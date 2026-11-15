/* api.js - the ONLY file that talks to the backend (see docs/API.md for the shapes).
   Set USE_BACKEND = true and API_BASE to the server address, and the whole site switches
   from the built-in sample data to the real endpoints. Pages never call fetch() themselves.

   Security notes for the real API:
   - Log in with an HTTP-only, Secure, SameSite session cookie. Never keep tokens in localStorage.
   - Every request sends the cookie (credentials:'include'); writes also send an X-CSRF-Token header.
   - The server decides who the user is from the session. Scenarios, bundles, wishlist and history are
     always looked up for that user, never for an id sent by the browser.
   - The server validates every field again. The front end escapes all text it prints (esc()). */

const USE_BACKEND = false;     // true when the backend is ready
const API_BASE = '';           // e.g. 'https://api.techmatch.example'  ('' = same site)

function csrfToken(){
  const m = document.querySelector('meta[name="csrf-token"]');
  return m ? m.content : '';
}
async function apiRequest(method, path, body){
  const res = await fetch(API_BASE + path, {
    method,
    credentials: 'include',
    headers: Object.assign({ 'Accept': 'application/json' },
                           body ? { 'Content-Type': 'application/json' } : {},
                           method !== 'GET' ? { 'X-CSRF-Token': csrfToken() } : {}),
    body: body ? JSON.stringify(body) : undefined
  });
  if(!res.ok) throw new Error('API ' + method + ' ' + path + ' failed (' + res.status + ')');
  return res.status === 204 ? null : res.json();
}

/* ======================= catalogue and recommendations ======================= */

/* GET /api/brands?category=laptop  ->  { brands: [ { name, count } ] } */
async function apiGetBrands(category){
  if(USE_BACKEND) return apiRequest('GET', '/api/brands' + (category ? '?category=' + encodeURIComponent(category) : ''));
  const counts = {};
  getCatalog().filter(i => !category || i.category === category).forEach(i => { counts[i.brand] = (counts[i.brand] || 0) + 1; });
  return { brands: Object.keys(counts).sort().map(name => ({ name, count: counts[name] })) };
}

/* GET /api/products?category&brand&q&type&minPrice&maxPrice&sort  ->  { items: [Product], total } */
async function apiGetProducts(f = {}){
  if(USE_BACKEND){
    const qs = Object.keys(f).filter(k => f[k] !== '' && f[k] != null).map(k => k + '=' + encodeURIComponent(f[k])).join('&');
    return apiRequest('GET', '/api/products' + (qs ? '?' + qs : ''));
  }
  const brands = f.brand ? String(f.brand).split(',') : [];
  const q = (f.q || '').toLowerCase();
  let items = getCatalog().map(toProduct).filter(p => {
    const cheapest = Math.min(p.local, p.landed.total);
    return (!f.category || p.category === f.category) && (!brands.length || brands.includes(p.brand)) &&
           (!f.type || p.type === f.type) && (!q || (p.brand + ' ' + p.model + ' ' + p.description).toLowerCase().includes(q)) &&
           (!f.minPrice || cheapest >= Number(f.minPrice)) && (!f.maxPrice || cheapest <= Number(f.maxPrice));
  });
  const cheapest = p => Math.min(p.local, p.landed.total);
  if(f.sort === 'price-asc') items.sort((a, b) => cheapest(a) - cheapest(b));
  else if(f.sort === 'price-desc') items.sort((a, b) => cheapest(b) - cheapest(a));
  else items.sort((a, b) => a.brand.localeCompare(b.brand) || a.model.localeCompare(b.model));
  return { items, total: items.length };
}

/* POST /api/recommendations  ->  { picks: [Pick], bundle: Bundle|null }.
   If the backend cannot be reached, the sample engine answers instead and source says so. */
async function apiRecommend(scenario){
  if(USE_BACKEND){
    try{ return Object.assign({ source: 'api' }, await apiRequest('POST', '/api/recommendations', scenario)); }
    catch(e){ console.warn(e); }
  }
  return Object.assign({ source: 'sample' }, recommend(scenario));
}

/* ======================= saved data (per signed-in user) ======================= */

async function listScenarios(){
  return USE_BACKEND ? (await apiRequest('GET', '/api/scenarios')).scenarios : load('itr_scenarios', []);
}
async function saveScenario(s){
  if(USE_BACKEND) return apiRequest('POST', '/api/scenarios', s);
  const list = load('itr_scenarios', []);
  if(!list.some(x => x.id === s.id)) list.unshift(s);
  save('itr_scenarios', list);
}
async function deleteScenario(id){
  if(USE_BACKEND) return apiRequest('DELETE', '/api/scenarios/' + encodeURIComponent(id));
  save('itr_scenarios', load('itr_scenarios', []).filter(s => s.id !== id));
}

async function listBundles(){
  return USE_BACKEND ? (await apiRequest('GET', '/api/bundles')).bundles : load('itr_bundles', []);
}
async function saveBundle(bundle, scenarioId){
  if(USE_BACKEND) return apiRequest('POST', '/api/bundles', { scenarioId, bundle });
  const list = load('itr_bundles', []);
  list.unshift({ id: Date.now(), scenarioId, saved: new Date().toLocaleDateString('en-KE'), bundle });
  save('itr_bundles', list);
}
async function deleteBundle(id){
  if(USE_BACKEND) return apiRequest('DELETE', '/api/bundles/' + encodeURIComponent(id));
  save('itr_bundles', load('itr_bundles', []).filter(b => b.id !== id));
}

async function listWishlistIds(){
  return USE_BACKEND ? (await apiRequest('GET', '/api/wishlist')).productIds : load('itr_wishlist', []);
}
async function listWishlistProducts(){
  if(USE_BACKEND) return (await apiRequest('GET', '/api/wishlist')).products;
  const ids = load('itr_wishlist', []);
  return getCatalog().filter(i => ids.includes(i.id)).map(toProduct);
}
async function toggleWishlist(productId){
  const ids = await listWishlistIds();
  const has = ids.includes(productId);
  if(USE_BACKEND) await apiRequest(has ? 'DELETE' : 'POST', has ? '/api/wishlist/' + productId : '/api/wishlist', has ? null : { productId });
  else save('itr_wishlist', has ? ids.filter(x => x !== productId) : ids.concat(productId));
  return !has;
}
