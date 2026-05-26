// Cyrix OMS v3.5 — InventoryService
// Syncs and manages stock, inventory reorder levels, and SAP mapping metrics.
(function(global) {
  'use strict';
  
  class InventoryService {
    async getInventory() {
      return await global.APIService.request('inventory');
    }
    
    async adjustStock(itemCode, qty, type, reference) {
      return await global.APIService.request('inventory/stock_movement', 'POST', {
        item_code: itemCode, qty, movement_type: type, reference_no: reference
      });
    }
  }
  
  global.InventoryService = new InventoryService();
})(window);
