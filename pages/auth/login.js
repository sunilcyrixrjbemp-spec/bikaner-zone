// Cyrix OMS v3.2 — Auth Controller Script
// Engineered by Senior Principal Software Engineer

document.addEventListener('DOMContentLoaded', () => {
  'use strict';

  // --- STATE ---
  const state = {
    activeTab: 'login'
  };

  // --- DOM SELECTORS ---
  const el = {
    tabLogin: document.getElementById('tab-login'),
    tabRegister: document.getElementById('tab-register'),
    formLogin: document.getElementById('form-login'),
    formRegister: document.getElementById('form-register'),
    loginUsername: document.getElementById('login-username'),
    loginPass: document.getElementById('login-password'),
    errorBox: document.getElementById('login-error-container'),
    errorMsg: document.getElementById('login-error-msg'),
    regStatusBox: document.getElementById('reg-status-container')
  };

  // --- INITIAL CHECK ---
  checkActiveSession();
  setupEventListeners();

  function checkActiveSession() {
    const sessionToken = localStorage.getItem('oms_session_token');
    const savedUser = localStorage.getItem('oms_current_user');
    
    if (sessionToken && savedUser) {
      window.location.href = '../dashboard/dashboard.html';
    }
  }

  function setupEventListeners() {
    el.tabLogin.addEventListener('click', () => switchTab('login'));
    el.tabRegister.addEventListener('click', () => switchTab('register'));
    el.formLogin.addEventListener('submit', handleLogin);
    el.formRegister.addEventListener('submit', handleRegistrationRequest);
  }

  function switchTab(tabName) {
    state.activeTab = tabName;
    if (tabName === 'login') {
      el.tabLogin.className = 'flex-1 pb-3 text-center border-b-2 border-blue-500 text-blue-500 font-semibold transition duration-200';
      el.tabRegister.className = 'flex-1 pb-3 text-center border-b-2 border-transparent text-slate-400 font-medium hover:text-white transition duration-200';
      el.formLogin.classList.remove('hidden');
      el.formRegister.classList.add('hidden');
    } else {
      el.tabRegister.className = 'flex-1 pb-3 text-center border-b-2 border-blue-500 text-blue-500 font-semibold transition duration-200';
      el.tabLogin.className = 'flex-1 pb-3 text-center border-b-2 border-transparent text-slate-400 font-medium hover:text-white transition duration-200';
      el.formRegister.classList.remove('hidden');
      el.formLogin.classList.add('hidden');
    }
    el.errorBox.classList.add('hidden');
    el.regStatusBox.classList.add('hidden');
  }

  async function handleLogin(event) {
    event.preventDefault();
    el.errorBox.classList.add('hidden');

    const username = el.loginUsername.value.trim();
    const passwordRaw = el.loginPass.value;

    try {
      // Load configurations from API layer (which resolves to IndexedDB locally)
      const data = await window.APIService.request('data');
      if (!data || !data.settings) {
        throw new Error('Database registry indices unreadable.');
      }

      const settings = data.settings;
      const hashed = await sha256(passwordRaw);

      if (username.toLowerCase() === settings.username.toLowerCase() && hashed === settings.passwordHash) {
        // Authenticated! Establish session tokens
        localStorage.setItem('oms_session_token', `token_${Date.now()}`);
        localStorage.setItem('oms_current_user', JSON.stringify({
          username: settings.username,
          displayName: settings.displayName
        }));
        
        // Redirect to Dashboard
        window.location.href = '../dashboard/dashboard.html';
      } else {
        showError('Invalid credential parameters or security lock active.');
      }
    } catch (err) {
      console.error(err);
      showError('Authentication service failure. Verify connection node.');
    }
  }

  function handleRegistrationRequest(event) {
    event.preventDefault();
    el.regStatusBox.classList.add('hidden');
    
    // Simulate lodging registration
    setTimeout(() => {
      el.regStatusBox.classList.remove('hidden');
      el.formRegister.reset();
    }, 600);
  }

  function showError(msg) {
    el.errorMsg.textContent = msg;
    el.errorBox.classList.remove('hidden');
  }

  // --- CRYPTO UTILITIES ---
  async function sha256(message) {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
});
