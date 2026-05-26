// Cyrix OMS v3.1 — Dual-Mode Database Engine & Simulator
// Designed by Lead CTO & Principal Architect (35+ years experience)

const STORAGE_KEY = 'cyrix_oms_data';

// Realistic Initial Seed Data
const INITIAL_SEED_DATA = {
  districts: [
    { id: 'bikaner', name: 'Bikaner' },
    { id: 'churu', name: 'Churu' },
    { id: 'ganganagar', name: 'Ganganagar' },
    { id: 'hanumangarh', name: 'Hanumangarh' }
  ],
  hospitals: [
    { id: 'h1', district_id: 'bikaner', name: 'PBM Government Hospital Bikaner', hospital_type: 'Medical College' },
    { id: 'h2', district_id: 'bikaner', name: 'District Hospital Nokha', hospital_type: 'District Hospital' },
    { id: 'h3', district_id: 'churu', name: 'DB General Hospital Churu', hospital_type: 'District Hospital' },
    { id: 'h4', district_id: 'churu', name: 'CHC Sujangarh', hospital_type: 'CHC' },
    { id: 'h5', district_id: 'ganganagar', name: 'Government Hospital Sri Ganganagar', hospital_type: 'District Hospital' },
    { id: 'h6', district_id: 'ganganagar', name: 'CHC Suratgarh', hospital_type: 'CHC' },
    { id: 'h7', district_id: 'hanumangarh', name: 'MGM District Hospital Hanumangarh', hospital_type: 'District Hospital' },
    { id: 'h8', district_id: 'hanumangarh', name: 'CHC Nohar', hospital_type: 'CHC' }
  ],
  equipment: [
    { id: 'eq1001', barcode: 'CYX-EQ-1001', name: '128-Slice CT Scanner', model: 'GE Optima 660', type: 'Imaging', hospital_id: 'h1', asset_value: 4500000, warranty_expiry: '2027-12-15', purchase_date: '2022-12-15' },
    { id: 'eq1002', barcode: 'CYX-EQ-1002', name: 'Digital X-Ray Machine', model: 'Siemens Multix Impact', type: 'Imaging', hospital_id: 'h1', asset_value: 1800000, warranty_expiry: '2026-05-10', purchase_date: '2021-05-10' },
    { id: 'eq1003', barcode: 'CYX-EQ-1003', name: 'ICU Ventilator', model: 'Philips Respironics V60', type: 'Life Support', hospital_id: 'h1', asset_value: 850000, warranty_expiry: '2025-08-20', purchase_date: '2020-08-20' },
    { id: 'eq1004', barcode: 'CYX-EQ-1004', name: 'PSA Oxygen Plant 500 LPM', model: 'Trident PSA-500', type: 'Gas Plant', hospital_id: 'h2', asset_value: 3500000, warranty_expiry: '2026-11-30', purchase_date: '2021-11-30' },
    { id: 'eq1005', barcode: 'CYX-EQ-1005', name: 'Color Doppler Ultrasound', model: 'Mindray DC-70', type: 'Imaging', hospital_id: 'h3', asset_value: 1200000, warranty_expiry: '2027-02-18', purchase_date: '2022-02-18' }
  ],
  complaints: [
    { id: 'c1001', complaint_no: 'CYX-CP-2026-001', equipment_id: 'eq1001', hospital_id: 'h1', district_id: 'bikaner', raise_date: '2026-05-10T10:00:00Z', attend_date: '2026-05-10T14:30:00Z', close_date: '2026-05-12T16:00:00Z', status: 'Closed', warranty_flag: 'Warranty', di_name: 'Dr. Ashok Verma', remarks: 'Resolved by replacing calibration cable under warranty.', downtime_days: 2.25, penalty_total: 0 },
    { id: 'c1002', complaint_no: 'CYX-CP-2026-002', equipment_id: 'eq1003', hospital_id: 'h1', district_id: 'bikaner', raise_date: '2026-05-12T09:00:00Z', attend_date: '2026-05-13T11:00:00Z', close_date: '', status: 'Open', warranty_flag: 'Out of Warranty', di_name: 'Sister Incharge ICU', remarks: 'Oxygen sensor showing fault. Escalated to vendor.', downtime_days: 14.5, penalty_total: 12500 }
  ],
  procurement_pi: [],
  procurement_pr: [],
  procurement_po: [],
  followups: [],
  remarks: [],
  settings: {
    username: 'Sunil',
    displayName: 'Sunil Kumar',
    passwordHash: 'e6900a0b67484dfc2826cf6f2e24cf81c3d180862024db49830fd17282b0e6bf', // Hash of 'Sunil@9784'
    sla_attend_hours: 24,
    sla_close_hours: 72,
    penalty_period_hours: 24,
    max_login_attempts: 3
  },
  penalty_slabs: [
    { id: 'slab1', max_value: 500000, per_period: 500 },
    { id: 'slab2', max_value: 2000000, per_period: 1500 },
    { id: 'slab3', max_value: 99999999, per_period: 3000 }
  ]
};

// Calculate downtime, breaches, and penalties
function calculateSLAAndPenalty(complaint, equipment, settings, slabs) {
  if (!equipment) return { status: 'Unknown', downtime_days: 0, penalty: 0 };
  
  const raiseDate = new Date(complaint.raise_date);
  const now = new Date();
  
  let endDate = complaint.close_date ? new Date(complaint.close_date) : now;
  let diffTime = Math.max(0, endDate - raiseDate);
  let downtimeDays = parseFloat((diffTime / (1000 * 60 * 60 * 24)).toFixed(2));
  
  let attendBreach = false;
  let attendOverdueHours = 0;
  if (complaint.attend_date) {
    const attendDate = new Date(complaint.attend_date);
    const responseTimeHours = (attendDate - raiseDate) / (1000 * 60 * 60);
    if (responseTimeHours > settings.sla_attend_hours) {
      attendBreach = true;
      attendOverdueHours = Math.max(0, responseTimeHours - settings.sla_attend_hours);
    }
  } else {
    const responseTimeHours = (now - raiseDate) / (1000 * 60 * 60);
    if (responseTimeHours > settings.sla_attend_hours) {
      attendBreach = true;
      attendOverdueHours = responseTimeHours - settings.sla_attend_hours;
    }
  }
  
  let closeBreach = false;
  let closeOverdueDays = 0;
  const resolutionTimeHours = (endDate - raiseDate) / (1000 * 60 * 60);
  if (resolutionTimeHours > settings.sla_close_hours) {
    closeBreach = true;
    closeOverdueDays = Math.max(0, (resolutionTimeHours - settings.sla_close_hours) / 24);
  }
  
  let penalty = 0;
  let penaltyDetail = { attendPenalty: 0, downtimePenalty: 0, total: 0 };
  
  if (complaint.warranty_flag === 'Out of Warranty') {
    const assetValue = equipment.asset_value || 0;
    const activeSlab = slabs.find(s => assetValue <= s.max_value) || slabs[slabs.length - 1];
    const ratePerPeriod = activeSlab ? activeSlab.per_period : 500;
    
    if (attendBreach) {
      penaltyDetail.attendPenalty = ratePerPeriod;
    }
    
    if (closeBreach) {
      const excessHours = Math.max(0, resolutionTimeHours - settings.sla_close_hours);
      const periods = Math.floor(excessHours / settings.penalty_period_hours);
      penaltyDetail.downtimePenalty = periods * ratePerPeriod;
    }
    
    penaltyDetail.total = penaltyDetail.attendPenalty + penaltyDetail.downtimePenalty;
    penalty = penaltyDetail.total;
  }
  
  let riskScore = 0;
  if (complaint.status === 'Open') {
    const hoursOpen = (now - raiseDate) / (1000 * 60 * 60);
    riskScore = Math.min(100, Math.floor((hoursOpen / 168) * 100));
    if (complaint.warranty_flag === 'Out of Warranty') {
      riskScore = Math.min(100, riskScore + 20);
    }
  }

  return {
    downtime_days: downtimeDays,
    penalty: penalty,
    penaltyDetail: penaltyDetail,
    attendBreach,
    attendOverdueHours: parseFloat(attendOverdueHours.toFixed(1)),
    closeBreach,
    closeOverdueDays: parseFloat(closeOverdueDays.toFixed(1)),
    riskScore
  };
}

class DatabaseManager {
  constructor() {
    this.connectionMode = localStorage.getItem('oms_db_mode') || 'local'; // 'local' or 'api'
    this.apiUrl = localStorage.getItem('oms_api_url') || '';
    this.initLocalData();
  }

  initLocalData() {
    if (!localStorage.getItem(STORAGE_KEY)) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_SEED_DATA));
    }
  }

  setMode(mode, url = '') {
    this.connectionMode = mode;
    localStorage.setItem('oms_db_mode', mode);
    if (url) {
      this.apiUrl = url;
      localStorage.setItem('oms_api_url', url);
    }
  }

  getData() {
    return JSON.parse(localStorage.getItem(STORAGE_KEY));
  }

  saveData(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  async executeQuery(action, method = 'GET', body = null) {
    if (this.connectionMode === 'api') {
      try {
        const urlPrefix = this.apiUrl ? this.apiUrl.replace(/\/$/, '') : '';
        const response = await fetch(`${urlPrefix}/api/${action}`, {
          method,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('oms_session_token') || ''}`
          },
          body: body ? JSON.stringify(body) : null
        });
        if (!response.ok) throw new Error(`API response error ${response.status}`);
        return await response.json();
      } catch (err) {
        console.error('API call failed, running in sandbox preview.', err);
      }
    }
    return this.executeLocalQuery(action, method, body);
  }

  executeLocalQuery(action, method, body) {
    const data = this.getData();
    const parts = action.split('/');
    const resource = parts[0];
    const id = parts[1];

    if (resource === 'complaints') {
      data.complaints = data.complaints.map(c => {
        const eq = data.equipment.find(e => e.id === c.equipment_id);
        const calc = calculateSLAAndPenalty(c, eq, data.settings, data.penalty_slabs);
        return { ...c, downtime_days: calc.downtime_days, penalty_total: calc.penalty };
      });
    }

    if (method === 'GET') {
      if (id) {
        const record = data[resource]?.find(item => item.id === id || item.barcode === id || item.complaint_no === id);
        if (resource === 'complaints' && record) {
          const eq = data.equipment.find(e => e.id === record.equipment_id);
          const calc = calculateSLAAndPenalty(record, eq, data.settings, data.penalty_slabs);
          return {
            ...record,
            calculations: calc,
            equipment: eq,
            hospital: data.hospitals.find(h => h.id === record.hospital_id),
            district: data.districts.find(d => d.id === record.district_id),
            followups: data.followups.filter(f => f.complaint_id === record.id),
            remarks_list: data.remarks.filter(r => r.complaint_id === record.id)
          };
        }
        return record || null;
      }
      return data[resource] || data;
    }

    if (method === 'POST') {
      const newRecord = { id: body.id || `${resource.slice(0,2)}_${Date.now()}`, ...body };
      data[resource].push(newRecord);
      this.saveData(data);
      return newRecord;
    }

    if (method === 'PUT') {
      const index = data[resource].findIndex(item => item.id === id);
      if (index !== -1) {
        data[resource][index] = { ...data[resource][index], ...body };
        this.saveData(data);
        return data[resource][index];
      }
      return null;
    }

    if (method === 'DELETE') {
      data[resource] = data[resource].filter(item => item.id !== id);
      this.saveData(data);
      return { success: true };
    }
  }

  async getDashboardSummary() {
    if (this.connectionMode === 'api') {
      try {
        const res = await this.executeQuery('dashboard');
        if (res && !res.fallback) return res;
      } catch (e) {
        console.error(e);
      }
    }

    // Local computation fallback
    const localData = this.getData();
    const complaints = localData.complaints.map(c => {
      const eq = localData.equipment.find(e => e.id === c.equipment_id);
      const calc = calculateSLAAndPenalty(c, eq, localData.settings, localData.penalty_slabs);
      return { ...c, calculations: calc };
    });

    const open = complaints.filter(c => c.status === 'Open');
    const closed = complaints.filter(c => c.status === 'Closed');
    const totalPenalty = complaints.reduce((sum, c) => sum + c.calculations.penalty, 0);
    const activeBreaches = open.filter(c => c.calculations.closeBreach).length;

    const districtScores = localData.districts.map(d => {
      const dComplaints = complaints.filter(c => c.district_id === d.id);
      const dOpen = dComplaints.filter(c => c.status === 'Open').length;
      const dClosed = dComplaints.filter(c => c.status === 'Closed').length;
      const dPenalty = dComplaints.reduce((sum, c) => sum + c.calculations.penalty, 0);
      const dBreached = dComplaints.filter(c => c.calculations.closeBreach).length;
      const complianceRate = dComplaints.length > 0 ? Math.round(((dComplaints.length - dBreached) / dComplaints.length) * 100) : 100;
      return {
        districtId: d.id,
        name: d.name,
        total: dComplaints.length,
        open: dOpen,
        closed: dClosed,
        penalty: dPenalty,
        complianceRate
      };
    });

    return {
      kpis: {
        totalComplaints: complaints.length,
        openComplaints: open.length,
        closedComplaints: closed.length,
        totalPenalty,
        activeBreaches,
        slaCompliance: complaints.length > 0 ? Math.round(((complaints.length - complaints.filter(c => c.calculations.closeBreach).length) / complaints.length) * 100) : 100
      },
      districtScores,
      recentComplaints: complaints.slice(-5).reverse()
    };
  }

  // Universal Bulk Data Import
  async importData(type, rows) {
    if (this.connectionMode === 'api') {
      const res = await this.executeQuery(`import/${type}`, 'POST', { rows });
      return res;
    }

    const data = this.getData();
    let importedCount = 0;

    rows.forEach(row => {
      // Auto resolve hospital / district mapping
      let hosp = data.hospitals.find(h => h.id === row.hospital_id || h.name.toLowerCase() === (row.hospital_name || '').toLowerCase());
      if (!hosp && row.hospital_name) {
        hosp = {
          id: `h_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
          district_id: row.district_id || 'bikaner',
          name: row.hospital_name,
          hospital_type: row.hospital_type || 'District Hospital'
        };
        data.hospitals.push(hosp);
      }

      if (type === 'complaints') {
        let eq = data.equipment.find(e => e.barcode === row.barcode);
        if (!eq && row.barcode) {
          eq = {
            id: `eq_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            barcode: row.barcode,
            name: row.equipment_name || 'Imported Equipment',
            model: row.model || 'Unknown',
            type: 'General',
            hospital_id: hosp ? hosp.id : 'h1',
            asset_value: parseInt(row.asset_value) || 100000,
            warranty_expiry: row.warranty_expiry || '',
            purchase_date: row.purchase_date || ''
          };
          data.equipment.push(eq);
        }

        const id = `c_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        data.complaints.push({
          id,
          complaint_no: row.complaint_no || `CYX-CP-IMP-${Date.now().toString().slice(-4)}`,
          equipment_id: eq ? eq.id : 'eq1001',
          hospital_id: hosp ? hosp.id : 'h1',
          district_id: hosp ? hosp.district_id : 'bikaner',
          raise_date: row.raise_date ? new Date(row.raise_date).toISOString() : new Date().toISOString(),
          attend_date: row.attend_date ? new Date(row.attend_date).toISOString() : '',
          close_date: row.close_date ? new Date(row.close_date).toISOString() : '',
          status: row.status || 'Open',
          warranty_flag: row.warranty_flag || 'Out of Warranty',
          di_name: row.di_name || 'Import Officer',
          remarks: row.remarks || 'Imported via CSV',
          downtime_days: 0,
          penalty_total: 0
        });
        importedCount++;
      } else if (type === 'equipment') {
        data.equipment.push({
          id: `eq_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
          barcode: row.barcode || `CYX-EQ-IMP-${Date.now().toString().slice(-4)}`,
          name: row.name || 'Unknown Device',
          model: row.model || '',
          type: row.type || 'General',
          hospital_id: hosp ? hosp.id : 'h1',
          asset_value: parseInt(row.asset_value) || 150000,
          warranty_expiry: row.warranty_expiry || '',
          purchase_date: row.purchase_date || ''
        });
        importedCount++;
      } else if (type === 'hospitals') {
        data.hospitals.push({
          id: `h_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
          district_id: row.district_id || 'bikaner',
          name: row.name,
          hospital_type: row.hospital_type || 'District Hospital'
        });
        importedCount++;
      }
    });

    this.saveData(data);
    return { success: true, count: importedCount };
  }

  // Operational Simulator: Generates 100+ highly realistic records
  async generateSimulatedData() {
    if (this.connectionMode === 'api') {
      const res = await this.executeQuery('simulate', 'POST');
      return res;
    }

    const data = this.getData();
    const mockEquip = ['128-Slice CT Scanner', 'ICU Ventilator', 'Color Doppler Ultrasound', 'Anesthesia Workstation', 'Defibrillator', 'PSA Oxygen Plant', 'Patient Monitor', 'Neonatal Incubator'];
    const mockModels = ['GE Healthcare Optima', 'Siemens Healthineers', 'Philips Respironics', 'BPL Cleo', 'Mindray DC', 'Drager Fabius'];
    const mockDI = ['Dr. Sunita Sharma', 'Dr. Ramesh Kumar', 'Dr. S. K. Choudhary', 'Dr. Pankaj Yadav', 'Dr. Vijay Kalla', 'Dr. Amit Mathur'];
    const mockDistricts = ['bikaner', 'churu', 'ganganagar', 'hanumangarh'];
    const mockWarranties = ['Warranty', 'Out of Warranty'];
    const mockRemarks = [
      'Error code E-09 on screen. Power supply card malfunctioning.',
      'Filter wheel alignment failure. Device failing biochemical calibration.',
      'Compressor overheating. Low pressure output detected in oxygen plant.',
      'Software freezing during patient imaging scans. Re-install required.',
      'Sensors giving inconsistent diagnostic logs. Needs board replacement.',
      'Battery backup depleted. Defibrillator failing to charge correctly.'
    ];

    // Generate 15 equipment
    for (let i = 0; i < 15; i++) {
      const name = mockEquip[i % mockEquip.length];
      const model = mockModels[i % mockModels.length];
      const hosp = data.hospitals[i % data.hospitals.length];
      data.equipment.push({
        id: `eq_sim_${i}`,
        barcode: `CYX-EQ-SIM-${1000 + i}`,
        name,
        model,
        type: name.includes('Scanner') || name.includes('X-Ray') ? 'Imaging' : 'Life Support',
        hospital_id: hosp.id,
        asset_value: 150000 * (i + 1),
        warranty_expiry: new Date(Date.now() + (i % 2 === 0 ? 300 : -200) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        purchase_date: new Date(Date.now() - 500 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      });
    }

    // Generate 100 complaints (mix of open/closed)
    const baseDate = new Date();
    for (let i = 0; i < 100; i++) {
      const eq = data.equipment[i % data.equipment.length];
      const hosp = data.hospitals.find(h => h.id === eq.hospital_id);
      
      const raiseOffsetDays = Math.floor(Math.random() * 60) + 1; // within last 60 days
      const raiseDate = new Date(baseDate.getTime() - raiseOffsetDays * 24 * 60 * 60 * 1000);
      
      const isClosed = i % 4 !== 0; // 75% closed, 25% open
      let closeDate = '';
      let attendDate = '';

      // Log engineer visit (attend) for most
      if (i % 5 !== 0) {
        attendDate = new Date(raiseDate.getTime() + (Math.random() * 30 + 5) * 60 * 60 * 1000).toISOString();
      }

      if (isClosed) {
        closeDate = new Date(raiseDate.getTime() + (Math.random() * 150 + 20) * 60 * 60 * 1000).toISOString();
      }

      data.complaints.push({
        id: `c_sim_${i}`,
        complaint_no: `CYX-CP-SIM-${10000 + i}`,
        equipment_id: eq.id,
        hospital_id: hosp.id,
        district_id: hosp.district_id,
        raise_date: raiseDate.toISOString(),
        attend_date: attendDate,
        close_date: closeDate,
        status: isClosed ? 'Closed' : 'Open',
        warranty_flag: mockWarranties[i % mockWarranties.length],
        di_name: mockDI[i % mockDI.length],
        remarks: mockRemarks[i % mockRemarks.length],
        downtime_days: 0,
        penalty_total: 0
      });
    }

    this.saveData(data);
    return { success: true, count: 100 };
  }

  // Rebuild / Reset database
  async resetDatabase() {
    if (this.connectionMode === 'api') {
      const res = await this.executeQuery('reset', 'POST');
      return res;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_SEED_DATA));
    return { success: true };
  }
}

const db = new DatabaseManager();
window.DB = db;
window.calculateSLAAndPenalty = calculateSLAAndPenalty;
