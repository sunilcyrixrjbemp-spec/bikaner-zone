// Cyrix OMS v3.5 — AssetService
// Coordinates hospital asset registries, warranties, and lifecycle value models.
(function(global) {
  'use strict';
  
  class AssetService {
    async getAsset(id) {
      return await global.APIService.request(`equipment/${id}`);
    }
    
    async registerAsset(asset) {
      return await global.APIService.request('equipment', 'POST', asset);
    }
  }
  
  global.AssetService = new AssetService();
})(window);
