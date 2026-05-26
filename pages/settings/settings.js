// Cyrix OMS v3.2 — Settings Page Controller
// Engineered by Senior Principal Software Engineer

document.addEventListener('DOMContentLoaded', async () => {
  'use strict';

  // --- AUTH CHECK ---
  const sessionToken = localStorage.getItem('oms_session_token');
  const savedUser = localStorage.getItem('oms_current_user');
  if (!sessionToken || !savedUser) {
    window.location.href = '../auth/login.html';
    return;
  }

  const user = JSON.parse(savedUser);
  document.getElementById('user-display-name').textContent = user.displayName;
  document.getElementById('user-initial').textContent = user.displayName[0];

  // --- DOM SELECTORS ---
  const el = {
    displayName: document.getElementById('set-display-name'),
    username: document.getElementById('set-username'),
    slaAttend: document.getElementById('set-sla-attend'),
    slaClose: document.getElementById('set-sla-close'),
    penaltyPeriod: document.getElementById('set-penalty-period'),
    password: document.getElementById('set-password'),
    confirmPassword: document.getElementById('set-confirm-password'),
    status: document.getElementById('settings-status'),
    form: document.getElementById('settings-form'),
    
    // DB settings
    dbMode: document.getElementById('set-db-mode'),
    apiUrl: document.getElementById('set-api-url'),
    dbApiSettings: document.getElementById('db-api-settings'),
    btnSaveConnection: document.getElementById('btn-save-connection')
  };

  setupListeners();
  await loadSettings();

  function setupListeners() {
    document.getElementById('btn-logout').addEventListener('click', () => {
      localStorage.removeItem('oms_session_token');
      localStorage.removeItem('oms_current_user');
      window.location.href = '../auth/login.html';
    });

    el.form.addEventListener('submit', handleSaveSettings);
    el.dbMode.addEventListener('change', handleDBModeToggle);
    el.btnSaveConnection.addEventListener('click', handleSaveConnection);
  }

  async function loadSettings() {
    const mode = window.APIService.mode;
    const url = window.APIService.apiUrl;
    
    el.dbMode.value = mode;
    el.apiUrl.value = url;
    
    if (mode === 'api') {
      el.dbApiSettings.classList.remove('hidden');
    } else {
      el.dbApiSettings.classList.add('hidden');
    }

    try {
      const data = await window.APIService.request('data');
      if (!data || !data.settings) return;

      const s = data.settings;
      el.displayName.value = s.displayName || '';
      el.username.value = s.username || '';
      el.slaAttend.value = s.sla_attend_hours || 24;
      el.slaClose.value = s.sla_close_hours || 72;
      el.penaltyPeriod.value = s.penalty_period_hours || 24;
    } catch (err) {
      console.error(err);
    }
  }

  function handleDBModeToggle(e) {
    if (e.target.value === 'api') {
      el.dbApiSettings.classList.remove('hidden');
    } else {
      el.dbApiSettings.classList.add('hidden');
    }
  }

  async function handleSaveSettings(event) {
    event.preventDefault();
    el.status.className = 'hidden';

    const displayName = el.displayName.value.trim();
    const username = el.username.value.trim();
    const slaAttend = parseInt(el.slaAttend.value);
    const slaClose = parseInt(el.slaClose.value);
    const penaltyPeriod = parseInt(el.penaltyPeriod.value);
    const pass = el.password.value;
    const confirm = el.confirmPassword.value;

    if (pass && pass !== confirm) {
      showStatus('Error: Credentials reset passwords do not match.', 'error');
      return;
    }

    try {
      // Save settings rows
      const data = await window.APIService.request('data');
      const settings = data.settings;

      settings.displayName = displayName;
      settings.username = username;
      settings.sla_attend_hours = slaAttend;
      settings.sla_close_hours = slaClose;
      settings.penalty_period_hours = penaltyPeriod;

      if (pass) {
        settings.passwordHash = await sha256(pass);
      }

      // Convert back to rows for storage
      const keys = Object.keys(settings);
      for (const k of keys) {
        await window.APIService.request(`settings/${k}`, 'PUT', { key: k, val: String(settings[k]) });
      }

      // Sync active session display
      user.displayName = displayName;
      user.username = username;
      localStorage.setItem('oms_current_user', JSON.stringify(user));
      document.getElementById('user-display-name').textContent = displayName;
      document.getElementById('user-initial').textContent = displayName[0];

      showStatus('Operations configurations saved successfully.', 'success');
    } catch (err) {
      console.error(err);
      showStatus('Failed to update configs. Connection profile offline.', 'error');
    }
  }

  function handleSaveConnection() {
    const mode = el.dbMode.value;
    const url = el.apiUrl.value.trim();

    window.APIService.setMode(mode, url);
    alert(`Database node connection established. Refreshing indices...`);
    window.location.reload();
  }

  function showStatus(msg, type) {
    el.status.textContent = msg;
    if (type === 'success') {
      el.status.className = 'p-3 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-xl text-sm block';
    } else {
      el.status.className = 'p-3 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-xl text-sm block';
    }
    setTimeout(() => { el.status.className = 'hidden'; }, 4000);
  }

  async function sha256(message) {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
});
