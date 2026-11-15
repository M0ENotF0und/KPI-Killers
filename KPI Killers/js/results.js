/* results.js - TechMatch results: filters, product cards, product detail, bundle and cost comparison.
   Data comes from apiRecommend() in api.js (the real API or the sample engine).
   Cards are drawn by productCardHTML() in render.js so they match the Browse page. */

const scenario = load('itr_current', null);
const filters = { brands: [], ram: 0, gpu: false, sort: 'match' };
let picks = [], topBundle = null, shown = [], selected = 0, wishIds = [];

const $ = id => document.getElementById(id);

/* the bundle for a pick: its own, or the top-level one for the first pick, or just the device itself */
function bundleFor(p){
  if(p.bundle) return p.bundle;
  if(p._i === 0 && topBundle) return topBundle;
  return { title: 'This device on its own', parts: [{ item: p.item, price: p.cheapest, route: p.local <= p.dubai.total ? 'Local' : 'Dubai' }],
           total: p.cheapest, budget: scenario.budget, leftover: scenario.budget - p.cheapest, units: 1, software: [], single: true };
}
function totalsOf(b){
  return {
    local: b.parts.reduce((t, x) => t + x.item.local, 0),
    dubai: b.parts.reduce((t, x) => t + x.item.landed.total, 0),
    best:  b.parts.reduce((t, x) => t + x.price, 0)
  };
}

(async function init(){
  if(!scenario){ $('results-empty').hidden = false; return; }
  $('results-area').hidden = false;

  const detailText = scenario.course || scenario.department || scenario.usecase;
  $('summary').textContent = (CATEGORY_LABELS[scenario.category] || scenario.category) + ' for ' + ROLE_LABELS[scenario.role].toLowerCase() +
    (detailText ? ' (' + detailText + ')' : '') + (scenario.workload ? ', ' + scenario.workload + ' workload' : '') +
    ', budget ' + kes(scenario.budget) + (scenario.units > 1 ? ' per unit (' + scenario.units + ' units)' : '') +
    (scenario.brands && scenario.brands.length ? ', preferred brands: ' + scenario.brands.join(', ') : '') + '.';

  const res = await apiRecommend(scenario);
  picks = res.picks || [];
  picks.forEach((p, i) => { p._i = i; });
  topBundle = res.bundle || null;
  $('source-note').hidden = res.source !== 'sample';
  wishIds = await listWishlistIds();

  if(!picks.length){ $('no-match').hidden = false; return; }
  $('results-body').hidden = false;
  buildFilters();
  apply();
})();

/* ---------------- filters ---------------- */
function buildFilters(){
  const brands = Array.from(new Set(picks.map(p => p.item.brand))).sort();
  $('f-brands').innerHTML = brands.map(b => '<label class="chip"><input type="checkbox" value="' + esc(b) + '"><span>' + esc(b) + '</span></label>').join('');
  $('f-brands-wrap').hidden = brands.length < 2;
  $('f-ram-wrap').hidden = !picks.some(p => p.item.ramGB);
  $('f-gpu-wrap').hidden = !picks.some(p => p.item.dgpu);
  const sorts = [['match', 'Best match'], ['price', 'Lowest price']];
  if(picks.some(p => p.item.ramGB)) sorts.push(['memory', 'Most memory']);
  if(picks.some(p => p.item.batteryWh)) sorts.push(['battery', 'Biggest battery (Wh)']);
  $('f-sort').innerHTML = sorts.map(s => '<option value="' + s[0] + '">' + s[1] + '</option>').join('');

  $('f-brands').addEventListener('change', () => { filters.brands = Array.from($('f-brands').querySelectorAll('input:checked')).map(i => i.value); apply(); });
  $('f-ram').addEventListener('change', e => { filters.ram = Number(e.target.value); apply(); });
  $('f-gpu').addEventListener('change', e => { filters.gpu = e.target.checked; apply(); });
  $('f-sort').addEventListener('change', e => { filters.sort = e.target.value; apply(); });
}

function apply(){
  shown = picks.filter(p =>
    (!filters.brands.length || filters.brands.includes(p.item.brand)) &&
    (!filters.ram || p.item.ramGB >= filters.ram) &&
    (!filters.gpu || p.item.dgpu));
  shown.sort({
    match:   (a, b) => a._i - b._i,
    price:   (a, b) => a.cheapest - b.cheapest,
    memory:  (a, b) => b.item.ramGB - a.item.ramGB,
    battery: (a, b) => b.item.batteryWh - a.item.batteryWh
  }[filters.sort]);
  selected = 0;
  $('count').textContent = 'Showing ' + shown.length + ' of ' + picks.length + ' matches.';
  render();
}

/* ---------------- drawing ---------------- */
function render(){
  if(!shown.length){
    $('cards').innerHTML = '<div class="empty"><p>No matches with these filters. Clear a filter to see more.</p></div>';
    $('detail').innerHTML = ''; $('bars').innerHTML = ''; $('bar-labels').innerHTML = '';
    return;
  }
  $('cards').innerHTML = shown.map((p, i) => productCardHTML(p, { selected: i === selected, compare: true, index: i, saved: wishIds.includes(p.item.id) })).join('');
  renderDetail(shown[selected]);
  renderChart();
}

function renderDetail(p){
  const it = p.item, d = p.dubai, b = bundleFor(p), t = totalsOf(b);
  const diff = p.local - d.total;
  const saving = diff > 0 ? 'Importing from Dubai saves about ' + kes(diff) + ' (' + (diff / p.local * 100).toFixed(0) + '%).'
               : diff < 0 ? 'Buying locally is cheaper by about ' + kes(-diff) + ' (' + (-diff / p.local * 100).toFixed(0) + '%).'
               : 'Both routes cost about the same.';

  const rows = b.parts.map((x, i) => '<tr><th scope="row">' + (i === 0 ? 'Main device' : esc(CATEGORY_LABELS[x.item.category] || x.item.category)) +
    '<br><small class="note">' + esc(x.item.name) + '</small></th>' +
    '<td class="num">' + kes(x.item.local) + '</td><td class="num">' + kes(x.item.landed.total) + '</td><td class="num">' + esc(x.route) + '</td></tr>').join('');

  const extras = b.parts.slice(1).map(x => '<div class="companion">' +
    '<p class="brand-line">' + esc(CATEGORY_LABELS[x.item.category] || x.item.category) + ' · ' + esc(x.item.brand) + '</p>' +
    '<h4>' + esc(x.item.model) + '</h4>' +
    '<dl class="specs">' + specRows(x.item, Object.keys(x.item.specs || {}).slice(0, 3)) + '</dl>' +
    '<p>' + esc(x.item.description || '') + '</p>' +
    (x.why ? '<p class="good">' + esc(x.why) + '</p>' : '') +
    '<p><strong>' + kes(x.price) + '</strong> <small class="note">(' + esc(x.route.toLowerCase()) + ' is cheaper)</small></p></div>').join('');

  const bundleSaving = t.local - t.best;
  $('detail').innerHTML =
    '<div class="detail-head"><div>' +
      '<p class="brand-line">' + esc(it.brand) + ' · ' + esc(CATEGORY_LABELS[it.category] || it.category) + (it.type ? ' · ' + esc(TYPE_LABELS[it.type] || it.type) : '') + '</p>' +
      '<h2>' + esc(it.model) + '</h2><p>' + esc(it.description || '') + '</p></div>' +
      '<div class="actions" style="margin:0"><button data-savebundle="1">' + (b.single ? 'Save this pick' : 'Save bundle') + '</button></div></div>' +

    '<div class="detail-grid"><div><h3>Full specifications</h3><dl class="specs">' + specRows(it) + '</dl>' +
      (it.useCases && it.useCases.length ? '<p class="note" style="margin-top:0.75rem">Good for: ' + it.useCases.map(esc).join(', ') + '</p>' : '') + '</div>' +
    '<div><h3>Why it fits you</h3><ul class="why">' + (p.why || []).map(w => '<li>' + esc(w) + '</li>').join('') + '</ul>' +
      (p.compare ? '<p class="compare">' + esc(p.compare) + '</p>' : '') +
      '<h3>Local vs Dubai</h3>' +
      '<div class="table-scroll"><table><thead><tr><th scope="col">Cost</th><th scope="col" class="num">Local</th><th scope="col" class="num">Dubai</th></tr></thead><tbody>' +
      '<tr><th scope="row">Price</th><td class="num">' + kes(p.local) + '</td><td class="num">' + kes(d.price) + '</td></tr>' +
      '<tr><th scope="row">Freight</th><td class="num">-</td><td class="num">' + kes(d.freight) + '</td></tr>' +
      '<tr><th scope="row">Duty</th><td class="num">-</td><td class="num">' + kes(d.duty) + '</td></tr>' +
      '<tr><th scope="row">VAT</th><td class="num">included</td><td class="num">' + kes(d.vat) + '</td></tr></tbody>' +
      '<tfoot><tr><th scope="row">Total</th><td class="num">' + kes(p.local) + '</td><td class="num">' + kes(d.total) + '</td></tr></tfoot></table></div>' +
      '<p class="saving">' + esc(saving) + '</p></div></div>' +

    (extras ? '<h3>' + esc(b.title) + ': bundle it with</h3><div class="companions">' + extras + '</div>' : '') +
    (b.software && b.software.length ? '<h3>Software to plan for</h3><ul class="sw-tags">' + b.software.map(s => '<li>' + esc(s) + '</li>').join('') + '</ul><p class="note">Many have free or student licences. Check with your institution or employer first.</p>' : '') +

    '<h3>' + (b.single ? 'Cost' : 'Bundle cost') + '</h3><div class="table-scroll"><table><thead><tr><th scope="col">Item</th><th scope="col" class="num">Local</th><th scope="col" class="num">Dubai landed</th><th scope="col" class="num">Cheaper</th></tr></thead>' +
      '<tbody>' + rows + '</tbody><tfoot>' +
      '<tr><th scope="row">Everything as listed</th><td class="num">' + kes(t.local) + '</td><td class="num">' + kes(t.dubai) + '</td><td class="num"></td></tr>' +
      '<tr><th scope="row">Best mix (cheaper route per item)</th><td class="num" colspan="3">' + kes(t.best) + '</td></tr></tfoot></table></div>' +
    '<p class="saving">' + (bundleSaving > 500 ? 'Picking the cheaper route for each item saves ' + kes(bundleSaving) + ' compared with buying everything locally. ' : 'Buying everything locally is already the cheapest way. ') +
      (b.single ? '' : 'That leaves ' + kes(Math.max(0, b.leftover)) + ' of your budget. ') +
      (b.units > 1 ? 'For ' + b.units + ' units, the best mix comes to ' + kes(t.best * b.units) + '.' : '') + '</p>' +
    '<p class="note">Landed cost is an estimate. It leaves out warranty differences and customs clearing fees. Specifications can vary by configuration, so confirm them before you buy.</p>';
}

function renderChart(){
  const tot = shown.map(p => totalsOf(bundleFor(p)));
  const max = Math.max.apply(null, tot.map(t => Math.max(t.local, t.dubai)));
  $('bars').innerHTML = tot.map(t => '<div class="bar-pair">' +
    '<div class="bar local" style="height:' + (t.local / max * 100) + '%" title="Local ' + kes(t.local) + '"></div>' +
    '<div class="bar dubai" style="height:' + (t.dubai / max * 100) + '%" title="Dubai landed ' + kes(t.dubai) + '"></div></div>').join('');
  $('bar-labels').innerHTML = shown.map(p => '<div class="bar-label">' + esc(p.item.model.split(' ').slice(0, 2).join(' ')) + '</div>').join('');
}

/* ---------------- clicks ---------------- */
document.addEventListener('click', async e => {
  const compare = e.target.closest('[data-compare]');
  const saveBtn = e.target.closest('#cards [data-save]');
  const bundleBtn = e.target.closest('[data-savebundle]');
  const msg = $('save-message');
  try{
    if(compare){ selected = Number(compare.dataset.compare); render(); $('detail').scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    if(saveBtn){ await toggleWishlist(Number(saveBtn.dataset.save)); wishIds = await listWishlistIds(); render(); }
    if(bundleBtn){
      await saveBundle(bundleFor(shown[selected]), scenario.id);
      msg.textContent = 'Saved. Find it under My scenarios.'; msg.classList.add('ok');
    }
  }catch(err){ msg.textContent = 'Could not save right now. Please try again.'; msg.classList.remove('ok'); console.warn(err); }
});

$('export-pdf').addEventListener('click', () => window.print());   // choose "Save as PDF" in the print dialog

$('save-scenario').addEventListener('click', async () => {
  const msg = $('save-message');
  try{
    await saveScenario(scenario);
    msg.textContent = 'Scenario saved. Find it under My scenarios.'; msg.classList.add('ok');
  }catch(err){ msg.textContent = 'Could not save right now. Please try again.'; msg.classList.remove('ok'); console.warn(err); }
});
