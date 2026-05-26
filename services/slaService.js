// Cyrix OMS v3.5 — SlaService
// Manages response and resolution SLA timers on-screen and flags breach statuses.
(function(global) {
  'use strict';
  
  class SlaService {
    calculateDowntime(raiseDateStr, closeDateStr) {
      const start = new Date(raiseDateStr);
      const end = closeDateStr ? new Date(closeDateStr) : new Date();
      const diff = Math.max(0, end - start);
      return parseFloat((diff / (1000 * 60 * 60 * 24)).toFixed(2));
    }
    
    checkResponseBreach(raiseDateStr, attendDateStr, limitHours) {
      const raise = new Date(raiseDateStr);
      const attend = attendDateStr ? new Date(attendDateStr) : new Date();
      const diffHours = (attend - raise) / (1000 * 60 * 60);
      return {
        breached: diffHours > limitHours,
        hours: parseFloat(diffHours.toFixed(1))
      };
    }
  }
  
  global.SlaService = new SlaService();
})(window);
