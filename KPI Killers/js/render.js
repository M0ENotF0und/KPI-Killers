/* render.js - turns a product into HTML. Shared by the Results page and the Browse page,
   so every product looks and reads the same everywhere. */

/* plain-language help for each spec, shown as a tooltip and in the glossary */
const SPEC_HELP = {
  'Processor':  'The "brain" of the device. Newer and higher numbers (Core i7, Ryzen 7, M3) are faster than i3, Ryzen 3 or older chips.',
  'Memory':     'Memory (RAM) is how many things the device can handle at once. 8 GB is basic, 16 GB is comfortable, 32 GB is for heavy work. DDR5 is newer and faster than DDR4. "Soldered" means it cannot be upgraded later.',
  'Graphics':   'The chip that draws what you see. "Built in" is fine for everyday work. A dedicated NVIDIA or AMD chip (like RTX 4060) is needed for CAD, 3D, video editing and gaming.',
  'Storage':    'Where your files live. An SSD is much faster than an old hard disk. NVMe is the fastest kind of SSD. 512 GB is plenty for most people.',
  'Display':    'The screen size and sharpness. Higher "Hz" (like 144 Hz) means smoother motion. OLED screens have deeper colours.',
  'Battery':    'How much energy the battery holds. Laptops use watt-hours (Wh): around 40 Wh is average and 70 Wh or more is excellent. Phones and tablets use mAh, shown with the Wh equivalent.',
  'Weight':     'Lighter laptops (under 1.5 kg) are easier to carry every day.',
  'Pen support':'Whether you can write on the screen with a stylus. Useful for handwritten notes.',
  'Main camera':'Higher megapixels (MP) do not always mean better photos, but they help with detail.',
  'Noise cancelling': 'Active (ANC) headphones use microphones to cancel background noise such as engines and chatter.',
  'Form':       'The shape of the computer: mini PC (tiny), tower (full size, easy to upgrade) or all-in-one (screen and PC together).'
};

/* which specs to show on the card itself (the rest are under "Full specs") */
const KEY_SPECS = {
  laptop: ['Memory', 'Battery', 'Graphics'],
  tablet: ['Memory', 'Battery', 'Pen support'],
  phone:  ['Memory', 'Battery', 'Storage'],
  desktop:['Processor', 'Memory', 'Graphics']
};

function perfLabel(item, band){
  if(COMPUTE.includes(item.category)) return ['', 'Entry level', 'Mid-range', 'High performance'][item.tier];
  return band || '';
}

function specRows(item, keys){
  const specs = item.specs || {};
  const list = (keys || Object.keys(specs)).filter(k => specs[k]);
  return list.map(k => '<dt title="' + esc(SPEC_HELP[k] || '') + '">' + esc(k) + '</dt><dd>' + esc(specs[k]) + '</dd>').join('');
}

/* r = { item, local, dubai:{total,...}, bestValue, band, brandMatch }
   o = { selected, compare (show the Compare button), saved } */
function productCardHTML(r, o = {}){
  const it = r.item;
  const keys = KEY_SPECS[it.category] || Object.keys(it.specs || {}).slice(0, 3);
  const typeLabel = TYPE_LABELS[it.type] || '';
  const tags = [perfLabel(it, r.band), typeLabel, r.brandMatch ? 'Your brand' : ''].filter(Boolean)
    .map((t, i) => '<span class="tag' + (t === 'Your brand' ? ' tag-hot' : '') + '">' + esc(t) + '</span>').join('');
  return `
    <article class="rec ${o.selected ? 'selected' : ''}">
      ${r.bestValue ? '<span class="badge">Best value</span>' : ''}
      <p class="brand-tag">${esc(it.brand)}</p>
      <h3>${esc(it.model)}</h3>
      <p class="tags">${tags}</p>
      <p class="desc">${esc(it.description || '')}</p>
      <dl class="specs">${specRows(it, keys)}</dl>
      ${it.useCases && it.useCases.length ? '<p class="meta">Good for: ' + it.useCases.map(esc).join(', ') + '</p>' : ''}
      <p class="price">Local: <strong>${kes(r.local)}</strong></p>
      <p class="price dubai">Dubai landed: <strong>${kes(r.dubai.total)}</strong></p>
      <details>
        <summary>Full specs</summary>
        <dl class="specs">${specRows(it)}</dl>
      </details>
      <div class="buttons">
        ${o.compare ? '<button class="btn-outline btn-small" data-compare="' + o.index + '">Compare cost</button>' : ''}
        <button class="btn-small" data-save="${it.id}">${o.saved ? 'Saved' : 'Save'}</button>
      </div>
    </article>`;
}

function glossaryHTML(){
  return '<summary>What do these specs mean?</summary><dl class="specs">' +
    Object.keys(SPEC_HELP).map(k => '<dt>' + esc(k) + '</dt><dd>' + esc(SPEC_HELP[k]) + '</dd>').join('') + '</dl>';
}
