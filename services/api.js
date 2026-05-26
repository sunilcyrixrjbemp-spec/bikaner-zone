// Cyrix OMS v3.2 — Enterprise API Service Connector
// Designed by Senior Principal Full Stack Architect

(function(global) {
  'use strict';

  class APIService {
    constructor() {
      this.mode = localStorage.getItem('oms_db_mode') || 'local'; // 'local' or 'api'
      this.apiUrl = localStorage.getItem('oms_api_url') || '';
    }

    setMode(mode, url = '') {
      this.mode = mode;
      localStorage.setItem('oms_db_mode', mode);
      if (url) {
        this.apiUrl = url;
        localStorage.setItem('oms_api_url', url);
      }
    }

    async request(endpoint, method = 'GET', body = null) {
      if (this.mode === 'api') {
        try {
          const url = `${this.apiUrl.replace(/\/$/, '')}/api/${endpoint}`;
          const options = {
            method,
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('oms_session_token') || ''}`
            }
          };
          if (body) {
            options.body = JSON.stringify(body);
          }
          const response = await fetch(url, options);
          if (!response.ok) {
            throw new Error(`API returned HTTP ${response.status}`);
          }
          return await response.json();
        } catch (e) {
          console.warn('Backend API connection failed. Reverting to local store operations.', e);
        }
      }

      // Local Fallback (IndexedDB operations)
      return this.handleLocalOperation(endpoint, method, body);
    }

    async handleLocalOperation(endpoint, method, body) {
      await global.IndexedDBManager.init();
      const parts = endpoint.split('/');
      const resource = parts[0];
      const id = parts[1];

      if (method === 'GET') {
        if (resource === 'data') {
          const districts = await global.IndexedDBManager.getAll('districts');
          const hospitals = await global.IndexedDBManager.getAll('hospitals');
          const equipment = await global.IndexedDBManager.getAll('equipment');
          const complaints = await global.IndexedDBManager.getAll('complaints');
          const followups = await global.IndexedDBManager.getAll('followups');
          const remarks = await global.IndexedDBManager.getAll('remarks');
          const penalty_slabs = await global.IndexedDBManager.getAll('penalty_slabs');
          
          const settingsList = await global.IndexedDBManager.getAll('settings');
          const settings = {};
          settingsList.forEach(s => {
            settings[s.key] = isNaN(s.val) ? s.val : parseInt(s.val);
          });

          return {
            districts,
            hospitals,
            equipment,
            complaints,
            followups,
            remarks,
            settings,
            penalty_slabs
          };
        }

        if (id) {
          const item = await global.IndexedDBManager.get(resource, id);
          if (resource === 'complaints' && item) {
            const eq = await global.IndexedDBManager.get('equipment', item.equipment_id);
            const hosp = await global.IndexedDBManager.get('hospitals', item.hospital_id);
            const district = await global.IndexedDBManager.get('districts', item.district_id);
            const followups = (await global.IndexedDBManager.getAll('followups')).filter(f => f.complaint_id === item.id);
            const remarks = (await global.IndexedDBManager.getAll('remarks')).filter(r => r.complaint_id === item.id);
            
            const settingsList = await global.IndexedDBManager.getAll('settings');
            const settings = {};
            settingsList.forEach(s => settings[s.key] = s.val);

            const slabs = await global.IndexedDBManager.getAll('penalty_slabs');
            const calc = global.SLAEngine.calculate(item, eq, settings, slabs);

            return {
              ...item,
              calculations: calc,
              equipment: eq,
              hospital: hosp,
              district,
              followups,
              remarks_list: remarks
            };
          }
          return item;
        }

        const list = await global.IndexedDBManager.getAll(resource);
        if (resource === 'complaints') {
          const equipment = await global.IndexedDBManager.getAll('equipment');
          const settingsList = await global.IndexedDBManager.getAll('settings');
          const settings = {};
          settingsList.forEach(s => settings[s.key] = s.val);
          const slabs = await global.IndexedDBManager.getAll('penalty_slabs');

          return list.map(c => {
            const eq = equipment.find(e => e.id === c.equipment_id);
            const calc = global.SLAEngine.calculate(c, eq, settings, slabs);
            return {
              ...c,
              downtime_days: calc.downtime_days,
              penalty_total: calc.penalty,
              calculations: calc
            };
          });
        }
        return list;
      }

      if (method === 'POST') {
        if (resource === 'reset') {
          await global.IndexedDBManager.clear('followups');
          await global.IndexedDBManager.clear('remarks');
          await global.IndexedDBManager.clear('complaints');
          await global.IndexedDBManager.clear('equipment');
          try {
            await global.IndexedDBManager.clear('csv_uploads');
            await global.IndexedDBManager.clear('import_history');
          } catch (e) {}
          return { success: true, message: "Database wiped." };
        }

        if (resource === 'simulate') {
          const complaints = await global.IndexedDBManager.getAll('complaints');
          const simComplaints = complaints.filter(c => c.id.startsWith('c_sim_'));
          for (const c of simComplaints) {
            await global.IndexedDBManager.delete('complaints', c.id);
          }

          const equipment = await global.IndexedDBManager.getAll('equipment');
          const simEquipment = equipment.filter(e => e.id.startsWith('eq_sim_'));
          for (const e of simEquipment) {
            await global.IndexedDBManager.delete('equipment', e.id);
          }

          const followups = await global.IndexedDBManager.getAll('followups');
          const simFollowups = followups.filter(f => f.id.startsWith('f_sim_'));
          for (const f of simFollowups) {
            await global.IndexedDBManager.delete('followups', f.id);
          }

          const hospitals = await global.IndexedDBManager.getAll('hospitals');
          if (hospitals.length === 0) {
            return { success: false, error: "No hospitals seeded." };
          }

          // Seed 15 simulated equipment
          for (let i = 0; i < 15; i++) {
            const eqid = `eq_sim_${i}`;
            const hosp = hospitals[i % hospitals.length];
            const asset_value = 120000 * (i + 1);
            await global.IndexedDBManager.put('equipment', {
              id: eqid,
              barcode: `CYX-EQ-SIM-${1000 + i}`,
              name: `Simulated Device ${i}`,
              model: `Model-${i}`,
              type: i % 3 === 0 ? 'Imaging' : (i % 3 === 1 ? 'Life Support' : 'Lab Equipment'),
              hospital_id: hosp.id,
              asset_value,
              warranty_expiry: new Date(Date.now() + (i % 2 === 0 ? 300 : -200) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
              purchase_date: new Date(Date.now() - 500 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
              status: 'Operational'
            });
          }

          // Seed 100 simulated complaints
          const baseDate = new Date();
          for (let i = 0; i < 100; i++) {
            const hosp = hospitals[i % hospitals.length];
            const raiseOffset = Math.floor(Math.random() * 60) + 1;
            const raiseDate = new Date(baseDate.getTime() - raiseOffset * 24 * 60 * 60 * 1000);
            const isClosed = i % 4 !== 0;

            await global.IndexedDBManager.put('complaints', {
              id: `c_sim_${i}`,
              complaint_no: `CYX-CP-SIM-${10000 + i}`,
              equipment_id: `eq_sim_${i % 15}`,
              hospital_id: hosp.id,
              district_id: hosp.district_id,
              raise_date: raiseDate.toISOString(),
              attend_date: isClosed ? new Date(raiseDate.getTime() + 12 * 60 * 60 * 1000).toISOString() : '',
              close_date: isClosed ? new Date(raiseDate.getTime() + 48 * 60 * 60 * 1000).toISOString() : '',
              status: isClosed ? 'Closed' : 'Open',
              warranty_flag: i % 2 === 0 ? 'Warranty' : 'Out of Warranty',
              di_name: 'Dr. Simulator',
              remarks: 'Simulated operational remarks.',
              downtime_days: 0,
              penalty_total: 0
            });
          }

          return { success: true };
        }

        const item = { id: body.id || `${resource.slice(0, 2)}_${Date.now()}`, ...body };
        await global.IndexedDBManager.put(resource, item);
        return item;
      }

      if (method === 'PUT') {
        const existing = await global.IndexedDBManager.get(resource, id);
        if (existing) {
          const updated = { ...existing, ...body };
          await global.IndexedDBManager.put(resource, updated);
          return updated;
        }
        return null;
      }

      if (method === 'DELETE') {
        await global.IndexedDBManager.delete(resource, id);
        return { success: true };
      }
    }
  }

  global.APIService = new APIService();
})(window);
