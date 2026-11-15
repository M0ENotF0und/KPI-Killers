/* main.js - runs on every page: highlights the current nav link and
   switches Login/Logout and the Admin link depending on who is signed in. */

const session = load('itr_session', null);

// 1. highlight the current page in the nav
const here = location.pathname.split('/').pop() || 'index.html';
document.querySelectorAll('nav a[href]').forEach(a => {
  if(a.getAttribute('href') === here) a.setAttribute('aria-current', 'page');
});

// 2. show the Admin link only for admins
const adminLink = document.getElementById('admin-link');
if(adminLink && session && session.role === 'admin') adminLink.hidden = false;

// 3. Login <-> Logout
const authLink = document.getElementById('auth-link');
if(authLink && session){
  authLink.textContent = 'Logout';
  authLink.setAttribute('href', '#');
  authLink.addEventListener('click', e => {
    e.preventDefault();
    localStorage.removeItem('itr_session');
    location.href = 'index.html';
  });
}
