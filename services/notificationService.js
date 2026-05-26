// Cyrix OMS v3.5 — NotificationService
// Controls in-app push alerts and logs notification status to database audit logs.
(function(global) {
  'use strict';
  
  class NotificationService {
    async push(title, message, type = 'info') {
      console.log(`[Notification] ${title}: ${message}`);
      try {
        await global.APIService.request('notifications', 'POST', {
          title, message, is_read: 0, created_at: new Date().toISOString()
        });
      } catch (e) {
        console.error(e);
      }
    }
  }
  
  global.NotificationService = new NotificationService();
})(window);
