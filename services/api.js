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
