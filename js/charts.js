// Cyrix OMS v3.0 — Advanced Charting Engine
// Built by Lead CTO & Principal Architect (35+ years experience)
// Manages and renders 10 high-fidelity dashboards charts.

const Charts = {
  instances: {},

  destroyAll() {
    Object.keys(this.instances).forEach(key => {
      if (this.instances[key]) {
        this.instances[key].destroy();
      }
    });
    this.instances = {};
  },

  renderDashboard(data) {
    this.destroyAll();

    const complaints = data.complaints || [];
    const equipment = data.equipment || [];
    const districts = data.districts || [];
    const hospitals = data.hospitals || [];

    // Preprocess Data
    const open = complaints.filter(c => c.status === 'Open');
    const closed = complaints.filter(c => c.status === 'Closed');

    // 1. Monthly Trend Line (Raised vs Closed)
    this.renderMonthlyTrend(complaints);

    // 2. District Performance Bar Chart
    this.renderDistrictPerformance(complaints, districts);

    // 3. Hospital Type Distribution
    this.renderHospitalTypeDonut(complaints, hospitals);

    // 4. Complaint Aging Buckets
    this.renderAgingBuckets(open);

    // 5. SLA Compliance Gauge
    this.renderSlaCompliance(complaints);
  },

  renderAnalytics(data) {
    this.destroyAll();
    
    const complaints = data.complaints || [];
    const equipment = data.equipment || [];
    const hospitals = data.hospitals || [];
    const procurementPi = data.procurement_pi || [];
    const procurementPr = data.procurement_pr || [];
    const procurementPo = data.procurement_po || [];

    // 6. Equipment Category Failures (Heatmap style or Horizontal Bar)
    this.renderEquipmentFailures(complaints, equipment);

    // 7. Penalty Trend by Month
    this.renderPenaltyTrend(complaints, equipment, data.settings, data.penalty_slabs);

    // 8. Resolution Time Distribution (Histogram)
    this.renderResolutionTimeDistribution(complaints);

    // 9. Procurement Funnel
    this.renderProcurementFunnel(procurementPi, procurementPr, procurementPo);

    // 10. Top 10 Worst Facilities
    this.renderWorstFacilities(complaints, hospitals);
  },

  // --- CHART RENDERING IMPLEMENTATIONS ---

  renderMonthlyTrend(complaints) {
    const ctx = document.getElementById('chart-monthly-trend')?.getContext('2d');
    if (!ctx) return;

    // Last 6 months labels
    const months = [];
    const raisedData = Array(6).fill(0);
    const closedData = Array(6).fill(0);

    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      months.push(d.toLocaleString('default', { month: 'short', year: '2-digit' }));
    }

    complaints.forEach(c => {
      const raiseDate = new Date(c.raise_date);
      const raisedIndex = months.findIndex(m => m === raiseDate.toLocaleString('default', { month: 'short', year: '2-digit' }));
      if (raisedIndex !== -1) raisedData[raisedIndex]++;

      if (c.close_date) {
        const closeDate = new Date(c.close_date);
        const closedIndex = months.findIndex(m => m === closeDate.toLocaleString('default', { month: 'short', year: '2-digit' }));
        if (closedIndex !== -1) closedData[closedIndex]++;
      }
    });

    this.instances.monthlyTrend = new Chart(ctx, {
      type: 'line',
      data: {
        labels: months,
        datasets: [
          {
            label: 'Complaints Raised',
            data: raisedData,
            borderColor: '#3b82f6',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            fill: true,
            tension: 0.4,
            borderWidth: 3
          },
          {
            label: 'Complaints Resolved',
            data: closedData,
            borderColor: '#10b981',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            fill: true,
            tension: 0.4,
            borderWidth: 3
          }
        ]
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
  },

  renderDistrictPerformance(complaints, districts) {
    const ctx = document.getElementById('chart-district-perf')?.getContext('2d');
    if (!ctx) return;

    const labels = districts.map(d => d.name);
    const openData = Array(districts.length).fill(0);
    const closedData = Array(districts.length).fill(0);

    complaints.forEach(c => {
      const idx = districts.findIndex(d => d.id === c.district_id);
      if (idx !== -1) {
        if (c.status === 'Open') openData[idx]++;
        else closedData[idx]++;
      }
    });

    this.instances.districtPerf = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Open Complaints',
            data: openData,
            backgroundColor: '#ef4444'
          },
          {
            label: 'Resolved Complaints',
            data: closedData,
            backgroundColor: '#10b981'
          }
        ]
      },
      options: {
        responsive: true,
        plugins: { legend: { labels: { color: '#94a3b8' } } },
        scales: {
          x: { stacked: true, grid: { display: false }, ticks: { color: '#94a3b8' } },
          y: { stacked: true, grid: { color: '#334155' }, ticks: { color: '#94a3b8' } }
        }
      }
    });
  },

  renderHospitalTypeDonut(complaints, hospitals) {
    const ctx = document.getElementById('chart-hospital-type')?.getContext('2d');
    if (!ctx) return;

    const types = ['Medical College', 'District Hospital', 'CHC', 'PHC'];
    const counts = Array(types.length).fill(0);

    complaints.forEach(c => {
      const hosp = hospitals.find(h => h.id === c.hospital_id);
      if (hosp) {
        const idx = types.indexOf(hosp.hospital_type);
        if (idx !== -1) counts[idx]++;
      }
    });

    this.instances.hospitalType = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: types,
        datasets: [{
          data: counts,
          backgroundColor: ['#a855f7', '#3b82f6', '#10b981', '#f59e0b'],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: 'bottom', labels: { color: '#94a3b8' } }
        }
      }
    });
  },

  renderAgingBuckets(openComplaints) {
    const ctx = document.getElementById('chart-aging')?.getContext('2d');
    if (!ctx) return;

    const buckets = ['0-3 Days', '4-7 Days', '8-15 Days', '15+ Days'];
    const counts = [0, 0, 0, 0];
    const now = new Date();

    openComplaints.forEach(c => {
      const diffTime = Math.abs(now - new Date(c.raise_date));
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays <= 3) counts[0]++;
      else if (diffDays <= 7) counts[1]++;
      else if (diffDays <= 15) counts[2]++;
      else counts[3]++;
    });

    this.instances.aging = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: buckets,
        datasets: [{
          label: 'Complaints',
          data: counts,
          backgroundColor: ['#10b981', '#f59e0b', '#f97316', '#ef4444'],
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
  },

  renderSlaCompliance(complaints) {
    const ctx = document.getElementById('chart-sla-compliance')?.getContext('2d');
    if (!ctx) return;

    let breached = 0;
    complaints.forEach(c => {
      if (c.calculations?.closeBreach) breached++;
    });

    const compliant = complaints.length - breached;
    const rate = complaints.length > 0 ? Math.round((compliant / complaints.length) * 100) : 100;

    this.instances.slaCompliance = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Compliant', 'SLA Breached'],
        datasets: [{
          data: [compliant, breached],
          backgroundColor: ['#10b981', 'rgba(239, 68, 68, 0.2)'],
          borderWidth: 0,
          circumference: 180,
          rotation: 270
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: 'bottom', labels: { color: '#94a3b8' } }
        },
        aspectRatio: 1.8
      }
    });
  },

  renderEquipmentFailures(complaints, equipment) {
    const ctx = document.getElementById('chart-equip-failures')?.getContext('2d');
    if (!ctx) return;

    const categories = {};
    complaints.forEach(c => {
      const eq = equipment.find(e => e.id === c.equipment_id);
      const cat = eq ? eq.type : 'General';
      categories[cat] = (categories[cat] || 0) + 1;
    });

    const labels = Object.keys(categories);
    const data = Object.values(categories);

    this.instances.equipFailures = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Failure Count',
          data,
          backgroundColor: 'rgba(168, 85, 247, 0.7)',
          borderColor: '#a855f7',
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
  },

  renderPenaltyTrend(complaints, equipment, settings, slabs) {
    const ctx = document.getElementById('chart-penalty-trend')?.getContext('2d');
    if (!ctx) return;

    const months = [];
    const penaltyData = Array(6).fill(0);

    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      months.push(d.toLocaleString('default', { month: 'short', year: '2-digit' }));
    }

    complaints.forEach(c => {
      const raiseDate = new Date(c.raise_date);
      const idx = months.findIndex(m => m === raiseDate.toLocaleString('default', { month: 'short', year: '2-digit' }));
      if (idx !== -1) {
        const eq = equipment.find(e => e.id === c.equipment_id);
        const calc = calculateSLAAndPenalty(c, eq, settings, slabs);
        penaltyData[idx] += calc.penalty;
      }
    });

    this.instances.penaltyTrend = new Chart(ctx, {
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
  },

  renderResolutionTimeDistribution(complaints) {
    const ctx = document.getElementById('chart-res-distribution')?.getContext('2d');
    if (!ctx) return;

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

    this.instances.resDist = new Chart(ctx, {
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
  },

  renderProcurementFunnel(piList, prList, poList) {
    const ctx = document.getElementById('chart-proc-funnel')?.getContext('2d');
    if (!ctx) return;

    this.instances.procFunnel = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['Indent (PI)', 'Requisition (PR)', 'Purchase Order (PO)'],
        datasets: [{
          label: 'Volume',
          data: [piList.length, prList.length, poList.length],
          backgroundColor: ['#f59e0b', '#3b82f6', '#10b981'],
          borderRadius: 6,
          barThickness: 40
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
  },

  renderWorstFacilities(complaints, hospitals) {
    const ctx = document.getElementById('chart-worst-facilities')?.getContext('2d');
    if (!ctx) return;

    const facilityStats = {};
    complaints.forEach(c => {
      const hosp = hospitals.find(h => h.id === c.hospital_id);
      if (hosp) {
        if (!facilityStats[hosp.name]) {
          facilityStats[hosp.name] = { count: 0, penalty: 0 };
        }
        facilityStats[hosp.name].count++;
        facilityStats[hosp.name].penalty += c.penalty_total || 0;
      }
    });

    const sorted = Object.entries(facilityStats)
      .sort((a, b) => b[1].penalty - a[1].penalty || b[1].count - a[1].count)
      .slice(0, 10);

    const labels = sorted.map(item => item[0]);
    const counts = sorted.map(item => item[1].count);
    const penalties = sorted.map(item => item[1].penalty);

    this.instances.worstFacilities = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Total Tickets',
            data: counts,
            backgroundColor: 'rgba(59, 130, 246, 0.5)',
            yAxisID: 'y'
          },
          {
            label: 'Total Penalty (₹)',
            data: penalties,
            backgroundColor: '#ef4444',
            yAxisID: 'y1'
          }
        ]
      },
      options: {
        responsive: true,
        plugins: { legend: { labels: { color: '#94a3b8' } } },
        scales: {
          x: { ticks: { color: '#94a3b8', maxRotation: 45, minRotation: 45 } },
          y: {
            type: 'linear',
            position: 'left',
            grid: { color: '#334155' },
            ticks: { color: '#94a3b8' }
          },
          y1: {
            type: 'linear',
            position: 'right',
            grid: { drawOnChartArea: false },
            ticks: { color: '#94a3b8' }
          }
        }
      }
    });
  }
};

window.Charts = Charts;
