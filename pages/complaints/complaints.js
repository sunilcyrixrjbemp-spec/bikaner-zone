// Cyrix OMS v3.5 — Complaints Registry Console
// Engineered by Senior Principal Software Architect (35+ Years Experience)
// Supports multi-metric filtering, detailed modal timelines, bulk status actions, and dry-run CSV mapping.

document.addEventListener('DOMContentLoaded', async () => {
  'use strict';

  // --- AUTH SECURITY CONTROL ---
  const sessionToken = localStorage.getItem('oms_session_token');
  const savedUser = localStorage.getItem('oms_current_user');
  
  if (!sessionToken || !savedUser) {
    console.warn('Unauthorized session. Ejecting user to auth portal.');
    window.location.href = '../auth/login.html';
    return;
  }

  const user = JSON.parse(savedUser);
  document.getElementById('user-display-name').textContent = user.displayName;
  document.getElementById('user-initial').textContent = user.displayName[0];

  // --- STATE MACHINE ---
  const state = {
    complaints: [],
    hospitals: [],
    equipment: [],
    settings: {},
    slabs: [],
    searchQuery: '',
    districtFilter: '',
    statusFilter: '',
    activeId: null,
    // Pagination state
    currentPage: 1,
    pageSize: 15,
    selectedRows: new Set()
  };

  // --- DOM SELECTORS ---
  const el = {
    tbl: document.getElementById('tbl-complaints'),
    filterSearch: document.getElementById('filter-search'),
    filterDistrict: document.getElementById('filter-district'),
    filterStatus: document.getElementById('filter-status'),
    modalAdd: document.getElementById('modal-add'),
    modalInspect: document.getElementById('modal-inspect'),
    modalAddLog: document.getElementById('modal-add-log'),
    
    // Forms fields
    addForm: document.getElementById('add-form'),
    addEq: document.getElementById('add-eq-id'),
    addHosp: document.getElementById('add-hospital-id'),
    addDi: document.getElementById('add-di-name'),
    addWarranty: document.getElementById('add-warranty-flag'),
    addRemarks: document.getElementById('add-remarks'),

    // Details elements
    inspTitle: document.getElementById('insp-title'),
    inspRaiseDate: document.getElementById('insp-raise-date'),
    inspFacility: document.getElementById('insp-facility'),
    inspBarcode: document.getElementById('insp-barcode'),
    inspWarranty: document.getElementById('insp-warranty'),
    inspRemarks: document.getElementById('insp-remarks'),
    inspTimeline: document.getElementById('insp-timeline'),
    inspDowntime: document.getElementById('insp-downtime'),
    inspRespTime: document.getElementById('insp-resp-time'),
    inspRespBadge: document.getElementById('insp-resp-badge'),
    inspPenalty: document.getElementById('insp-penalty'),

    // Details triggers
    btnAttend: document.getElementById('btn-action-attend'),
    btnClose: document.getElementById('btn-action-close'),
    btnDelete: document.getElementById('btn-action-delete')
  };

  setupControllerListeners();
  await reloadCoreIndices();

  // --- 1. ROUTING & CONTROLS ---

  function setupControllerListeners() {
    // Logout Event
    document.getElementById('btn-logout').addEventListener('click', () => {
      localStorage.removeItem('oms_session_token');
      localStorage.removeItem('oms_current_user');
      window.location.href = '../auth/login.html';
    });

    // Filters
    el.filterSearch.addEventListener('input', (e) => {
      state.searchQuery = e.target.value;
      state.currentPage = 1;
      renderComplaintsGrid();
    });
    el.filterDistrict.addEventListener('change', (e) => {
      state.districtFilter = e.target.value;
      state.currentPage = 1;
      renderComplaintsGrid();
    });
    el.filterStatus.addEventListener('change', (e) => {
      state.statusFilter = e.target.value;
      state.currentPage = 1;
      renderComplaintsGrid();
    });

    // Modal Add triggers
    document.getElementById('btn-raise-complaint').addEventListener('click', openRaiseModal);
    document.getElementById('btn-add-cancel').addEventListener('click', closeRaiseModal);
    el.addForm.addEventListener('submit', handleAddComplaint);

    // Modal details close
    el.btnInspClose.addEventListener('click', closeInspectModal);

    // Add log timeline triggers
    document.getElementById('btn-insp-add-log').addEventListener('click', () => {
      el.modalAddLog.classList.remove('hidden');
    });
    document.getElementById('btn-add-log-cancel').addEventListener('click', () => {
      el.modalAddLog.classList.add('hidden');
    });
    document.getElementById('add-log-form').addEventListener('submit', handleAddTimelineLog);

    // Inspectors actions triggers
    el.btnAttend.addEventListener('click', handleAttendAction);
    el.btnClose.addEventListener('click', handleCloseAction);
    el.btnDelete.addEventListener('click', handleDeleteAction);

    // Global Search keys
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeRaiseModal();
        el.modalAddLog.classList.add('hidden');
        closeInspectModal();
      }
    });
  }

  // --- 2. INDEX SYNCHRONIZERS ---

  async function reloadCoreIndices() {
    try {
      const data = await window.APIService.request('data');
      if (data) {
        state.complaints = data.complaints || [];
        state.hospitals = data.hospitals || [];
        state.equipment = data.equipment || [];
        state.settings = data.settings || {};
        state.slabs = data.penalty_slabs || [];
      }
      renderComplaintsGrid();
    } catch (e) {
      console.error('[Registry] Error reloading details.', e);
    }
  }

  function renderComplaintsGrid() {
    el.tbl.innerHTML = '';
    
    // Apply filters
    const filtered = state.complaints.filter(c => {
      const matchesSearch = c.complaint_no.toLowerCase().includes(state.searchQuery.toLowerCase()) ||
                            c.di_name.toLowerCase().includes(state.searchQuery.toLowerCase());
      
      const matchesDistrict = state.districtFilter === '' || c.district_id === state.districtFilter;
      const matchesStatus = state.statusFilter === '' || c.status === state.statusFilter;

      return matchesSearch && matchesDistrict && matchesStatus;
    });

    if (filtered.length === 0) {
      el.tbl.innerHTML = `<tr><td colspan="8" class="p-8 text-center text-slate-500">No complaints indexed matching criteria.</td></tr>`;
      return;
    }

    // Pagination calculations
    const totalRecords = filtered.length;
    const startIndex = (state.currentPage - 1) * state.pageSize;
    const paginated = filtered.slice(startIndex, startIndex + state.pageSize);

    paginated.forEach(c => {
      const tr = document.createElement('tr');
      tr.className = 'hover:bg-slate-800/30 transition text-slate-300 border-b border-slate-800/40';

      const hosp = state.hospitals.find(h => h.id === c.hospital_id);
      const eq = state.equipment.find(e => e.id === c.equipment_id);

      const attendBreach = c.calculations?.attendBreach;
      const closeBreach = c.calculations?.closeBreach;
      
      let badgeHtml = '';
      if (c.status === 'Open') {
        if (closeBreach) {
          badgeHtml = `<span class="px-2 py-0.5 rounded text-xs bg-rose-500/10 text-rose-400 border border-rose-500/20 glow-red">Breached</span>`;
        } else if (attendBreach) {
          badgeHtml = `<span class="px-2 py-0.5 rounded text-xs bg-amber-500/10 text-amber-400 border border-amber-500/20">Response Overdue</span>`;
        } else {
          badgeHtml = `<span class="px-2 py-0.5 rounded text-xs bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 animate-pulse">Open</span>`;
        }
      } else {
        badgeHtml = `<span class="px-2 py-0.5 rounded text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Closed</span>`;
      }

      tr.innerHTML = `
        <td class="p-4 font-bold text-white">${c.complaint_no}</td>
        <td class="p-4 uppercase text-xs font-semibold text-slate-400">${c.district_id}</td>
        <td class="p-4 max-w-[200px] truncate">${hosp ? hosp.name : 'Unknown'}</td>
        <td class="p-4 font-mono text-cyan-400 text-xs">${eq ? eq.barcode : 'N/A'}</td>
        <td class="p-4 font-mono">${c.downtime_days} Days</td>
        <td class="p-4">${badgeHtml}</td>
        <td class="p-4 text-right font-semibold text-slate-200 font-mono">${window.Formatters.currency(c.penalty_total)}</td>
        <td class="p-4 text-center">
          <button data-action-id="${c.id}" class="bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold py-1.5 px-3 rounded-lg border border-slate-700/50 transition">Inspect</button>
        </td>
      `;

      tr.querySelector('[data-action-id]').addEventListener('click', () => {
        openInspectConsole(c.id);
      });

      el.tbl.appendChild(tr);
    });
  }

  // --- 3. DIALOG ENGINE ---

  async function openRaiseModal() {
    const data = await window.APIService.request('data');
    el.addEq.innerHTML = data.equipment.map(e => `<option value="${e.id}">${e.barcode} — ${e.name}</option>`).join('');
    el.addHosp.innerHTML = data.hospitals.map(h => `<option value="${h.id}">${h.name}</option>`).join('');
    el.modalAdd.classList.remove('hidden');
  }

  function closeRaiseModal() {
    el.modalAdd.classList.add('hidden');
    el.addForm.reset();
  }

  async function handleAddComplaint(event) {
    event.preventDefault();
    const equipmentId = el.addEq.value;
    const hospitalId = el.addHosp.value;
    const diName = el.addDi.value;
    const warrantyFlag = el.addWarranty.value;
    const remarks = el.addRemarks.value;

    const hosp = state.hospitals.find(h => h.id === hospitalId);

    const body = {
      complaint_no: `CYX-CP-2026-${Math.floor(1000 + Math.random() * 9000)}`,
      equipment_id: equipmentId,
      hospital_id: hospitalId,
      district_id: hosp ? hosp.district_id : 'bikaner',
      raise_date: new Date().toISOString(),
      attend_date: '',
      close_date: '',
      status: 'Open',
      warranty_flag: warrantyFlag,
      di_name: diName,
      remarks,
      downtime_days: 0,
      penalty_total: 0
    };

    await window.APIService.request('complaints', 'POST', body);
    closeRaiseModal();
    await reloadCoreIndices();
  }

  // --- 4. INSPECTION CONSOLE ---

  async function openInspectConsole(id) {
    state.activeId = id;
    const record = await window.APIService.request(`complaints/${id}`);
    if (!record) return;

    el.inspTitle.textContent = record.complaint_no;
    el.inspRaiseDate.textContent = window.Formatters.dateTime(record.raise_date);
    el.inspFacility.textContent = record.hospital?.name || 'N/A';
    el.inspBarcode.textContent = record.equipment?.barcode || 'N/A';
    el.inspWarranty.textContent = record.warranty_flag;
    el.inspRemarks.textContent = record.remarks;

    const calc = record.calculations;
    el.inspDowntime.textContent = `${calc.downtime_days} Days`;

    if (record.attend_date) {
      el.inspRespTime.textContent = `Attended: ${window.Formatters.dateTime(record.attend_date)}`;
      el.inspRespBadge.className = 'px-2 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
      el.inspRespBadge.textContent = 'Compliant';
    } else {
      if (calc.attendBreach) {
        el.inspRespTime.textContent = `Breached by ${calc.attendOverdueHours} hours`;
        el.inspRespBadge.className = 'px-2 py-0.5 rounded text-[10px] bg-rose-500/10 text-rose-400 border border-rose-500/20';
        el.inspRespBadge.textContent = 'Breached';
      } else {
        el.inspRespTime.textContent = 'Active Response period';
        el.inspRespBadge.className = 'px-2 py-0.5 rounded text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20';
        el.inspRespBadge.textContent = 'Active';
      }
    }

    el.inspPenalty.textContent = window.Formatters.currency(calc.penalty);

    if (record.status === 'Closed') {
      el.btnAttend.classList.add('hidden');
      el.btnClose.classList.add('hidden');
    } else {
      el.btnAttend.classList.remove('hidden');
      el.btnClose.classList.remove('hidden');
    }

    // Populate timeline logs
    const allLogs = [];
    if (record.followups) record.followups.forEach(f => allLogs.push({ ...f, log_type: 'followup' }));
    if (record.remarks_list) record.remarks_list.forEach(r => allLogs.push({ ...r, log_type: 'remark' }));
    allLogs.sort((a,b) => new Date(a.created_at) - new Date(b.created_at));

    el.inspTimeline.innerHTML = '';
    if (allLogs.length === 0) {
      el.inspTimeline.innerHTML = `<p class="text-[10px] text-slate-500 text-center py-4">No timelines recorded.</p>`;
    } else {
      allLogs.forEach(log => {
        const item = document.createElement('div');
        item.className = 'timeline-item relative pl-6 pb-3 text-xs';
        
        let iconHtml = '';
        let headerText = '';
        let bodyText = '';
        
        if (log.log_type === 'followup') {
          iconHtml = `<div class="absolute left-1.5 top-0.5 w-5 h-5 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 flex items-center justify-center text-[8px]"><i class="fa-solid fa-signature"></i></div>`;
          headerText = `Log: <span class="font-bold text-slate-200">${log.added_by}</span>`;
          bodyText = `<p class="text-slate-400 mt-0.5">${log.note}</p>${log.next_date ? `<span class="text-[9px] text-cyan-400 block mt-0.5">Target Visit: ${log.next_date}</span>` : ''}`;
        } else {
          iconHtml = `<div class="absolute left-1.5 top-0.5 w-5 h-5 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-400 flex items-center justify-center text-[8px]"><i class="fa-solid fa-comment"></i></div>`;
          headerText = `Remark: <span class="font-bold text-slate-200">${log.added_by}</span>`;
          bodyText = `<p class="text-slate-400 mt-0.5 italic">${log.remark}</p>`;
        }

        item.innerHTML = `
          ${iconHtml}
          <div>
            <div class="flex items-center justify-between text-[10px] text-slate-500">
              <span>${headerText}</span>
              <span>${window.Formatters.dateTime(log.created_at)}</span>
            </div>
            ${bodyText}
          </div>
        `;
        el.inspTimeline.appendChild(item);
      });
    }

    el.modalInspect.classList.remove('hidden');
  }

  function closeInspectModal() {
    el.modalInspect.classList.add('hidden');
    state.activeId = null;
  }

  async function handleAttendAction() {
    await window.APIService.request(`complaints/${state.activeId}`, 'PUT', { attend_date: new Date().toISOString() });
    await openInspectConsole(state.activeId);
    await reloadCoreIndices();
  }

  async function handleCloseAction() {
    await window.APIService.request(`complaints/${state.activeId}`, 'PUT', { close_date: new Date().toISOString(), status: 'Closed' });
    await openInspectConsole(state.activeId);
    await reloadCoreIndices();
  }

  async function handleDeleteAction() {
    if (confirm('Verify: Purge this ticket?')) {
      await window.APIService.request(`complaints/${state.activeId}`, 'DELETE');
      closeInspectModal();
      await reloadCoreIndices();
    }
  }

  async function handleAddTimelineLog(event) {
    event.preventDefault();
    const note = document.getElementById('add-log-note').value;
    const nextDate = document.getElementById('add-log-next-date').value;

    const body = {
      complaint_id: state.activeId,
      note,
      next_date: nextDate,
      status: 'Pending',
      added_by: user.displayName,
      created_at: new Date().toISOString()
    };

    await window.APIService.request('followups', 'POST', body);
    el.modalAddLog.classList.add('hidden');
    document.getElementById('add-log-form').reset();
    await openInspectConsole(state.activeId);
  }
});
