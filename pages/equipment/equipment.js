// Cyrix OMS v3.2 — Equipment Controller
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

  // --- STATE ---
  const state = {
    searchQuery: '',
    equipment: []
  };

  // --- DOM SELECTORS ---
  const el = {
    tbl: document.getElementById('tbl-equipment'),
    filterSearch: document.getElementById('filter-search'),
    modalAdd: document.getElementById('modal-add'),
    addForm: document.getElementById('add-form'),
    addName: document.getElementById('add-name'),
    addModel: document.getElementById('add-model'),
    addValue: document.getElementById('add-value'),
    addHosp: document.getElementById('add-hosp'),
    addWarranty: document.getElementById('add-warranty'),
    btnScan: document.getElementById('btn-scan')
  };

  setupListeners();
  await refreshEquipment();

  function setupListeners() {
    document.getElementById('btn-logout').addEventListener('click', () => {
      localStorage.removeItem('oms_session_token');
      localStorage.removeItem('oms_current_user');
      window.location.href = '../auth/login.html';
    });

    el.filterSearch.addEventListener('input', (e) => {
      state.searchQuery = e.target.value;
      renderTable();
    });

    document.getElementById('btn-add-asset').addEventListener('click', openAddModal);
    document.getElementById('btn-add-cancel').addEventListener('click', closeAddModal);
    el.addForm.addEventListener('submit', handleAddAsset);
    el.btnScan.addEventListener('click', handleBarcodeScan);
  }

  async function refreshEquipment() {
    const list = await window.APIService.request('equipment');
    state.equipment = list || [];
    renderTable();
  }

  async function renderTable() {
    el.tbl.innerHTML = '';
    const data = await window.APIService.request('data');
    if (!data) return;

    const filtered = state.equipment.filter(e => {
      return e.barcode.toLowerCase().includes(state.searchQuery.toLowerCase()) ||
             e.name.toLowerCase().includes(state.searchQuery.toLowerCase());
    });

    if (filtered.length === 0) {
      el.tbl.innerHTML = `<tr><td colspan="6" class="p-8 text-center text-slate-500">No equipment matching query found.</td></tr>`;
      return;
    }

    filtered.forEach(e => {
      const row = document.createElement('tr');
      row.className = 'hover:bg-slate-800/30 transition text-slate-300';
      const hosp = data.hospitals.find(h => h.id === e.hospital_id);

      row.innerHTML = `
        <td class="p-4 font-mono text-cyan-400 font-bold">${e.barcode}</td>
        <td class="p-4 font-semibold text-white">${e.name}</td>
        <td class="p-4">${e.model}</td>
        <td class="p-4">${hosp ? hosp.name : 'Unknown Location'}</td>
        <td class="p-4 text-purple-400 font-semibold">${window.Formatters.currency(e.asset_value)}</td>
        <td class="p-4 text-xs font-semibold text-slate-400">${e.warranty_expiry || 'N/A'}</td>
      `;
      el.tbl.appendChild(row);
    });
  }

  async function openAddModal() {
    const data = await window.APIService.request('data');
    el.addHosp.innerHTML = data.hospitals.map(h => `<option value="${h.id}">${h.name}</option>`).join('');
    el.modalAdd.classList.remove('hidden');
  }

  function closeAddModal() {
    el.modalAdd.classList.add('hidden');
    el.addForm.reset();
  }

  async function handleAddAsset(event) {
    event.preventDefault();

    const body = {
      barcode: `CYX-EQ-${Math.floor(1100 + Math.random() * 8000)}`,
      name: el.addName.value,
      model: el.addModel.value,
      type: 'General',
      hospital_id: el.addHosp.value,
      asset_value: parseInt(el.addValue.value) || 100000,
      warranty_expiry: el.addWarranty.value,
      purchase_date: new Date().toISOString().split('T')[0]
    };

    await window.APIService.request('equipment', 'POST', body);
    closeAddModal();
    await refreshEquipment();
  }

  async function handleBarcodeScan() {
    const barcode = prompt('Simulate Barcode input (e.g. CYX-EQ-1001, CYX-EQ-1005):');
    if (barcode) {
      const found = state.equipment.find(e => e.barcode.toLowerCase() === barcode.trim().toLowerCase());
      if (found) {
        const compList = await window.APIService.request('complaints');
        const activeComp = compList.find(c => c.equipment_id === found.id && c.status === 'Open');
        if (activeComp) {
          window.location.href = `../complaints/complaints.html`;
        } else {
          alert(`Asset located!\nName: ${found.name}\nModel: ${found.model}\nWarranty Expiry: ${found.warranty_expiry}`);
        }
      } else {
        alert('Barcode not found in registry.');
      }
    }
  }
});
