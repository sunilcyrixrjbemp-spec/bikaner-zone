// Cyrix OMS v3.1 — Central Application Logic & SPA Controller
// Engineered by Lead CTO & Principal Architect (35+ years experience)

document.addEventListener('DOMContentLoaded', () => {
  // --- APPLICATION STATE ---
  const state = {
    currentUser: null,
    currentView: 'dashboard',
    activeComplaintId: null,
    activeProcurementTab: 'pi',
    searchQuery: '',
    districtFilter: '',
    statusFilter: '',
    // CSV Ingestion specific state
    rawCSVText: '',
    csvHeaders: [],
    csvRows: [],
    mappedColumns: {},
    requiredKeys: []
  };

  // --- DOM SELECTORS ---
  const views = {
    login: document.getElementById('view-login'),
    app: document.getElementById('app-layout'),
    dashboard: document.getElementById('content-dashboard'),
    complaints: document.getElementById('content-complaints'),
    complaintDetail: document.getElementById('content-complaint-detail'),
    equipment: document.getElementById('content-equipment'),
    procurement: document.getElementById('content-procurement'),
    penalty: document.getElementById('content-penalty'),
    analytics: document.getElementById('content-analytics'),
    import: document.getElementById('content-import'),
    settings: document.getElementById('content-settings')
  };

  // --- INITIALIZATION ---
  initSession();
  setupEventListeners();

  function initSession() {
    const sessionToken = localStorage.getItem('oms_session_token');
    const savedUser = localStorage.getItem('oms_current_user');
    
    // Update Connection Mode Banner
    const mode = window.DB.connectionMode;
    const url = window.DB.apiUrl;
    document.getElementById('dash-db-mode').textContent = mode === 'api' ? `Enterprise Cloud Engine (${url})` : 'Local Sandboxed (IndexedDB)';

    if (sessionToken && savedUser) {
      state.currentUser = JSON.parse(savedUser);
      enterApp();
    } else {
      showView('login');
    }
  }

  function setupEventListeners() {
    // Auth
    document.getElementById('login-form').addEventListener('submit', handleLogin);
    document.getElementById('btn-logout').addEventListener('click', handleLogout);

    // Sidebar View Routing
    window.addEventListener('hashchange', handleHashRoute);
    
    // Mobile Nav Toggle
    document.getElementById('toggle-sidebar').addEventListener('click', () => {
      document.querySelector('aside').classList.toggle('-translate-x-full');
    });

    // Complaints filtering
    document.getElementById('filter-search').addEventListener('input', (e) => {
      state.searchQuery = e.target.value;
      renderComplaints();
    });
    document.getElementById('filter-district').addEventListener('change', (e) => {
      state.districtFilter = e.target.value;
      renderComplaints();
    });
    document.getElementById('filter-status').addEventListener('change', (e) => {
      state.statusFilter = e.target.value;
      renderComplaints();
    });

    // Complaint Modals Actions
    document.getElementById('btn-add-complaint').addEventListener('click', openAddComplaintModal);
    document.getElementById('btn-add-complaint-cancel').addEventListener('click', closeAddComplaintModal);
    document.getElementById('add-complaint-form').addEventListener('submit', handleAddComplaint);

    // Complaint Detail Actions
    document.getElementById('btn-detail-back').addEventListener('click', () => {
      window.location.hash = '#complaints';
    });
    document.getElementById('btn-add-followup').addEventListener('click', openAddLogModal);
    document.getElementById('btn-add-log-cancel').addEventListener('click', closeAddLogModal);
    document.getElementById('add-log-form').addEventListener('submit', handleAddLog);
    
    document.getElementById('btn-action-attend').addEventListener('click', handleAttendComplaint);
    document.getElementById('btn-action-close').addEventListener('click', handleCloseComplaint);
    document.getElementById('btn-action-delete').addEventListener('click', handleDeleteComplaint);

    // Equipment Actions
    document.getElementById('eq-search').addEventListener('input', renderEquipment);
    document.getElementById('btn-barcode-scan-demo').addEventListener('click', handleBarcodeScanDemo);
    document.getElementById('btn-add-equipment').addEventListener('click', handleAddEquipmentDemo);

    // Procurement tab toggle
    document.querySelectorAll('[data-proc-tab]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('[data-proc-tab]').forEach(b => {
          b.classList.remove('border-blue-500', 'text-blue-500');
          b.classList.add('border-transparent', 'text-slate-400');
        });
        btn.classList.add('border-blue-500', 'text-blue-500');
        state.activeProcurementTab = btn.getAttribute('data-proc-tab');
        renderProcurement();
      });
    });

    // Settings actions
    document.getElementById('settings-form').addEventListener('submit', handleSaveSettings);
    
    // DB Switcher Toggle Events
    document.getElementById('set-db-mode').addEventListener('change', (e) => {
      const urlBox = document.getElementById('db-api-settings');
      if (e.target.value === 'api') {
        urlBox.classList.remove('hidden');
      } else {
        urlBox.classList.add('hidden');
      }
    });

    document.getElementById('btn-save-db-connection').addEventListener('click', handleSaveDBConnection);

    // Simulation & Rebuild buttons
    document.getElementById('btn-simulate-data').addEventListener('click', handleSimulateData);
    document.getElementById('btn-reset-db').addEventListener('click', handleResetDB);

    // Global Search Modal (Ctrl+K)
    document.getElementById('btn-global-search').addEventListener('click', openSearchModal);
    document.getElementById('modal-search-close').addEventListener('click', closeSearchModal);
    document.getElementById('modal-search-input').addEventListener('input', handleGlobalSearch);
    
    // Hotkeys
    window.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        openSearchModal();
      }
      if (e.key === 'Escape') {
        closeSearchModal();
        closeAddComplaintModal();
        closeAddLogModal();
      }
    });

    // Universal Ingestion File Drag-and-drop Events
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('import-file-input');
    
    dropZone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => loadCSVToIngestionPipeline(e.target.files[0]));
    
    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.classList.add('border-blue-500', 'bg-slate-800/40');
    });
    dropZone.addEventListener('dragleave', () => {
      dropZone.classList.remove('border-blue-500', 'bg-slate-800/40');
    });
    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('border-blue-500', 'bg-slate-800/40');
      if (e.dataTransfer.files.length > 0) {
        loadCSVToIngestionPipeline(e.dataTransfer.files[0]);
      }
    });

    // Column Mapping Navigation
    document.getElementById('btn-mapping-cancel').addEventListener('click', showUploadImportScreen);
    document.getElementById('btn-mapping-confirm').addEventListener('click', runMappingDryRun);
    
    // Preview dry-run Navigation
    document.getElementById('btn-preview-back').addEventListener('click', showMappingImportScreen);
    document.getElementById('btn-preview-commit').addEventListener('click', commitImportedRecords);
  }

  // --- ROUTING HANDLERS ---
  function handleHashRoute() {
    const hash = window.location.hash.slice(1) || 'dashboard';
    const parts = hash.split('/');
    const viewName = parts[0];
    
    const titleEl = document.getElementById('current-page-title');
    titleEl.textContent = viewName.toUpperCase();

    document.querySelectorAll('.nav-link').forEach(n => {
      if (n.getAttribute('data-view') === viewName) {
        n.classList.add('bg-slate-800/80', 'text-white');
      } else {
        n.classList.remove('bg-slate-800/80', 'text-white');
      }
    });

    if (viewName === 'complaints' && parts[1]) {
      state.activeComplaintId = parts[1];
      showView('complaintDetail');
      loadComplaintDetails(parts[1]);
      return;
    }

    if (views[viewName]) {
      showView(viewName);
      loadViewData(viewName);
    }
  }

  function showView(name) {
    Object.keys(views).forEach(key => {
      if (key === name) {
        views[key].classList.remove('hidden');
      } else if (key !== 'app') {
        views[key].classList.add('hidden');
      }
    });
    state.currentView = name;
  }

  async function loadViewData(viewName) {
    if (viewName === 'dashboard') {
      const summary = await window.DB.getDashboardSummary();
      
      document.getElementById('kpi-total').textContent = summary.kpis.totalComplaints;
      document.getElementById('kpi-open').textContent = summary.kpis.openComplaints;
      document.getElementById('kpi-compliance').textContent = `${summary.kpis.slaCompliance}%`;
      document.getElementById('kpi-penalty').textContent = `₹${summary.kpis.totalPenalty.toLocaleString('en-IN')}`;
      
      const tblScorecards = document.getElementById('tbl-district-scorecards');
      tblScorecards.innerHTML = summary.districtScores.map(d => `
        <tr class="border-b border-slate-800 text-slate-300 hover:bg-slate-800/20 transition">
          <td class="py-3 font-semibold">${d.name}</td>
          <td class="py-3">${d.total}</td>
          <td class="py-3 text-rose-400">${d.open}</td>
          <td class="py-3">
            <span class="px-2 py-0.5 rounded text-xs ${d.complianceRate >= 80 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'}">${d.complianceRate}%</span>
          </td>
          <td class="py-3 text-right font-semibold text-purple-400">₹${d.penalty.toLocaleString('en-IN')}</td>
        </tr>
      `).join('');

      // Populate Live alert tickers at top
      const tickerBox = document.getElementById('ticker-container');
      const tickerText = document.getElementById('ticker-text');

      const rawData = await window.DB.executeQuery('data');
      const breachedList = rawData.complaints.map(c => {
        const eq = rawData.equipment.find(e => e.id === c.equipment_id);
        const calc = window.calculateSLAAndPenalty(c, eq, rawData.settings, rawData.penalty_slabs);
        return { ...c, calculations: calc };
      }).filter(c => c.status === 'Open' && c.calculations.closeBreach);

      if (breachedList.length > 0) {
        tickerBox.classList.remove('hidden');
        tickerText.innerHTML = breachedList.map(b => `
          <span class="mr-12 font-semibold">
            🚨 CRITICAL BREACH: Complaint <span class="underline">${b.complaint_no}</span> at ${rawData.hospitals.find(h => h.id === b.hospital_id)?.name || 'Facility'} is currently down for ${b.calculations.downtime_days} days. Accrued penalty: ₹${b.calculations.penalty.toLocaleString('en-IN')}.
          </span>
        `).join('');
      } else {
        tickerBox.classList.add('hidden');
      }

      window.Charts.renderDashboard(rawData);
    } 
    
    else if (viewName === 'complaints') {
      renderComplaints();
    } 
    
    else if (viewName === 'equipment') {
      renderEquipment();
    } 
    
    else if (viewName === 'procurement') {
      renderProcurement();
    } 
    
    else if (viewName === 'penalty') {
      renderPenaltyMatrix();
    } 
    
    else if (viewName === 'analytics') {
      const rawData = await window.DB.executeQuery('data');
      window.Charts.renderAnalytics(rawData);
    } 
    
    else if (viewName === 'settings') {
      loadSettings();
    }
  }

  // --- AUTH FUNCTIONS ---
  async function handleLogin(e) {
    e.preventDefault();
    const username = document.getElementById('login-username').value;
    const passwordRaw = document.getElementById('login-password').value;

    const data = await window.DB.executeQuery('data');
    const settings = data.settings;

    const inputHash = await sha256(passwordRaw);
    
    if (username.toLowerCase() === settings.username.toLowerCase() && inputHash === settings.passwordHash) {
      state.currentUser = { username: settings.username, displayName: settings.displayName };
      localStorage.setItem('oms_session_token', `token_${Date.now()}`);
      localStorage.setItem('oms_current_user', JSON.stringify(state.currentUser));
      enterApp();
    } else {
      const errEl = document.getElementById('login-error');
      errEl.classList.remove('hidden');
    }
  }

  function handleLogout() {
    localStorage.removeItem('oms_session_token');
    localStorage.removeItem('oms_current_user');
    state.currentUser = null;
    views.app.classList.add('hidden');
    views.login.classList.remove('hidden');
    window.location.hash = '';
  }

  function enterApp() {
    views.login.classList.add('hidden');
    views.app.classList.remove('hidden');
    document.getElementById('user-initial').textContent = state.currentUser.displayName[0];
    document.getElementById('user-display-name').textContent = state.currentUser.displayName;
    handleHashRoute();
  }

  // --- COMPLAINTS ---
  async function renderComplaints() {
    const list = await window.DB.executeQuery('complaints');
    const tbl = document.getElementById('tbl-complaints');
    tbl.innerHTML = '';

    const filtered = list.filter(c => {
      const matchesSearch = c.complaint_no.toLowerCase().includes(state.searchQuery.toLowerCase()) ||
                            c.di_name.toLowerCase().includes(state.searchQuery.toLowerCase());
      
      const matchesDistrict = state.districtFilter === '' || c.district_id === state.districtFilter;
      const matchesStatus = state.statusFilter === '' || c.status === state.statusFilter;

      return matchesSearch && matchesDistrict && matchesStatus;
    });

    if (filtered.length === 0) {
      tbl.innerHTML = `<tr><td colspan="8" class="p-8 text-center text-slate-500">No matching complaint records found.</td></tr>`;
      return;
    }

    const data = await window.DB.executeQuery('data');

    filtered.forEach(c => {
      const row = document.createElement('tr');
      row.className = 'hover:bg-slate-800/30 transition text-slate-300';

      const hosp = data.hospitals.find(h => h.id === c.hospital_id);
      const eq = data.equipment.find(e => e.id === c.equipment_id);

      const attendBreach = c.calculations?.attendBreach;
      const closeBreach = c.calculations?.closeBreach;
      
      let badgeHtml = '';
      if (c.status === 'Open') {
        if (closeBreach) badgeHtml = `<span class="px-2 py-0.5 rounded text-xs bg-rose-500/10 text-rose-400 border border-rose-500/20 glow-red">Breached</span>`;
        else if (attendBreach) badgeHtml = `<span class="px-2 py-0.5 rounded text-xs bg-amber-500/10 text-amber-400 border border-amber-500/20">Response Overdue</span>`;
        else badgeHtml = `<span class="px-2 py-0.5 rounded text-xs bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 animate-pulse">Open</span>`;
      } else {
        badgeHtml = `<span class="px-2 py-0.5 rounded text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Closed</span>`;
      }

      row.innerHTML = `
        <td class="p-4 font-bold text-white">${c.complaint_no}</td>
        <td class="p-4 uppercase text-xs font-semibold">${c.district_id}</td>
        <td class="p-4 max-w-[200px] truncate">${hosp ? hosp.name : 'Unknown Location'}</td>
        <td class="p-4 font-mono text-cyan-400 text-xs">${eq ? eq.barcode : 'N/A'}</td>
        <td class="p-4">${c.downtime_days} Days</td>
        <td class="p-4">${badgeHtml}</td>
        <td class="p-4 text-right font-semibold ${c.penalty_total > 0 ? 'text-rose-400' : 'text-slate-500'}">₹${c.penalty_total.toLocaleString('en-IN')}</td>
        <td class="p-4 text-center">
          <a href="#complaints/${c.id}" class="bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold py-1.5 px-3 rounded-lg border border-slate-700/50 transition">Inspect</a>
        </td>
      `;
      tbl.appendChild(row);
    });
  }

  async function openAddComplaintModal() {
    const data = await window.DB.executeQuery('data');
    const eqSelect = document.getElementById('add-eq-id');
    const hospSelect = document.getElementById('add-hospital-id');

    eqSelect.innerHTML = data.equipment.map(e => `<option value="${e.id}">${e.barcode} — ${e.name}</option>`).join('');
    hospSelect.innerHTML = data.hospitals.map(h => `<option value="${h.id}">${h.name} (${h.hospital_type})</option>`).join('');

    document.getElementById('modal-add-complaint').classList.remove('hidden');
  }

  function closeAddComplaintModal() {
    document.getElementById('modal-add-complaint').classList.add('hidden');
    document.getElementById('add-complaint-form').reset();
  }

  async function handleAddComplaint(e) {
    e.preventDefault();
    const data = await window.DB.executeQuery('data');

    const equipmentId = document.getElementById('add-eq-id').value;
    const hospitalId = document.getElementById('add-hospital-id').value;
    const diName = document.getElementById('add-di-name').value;
    const warrantyFlag = document.getElementById('add-warranty-flag').value;
    const remarks = document.getElementById('add-remarks').value;

    const hosp = data.hospitals.find(h => h.id === hospitalId);

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

    await window.DB.executeQuery('complaints', 'POST', body);
    closeAddComplaintModal();
    renderComplaints();
  }

  // --- DETAIL VIEW ---
  async function loadComplaintDetails(id) {
    const record = await window.DB.executeQuery(`complaints/${id}`);
    if (!record) {
      window.location.hash = '#complaints';
      return;
    }

    document.getElementById('detail-no').textContent = record.complaint_no;
    document.getElementById('detail-raise-date').textContent = new Date(record.raise_date).toLocaleString('en-IN');
    document.getElementById('detail-di-name').textContent = record.di_name;
    document.getElementById('detail-remarks').textContent = record.remarks;
    
    const detailBadge = document.getElementById('detail-status-badge');
    const statusVal = document.getElementById('detail-status');
    statusVal.textContent = record.status;
    
    if (record.status === 'Open') {
      detailBadge.innerHTML = `<span class="px-3 py-1 rounded-full text-xs font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20 glow-red animate-pulse">LIVE INCIDENT</span>`;
      document.getElementById('btn-action-close').classList.remove('hidden');
      document.getElementById('btn-action-attend').classList.remove('hidden');
    } else {
      detailBadge.innerHTML = `<span class="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">RESOLVED</span>`;
      document.getElementById('btn-action-close').classList.add('hidden');
      document.getElementById('btn-action-attend').classList.add('hidden');
    }

    document.getElementById('detail-eq-name').textContent = record.equipment?.name || 'N/A';
    document.getElementById('detail-barcode').textContent = record.equipment?.barcode || 'N/A';
    document.getElementById('detail-model').textContent = record.equipment?.model || 'N/A';
    document.getElementById('detail-hospital').textContent = record.hospital?.name || 'N/A';
    document.getElementById('detail-asset-value').textContent = `₹${record.equipment?.asset_value?.toLocaleString('en-IN') || '0'}`;
    document.getElementById('detail-warranty-status').textContent = record.warranty_flag;

    const calc = record.calculations;
    
    const resBadge = document.getElementById('diag-response-badge');
    const resTimeMsg = document.getElementById('diag-response-time');
    if (record.attend_date) {
      resBadge.innerHTML = `<span class="px-2 py-0.5 rounded text-xs bg-emerald-500/10 text-emerald-400">Attended</span>`;
      resTimeMsg.textContent = `Response logged at ${new Date(record.attend_date).toLocaleString('en-IN')}`;
    } else {
      if (calc.attendBreach) {
        resBadge.innerHTML = `<span class="px-2 py-0.5 rounded text-xs bg-rose-500/10 text-rose-400">Breached</span>`;
        resTimeMsg.textContent = `Breached by ${calc.attendOverdueHours} hours. Urgent engineer response needed.`;
      } else {
        resBadge.innerHTML = `<span class="px-2 py-0.5 rounded text-xs bg-blue-500/10 text-blue-400">Active</span>`;
        resTimeMsg.textContent = `SLA response deadline active.`;
      }
    }

    const slBadge = document.getElementById('diag-resolution-badge');
    const slTimeMsg = document.getElementById('diag-resolution-time');
    if (record.status === 'Closed') {
      slBadge.innerHTML = `<span class="px-2 py-0.5 rounded text-xs bg-emerald-500/10 text-emerald-400">Completed</span>`;
      slTimeMsg.textContent = `Closed on ${new Date(record.close_date).toLocaleString('en-IN')} | Total Downtime: ${record.downtime_days} Days`;
    } else {
      if (calc.closeBreach) {
        slBadge.innerHTML = `<span class="px-2 py-0.5 rounded text-xs bg-rose-500/10 text-rose-400 border border-rose-500/20">Breached</span>`;
        slTimeMsg.textContent = `Downtime: ${record.downtime_days} Days. Penalty growing daily.`;
      } else {
        slBadge.innerHTML = `<span class="px-2 py-0.5 rounded text-xs bg-blue-500/10 text-blue-400">Under Review</span>`;
        slTimeMsg.textContent = `Active resolution period. Target: Under 72 Hours.`;
      }
    }

    document.getElementById('diag-risk-val').textContent = `${calc.riskScore}%`;
    const riskBar = document.getElementById('diag-risk-bar');
    riskBar.style.width = `${calc.riskScore}%`;
    if (calc.riskScore > 75) {
      riskBar.className = 'h-full bg-rose-500 transition-all duration-300';
    } else if (calc.riskScore > 40) {
      riskBar.className = 'h-full bg-amber-500 transition-all duration-300';
    } else {
      riskBar.className = 'h-full bg-emerald-500 transition-all duration-300';
    }

    document.getElementById('diag-penalty-response').textContent = `₹${calc.penaltyDetail.attendPenalty.toLocaleString('en-IN')}`;
    document.getElementById('diag-penalty-downtime').textContent = `₹${calc.penaltyDetail.downtimePenalty.toLocaleString('en-IN')}`;
    document.getElementById('diag-penalty-total').textContent = `₹${calc.penalty.toLocaleString('en-IN')}`;

    const timeline = document.getElementById('timeline-followups');
    timeline.innerHTML = '';
    
    const allLogs = [];
    if (record.followups) {
      record.followups.forEach(f => allLogs.push({ ...f, log_type: 'followup' }));
    }
    if (record.remarks_list) {
      record.remarks_list.forEach(r => allLogs.push({ ...r, log_type: 'remark' }));
    }

    allLogs.sort((a,b) => new Date(a.created_at) - new Date(b.created_at));

    if (allLogs.length === 0) {
      timeline.innerHTML = `<p class="text-xs text-slate-500 py-4 text-center">No logs generated for this incident yet.</p>`;
    } else {
      allLogs.forEach(log => {
        const item = document.createElement('div');
        item.className = 'timeline-item relative pl-8 pb-4 text-sm';
        
        let iconHtml = '';
        let headerText = '';
        let bodyText = '';
        
        if (log.log_type === 'followup') {
          iconHtml = `<div class="absolute left-1.5 top-0.5 w-6 h-6 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 flex items-center justify-center text-[10px]"><i class="fa-solid fa-signature"></i></div>`;
          headerText = `Follow-up logged by <span class="font-bold text-white">${log.added_by}</span>`;
          bodyText = `<p class="text-slate-300 mt-1">${log.note}</p>${log.next_date ? `<span class="text-[10px] text-cyan-400 block mt-1 font-semibold"><i class="fa-regular fa-calendar-check mr-1.5"></i>Next Action Target: ${log.next_date}</span>` : ''}`;
        } else {
          iconHtml = `<div class="absolute left-1.5 top-0.5 w-6 h-6 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-400 flex items-center justify-center text-[10px]"><i class="fa-solid fa-comment"></i></div>`;
          headerText = `Officer remark appended by <span class="font-bold text-white">${log.added_by}</span>`;
          bodyText = `<p class="text-slate-300 mt-1 italic">${log.remark}</p>`;
        }

        item.innerHTML = `
          ${iconHtml}
          <div>
            <div class="flex items-center justify-between text-xs text-slate-400">
              <span>${headerText}</span>
              <span>${new Date(log.created_at).toLocaleString('en-IN')}</span>
            </div>
            ${bodyText}
          </div>
        `;
        timeline.appendChild(item);
      });
    }
  }

  async function handleAttendComplaint() {
    const updateBody = { attend_date: new Date().toISOString() };
    await window.DB.executeQuery(`complaints/${state.activeComplaintId}`, 'PUT', updateBody);
    loadComplaintDetails(state.activeComplaintId);
  }

  async function handleCloseComplaint() {
    const updateBody = { close_date: new Date().toISOString(), status: 'Closed' };
    await window.DB.executeQuery(`complaints/${state.activeComplaintId}`, 'PUT', updateBody);
    loadComplaintDetails(state.activeComplaintId);
  }

  async function handleDeleteComplaint() {
    if (confirm('Warning: Are you absolutely certain you want to purge this record from indices?')) {
      await window.DB.executeQuery(`complaints/${state.activeComplaintId}`, 'DELETE');
      window.location.hash = '#complaints';
    }
  }

  function openAddLogModal() {
    document.getElementById('modal-add-log').classList.remove('hidden');
  }

  function closeAddLogModal() {
    document.getElementById('modal-add-log').classList.add('hidden');
    document.getElementById('add-log-form').reset();
  }

  async function handleAddLog(e) {
    e.preventDefault();
    const note = document.getElementById('add-log-note').value;
    const nextDate = document.getElementById('add-log-next-date').value;

    const body = {
      complaint_id: state.activeComplaintId,
      note,
      next_date: nextDate,
      status: 'Pending',
      added_by: state.currentUser.displayName,
      created_at: new Date().toISOString()
    };

    await window.DB.executeQuery('followups', 'POST', body);
    closeAddLogModal();
    loadComplaintDetails(state.activeComplaintId);
  }

  // --- EQUIPMENT ---
  async function renderEquipment() {
    const query = document.getElementById('eq-search').value.toLowerCase();
    const list = await window.DB.executeQuery('equipment');
    const tbl = document.getElementById('tbl-equipment');
    tbl.innerHTML = '';

    const filtered = list.filter(e => e.barcode.toLowerCase().includes(query) || e.name.toLowerCase().includes(query));

    if (filtered.length === 0) {
      tbl.innerHTML = `<tr><td colspan="6" class="p-8 text-center text-slate-500">No equipment records indexed.</td></tr>`;
      return;
    }

    const data = await window.DB.executeQuery('data');

    filtered.forEach(e => {
      const row = document.createElement('tr');
      row.className = 'hover:bg-slate-800/30 transition text-slate-300';
      const hosp = data.hospitals.find(h => h.id === e.hospital_id);

      row.innerHTML = `
        <td class="p-4 font-mono text-cyan-400 font-bold">${e.barcode}</td>
        <td class="p-4 font-semibold text-white">${e.name}</td>
        <td class="p-4">${e.model}</td>
        <td class="p-4">${hosp ? hosp.name : 'Unknown Location'}</td>
        <td class="p-4 text-purple-400 font-semibold">₹${e.asset_value.toLocaleString('en-IN')}</td>
        <td class="p-4 text-xs font-semibold text-slate-400">${e.warranty_expiry || 'N/A'}</td>
      `;
      tbl.appendChild(row);
    });
  }

  async function handleBarcodeScanDemo() {
    const barcode = prompt('Simulate Barcode Hardware input (e.g. CYX-EQ-1001, CYX-EQ-1005):');
    if (barcode) {
      const eqList = await window.DB.executeQuery('equipment');
      const found = eqList.find(e => e.barcode.toLowerCase() === barcode.trim().toLowerCase());
      if (found) {
        const compList = await window.DB.executeQuery('complaints');
        const activeComp = compList.find(c => c.equipment_id === found.id && c.status === 'Open');
        if (activeComp) {
          window.location.hash = `#complaints/${activeComp.id}`;
        } else {
          alert(`Asset Located!\nName: ${found.name}\nModel: ${found.model}\nWarranty: ${found.warranty_expiry}`);
        }
      } else {
        alert('Asset barcode not found in local registries.');
      }
    }
  }

  async function handleAddEquipmentDemo() {
    const name = prompt('Asset Name:');
    if (!name) return;
    const model = prompt('Model:');
    const assetValue = parseInt(prompt('Book Value (INR):'));
    
    if (name && assetValue) {
      const body = {
        barcode: `CYX-EQ-${Math.floor(1100 + Math.random() * 8000)}`,
        name,
        model: model || 'General model',
        type: 'General',
        hospital_id: 'h1',
        asset_value: assetValue,
        warranty_expiry: new Date(Date.now() + 365*24*60*60*1000).toISOString().split('T')[0],
        purchase_date: new Date().toISOString().split('T')[0]
      };
      await window.DB.executeQuery('equipment', 'POST', body);
      renderEquipment();
    }
  }

  // --- PROCUREMENT ---
  async function renderProcurement() {
    const data = await window.DB.executeQuery('data');
    const head = document.getElementById('tbl-proc-header');
    const body = document.getElementById('tbl-proc-body');
    
    head.innerHTML = '';
    body.innerHTML = '';

    if (state.activeProcurementTab === 'pi') {
      head.innerHTML = `
        <tr>
          <th class="p-4">Indent No</th>
          <th class="p-4">Device Category</th>
          <th class="p-4 text-center">Qty</th>
          <th class="p-4">Facility Requested</th>
          <th class="p-4">Support Ticket</th>
          <th class="p-4">Logged Date</th>
          <th class="p-4">SLA State</th>
        </tr>
      `;

      if (!data.procurement_pi || data.procurement_pi.length === 0) {
        body.innerHTML = `<tr><td colspan="7" class="p-8 text-center text-slate-500">No Indents filed.</td></tr>`;
        return;
      }

      data.procurement_pi.forEach(item => {
        const hosp = data.hospitals.find(h => h.id === item.facility_id);
        const row = document.createElement('tr');
        row.className = 'hover:bg-slate-800/30 transition text-slate-300';
        row.innerHTML = `
          <td class="p-4 font-bold text-white">${item.indent_no}</td>
          <td class="p-4 font-semibold text-slate-200">${item.device_name}</td>
          <td class="p-4 text-center font-bold text-blue-400">${item.qty}</td>
          <td class="p-4 max-w-[200px] truncate">${hosp ? hosp.name : 'Unknown'}</td>
          <td class="p-4 font-mono text-xs text-slate-400">${item.ticket_no}</td>
          <td class="p-4">${item.created_date}</td>
          <td class="p-4"><span class="px-2 py-0.5 rounded text-xs ${item.status === 'Approved' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse'}">${item.status}</span></td>
        `;
        body.appendChild(row);
      });
    } 
    
    else if (state.activeProcurementTab === 'pr') {
      head.innerHTML = `
        <tr>
          <th class="p-4">Requisition No</th>
          <th class="p-4">Device Requested</th>
          <th class="p-4 text-center">Qty</th>
          <th class="p-4">Sourcing Facility</th>
          <th class="p-4">Engineering Remark</th>
          <th class="p-4">Status</th>
        </tr>
      `;

      if (!data.procurement_pr || data.procurement_pr.length === 0) {
        body.innerHTML = `<tr><td colspan="6" class="p-8 text-center text-slate-500">No requisitions active.</td></tr>`;
        return;
      }

      data.procurement_pr.forEach(item => {
        const hosp = data.hospitals.find(h => h.id === item.facility_id);
        const row = document.createElement('tr');
        row.className = 'hover:bg-slate-800/30 transition text-slate-300';
        row.innerHTML = `
          <td class="p-4 font-bold text-white">${item.pr_no}</td>
          <td class="p-4 font-semibold text-slate-200">${item.device_name}</td>
          <td class="p-4 text-center font-bold text-blue-400">${item.qty}</td>
          <td class="p-4 max-w-[200px] truncate">${hosp ? hosp.name : 'Unknown'}</td>
          <td class="p-4 max-w-[250px] truncate text-slate-400">${item.remark || 'N/A'}</td>
          <td class="p-4"><span class="px-2 py-0.5 rounded text-xs ${item.status === 'Converted to PO' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'}">${item.status}</span></td>
        `;
        body.appendChild(row);
      });
    } 
    
    else if (state.activeProcurementTab === 'po') {
      head.innerHTML = `
        <tr>
          <th class="p-4">Purchase Order</th>
          <th class="p-4">Equipment Specs</th>
          <th class="p-4 text-center">Qty</th>
          <th class="p-4 text-right">Unit Price</th>
          <th class="p-4 text-right">Net Value</th>
          <th class="p-4">Vendor Partner</th>
          <th class="p-4">PO Status</th>
        </tr>
      `;

      if (!data.procurement_po || data.procurement_po.length === 0) {
        body.innerHTML = `<tr><td colspan="7" class="p-8 text-center text-slate-500">No Purchase Orders initialized.</td></tr>`;
        return;
      }

      data.procurement_po.forEach(item => {
        const row = document.createElement('tr');
        row.className = 'hover:bg-slate-800/30 transition text-slate-300';
        row.innerHTML = `
          <td class="p-4 font-bold text-white">${item.po_no}</td>
          <td class="p-4 font-semibold text-slate-200">${item.device_name}</td>
          <td class="p-4 text-center font-bold text-blue-400">${item.qty}</td>
          <td class="p-4 text-right">₹${item.unit_price.toLocaleString('en-IN')}</td>
          <td class="p-4 text-right font-bold text-purple-400">₹${item.final_amount.toLocaleString('en-IN')}</td>
          <td class="p-4 text-slate-300 font-semibold">${item.vendor}</td>
          <td class="p-4"><span class="px-2 py-0.5 rounded text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">${item.status}</span></td>
        `;
        body.appendChild(row);
      });
    }
  }

  // --- PENALTY CONFIG MATRIX ---
  async function renderPenaltyMatrix() {
    const data = await window.DB.executeQuery('data');
    
    const configEl = document.getElementById('penalty-config-list');
    configEl.innerHTML = `
      <div class="bg-[#0b0f19] p-3 rounded-xl flex justify-between border border-slate-800">
        <span class="text-slate-400">Response SLA limit</span>
        <span class="font-bold text-white">${data.settings.sla_attend_hours} Hours</span>
      </div>
      <div class="bg-[#0b0f19] p-3 rounded-xl flex justify-between border border-slate-800">
        <span class="text-slate-400">Resolution SLA limit</span>
        <span class="font-bold text-white">${data.settings.sla_close_hours} Hours</span>
      </div>
      <div class="bg-[#0b0f19] p-3 rounded-xl flex justify-between border border-slate-800">
        <span class="text-slate-400">Penalty Slab Period</span>
        <span class="font-bold text-white">${data.settings.penalty_period_hours} Hours</span>
      </div>
    `;

    const tblSlabs = document.getElementById('tbl-penalty-slabs');
    tblSlabs.innerHTML = data.penalty_slabs.map((s, idx) => `
      <tr class="border-b border-slate-800 text-slate-300">
        <td class="py-3 font-semibold text-white">Slab Grade ${idx + 1}</td>
        <td class="py-3 text-slate-400">${s.max_value === 99999999 ? 'No limit (High End Assets)' : `Up to ₹${s.max_value.toLocaleString('en-IN')}`}</td>
        <td class="py-3 text-right font-bold text-rose-400">₹${s.per_period.toLocaleString('en-IN')}</td>
      </tr>
    `).join('');

    const tblBreaches = document.getElementById('tbl-breached-penalties');
    tblBreaches.innerHTML = '';

    const complaints = data.complaints.map(c => {
      const eq = data.equipment.find(e => e.id === c.equipment_id);
      const calc = window.calculateSLAAndPenalty(c, eq, data.settings, data.penalty_slabs);
      return { ...c, calculations: calc, equipment: eq };
    });

    const activeBreaches = complaints.filter(c => c.calculations.penalty > 0);

    if (activeBreaches.length === 0) {
      tblBreaches.innerHTML = `<tr><td colspan="6" class="p-8 text-center text-slate-500">No active penalty exposures detected. All systems compliant.</td></tr>`;
      return;
    }

    activeBreaches.forEach(c => {
      const row = document.createElement('tr');
      row.className = 'border-b border-slate-800 text-slate-300';
      const assetValue = c.equipment?.asset_value || 0;
      const activeSlab = data.penalty_slabs.find(s => assetValue <= s.max_value) || data.penalty_slabs[data.penalty_slabs.length - 1];
      const slabName = activeSlab ? `₹${activeSlab.per_period}/day` : 'N/A';

      row.innerHTML = `
        <td class="py-3 font-bold text-white">${c.complaint_no}</td>
        <td class="py-3 font-mono text-cyan-400 text-xs">${c.equipment?.barcode || 'N/A'}</td>
        <td class="py-3 max-w-[200px] truncate">${data.hospitals.find(h => h.id === c.hospital_id)?.name || 'Unknown'}</td>
        <td class="py-3 font-semibold text-rose-400">${c.calculations.downtime_days * 24} Hours</td>
        <td class="py-3"><span class="px-2 py-0.5 rounded text-xs bg-purple-500/10 text-purple-400 border border-purple-500/20">${slabName}</span></td>
        <td class="py-3 text-right font-bold text-purple-400">₹${c.calculations.penalty.toLocaleString('en-IN')}</td>
      `;
      tblBreaches.appendChild(row);
    });
  }

  // --- SETTINGS CONTROLLER ---
  function loadSettings() {
    const mode = window.DB.connectionMode;
    const url = window.DB.apiUrl;
    
    document.getElementById('set-db-mode').value = mode;
    document.getElementById('set-api-url').value = url;
    
    const urlBox = document.getElementById('db-api-settings');
    if (mode === 'api') {
      urlBox.classList.remove('hidden');
    } else {
      urlBox.classList.add('hidden');
    }

    const local = window.DB.getData();
    document.getElementById('set-display-name').value = local.settings.displayName;
    document.getElementById('set-username').value = local.settings.username;
    document.getElementById('set-sla-attend').value = local.settings.sla_attend_hours;
    document.getElementById('set-sla-close').value = local.settings.sla_close_hours;
    document.getElementById('set-penalty-period').value = local.settings.penalty_period_hours;
  }

  async function handleSaveSettings(e) {
    e.preventDefault();
    const local = window.DB.getData();

    const displayName = document.getElementById('set-display-name').value;
    const username = document.getElementById('set-username').value;
    const slaAttend = parseInt(document.getElementById('set-sla-attend').value);
    const slaClose = parseInt(document.getElementById('set-sla-close').value);
    const penaltyPeriod = parseInt(document.getElementById('set-penalty-period').value);
    const newPass = document.getElementById('set-password').value;
    const confirmPass = document.getElementById('set-confirm-password').value;

    const statusEl = document.getElementById('settings-status');
    statusEl.className = 'p-3 rounded-lg text-sm hidden';

    if (newPass && newPass !== confirmPass) {
      statusEl.textContent = 'Error: Passwords do not match.';
      statusEl.className = 'p-3 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-lg text-sm block';
      return;
    }

    local.settings.displayName = displayName;
    local.settings.username = username;
    local.settings.sla_attend_hours = slaAttend;
    local.settings.sla_close_hours = slaClose;
    local.settings.penalty_period_hours = penaltyPeriod;

    if (newPass) {
      local.settings.passwordHash = await sha256(newPass);
    }

    window.DB.saveData(local);
    state.currentUser.displayName = displayName;
    state.currentUser.username = username;
    localStorage.setItem('oms_current_user', JSON.stringify(state.currentUser));
    
    document.getElementById('user-display-name').textContent = displayName;
    document.getElementById('user-initial').textContent = displayName[0];

    statusEl.textContent = 'Configurations saved successfully.';
    statusEl.className = 'p-3 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-lg text-sm block';
    
    setTimeout(() => {
      statusEl.className = 'hidden';
    }, 4000);
  }

  async function handleSaveDBConnection() {
    const mode = document.getElementById('set-db-mode').value;
    const url = document.getElementById('set-api-url').value;

    window.DB.setMode(mode, url);
    alert(`Database Profile updated to: ${mode.toUpperCase()}. Reloading indices...`);
    window.location.reload();
  }

  async function handleSimulateData() {
    if (confirm('Initiate synthetic data script (adds 100+ complaints and 15 equipment)?')) {
      const res = await window.DB.generateSimulatedData();
      if (res.success) {
        alert('Synthetic operations dataset injected into indices successfully!');
        window.location.reload();
      }
    }
  }

  async function handleResetDB() {
    if (confirm('Warning: Are you certain you want to purge all indices and revert database to defaults?')) {
      await window.DB.resetDatabase();
      alert('Database records initialized.');
      window.location.reload();
    }
  }

  // --- UNIVERSAL CSV INGESTION HUB ENGINE (Phase 2) ---
  function showUploadImportScreen() {
    document.getElementById('import-step-upload').classList.remove('hidden');
    document.getElementById('import-step-mapping').classList.add('hidden');
    document.getElementById('import-step-preview').classList.add('hidden');
  }

  function showMappingImportScreen() {
    document.getElementById('import-step-upload').classList.add('hidden');
    document.getElementById('import-step-mapping').classList.remove('hidden');
    document.getElementById('import-step-preview').classList.add('hidden');
  }

  function showPreviewImportScreen() {
    document.getElementById('import-step-upload').classList.add('hidden');
    document.getElementById('import-step-mapping').classList.add('hidden');
    document.getElementById('import-step-preview').classList.remove('hidden');
  }

  function loadCSVToIngestionPipeline(file) {
    const statusMsg = document.getElementById('import-status-msg');
    statusMsg.className = 'hidden w-full mt-4 p-3.5 rounded-xl text-sm';

    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      statusMsg.textContent = 'Error: Dataset file must be a .csv structure.';
      statusMsg.className = 'w-full mt-4 p-3.5 rounded-xl text-sm bg-rose-500/10 text-rose-400 border border-rose-500/20 block';
      return;
    }

    const type = document.getElementById('import-type').value;
    
    // Set required fields for mapping based on type
    if (type === 'complaints') {
      state.requiredKeys = ['complaint_no', 'barcode', 'hospital_id', 'di_name', 'raise_date', 'remarks', 'warranty_flag'];
    } else if (type === 'equipment') {
      state.requiredKeys = ['barcode', 'name', 'model', 'asset_value', 'hospital_id', 'warranty_expiry'];
    } else if (type === 'hospitals') {
      state.requiredKeys = ['district_id', 'name', 'hospital_type'];
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      state.rawCSVText = text;

      // Extract lines & parse headers
      const lines = text.split('\n');
      if (lines.length === 0 || !lines[0].trim()) {
        alert('Error: CSV file appears empty.');
        return;
      }

      state.csvHeaders = lines[0].split(',').map(h => h.trim().replace(/^["']|["']$/g, '').toLowerCase());
      state.csvRows = [];

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const values = parseCSVLineCells(line);
        state.csvRows.push(values);
      }

      buildMappingInterface();
      showMappingImportScreen();
    };
    reader.readAsText(file);
  }

  // Parse CSV cells handling quoted values with commas
  function parseCSVLineCells(line) {
    const result = [];
    let insideQuote = false;
    let currentCell = '';
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        insideQuote = !insideQuote;
      } else if (char === ',' && !insideQuote) {
        result.push(currentCell.trim().replace(/^["']|["']$/g, ''));
        currentCell = '';
      } else {
        currentCell += char;
      }
    }
    result.push(currentCell.trim().replace(/^["']|["']$/g, ''));
    return result;
  }

  function buildMappingInterface() {
    const container = document.getElementById('mapping-fields-container');
    container.innerHTML = '';

    state.requiredKeys.forEach(key => {
      // Auto mapping matches
      let matchedHeader = '';
      const alternatives = {
        'complaint_no': ['ticket', 'complaint', 'complaint no', 'ticket id', 'complaint_no'],
        'barcode': ['barcode', 'asset', 'equipment', 'asset code', 'equipment barcode'],
        'hospital_id': ['hospital', 'facility', 'hospital id', 'hospital_id', 'facility id'],
        'di_name': ['di', 'officer', 'reporter', 'name', 'di name'],
        'raise_date': ['date', 'raise date', 'logged', 'raise_date'],
        'remarks': ['remarks', 'detail', 'remarks', 'issue'],
        'warranty_flag': ['warranty', 'warranty flag', 'warranty status'],
        'name': ['name', 'equipment name', 'title'],
        'model': ['model', 'make', 'make/model'],
        'asset_value': ['value', 'asset value', 'cost', 'price'],
        'warranty_expiry': ['warranty expiry', 'expiry', 'warranty_expiry'],
        'district_id': ['district', 'district id', 'district_id'],
        'hospital_type': ['type', 'hospital type', 'hospital_type']
      };

      const matchCandidates = alternatives[key] || [key];
      state.csvHeaders.forEach(header => {
        if (matchCandidates.includes(header)) {
          matchedHeader = header;
        }
      });

      const optionsHtml = state.csvHeaders.map(h => `
        <option value="${h}" ${h === matchedHeader ? 'selected' : ''}>${h}</option>
      `).join('');

      container.innerHTML += `
        <div class="flex items-center justify-between bg-[#131a2b] p-3 rounded-xl border border-slate-800">
          <span class="text-sm font-semibold capitalize text-slate-300">${key.replace('_', ' ')}</span>
          <select data-mapping-key="${key}" class="bg-[#0b0f19] border border-slate-700/50 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500">
            <option value="">-- Choose CSV Column --</option>
            ${optionsHtml}
          </select>
        </div>
      `;
    });
  }

  function runMappingDryRun() {
    state.mappedColumns = {};
    document.querySelectorAll('[data-mapping-key]').forEach(select => {
      state.mappedColumns[select.getAttribute('data-mapping-key')] = select.value;
    });

    const head = document.getElementById('tbl-import-preview-head');
    const body = document.getElementById('tbl-import-preview-body');
    head.innerHTML = '';
    body.innerHTML = '';

    // Render Preview Headers
    let headerRowHtml = state.requiredKeys.map(key => `<th class="p-3">${key.replace('_', ' ')}</th>`).join('');
    headerRowHtml += `<th class="p-3">Status Log</th>`;
    head.innerHTML = `<tr>${headerRowHtml}</tr>`;

    // Process mapped rows
    const parsedRows = getParsedMappedRows();
    
    parsedRows.forEach((row, index) => {
      const tr = document.createElement('tr');
      tr.className = row.isValid ? 'bg-emerald-500/5 text-slate-300' : 'bg-rose-500/5 text-slate-300';
      
      let cellsHtml = state.requiredKeys.map(key => {
        return `<td class="p-3 font-semibold">${row.data[key] || '<span class="text-slate-500">N/A</span>'}</td>`;
      }).join('');

      cellsHtml += `<td class="p-3 font-bold text-xs ${row.isValid ? 'text-emerald-400' : 'text-rose-400'}">${row.statusLog}</td>`;
      tr.innerHTML = cellsHtml;
      body.appendChild(tr);
    });

    showPreviewImportScreen();
  }

  function getParsedMappedRows() {
    const results = [];
    const type = document.getElementById('import-type').value;

    state.csvRows.forEach((csvRow, rowIndex) => {
      const rowData = {};
      state.requiredKeys.forEach(key => {
        const csvHeader = state.mappedColumns[key];
        const headerIndex = state.csvHeaders.indexOf(csvHeader);
        rowData[key] = headerIndex !== -1 ? csvRow[headerIndex] : '';
      });

      // Basic validation rules
      let isValid = true;
      let statusLog = 'Valid';

      if (type === 'complaints') {
        if (!rowData.complaint_no) {
          isValid = false;
          statusLog = 'Missing complaint ID';
        } else if (!rowData.barcode) {
          isValid = false;
          statusLog = 'Missing asset barcode';
        }
      } else if (type === 'equipment') {
        if (!rowData.barcode) {
          isValid = false;
          statusLog = 'Missing barcode';
        } else if (!rowData.name) {
          isValid = false;
          statusLog = 'Missing asset name';
        }
      }

      results.push({ data: rowData, isValid, statusLog });
    });

    return results;
  }

  async function commitImportedRecords() {
    const type = document.getElementById('import-type').value;
    const parsed = getParsedMappedRows().filter(r => r.isValid).map(r => r.data);
    
    if (parsed.length === 0) {
      alert('No valid records to commit.');
      return;
    }

    const res = await window.DB.importData(type, parsed);
    alert(`Import transaction completed successfully. ${res.count} records saved to database indices.`);
    showUploadImportScreen();
    window.location.hash = `#${type === 'hospitals' ? 'dashboard' : type}`;
  }

  // --- SEARCH MODAL (CTRL+K) ---
  function openSearchModal() {
    document.getElementById('modal-search').classList.remove('hidden');
    document.getElementById('modal-search-input').focus();
  }

  function closeSearchModal() {
    document.getElementById('modal-search').classList.add('hidden');
    document.getElementById('modal-search-input').value = '';
    document.getElementById('modal-search-results').innerHTML = '<p class="text-slate-500 text-xs text-center py-6">Begin typing to scan indices...</p>';
  }

  async function handleGlobalSearch(e) {
    const query = e.target.value.toLowerCase().trim();
    const resultsContainer = document.getElementById('modal-search-results');
    
    if (query.length < 2) {
      resultsContainer.innerHTML = '<p class="text-slate-500 text-xs text-center py-6">Begin typing to scan indices...</p>';
      return;
    }

    const data = await window.DB.executeQuery('data');
    const matchedComplaints = data.complaints.filter(c => c.complaint_no.toLowerCase().includes(query) || c.di_name.toLowerCase().includes(query));
    const matchedEquipment = data.equipment.filter(e => e.barcode.toLowerCase().includes(query) || e.name.toLowerCase().includes(query));
    
    resultsContainer.innerHTML = '';

    if (matchedComplaints.length === 0 && matchedEquipment.length === 0) {
      resultsContainer.innerHTML = '<p class="text-slate-500 text-xs text-center py-6">No matching indices found in database.</p>';
      return;
    }

    if (matchedComplaints.length > 0) {
      const section = document.createElement('div');
      section.className = 'space-y-2 pb-2';
      section.innerHTML = `<span class="text-slate-400 font-bold text-xs uppercase tracking-wider">Complaints (${matchedComplaints.length})</span>`;
      
      matchedComplaints.forEach(c => {
        const item = document.createElement('div');
        item.className = 'p-2 hover:bg-slate-800 rounded cursor-pointer flex justify-between text-sm';
        item.innerHTML = `<span class="font-bold text-white">${c.complaint_no}</span><span class="text-slate-400">${c.di_name}</span>`;
        item.addEventListener('click', () => {
          closeSearchModal();
          window.location.hash = `#complaints/${c.id}`;
        });
        section.appendChild(item);
      });
      resultsContainer.appendChild(section);
    }

    if (matchedEquipment.length > 0) {
      const section = document.createElement('div');
      section.className = 'space-y-2 pt-2';
      section.innerHTML = `<span class="text-slate-400 font-bold text-xs uppercase tracking-wider">Equipment (${matchedEquipment.length})</span>`;
      
      matchedEquipment.forEach(eq => {
        const item = document.createElement('div');
        item.className = 'p-2 hover:bg-slate-800 rounded cursor-pointer flex justify-between text-sm';
        item.innerHTML = `<span class="font-mono text-cyan-400">${eq.barcode}</span><span class="text-slate-400">${eq.name}</span>`;
        item.addEventListener('click', () => {
          closeSearchModal();
          window.location.hash = `#equipment`;
          document.getElementById('eq-search').value = eq.barcode;
          renderEquipment();
        });
        section.appendChild(item);
      });
      resultsContainer.appendChild(section);
    }
  }

  async function sha256(message) {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
});
