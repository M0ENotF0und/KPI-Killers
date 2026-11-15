/* lists.js - My scenarios (with saved bundles) and Wishlist pages. Reads and writes through api.js. */

const scenarioList = document.getElementById('scenario-list');
const bundleList = document.getElementById('bundle-list');
const wishList = document.getElementById('wish-list');

if(scenarioList){
  async function drawScenarios(){
    const list = await listScenarios();
    document.getElementById('scenarios-empty').hidden = list.length > 0;
    scenarioList.innerHTML = list.map(s => `
      <li>
        <span><strong>${esc(CATEGORY_LABELS[s.category] || s.category)}</strong> for ${esc((ROLE_LABELS[s.role] || s.role).toLowerCase())}${s.workload ? ' · ' + esc(s.workload) : ''} · ${kes(s.budget)}<br>
        <small class="note">Saved ${esc(s.created)}</small></span>
        <span class="row-actions">
          <button class="btn-small" data-run="${s.id}">View results</button>
          <button class="btn-outline btn-small" data-del="${s.id}">Delete</button>
        </span>
      </li>`).join('');
  }
  async function drawBundles(){
    const list = await listBundles();
    document.getElementById('bundles-empty').hidden = list.length > 0;
    bundleList.innerHTML = list.map(x => {
      const b = x.bundle, names = b.parts.map(p => p.item.name);
      return `<li>
        <span><strong>${esc(names[0])}</strong>${names.length > 1 ? ' + ' + (names.length - 1) + ' accessories' : ''} · ${kes(b.total)}<br>
        <small class="note">${esc(b.title)}: ${esc(names.join(', '))} · saved ${esc(x.saved)}</small></span>
        <button class="btn-outline btn-small" data-delbundle="${x.id}">Delete</button></li>`;
    }).join('');
  }
  document.addEventListener('click', async e => {
    const run = e.target.closest('[data-run]');
    const del = e.target.closest('[data-del]');
    const delB = e.target.closest('[data-delbundle]');
    if(run){
      const s = (await listScenarios()).find(x => String(x.id) === run.dataset.run);
      if(s){ save('itr_current', s); location.href = 'results.html'; }
    }
    if(del){ await deleteScenario(Number(del.dataset.del)); drawScenarios(); }
    if(delB){ await deleteBundle(Number(delB.dataset.delbundle)); drawBundles(); }
  });
  drawScenarios();
  drawBundles();
}

if(wishList){
  async function drawWishlist(){
    const items = await listWishlistProducts();
    document.getElementById('wish-empty').hidden = items.length > 0;
    wishList.innerHTML = items.map(p => `
      <li>
        <span><strong>${esc(p.name)}</strong> <small class="note">${esc(CATEGORY_LABELS[p.category] || p.category)}</small><br>
        <small class="note">Local ${kes(p.local)} · Dubai landed ${kes(p.landed.total)}</small></span>
        <button class="btn-outline btn-small" data-remove="${p.id}">Remove</button>
      </li>`).join('');
  }
  wishList.addEventListener('click', async e => {
    const rm = e.target.closest('[data-remove]');
    if(!rm) return;
    await toggleWishlist(Number(rm.dataset.remove));
    drawWishlist();
  });
  drawWishlist();
}
