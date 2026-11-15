/* products.js - Browse page: search the catalogue by brand, model, type and price.
   Everything goes through api.js, so it works the same with the real backend. */

const filtersForm = document.getElementById('filters');
const grid = document.getElementById('product-grid');
const countEl = document.getElementById('count');
document.getElementById('glossary').innerHTML = glossaryHTML();

/* category list */
filtersForm.category.innerHTML = '<option value="">All devices</option>' +
  Object.keys(CATEGORY_LABELS).map(k => '<option value="' + k + '">' + CATEGORY_LABELS[k] + '</option>').join('');

async function loadBrands(){
  const keep = filtersForm.brand.value;
  const data = await apiGetBrands(filtersForm.category.value);
  filtersForm.brand.innerHTML = '<option value="">All brands</option>' +
    data.brands.map(b => '<option value="' + esc(b.name) + '">' + esc(b.name) + ' (' + b.count + ')</option>').join('');
  if(data.brands.some(b => b.name === keep)) filtersForm.brand.value = keep;
}

async function loadProducts(){
  const f = {
    category: filtersForm.category.value,
    brand: filtersForm.brand.value,
    q: filtersForm.q.value.trim(),
    maxPrice: filtersForm.maxPrice.value,
    sort: filtersForm.sort.value
  };
  try{
    const data = await apiGetProducts(f);
    const saved = load('itr_wishlist', []);
    countEl.textContent = data.total === 0 ? 'No products match. Try clearing a filter.' : data.total + ' product' + (data.total === 1 ? '' : 's') + ' found.';
    grid.innerHTML = data.items.map(p => productCardHTML(
      { item: p, local: p.local, dubai: p.landed }, { saved: saved.includes(p.id) })).join('');
  }catch(err){
    countEl.textContent = 'Could not load products. Check that the backend is running.';
    grid.innerHTML = '';
  }
}

filtersForm.category.addEventListener('change', async () => { await loadBrands(); loadProducts(); });
['brand', 'sort'].forEach(n => filtersForm[n].addEventListener('change', loadProducts));
['q', 'maxPrice'].forEach(n => filtersForm[n].addEventListener('input', loadProducts));
filtersForm.addEventListener('submit', e => e.preventDefault());

grid.addEventListener('click', e => {
  const btn = e.target.closest('[data-save]');
  if(!btn) return;
  const id = Number(btn.dataset.save);
  let list = load('itr_wishlist', []);
  list = list.includes(id) ? list.filter(x => x !== id) : [...list, id];
  save('itr_wishlist', list);
  btn.textContent = list.includes(id) ? 'Saved' : 'Save';
});

loadBrands().then(loadProducts);
