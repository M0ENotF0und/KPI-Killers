/* admin.js - admin console (screen 4): catalogue, rates, audit log.
   Only works when signed in as an admin. Every change is written to the audit log. */

const isAdmin = session && session.role === 'admin';
document.getElementById('admin-blocked').hidden = isAdmin;
document.getElementById('admin-area').hidden = !isAdmin;

if(isAdmin){
  let catalog = getCatalog();
  const tbody = document.getElementById('catalog-body');

  function saveCatalog(){ save(CATALOG_KEY, catalog); drawCatalog(); }

  function drawCatalog(){
    document.getElementById('stat-items').textContent = catalog.length;
    document.getElementById('stat-alerts').textContent = catalog.filter(i => i.stock < 5).length;
    tbody.innerHTML = catalog.map(i => `
      <tr>
        <td>${esc(i.name)}</td>
        <td>${esc(CATEGORY_LABELS[i.category] || i.category)}</td>
        <td class="num">${i.local.toLocaleString('en-KE')}</td>
        <td class="num">${i.stock}${i.stock < 5 ? ' (low)' : ''}</td>
        <td><button class="btn-outline btn-small" data-edit="${i.id}">Edit</button>
            <button class="btn-outline btn-small" data-delete="${i.id}">Delete</button></td>
      </tr>`).join('');
  }

  tbody.addEventListener('click', e => {
    const edit = e.target.closest('[data-edit]');
    const del = e.target.closest('[data-delete]');
    if(edit){
      const item = catalog.find(i => i.id === Number(edit.dataset.edit));
      const price = prompt('New local price (KES) for ' + item.name + ':', item.local);
      if(price === null) return;
      const n = Number(price);
      if(!(n > 0)) return alert('Enter a price above 0.');
      logAudit('Changed local price of "' + item.name + '" from ' + item.local + ' to ' + n);
      item.local = n;
      saveCatalog();
    }
    if(del){
      const item = catalog.find(i => i.id === Number(del.dataset.delete));
      if(!confirm('Delete "' + item.name + '"?')) return;
      catalog = catalog.filter(i => i.id !== item.id);
      logAudit('Deleted item "' + item.name + '"');
      saveCatalog();
    }
  });

  /* add item */
  const addForm = document.getElementById('add-form');
  document.getElementById('add-toggle').addEventListener('click', () => { addForm.hidden = !addForm.hidden; });
  addForm.addEventListener('submit', e => {
    e.preventDefault();
    const f = addForm;
    const item = {
      id: Date.now(), brand: f.brand.value.trim(), model: f.model.value.trim(), name: f.brand.value.trim() + ' ' + f.model.value.trim(),
      category: f.category.value, type: '', os: 'Any', storage: 0, tier: 1, tags: [], useCases: [], specs: {},
      description: f.description.value.trim(),
      local: Number(f.local.value), dubai: Number(f.dubai.value), kg: Number(f.kg.value) || 1, stock: Number(f.stock.value) || 0
    };
    catalog.push(item);
    logAudit('Added item "' + item.name + '"');
    f.reset();
    addForm.hidden = true;
    saveCatalog();
  });

  /* rates */
  const ratesForm = document.getElementById('rates-form');
  const rates = getRates();
  ratesForm.freight.value = rates.freightPerKg;
  ratesForm.duty.value = rates.dutyPct;
  ratesForm.vat.value = rates.vatPct;
  ratesForm.addEventListener('submit', e => {
    e.preventDefault();
    save('itr_rates', { freightPerKg: Number(ratesForm.freight.value), dutyPct: Number(ratesForm.duty.value), vatPct: Number(ratesForm.vat.value) });
    logAudit('Updated import rates');
    const m = document.getElementById('rates-message');
    m.textContent = 'Rates saved.';
    m.classList.add('ok');
    drawAudit();
  });

  /* audit log */
  function drawAudit(){
    const log = load('itr_audit', []);
    document.getElementById('audit-body').innerHTML = log.length
      ? log.map(l => `<tr><td>${esc(l.time)}</td><td>${esc(l.who)}</td><td>${esc(l.action)}</td></tr>`).join('')
      : '<tr><td colspan="3">No changes recorded yet.</td></tr>';
  }

  /* sidebar tabs */
  const tabs = document.querySelectorAll('.side button');
  tabs.forEach(btn => btn.addEventListener('click', () => {
    tabs.forEach(b => b.setAttribute('aria-selected', b === btn));
    document.querySelectorAll('[data-tab]').forEach(p => p.hidden = p.dataset.tab !== btn.dataset.target);
    if(btn.dataset.target === 'audit') drawAudit();
  }));

  drawCatalog();
}
