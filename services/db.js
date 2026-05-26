// Cyrix OMS v3.2 — Enterprise Data Access Layer (IndexedDB Engine)
// Engineered by Senior Principal Database Architect

(function(global) {
  'use strict';

  const DB_NAME = 'CyrixOMS_EnterpriseDB';
  const DB_VERSION = 1;
  let dbInstance = null;

  const STORES = {
    districts: 'id',
    hospitals: 'id',
    equipment: 'id',
    complaints: 'id',
    procurement_pi: 'id',
    procurement_pr: 'id',
    procurement_po: 'id',
    followups: 'id',
    remarks: 'id',
    settings: 'key',
    penalty_slabs: 'id'
  };

  const SEED_DATA = {
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
    settings: [
      { key: 'username', val: 'Sunil' },
      { key: 'displayName', val: 'Sunil Kumar' },
      { key: 'passwordHash', val: 'e6900a0b67484dfc2826cf6f2e24cf81c3d180862024db49830fd17282b0e6bf' },
      { key: 'sla_attend_hours', val: '24' },
      { key: 'sla_close_hours', val: '72' },
      { key: 'penalty_period_hours', val: '24' }
    ],
    penalty_slabs: [
      { id: 'slab1', max_value: 500000, per_period: 500 },
      { id: 'slab2', max_value: 2000000, per_period: 1500 },
      { id: 'slab3', max_value: 99999999, per_period: 3000 }
    ]
  };

  const IndexedDBManager = {
    init() {
      return new Promise((resolve, reject) => {
        if (dbInstance) {
          return resolve(dbInstance);
        }

        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
          const db = event.target.result;
          Object.keys(STORES).forEach(storeName => {
            if (!db.objectStoreNames.contains(storeName)) {
              db.createObjectStore(storeName, { keyPath: STORES[storeName] });
            }
          });
        };

        request.onsuccess = async (event) => {
          dbInstance = event.target.result;
          await this.checkAndSeedData();
          resolve(dbInstance);
        };

        request.onerror = (event) => {
          console.error('IndexedDB open request error:', event.target.error);
          reject(event.target.error);
        };
      });
    },

    async checkAndSeedData() {
      const districtsCount = await this.count('districts');
      if (districtsCount === 0) {
        console.log('Seeding initial enterprise dataset into IndexedDB stores...');
        for (const storeName of Object.keys(SEED_DATA)) {
          const items = SEED_DATA[storeName];
          for (const item of items) {
            await this.put(storeName, item);
          }
        }
      }
    },

    getTransaction(storeNames, mode = 'readonly') {
      const names = Array.isArray(storeNames) ? storeNames : [storeNames];
      return dbInstance.transaction(names, mode);
    },

    getAll(storeName) {
      return new Promise((resolve, reject) => {
        const tx = this.getTransaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const request = store.getAll();

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    },

    get(storeName, key) {
      return new Promise((resolve, reject) => {
        const tx = this.getTransaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const request = store.get(key);

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    },

    put(storeName, item) {
      return new Promise((resolve, reject) => {
        const tx = this.getTransaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const request = store.put(item);

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    },

    delete(storeName, key) {
      return new Promise((resolve, reject) => {
        const tx = this.getTransaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const request = store.delete(key);

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    },

    count(storeName) {
      return new Promise((resolve, reject) => {
        const tx = this.getTransaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const request = store.count();

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    },

    clear(storeName) {
      return new Promise((resolve, reject) => {
        const tx = this.getTransaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const request = store.clear();

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    }
  };

  global.IndexedDBManager = IndexedDBManager;
})(window);
