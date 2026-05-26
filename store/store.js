// Cyrix OMS v3.5 — Global UI State Store
(function(global) {
  'use strict';
  
  class Store {
    constructor() {
      this.state = {
        theme: 'dark',
        activeView: 'dashboard',
        sidebarCollapsed: false
      };
      this.listeners = [];
    }
    
    getState() {
      return this.state;
    }
    
    updateState(updates) {
      this.state = { ...this.state, ...updates };
      this.listeners.forEach(l => l(this.state));
    }
    
    subscribe(listener) {
      this.listeners.push(listener);
      return () => {
        this.listeners = this.listeners.filter(l => l !== listener);
      };
    }
  }
  
  global.OMSStore = new Store();
})(window);
// Remove index configuration for scaffolding script
