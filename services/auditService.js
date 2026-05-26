// Cyrix OMS v3.5 — AuditService
// Interfaces with immutable blockchain audit logs for system transparency.
(function(global) {
  'use strict';
  
  class AuditService {
    async getAuditLogs() {
      return await global.APIService.request('audit_logs');
    }
  }
  
  global.AuditService = new AuditService();
})(window);
