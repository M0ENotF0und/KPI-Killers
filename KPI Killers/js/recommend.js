/* recommend.js - the scenario input form (screen 2).
   - Each user type sees its own device list and questions.
   - Choosing a course (student) or department (business) suggests a workload.
   - Validates as you type, then saves the scenario and opens the results page. */

const form = document.getElementById('scenario-form');
const budgetNum = document.getElementById('budget');
const budgetRange = document.getElementById('budget-range');
const budgetOut = document.getElementById('budget-readout');
const workloadSel = document.getElementById('workload');
const suggestion = document.getElementById('suggestion');
let workloadTouched = false;      // true once the person picks a workload themselves

/* what each user type sees under "Device" */
const ROLE_HINTS = {
  student:  'Laptops for coursework, tablets for note-taking, and add-ons that make studying easier.',
  business: 'Desktops, monitors and office hardware for a team or department. Laptops are here too.',
  consumer: 'Phones, home PCs and everyday gear for home, work-from-home or fun.'
};
const ALL_CATS = Array.from(document.querySelectorAll('#category option')).map(o => ({
  value: o.value, label: o.textContent, roles: o.dataset.role.split(' ')
}));

function buildCategories(){
  const role = form.elements.role.value;
  const sel = form.elements.category;
  const previous = sel.value;
  const allowed = ALL_CATS.filter(c => c.roles.includes(role));
  sel.innerHTML = allowed.map(c => '<option value="' + c.value + '">' + c.label + '</option>').join('');
  if(allowed.some(c => c.value === previous)) sel.value = previous;
  document.getElementById('role-hint').textContent = ROLE_HINTS[role];
}

/* brand chips come from the API (or the sample catalogue), for the chosen device */
async function buildBrands(){
  const box = document.getElementById('brand-chips');
  const keep = new Set(Array.from(box.querySelectorAll('input:checked')).map(i => i.value));
  try{
    const data = await apiGetBrands(form.elements.category.value);
    box.innerHTML = data.brands.map(b =>
      '<label class="chip"><input type="checkbox" name="brand" value="' + esc(b.name) + '"' + (keep.has(b.name) ? ' checked' : '') + '><span>' + esc(b.name) + '</span></label>').join('');
  }catch(err){
    box.innerHTML = '<span class="note">Brands could not be loaded.</span>';
  }
}

/* fill the course and department lists from the profiles in data.js */
function fillList(select, profiles, placeholder){
  select.innerHTML = '<option value="">' + placeholder + '</option>' +
    Object.keys(profiles).map(k => '<option value="' + esc(k) + '">' + esc(k) + '</option>').join('');
}
fillList(document.getElementById('course'), COURSE_PROFILES, 'Select your course');
fillList(document.getElementById('department'), DEPT_PROFILES, 'Select department');
fillList(document.getElementById('usecase'), CONSUMER_PROFILES, 'What will you mostly use it for?');

/* ---- show/hide fields depending on user type and device ---- */
function refresh(){
  const role = form.elements.role.value;
  const cat = form.elements.category.value;

  // 1. hide anything that does not match the role or device
  form.querySelectorAll('[data-role], [data-cat]').forEach(el => {
    const roleOk = !el.dataset.role || el.dataset.role.split(' ').includes(role);
    const catOk  = !el.dataset.cat  || el.dataset.cat.split(' ').includes(cat);
    el.hidden = !(roleOk && catOk);
  });
  // 2. hide a whole fieldset when nothing inside it applies
  form.querySelectorAll('fieldset[data-auto]').forEach(fs => {
    fs.hidden = !fs.querySelector('[data-cat]:not([hidden])');
  });
  // 3. hidden fields are switched off, so they are not required and not sent
  form.querySelectorAll('input, select').forEach(f => {
    if(f.closest('[hidden]')) f.disabled = true;
    else if(f.type !== 'range') f.disabled = false;
  });
  budgetRange.disabled = false;
  // 4. if the chosen OS/storage chip was hidden, fall back to Any
  ['os', 'storage'].forEach(name => {
    const checked = form.querySelector('input[name="' + name + '"]:checked');
    if(!checked || checked.disabled){
      const any = form.querySelector('input[name="' + name + '"][value="any"], input[name="' + name + '"][value="0"]');
      if(any) any.checked = true;
    }
  });
  showSuggestion();
  buildBrands();
}

/* ---- course / department suggestion ---- */
function currentProfile(){
  const s = { role: form.elements.role.value, course: form.elements.course.value, department: form.elements.department.value, usecase: form.elements.usecase.value };
  return profileFor(s);
}
function showSuggestion(){
  const p = currentProfile();
  if(!p){ suggestion.textContent = ''; return; }
  const os = p.osLikes.length ? ' Often a good fit: ' + p.osLikes.join(' or ') + '.' : '';
  const br = p.brands && p.brands.length ? ' Brands worth a look: ' + p.brands.join(', ') + '.' : '';
  suggestion.textContent = 'Suggestion: ' + p.workload + ' workload. ' + p.note + os + br;
  if(!workloadTouched && !workloadSel.disabled){
    workloadSel.value = p.workload;
    validateField(workloadSel);
  }
}
workloadSel.addEventListener('change', () => { workloadTouched = true; });
form.elements.course.addEventListener('change', showSuggestion);
form.elements.department.addEventListener('change', showSuggestion);
form.elements.usecase.addEventListener('change', showSuggestion);

form.querySelectorAll('input[name="role"]').forEach(r => r.addEventListener('change', () => { buildCategories(); refresh(); }));
form.elements.category.addEventListener('change', refresh);

/* pick the user type from the link (recommend.html?role=business) or from the logged-in account */
const roleFromUrl = new URLSearchParams(location.search).get('role');
const startRole = roleFromUrl || (session && session.role !== 'admin' ? session.role : null);
if(startRole){
  const radio = form.querySelector('input[name="role"][value="' + startRole + '"]');
  if(radio) radio.checked = true;
}

/* ---- budget slider and number box stay in sync ---- */
function showBudget(){ budgetOut.textContent = kes(Number(budgetNum.value) || 0); }
budgetRange.addEventListener('input', () => { budgetNum.value = budgetRange.value; showBudget(); validateField(budgetNum); });
budgetNum.addEventListener('input', () => { budgetRange.value = budgetNum.value; showBudget(); });

/* ---- validation (checks as you type) ---- */
function validateField(el){
  if(el.disabled) return true;
  const msg = form.querySelector('[data-for="' + el.id + '"]');
  let text = '';
  if(el.required && !el.value.trim()) text = 'This field is required.';
  else if(el.id === 'budget' && Number(el.value) <= 0) text = 'Budget must be above 0.';
  else if(el.id === 'units' && Number(el.value) < 1) text = 'Enter at least 1 unit.';
  if(msg) msg.textContent = text;
  el.classList.toggle('invalid', text !== '');
  return text === '';
}
form.querySelectorAll('input[type="number"], select').forEach(el => {
  el.addEventListener('input', () => validateField(el));
  el.addEventListener('change', () => validateField(el));
  el.addEventListener('blur', () => validateField(el));
});

/* ---- submit ---- */
form.addEventListener('submit', e => {
  e.preventDefault();
  let firstBad = null;
  form.querySelectorAll('input[type="number"], select').forEach(el => {
    if(!validateField(el) && !firstBad) firstBad = el;
  });
  if(firstBad){ firstBad.focus(); return; }

  const d = new FormData(form);
  const scenario = {
    id: Date.now(),
    role: d.get('role'),
    category: d.get('category'),
    workload: d.get('workload') || '',
    course: d.get('course') || '',
    industry: d.get('industry') || '',
    department: d.get('department') || '',
    units: Number(d.get('units')) || 1,
    budget: Number(d.get('budget')),
    os: d.get('os') || 'any',
    storage: Number(d.get('storage')) || 0,
    ergo: d.getAll('ergo'),
    usecase: d.get('usecase') || '',
    brands: d.getAll('brand'),
    bundle: d.get('bundle') === 'on',
    created: new Date().toLocaleDateString('en-KE')
  };
  save('itr_current', scenario);
  location.href = 'results.html';
});

buildCategories();
refresh();
showBudget();
