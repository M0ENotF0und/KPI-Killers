/* auth.js - DEMO login/register, front-end only.
   No passwords are stored. Real authentication (and RBAC) will happen on the server. */

const DEMO_ADMIN = 'admin@techmatch.app';
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');

function showMsg(id, text, ok){
  const el = document.getElementById(id);
  el.textContent = text;
  el.classList.toggle('ok', !!ok);
}

if(loginForm){
  loginForm.addEventListener('submit', e => {
    e.preventDefault();
    const email = loginForm.email.value.trim().toLowerCase();
    const password = loginForm.password.value;
    const users = load('itr_users', {});
    let user = users[email];

    if(email === DEMO_ADMIN) user = { name: 'Admin', role: 'admin' };
    if(!user) return showMsg('login-message', 'No account found for that email. Create one first.');
    if(password.length < 6) return showMsg('login-message', 'Password must be at least 6 characters.');

    save('itr_session', { email, name: user.name, role: user.role });
    location.href = user.role === 'admin' ? 'admin.html' : 'recommend.html?role=' + user.role;
  });
}

if(registerForm){
  registerForm.addEventListener('submit', e => {
    e.preventDefault();
    const f = registerForm;
    const email = f.email.value.trim().toLowerCase();
    if(f.password.value.length < 6) return showMsg('register-message', 'Password must be at least 6 characters.');
    if(f.password.value !== f.confirm.value) return showMsg('register-message', 'Passwords do not match.');
    if(email === DEMO_ADMIN) return showMsg('register-message', 'That email is reserved.');

    const users = load('itr_users', {});
    if(users[email]) return showMsg('register-message', 'An account with that email already exists. Log in instead.');

    users[email] = { name: f.name.value.trim(), role: f.role.value };
    save('itr_users', users);
    save('itr_session', { email, name: users[email].name, role: users[email].role });
    location.href = 'recommend.html?role=' + users[email].role;
  });
}
