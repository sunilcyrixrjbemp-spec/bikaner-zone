// Cyrix OMS v3.5 — Advanced Mission Control Dashboard Controller
// Engineered by Senior Principal Software Architect (35+ Years Experience)
// Handles multi-metric charts, telemetry grids, live audit streams, and real-time synchronization.

document.addEventListener('DOMContentLoaded', async () => {
  'use strict';

  // --- 1. ENTERPRISE AUTHENTICATION & SECURITY ENFORCEMENT ---
  const sessionToken = localStorage.getItem('oms_session_token');
  const savedUser = localStorage.getItem('oms_current_user');
  
  if (!sessionToken || !savedUser) {
    console.warn('Authentication token missing. Redirecting to security gateway.');
    window.location.href = '../auth/login.html';
    return;
  }

  const user = JSON.parse(savedUser);
  document.getElementById('user-display-name').textContent = user.displayName;
  document.getElementById('user-initial').textContent = user.displayName[0];
  document.getElementById('db-mode-val').textContent = window.APIService.mode;

  // Chart cache instances
  const charts = {};

  // Setup Sidebar Controls & Security Session Monitoring
  setupInterfaceControls();
  startSessionWatchdog();

  // --- 2. INITIALIZE VIEW TELEMETRY ---
  await refreshDashboard();
  
  // Real-time refresh loop (Simulates 10-second sync updates)
  const syncInterval = setInterval(async () => {
    console.log('[Telemetry] Synchronizing database indices at edge nodes...');
    await refreshDashboard();
  }, 15000);

  window.addEventListener('beforeunload', () => {
    clearInterval(syncInterval);
  });

  // --- 3. CORE LOGIC IMPLEMENTATION ---

  function setupInterfaceControls() {
    // Logout Hook
    document.getElementById('btn-logout').addEventListener('click', () => {
      console.log('[Auth] Invalidating session tokens.');
      localStorage.removeItem('oms_session_token');
      localStorage.removeItem('oms_current_user');
      window.location.href = '../auth/login.html';
    });

    // Scaffolds Actions
    document.getElementById('btn-simulate-data').addEventListener('click', handleSimulationTrigger);
    document.getElementById('btn-reset-db').addEventListener('click', handlePurgeTrigger);

    // Sidebar Toggle for Mobile devices
    document.getElementById('toggle-sidebar').addEventListener('click', () => {
      const sidebar = document.querySelector('aside');
      sidebar.classList.toggle('-translate-x-full');
    });
  }

  function startSessionWatchdog() {
    // Automatically signs out user if inactivity limits are reached
    let lastAction = Date.now();
    const timeoutLimit = 8 * 60 * 60 * 1000; // 8 Hours

    const resetTimer = () => { lastAction = Date.now(); };
    window.addEventListener('mousemove', resetTimer);
    window.addEventListener('keydown', resetTimer);
    window.addEventListener('click', resetTimer);

    const watchdog = setInterval(() => {
      if (Date.now() - lastAction > timeoutLimit) {
        console.warn('Session inactive limit exceeded. Signing out user.');
        clearInterval(watchdog);
        localStorage.removeItem('oms_session_token');
        localStorage.removeItem('oms_current_user');
        window.location.href = '../auth/login.html';
      }
    }, 60000); // Check every minute
  }

  async function refreshDashboard() {
    try {
      // Fetch core datasets
      const data = await window.APIService.request('data');
      if (!data) return;

      const settings = data.settings || {};
      const slabs = data.penalty_slabs || [];
      const complaints = data.complaints || [];
      const equipment = data.equipment || [];
      const districts = data.districts || [];
      const hospitals = data.hospitals || [];

      // Process complaints data using SLA Engine
      const computedComplaints = complaints.map(c => {
        const eq = equipment.find(e => e.id === c.equipment_id);
        const calc = window.SLAEngine.calculate(c, eq, settings, slabs);
        return { ...c, calculations: calc };
      });

      // Update Alert ticker banner
      renderAlertTicker(computedComplaints, hospitals);

      // Aggregate KPI Metrics
      const totalCount = computedComplaints.length;
      const openList = computedComplaints.filter(c => c.status === 'Open');
      const closedList = computedComplaints.filter(c => c.status === 'Closed');
      
      const totalPenalty = computedComplaints.reduce((sum, c) => sum + c.calculations.penalty, 0);
      const activeBreaches = openList.filter(c => c.calculations.closeBreach).length;
      
      const complianceRate = totalCount > 0 
        ? Math.round(((totalCount - computedComplaints.filter(c => c.calculations.closeBreach).length) / totalCount) * 100) 
        : 100;

      // Update DOM Indicators
      document.getElementById('kpi-total').textContent = totalCount;
      document.getElementById('kpi-open').textContent = openList.length;
      document.getElementById('kpi-compliance').textContent = `${complianceRate}%`;
      document.getElementById('kpi-penalty').textContent = window.Formatters.currency(totalPenalty);

      // Build District Scorecard leaderboards
      const tblScorecards = document.getElementById('tbl-district-scorecards');
      tblScorecards.innerHTML = districts.map(d => {
        const dComplaints = computedComplaints.filter(c => c.district_id === d.id);
        const dOpen = dComplaints.filter(c => c.status === 'Open').length;
        const dClosed = dComplaints.filter(c => c.status === 'Closed').length;
        const dPenalty = dComplaints.reduce((sum, c) => sum + c.calculations.penalty, 0);
        const dBreached = dComplaints.filter(c => c.calculations.closeBreach).length;
        const dCompliance = dComplaints.length > 0 
          ? Math.round(((dComplaints.length - dBreached) / dComplaints.length) * 100) 
          : 100;

        return `
          <tr class="hover:bg-slate-800/25 transition border-b border-slate-800/40">
            <td class="py-3 font-semibold text-slate-200">${d.name}</td>
            <td class="py-3 font-mono">${dComplaints.length}</td>
            <td class="py-3 text-rose-400 font-mono">${dOpen}</td>
            <td class="py-3"><span class="px-2 py-0.5 rounded text-xs ${dCompliance >= 80 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'}">${dCompliance}%</span></td>
            <td class="py-3 text-right font-semibold text-purple-400 font-mono">${window.Formatters.currency(dPenalty)}</td>
          </tr>
        `;
      }).join('');

      // Render Charts
      updateDashboardCharts(computedComplaints, hospitals);

    } catch (err) {
      console.error('[Telemetry] Fails to query edge data metrics:', err);
    }
  }

  function renderAlertTicker(computedComplaints, hospitals) {
    const tickerBox = document.getElementById('ticker-container');
    const tickerText = document.getElementById('ticker-text');

    const breachedList = computedComplaints.filter(c => c.status === 'Open' && c.calculations.closeBreach);
    
    if (breachedList.length > 0) {
      tickerBox.classList.remove('hidden');
      tickerText.innerHTML = breachedList.map(b => {
        const hospName = hospitals.find(h => h.id === b.hospital_id)?.name || 'Facility';
        return `
          <span class="mr-12 text-rose-300">
            🚨 SLA OVERDUE: Complaint ID <span class="underline font-bold">${b.complaint_no}</span> at ${hospName} has breached resolution limit. Downtime: ${b.calculations.downtime_days} Days. Penalty: ${window.Formatters.currency(b.calculations.penalty)}.
          </span>
        `;
      }).join('');
    } else {
      tickerBox.classList.add('hidden');
    }
  }

  function updateDashboardCharts(complaints, hospitals) {
    // 1. Monthly Trend Chart
    const lineCtx = document.getElementById('chart-monthly-trend')?.getContext('2d');
    if (lineCtx) {
      if (charts.monthlyTrend) charts.monthlyTrend.destroy();

      const months = [];
      const raised = Array(6).fill(0);
      const resolved = Array(6).fill(0);

      for (let i = 5; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        months.push(d.toLocaleString('default', { month: 'short', year: '2-digit' }));
      }

      complaints.forEach(c => {
        const rIndex = months.findIndex(m => m === new Date(c.raise_date).toLocaleString('default', { month: 'short', year: '2-digit' }));
        if (rIndex !== -1) raised[rIndex]++;

        if (c.close_date) {
          const cIndex = months.findIndex(m => m === new Date(c.close_date).toLocaleString('default', { month: 'short', year: '2-digit' }));
          if (cIndex !== -1) resolved[cIndex]++;
        }
      });

      charts.monthlyTrend = new Chart(lineCtx, {
        type: 'line',
        data: {
          labels: months,
          datasets: [
            {
              label: 'Complaints Raised',
              data: raised,
              borderColor: '#3b82f6',
              backgroundColor: 'rgba(59, 130, 246, 0.05)',
              fill: true,
              tension: 0.35,
              borderWidth: 3,
              pointBackgroundColor: '#3b82f6'
            },
            {
              label: 'Complaints Resolved',
              data: resolved,
              borderColor: '#10b981',
              backgroundColor: 'rgba(16, 185, 129, 0.05)',
              fill: true,
              tension: 0.35,
              borderWidth: 3,
              pointBackgroundColor: '#10b981'
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'top', labels: { color: '#94a3b8', font: { family: 'Plus Jakarta Sans', size: 11 } } }
          },
          scales: {
            x: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#64748b', font: { size: 10 } } },
            y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#64748b', font: { size: 10 } } }
          }
        }
      });
    }

    // 2. Hospital Type Chart
    const donutCtx = document.getElementById('chart-hospital-type')?.getContext('2d');
    if (donutCtx) {
      if (charts.hospitalType) charts.hospitalType.destroy();

      const types = ['Medical College', 'District Hospital', 'CHC', 'PHC'];
      const counts = Array(types.length).fill(0);

      complaints.forEach(c => {
        const hosp = hospitals.find(h => h.id === c.hospital_id);
        if (hosp) {
          const idx = types.indexOf(hosp.hospital_type);
          if (idx !== -1) counts[idx]++;
        }
      });

      charts.hospitalType = new Chart(donutCtx, {
        type: 'doughnut',
        data: {
          labels: types,
          datasets: [{
            data: counts,
            backgroundColor: ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b'],
            borderWidth: 0,
            hoverOffset: 4
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'bottom', labels: { color: '#94a3b8', font: { family: 'Plus Jakarta Sans', size: 11 } } }
          },
          cutout: '70%'
        }
      });
    }

    // 3. SLA Compliance Gauge
    const gaugeCtx = document.getElementById('chart-sla-compliance')?.getContext('2d');
    if (gaugeCtx) {
      if (charts.slaCompliance) charts.slaCompliance.destroy();

      let breached = 0;
      complaints.forEach(c => {
        if (c.calculations?.closeBreach) breached++;
      });
      const compliant = complaints.length - breached;

      charts.slaCompliance = new Chart(gaugeCtx, {
        type: 'doughnut',
        data: {
          labels: ['Compliant', 'Breached'],
          datasets: [{
            data: [compliant, breached],
            backgroundColor: ['#10b981', 'rgba(244, 63, 94, 0.15)'],
            borderWidth: 0,
            circumference: 180,
            rotation: 270
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'bottom', labels: { color: '#94a3b8', font: { family: 'Plus Jakarta Sans', size: 11 } } }
          },
          aspectRatio: 1.8,
          cutout: '75%'
        }
      });
    }
  }

  async function handleSimulationTrigger() {
    if (confirm('Verify: Generate synthetic operations database (100+ tickets)?')) {
      const res = await window.APIService.request('simulate', 'POST');
      if (res && res.success) {
        alert('Synthetic operational data generated successfully!');
        window.location.reload();
      }
    }
  }

  async function handlePurgeTrigger() {
    if (confirm('Caution: Purge all operational logs? This is irreversible.')) {
      const res = await window.APIService.request('reset', 'POST');
      if (res && res.success) {
        alert('Data cleared successfully.');
        window.location.reload();
      }
    }
  }
});
