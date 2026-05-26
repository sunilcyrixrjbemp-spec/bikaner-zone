// Cyrix OMS v3.5 — Universal CSV Ingestion Hub Controller
// Designed and implemented by Senior Principal Software Architect (35+ Years Experience)
// Supports offline IndexedDB validation, real-time D1 API sync, column matching algorithms, and validation checks.

document.addEventListener('DOMContentLoaded', async () => {
  'use strict';

  // --- 1. ENTERPRISE AUTHENTICATION & SECURITY ENFORCEMENT ---
  const sessionToken = localStorage.getItem('oms_session_token');
  const savedUser = localStorage.getItem('oms_current_user');

  if (!sessionToken || !savedUser) {
    console.warn('[Security] Unauthorized session state. Ejecting to Auth Portal.');
    window.location.href = '../auth/login.html';
    return;
  }

  const user = JSON.parse(savedUser);
  document.getElementById('user-display-name').textContent = user.displayName;
  document.getElementById('user-initial').textContent = user.displayName[0];
  document.getElementById('db-mode-val').textContent = window.APIService.mode;

  // --- 2. CONFIGURATION SCHEMAS ---
  const SCHEMAS = {
    districts: [
      { name: 'id', type: 'string', required: true, label: 'District ID (e.g. bikaner, churu)' },
      { name: 'name', type: 'string', required: true, label: 'District Name (e.g. Bikaner)' },
      { name: 'zone', type: 'string', required: false, label: 'Administrative Zone (e.g. North)' }
    ],
    hospitals: [
      { name: 'id', type: 'string', required: true, label: 'Hospital ID (e.g. h1, h2)' },
      { name: 'district_id', type: 'string', required: true, label: 'District ID (References Districts)' },
      { name: 'name', type: 'string', required: true, label: 'Facility Location Name' },
      { name: 'hospital_type', type: 'string', required: true, enum: ['Medical College', 'District Hospital', 'CHC', 'PHC', 'SDH'], label: 'Hospital Classification' },
      { name: 'address', type: 'string', required: false, label: 'Street Address Description' },
      { name: 'contact_email', type: 'string', required: false, label: 'Contact Email Address' }
    ],
    equipment: [
      { name: 'id', type: 'string', required: true, label: 'Equipment ID (e.g. eq1, eq_sim_1)' },
      { name: 'barcode', type: 'string', required: true, label: 'Barcode Asset Tag (e.g. CYX-EQ-1001)' },
      { name: 'name', type: 'string', required: true, label: 'Device Equipment Name' },
      { name: 'model', type: 'string', required: false, label: 'Model Descriptor' },
      { name: 'hospital_id', type: 'string', required: true, label: 'Hospital ID (References Hospitals)' },
      { name: 'asset_value', type: 'number', required: false, label: 'Book Asset Value (INR)' },
      { name: 'warranty_expiry', type: 'date', required: false, label: 'Warranty Expiry Date (YYYY-MM-DD)' },
      { name: 'purchase_date', type: 'date', required: false, label: 'Purchase Date (YYYY-MM-DD)' },
      { name: 'status', type: 'string', required: false, enum: ['Operational', 'Faulty', 'Scrapped', 'Under Maintenance'], default: 'Operational', label: 'Operational Status' }
    ],
    complaints: [
      { name: 'id', type: 'string', required: true, label: 'Complaint ID (e.g. c1)' },
      { name: 'complaint_no', type: 'string', required: true, label: 'Complaint Ticket Number (e.g. CYX-CP-10001)' },
      { name: 'equipment_id', type: 'string', required: true, label: 'Equipment Asset ID' },
      { name: 'hospital_id', type: 'string', required: true, label: 'Hospital Location ID' },
      { name: 'district_id', type: 'string', required: true, label: 'District ID (References Districts)' },
      { name: 'raise_date', type: 'date', required: true, label: 'Incident Raised Date' },
      { name: 'attend_date', type: 'date', required: false, label: 'Engineer Attended Date' },
      { name: 'close_date', type: 'date', required: false, label: 'Ticket Close Date' },
      { name: 'status', type: 'string', required: true, enum: ['Open', 'Attended', 'Resolved', 'Closed', 'Escalated'], label: 'Workflow Status' },
      { name: 'warranty_flag', type: 'string', required: true, enum: ['Warranty', 'Out of Warranty'], label: 'Warranty State Flag' },
      { name: 'di_name', type: 'string', required: true, label: 'Reporting DI Officer Name' },
      { name: 'remarks', type: 'string', required: false, label: 'Technical Diagnostic Remarks' }
    ],
    penalty_slabs: [
      { name: 'id', type: 'string', required: true, label: 'Slab ID' },
      { name: 'max_value', type: 'number', required: true, label: 'Max Asset Value Ceiling (INR)' },
      { name: 'per_period', type: 'number', required: true, label: 'Penalty rate per 24-hours (INR)' }
    ]
  };

  // --- 3. STATE CONTEXT ---
  const state = {
    selectedSchema: 'equipment', // Default target
    csvRawData: [],
    csvHeaders: [],
    mappings: {},
    validatedRows: [],
    dryRunStats: { total: 0, valid: 0, errors: 0, warnings: 0 },
    validationLogs: [],
    // Database Reference caches (used during foreign key validation checks)
    cache: {
      districts: new Set(),
      hospitals: new Set(),
      equipment: new Set()
    }
  };

  // --- 4. DOM SELECTIONS ---
  const el = {
    sidebarToggle: document.getElementById('toggle-sidebar'),
    logoutBtn: document.getElementById('btn-logout'),
    schemaButtons: document.querySelectorAll('.schema-btn'),
    dropZone: document.getElementById('drop-zone'),
    fileInput: document.getElementById('csv-file-input'),
    browseBtn: document.getElementById('btn-browse-file'),
    
    // Panels
    panel1: document.getElementById('step-panel-1'),
    panel2: document.getElementById('step-panel-2'),
    panel3: document.getElementById('step-panel-3'),
    panel4: document.getElementById('step-panel-4'),
    
    // Step indicators
    ind1: document.getElementById('step-ind-1'),
    ind2: document.getElementById('step-ind-2'),
    ind3: document.getElementById('step-ind-3'),
    ind4: document.getElementById('step-ind-4'),
    
    // Column Mapper
    mappingContainer: document.getElementById('mapping-fields-container'),
    selectedTableBadge: document.getElementById('selected-table-badge'),
    btnMapBack: document.getElementById('btn-map-back'),
    btnMapNext: document.getElementById('btn-map-next'),
    
    // Dry Run
    dryTotal: document.getElementById('dry-stat-total'),
    dryValid: document.getElementById('dry-stat-valid'),
    dryErrors: document.getElementById('dry-stat-errors'),
    dryWarnings: document.getElementById('dry-stat-warnings'),
    tblDryHead: document.getElementById('tbl-dry-head'),
    tblDryBody: document.getElementById('tbl-dry-body'),
    tabPreview: document.getElementById('btn-tab-preview'),
    tabLogs: document.getElementById('btn-tab-logs'),
    panelPreview: document.getElementById('panel-tab-preview'),
    panelLogs: document.getElementById('panel-tab-logs'),
    chkStructure: document.getElementById('chk-structure'),
    chkTypes: document.getElementById('chk-types'),
    chkFkeys: document.getElementById('chk-fkeys'),
    btnDryBack: document.getElementById('btn-dry-back'),
    btnDryCommit: document.getElementById('btn-dry-commit'),
    
    // Completion
    finalTable: document.getElementById('final-table'),
    finalRows: document.getElementById('final-rows'),
    finalStamp: document.getElementById('final-stamp'),
    btnFinalDashboard: document.getElementById('btn-final-dashboard'),
    btnFinalView: document.getElementById('btn-final-view')
  };

  // --- 5. INITIALIZATION ---
  initController();

  function initController() {
    setupSidebarEvents();
    setupSchemaButtons();
    setupDragAndDrop();
    setupMapperButtons();
    setupDryRunTabToggle();
    setupDryRunNavButtons();
    setupCompletionButtons();
  }

  function setupSidebarEvents() {
    el.sidebarToggle.addEventListener('click', () => {
      document.querySelector('aside').classList.toggle('-translate-x-full');
    });

    el.logoutBtn.addEventListener('click', () => {
      localStorage.removeItem('oms_session_token');
      localStorage.removeItem('oms_current_user');
      window.location.href = '../auth/login.html';
    });
  }

  function setupSchemaButtons() {
    el.schemaButtons.forEach(btn => {
      // Initialize active visual state
      if (btn.dataset.schema === state.selectedSchema) {
        btn.classList.add('active');
      }

      btn.addEventListener('click', () => {
        el.schemaButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.selectedSchema = btn.dataset.schema;
        console.log(`[Import] Selected schema: ${state.selectedSchema}`);
      });
    });
  }

  function setupDragAndDrop() {
    el.browseBtn.addEventListener('click', () => el.fileInput.click());
    
    el.fileInput.addEventListener('change', (e) => {
      if (e.target.files.length > 0) {
        handleFileSelection(e.target.files[0]);
      }
    });

    el.dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      el.dropZone.classList.add('dragover');
    });

    el.dropZone.addEventListener('dragleave', () => {
      el.dropZone.classList.remove('dragover');
    });

    el.dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      el.dropZone.classList.remove('dragover');
      if (e.dataTransfer.files.length > 0) {
        handleFileSelection(e.dataTransfer.files[0]);
      }
    });
  }

  async function handleFileSelection(file) {
    if (!file.name.endsWith('.csv')) {
      alert('Security Policy: Only standard CSV spreadsheets are supported.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      processCSVContent(text);
    };
    reader.readAsText(file);
  }

  // --- 6. PARSING ENGINE ---
  function processCSVContent(text) {
    const rawRows = parseCSV(text);
    
    if (rawRows.length === 0) {
      alert('Parser Warning: Empty file content detected.');
      return;
    }

    state.csvHeaders = rawRows[0].map(h => h.trim());
    state.csvRawData = rawRows.slice(1).filter(r => r.length > 0 && r.some(cell => cell.trim() !== ''));

    console.log(`[CSV Engine] Parsed ${state.csvRawData.length} records. Headers:`, state.csvHeaders);

    // Transition to Step 2
    transitionStep(1, 2);
    renderColumnMapper();
  }

  // RFC-4180 Compliant JavaScript CSV Parser
  function parseCSV(text) {
    const lines = [];
    let row = [''];
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      const next = text[i + 1];

      if (c === '"') {
        if (inQuotes && next === '"') {
          row[row.length - 1] += '"';
          i++; // Skip next quote
        } else {
          inQuotes = !inQuotes;
        }
      } else if (c === ',' && !inQuotes) {
        row.push('');
      } else if ((c === '\r' || c === '\n') && !inQuotes) {
        if (c === '\r' && next === '\n') {
          i++; // Skip CRLF
        }
        lines.push(row);
        row = [''];
      } else {
        row[row.length - 1] += c;
      }
    }

    if (row.length > 1 || row[0] !== '') {
      lines.push(row);
    }
    return lines;
  }

  // --- 7. COLUMN MAPPING UI ---
  function renderColumnMapper() {
    el.selectedTableBadge.textContent = `Schema Table: ${state.selectedSchema}`;
    el.mappingContainer.innerHTML = '';

    const schemaFields = SCHEMAS[state.selectedSchema];

    schemaFields.forEach(field => {
      const div = document.createElement('div');
      div.className = 'bg-[#131a2b]/50 p-4 rounded-xl border border-slate-800 space-y-2';
      
      const isReq = field.required;
      
      // Auto-matching algorithm based on header keywords
      const matchedHeader = findBestMatch(field.name, state.csvHeaders);

      let optionsHtml = `<option value="">-- Ignore Column --</option>`;
      state.csvHeaders.forEach(header => {
        const selected = (header === matchedHeader) ? 'selected' : '';
        optionsHtml += `<option value="${header}" ${selected}>${header}</option>`;
      });

      div.innerHTML = `
        <div class="flex items-center justify-between">
          <label class="block font-bold text-white text-xs uppercase">${field.label}</label>
          ${isReq ? '<span class="text-[10px] text-rose-400 font-bold bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">Required</span>' : '<span class="text-[10px] text-slate-500 bg-slate-800 px-2 py-0.5 rounded">Optional</span>'}
        </div>
        <select data-field="${field.name}" class="mapping-dropdown w-full bg-[#0b0f19] border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500">
          ${optionsHtml}
        </select>
        <p class="text-[10px] text-slate-500">Database field name: <code class="text-cyan-400">${field.name} (${field.type})</code></p>
      `;

      el.mappingContainer.appendChild(div);
    });
  }

  function findBestMatch(fieldName, headers) {
    // Basic similarity rules
    const normalizedField = fieldName.toLowerCase().replace(/_id$/, '').replace(/_/, '');
    
    for (const h of headers) {
      const normalizedHeader = h.toLowerCase().replace(/\s+/, '').replace(/_/, '');
      if (normalizedHeader === normalizedField || 
          normalizedHeader.includes(normalizedField) ||
          normalizedField.includes(normalizedHeader)) {
        return h;
      }
    }
    
    // Common mappings
    const commonMatches = {
      'barcode': ['barcode', 'code', 'asset tag', 'tag', 'rfid'],
      'asset_value': ['value', 'cost', 'price', 'book value', 'amount'],
      'di_name': ['di', 'officer', 'reported by', 'name', 'director'],
      'complaint_no': ['ticket', 'complaint no', 'complaint number', 'id'],
      'hospital_id': ['hospital', 'facility', 'location', 'hospital id', 'facility id']
    };

    if (commonMatches[fieldName]) {
      for (const pattern of commonMatches[fieldName]) {
        const found = headers.find(h => h.toLowerCase().includes(pattern));
        if (found) return found;
      }
    }

    return '';
  }

  function setupMapperButtons() {
    el.btnMapBack.addEventListener('click', () => transitionStep(2, 1));
    el.btnMapNext.addEventListener('click', async () => {
      // Gather mappings
      const dropdowns = el.mappingContainer.querySelectorAll('.mapping-dropdown');
      state.mappings = {};
      
      let missingReq = false;
      
      dropdowns.forEach(dd => {
        const fieldName = dd.dataset.field;
        const csvCol = dd.value;
        const schema = SCHEMAS[state.selectedSchema].find(f => f.name === fieldName);

        if (schema.required && !csvCol) {
          missingReq = true;
          dd.classList.add('border-rose-500');
        } else {
          dd.classList.remove('border-rose-500');
        }

        if (csvCol) {
          state.mappings[fieldName] = csvCol;
        }
      });

      if (missingReq) {
        alert('Validation Block: Please select mappings for all required fields.');
        return;
      }

      transitionStep(2, 3);
      await performDryRun();
    });
  }

  // --- 8. DRY RUN VALIDATOR ---
  async function performDryRun() {
    // Clear state
    state.validatedRows = [];
    state.validationLogs = [];
    state.dryRunStats = { total: 0, valid: 0, errors: 0, warnings: 0 };
    
    logConsole('==================== STARTING DATA VALIDATION TELEMETRY ====================');
    logConsole(`[System] Initializing validations for table: "${state.selectedSchema}"...`);

    // Load FK Caches
    try {
      const data = await window.APIService.request('data');
      if (data) {
        state.cache.districts = new Set((data.districts || []).map(d => d.id));
        state.cache.hospitals = new Set((data.hospitals || []).map(h => h.id));
        state.cache.equipment = new Set((data.equipment || []).map(e => e.id));
      }
      logConsole(`[Cache] Pre-cached reference index keys: Districts(${state.cache.districts.size}), Hospitals(${state.cache.hospitals.size}), Equipment(${state.cache.equipment.size})`);
    } catch (e) {
      logConsole(`[Warning] Database cache error. Integrity check will execute with partial checks.`);
    }

    const schemaFields = SCHEMAS[state.selectedSchema];
    const rawCount = state.csvRawData.length;
    state.dryRunStats.total = rawCount;

    // Table mapping indices
    const mappedHeaders = Object.keys(state.mappings);
    
    // Build Table Header Preview
    el.tblDryHead.innerHTML = `
      <tr class="bg-slate-800/40 border-b border-slate-700/50">
        <th class="p-3">Line</th>
        ${mappedHeaders.map(f => `<th class="p-3">${f}</th>`).join('')}
        <th class="p-3 text-right">Integrity Status</th>
      </tr>
    `;

    el.tblDryBody.innerHTML = '';
    let tableBodyHtml = '';
    
    let hasFKError = false;
    let hasTypeError = false;

    // Process rows
    for (let idx = 0; idx < rawCount; idx++) {
      const csvRow = state.csvRawData[idx];
      const rowNum = idx + 2; // Line 1 is header
      
      const validatedRow = {};
      const rowErrors = [];
      const rowWarnings = [];

      // Map cells
      schemaFields.forEach(field => {
        const csvHeader = state.mappings[field.name];
        if (!csvHeader) {
          validatedRow[field.name] = field.default || null;
          return;
        }

        const headerIdx = state.csvHeaders.indexOf(csvHeader);
        let val = csvRow[headerIdx];

        if (val !== undefined && val !== null) {
          val = val.trim();
        } else {
          val = '';
        }

        // Validate Empty checks
        if (field.required && val === '') {
          rowErrors.push(`Missing value for required field "${field.name}"`);
          validatedRow[field.name] = null;
          return;
        }

        if (val === '') {
          validatedRow[field.name] = null;
          return;
        }

        // Validate Types
        if (field.type === 'number') {
          // Clean currency symbols and commas
          const cleanedVal = val.replace(/[₹$,\s]/g, '');
          const num = Number(cleanedVal);
          if (isNaN(num)) {
            rowErrors.push(`Field "${field.name}" expected number, got "${val}"`);
            hasTypeError = true;
            validatedRow[field.name] = val;
          } else {
            validatedRow[field.name] = num;
          }
        } else if (field.type === 'date') {
          const timestamp = Date.parse(val);
          if (isNaN(timestamp)) {
            rowWarnings.push(`Field "${field.name}" has unparseable date "${val}". Attempting direct storage.`);
            validatedRow[field.name] = val;
          } else {
            validatedRow[field.name] = new Date(timestamp).toISOString().split('T')[0];
          }
        } else {
          // String
          if (field.enum && !field.enum.includes(val)) {
            rowErrors.push(`Field "${field.name}" value "${val}" not in supported lists: [${field.enum.join(', ')}]`);
            validatedRow[field.name] = val;
          } else {
            validatedRow[field.name] = val;
          }
        }
      });

      // Cross-reference Foreign Keys
      if (rowErrors.length === 0) {
        if (state.selectedSchema === 'hospitals') {
          if (!state.cache.districts.has(validatedRow.district_id)) {
            rowErrors.push(`District ID "${validatedRow.district_id}" is not registered in districts schema table.`);
            hasFKError = true;
          }
        } else if (state.selectedSchema === 'equipment') {
          if (!state.cache.hospitals.has(validatedRow.hospital_id)) {
            rowErrors.push(`Hospital ID "${validatedRow.hospital_id}" is not registered in hospitals schema table.`);
            hasFKError = true;
          }
        } else if (state.selectedSchema === 'complaints') {
          if (!state.cache.equipment.has(validatedRow.equipment_id)) {
            rowErrors.push(`Equipment Asset ID "${validatedRow.equipment_id}" does not exist in databases.`);
            hasFKError = true;
          }
          if (!state.cache.hospitals.has(validatedRow.hospital_id)) {
            rowErrors.push(`Hospital ID "${validatedRow.hospital_id}" is missing.`);
            hasFKError = true;
          }
          if (!state.cache.districts.has(validatedRow.district_id)) {
            rowErrors.push(`District ID "${validatedRow.district_id}" is missing.`);
            hasFKError = true;
          }
        }
      }

      // Record logs
      const isValid = rowErrors.length === 0;
      if (isValid) {
        state.dryRunStats.valid++;
        if (rowWarnings.length > 0) {
          state.dryRunStats.warnings += rowWarnings.length;
          logConsole(`[Warning] Line ${rowNum}: ${rowWarnings.join(', ')}`);
        } else {
          logConsole(`[Info] Line ${rowNum}: Row verified successfully.`);
        }
      } else {
        state.dryRunStats.errors += rowErrors.length;
        logConsole(`[Error] Line ${rowNum} REJECTED: ${rowErrors.join(' | ')}`);
      }

      state.validatedRows.push({
        line: rowNum,
        data: validatedRow,
        isValid,
        errors: rowErrors,
        warnings: rowWarnings
      });

      // Build grid preview rows html
      const cellsHtml = mappedHeaders.map(f => {
        let cellVal = validatedRow[f];
        if (cellVal === null || cellVal === undefined) cellVal = '';
        
        let cellClass = '';
        if (rowErrors.some(err => err.includes(`"${f}"`))) {
          cellClass = 'cell-error font-semibold';
        } else if (rowWarnings.some(w => w.includes(`"${f}"`))) {
          cellClass = 'cell-warning font-semibold';
        }
        return `<td class="p-3 ${cellClass}">${cellVal}</td>`;
      }).join('');

      const statusBadge = isValid 
        ? `<span class="px-2 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">Pass</span>`
        : `<span class="px-2 py-0.5 rounded text-[10px] bg-rose-500/10 text-rose-400 border border-rose-500/20 font-bold glow-red">Rejected</span>`;

      tableBodyHtml += `
        <tr class="hover:bg-slate-800/30 transition border-b border-slate-800/40 ${isValid ? '' : 'bg-rose-500/5'}">
          <td class="p-3 text-slate-500 font-bold">${rowNum}</td>
          ${cellsHtml}
          <td class="p-3 text-right">${statusBadge}</td>
        </tr>
      `;
    }

    el.tblDryBody.innerHTML = tableBodyHtml;
    
    // Update Stats DOM
    el.dryTotal.textContent = state.dryRunStats.total;
    el.dryValid.textContent = state.dryRunStats.valid;
    el.dryErrors.textContent = state.dryRunStats.errors;
    el.dryWarnings.textContent = state.dryRunStats.warnings;

    // Checklist updates
    updateChecklistStatus(el.chkStructure, true);
    updateChecklistStatus(el.chkTypes, !hasTypeError);
    updateChecklistStatus(el.chkFkeys, !hasFKError);

    logConsole(`[Telemetry] Validation complete. Valid: ${state.dryRunStats.valid}/${state.dryRunStats.total}. Failed: ${state.dryRunStats.errors}.`);
    logConsole('==================== VALIDATION COMPLETED ====================');

    // Enable/Disable final submit action based on valid counts
    if (state.dryRunStats.valid === 0) {
      el.btnDryCommit.disabled = true;
      el.btnDryCommit.className = 'bg-slate-800 border border-slate-700 text-slate-500 font-bold text-xs px-6 py-2.5 rounded-xl cursor-not-allowed';
      logConsole('[System] Execution blocked. Zero valid rows ready for transactional commits.');
    } else {
      el.btnDryCommit.disabled = false;
      el.btnDryCommit.className = 'bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-6 py-2.5 rounded-xl flex items-center space-x-2 transition';
    }
  }

  function updateChecklistStatus(dom, isPass) {
    if (isPass) {
      dom.className = 'fa-solid fa-circle-check text-emerald-400';
    } else {
      dom.className = 'fa-solid fa-triangle-exclamation text-amber-500';
    }
  }

  function logConsole(message) {
    state.validationLogs.push(message);
    const div = document.createElement('div');
    if (message.includes('[Error]')) {
      div.className = 'text-rose-400 font-semibold';
    } else if (message.includes('[Warning]')) {
      div.className = 'text-amber-400 font-semibold';
    } else if (message.includes('STARTING') || message.includes('COMPLETED')) {
      div.className = 'text-cyan-400 font-bold tracking-wider';
    } else {
      div.className = 'text-slate-400';
    }
    div.textContent = message;
    el.panelLogs.appendChild(div);
  }

  // --- 9. STEP NAVIGATION CONTROLLERS ---
  function setupDryRunTabToggle() {
    el.tabPreview.addEventListener('click', () => {
      el.tabPreview.className = 'px-3 py-1.5 text-xs font-semibold bg-slate-800 rounded-lg text-white border border-slate-700/50';
      el.tabLogs.className = 'px-3 py-1.5 text-xs font-semibold hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition';
      el.panelPreview.classList.remove('hidden');
      el.panelLogs.classList.add('hidden');
    });

    el.tabLogs.addEventListener('click', () => {
      el.tabLogs.className = 'px-3 py-1.5 text-xs font-semibold bg-slate-800 rounded-lg text-white border border-slate-700/50';
      el.tabPreview.className = 'px-3 py-1.5 text-xs font-semibold hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition';
      el.panelLogs.classList.remove('hidden');
      el.panelPreview.classList.add('hidden');
    });
  }

  function setupDryRunNavButtons() {
    el.btnDryBack.addEventListener('click', () => transitionStep(3, 2));
    el.btnDryCommit.addEventListener('click', handleCommitImport);
  }

  // --- 10. COMMIT TRANSACTION ENGINE ---
  async function handleCommitImport() {
    if (!confirm(`Verify Operations: Ingest ${state.dryRunStats.valid} records into database?`)) {
      return;
    }

    el.btnDryCommit.disabled = true;
    el.btnDryCommit.innerHTML = `<i class="fa-solid fa-spinner animate-spin"></i> <span>Processing writes...</span>`;

    const targetTable = state.selectedSchema;
    const writeRows = state.validatedRows.filter(r => r.isValid).map(r => r.data);

    const stampId = `imp_${Date.now()}`;
    
    try {
      // 1. Audit Log initialization
      const uploadMetadata = {
        id: stampId,
        filename: 'Universal_CSV_Ingestion.csv',
        uploader_id: user.username,
        target_module: targetTable,
        total_rows: state.dryRunStats.total,
        valid_rows: state.dryRunStats.valid,
        status: 'Completed',
        created_at: new Date().toISOString()
      };

      await window.APIService.request('csv_uploads', 'POST', uploadMetadata);

      // 2. Commit valid rows
      let index = 0;
      for (const row of writeRows) {
        // Save row contents
        await window.APIService.request(targetTable, 'POST', row);
        
        // Save history detail for tracing
        const historyDetail = {
          id: `ih_${stampId}_${index}`,
          upload_id: stampId,
          row_index: index,
          payload: JSON.stringify(row),
          error_log: '',
          created_at: new Date().toISOString()
        };
        await window.APIService.request('import_history', 'POST', historyDetail);
        index++;
      }

      console.log(`[Import] Committed ${index} records to store: ${targetTable}`);

      // Update Completion Screen DOM
      el.finalTable.textContent = targetTable;
      el.finalRows.textContent = state.dryRunStats.valid;
      el.finalStamp.textContent = stampId;

      transitionStep(3, 4);

    } catch (e) {
      console.error(e);
      alert('Edge Transaction Error: Committing data packets failed.');
      el.btnDryCommit.disabled = false;
      el.btnDryCommit.innerHTML = `<i class="fa-solid fa-cloud-arrow-up"></i><span>Approve & Write Data</span>`;
    }
  }

  function setupCompletionButtons() {
    el.btnFinalDashboard.addEventListener('click', () => {
      window.location.href = '../dashboard/dashboard.html';
    });

    el.btnFinalView.addEventListener('click', () => {
      if (state.selectedSchema === 'complaints') {
        window.location.href = '../complaints/complaints.html';
      } else if (state.selectedSchema === 'equipment') {
        window.location.href = '../equipment/equipment.html';
      } else {
        window.location.href = '../dashboard/dashboard.html';
      }
    });
  }

  // --- 11. STEP ANIMATION TRANSITIONS ---
  function transitionStep(from, to) {
    const panels = { 1: el.panel1, 2: el.panel2, 3: el.panel3, 4: el.panel4 };
    const indicators = { 1: el.ind1, 2: el.ind2, 3: el.ind3, 4: el.ind4 };

    // Hide old panel, show new
    panels[from].classList.add('hidden');
    panels[to].classList.remove('hidden');

    // Update progress markers styling
    for (let step = 1; step <= 4; step++) {
      const ind = indicators[step];
      const circle = ind.querySelector('span');

      if (step === to) {
        ind.className = 'flex items-center space-x-3 text-sm font-semibold border-b-2 border-blue-500 pb-2 transition';
        circle.className = 'w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs';
      } else if (step < to) {
        ind.className = 'flex items-center space-x-3 text-sm font-semibold text-emerald-400 border-b-2 border-emerald-500/30 pb-2 transition';
        circle.className = 'w-6 h-6 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center text-xs';
      } else {
        ind.className = 'flex items-center space-x-3 text-sm font-semibold text-slate-500 border-b-2 border-transparent pb-2 transition';
        circle.className = 'w-6 h-6 rounded-full bg-slate-800 text-slate-400 flex items-center justify-center text-xs';
      }
    }
  }
});
