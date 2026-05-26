// Cyrix OMS v3.2 — Advanced Analytics Controller
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

  const charts = {};

  setupListeners();
  await refreshAnalytics();

  function setupListeners() {
    document.getElementById('btn-logout').addEventListener('click', () => {
      localStorage.removeItem('oms_session_token');
      localStorage.removeItem('oms_current_user');
      window.location.href = '../auth/login.html';
    });
  }

  async function refreshAnalytics() {
    try {
      const data = await window.APIService.request('data');
      if (!data) return;

      const complaints = data.complaints || [];
      const equipment = data.equipment || [];
      const hospitals = data.hospitals || [];
      const settings = data.settings;
      const slabs = data.penalty_slabs;

      // Map SLAEngine outputs
      const computedComplaints = complaints.map(c => {
        const eq = equipment.find(e => e.id === c.equipment_id);
        const calc = window.SLAEngine.calculate(c, eq, settings, slabs);
        return { ...c, calculations: calc };
      });

      renderAnalytics(computedComplaints, equipment, hospitals, settings, slabs);
    } catch (err) {
      console.error(err);
    }
  }

  function renderAnalytics(complaints, equipment, hospitals, settings, slabs) {
    // 1. Equipment Category Failures
    const failuresCtx = document.getElementById('chart-equip-failures')?.getContext('2d');
    if (failuresCtx) {
      const categories = {};
      complaints.forEach(c => {
        const eq = equipment.find(e => e.id === c.equipment_id);
        const typeName = eq ? eq.type : 'General';
        categories[typeName] = (categories[typeName] || 0) + 1;
      });

      charts.failures = new Chart(failuresCtx, {
        type: 'bar',
        data: {
          labels: Object.keys(categories),
          datasets: [{
            label: 'Failure Count',
            data: Object.values(categories),
            backgroundColor: 'rgba(139, 92, 246, 0.7)',
            borderColor: '#8b5cf6',
            borderWidth: 2,
            borderRadius: 4
          }]
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          plugins: { legend: { display: false } },
          scales: {
            x: { grid: { color: '#334155' }, ticks: { color: '#94a3b8' } },
            y: { grid: { display: false }, ticks: { color: '#94a3b8' } }
          }
        }
      });
    }

    // 2. Accrued Penalties Trend Line
    const trendCtx = document.getElementById('chart-penalty-trend')?.getContext('2d');
    if (trendCtx) {
      const months = [];
      const penaltyData = Array(6).fill(0);

      for (let i = 5; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        months.push(d.toLocaleString('default', { month: 'short', year: '2-digit' }));
      }

      complaints.forEach(c => {
        const index = months.findIndex(m => m === new Date(c.raise_date).toLocaleString('default', { month: 'short', year: '2-digit' }));
        if (index !== -1) {
          penaltyData[index] += c.calculations.penalty;
        }
      });

      charts.penaltyTrend = new Chart(trendCtx, {
        type: 'line',
        data: {
          labels: months,
          datasets: [{
            label: 'Penalty Incurred (₹)',
            data: penaltyData,
            borderColor: '#f43f5e',
            backgroundColor: 'rgba(244, 63, 94, 0.1)',
            fill: true,
            tension: 0.3,
            borderWidth: 3
          }]
        },
        options: {
          responsive: true,
          plugins: { legend: { labels: { color: '#94a3b8' } } },
          scales: {
            x: { grid: { color: '#334155' }, ticks: { color: '#94a3b8' } },
            y: { grid: { color: '#334155' }, ticks: { color: '#94a3b8' } }
          }
        }
      });
    }

    // 3. Resolution Time Distribution Histogram
    const distCtx = document.getElementById('chart-res-distribution')?.getContext('2d');
    if (distCtx) {
      const closed = complaints.filter(c => c.status === 'Closed');
      const ranges = ['< 1 Day', '1-2 Days', '2-5 Days', '5-10 Days', '10+ Days'];
      const counts = [0, 0, 0, 0, 0];

      closed.forEach(c => {
        const diff = Math.max(0, new Date(c.close_date) - new Date(c.raise_date));
        const days = diff / (1000 * 60 * 60 * 24);

        if (days < 1) counts[0]++;
        else if (days <= 2) counts[1]++;
        else if (days <= 5) counts[2]++;
        else if (days <= 10) counts[3]++;
        else counts[4]++;
      });

      charts.distribution = new Chart(distCtx, {
        type: 'bar',
        data: {
          labels: ranges,
          datasets: [{
            label: 'Resolved Tickets',
            data: counts,
            backgroundColor: '#06b6d4',
            borderRadius: 6
          }]
        },
        options: {
          responsive: true,
          plugins: { legend: { display: false } },
          scales: {
            x: { grid: { display: false }, ticks: { color: '#94a3b8' } },
            y: { grid: { color: '#334155' }, ticks: { color: '#94a3b8' } }
          }
        }
      });
    }

    // 4. Worst Performing Facilities (Top 10)
    const facilitiesCtx = document.getElementById('chart-worst-facilities')?.getContext('2d');
    if (facilitiesCtx) {
      const stats = {};
      complaints.forEach(c => {
        const hospName = hospitals.find(h => h.id === c.hospital_id)?.name || 'Facility';
        if (!stats[hospName]) {
          stats[hospName] = { count: 0, penalty: 0 };
        }
        stats[hospName].count++;
        stats[hospName].penalty += c.calculations.penalty;
      });

      const sorted = Object.entries(stats)
        .sort((a,b) => b[1].penalty - a[1].penalty)
        .slice(0, 10);

      charts.worst = new Chart(facilitiesCtx, {
        type: 'bar',
        data: {
          labels: sorted.map(i => i[0]),
          datasets: [
            { label: 'Tickets', data: sorted.map(i => i[1].count), backgroundColor: 'rgba(59, 130, 246, 0.5)', yAxisID: 'y' },
            { label: 'Penalty (₹)', data: sorted.map(i => i[1].penalty), backgroundColor: '#f43f5e', yAxisID: 'y1' }
          ]
        },
        options: {
          responsive: true,
          plugins: { legend: { labels: { color: '#94a3b8' } } },
          scales: {
            x: { ticks: { color: '#94a3b8', maxRotation: 45, minRotation: 45 } },
            y: { type: 'linear', position: 'left', grid: { color: '#334155' }, ticks: { color: '#94a3b8' } },
            y1: { type: 'linear', position: 'right', grid: { drawOnChartArea: false }, ticks: { color: '#94a3b8' } }
          }
        }
      });
    }
  }
});
