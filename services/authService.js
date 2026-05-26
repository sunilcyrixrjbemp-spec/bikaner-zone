// Cyrix OMS v3.5 — AuthService
// Designed for JWT rotation, Multi-Factor Resend OTP triggers, and security locks.
(function(global) {
  'use strict';
  
  class AuthService {
    constructor() {
      this.sessionKey = 'oms_session_token';
      this.userKey = 'oms_current_user';
    }
    
    async login(username, password, fingerprint) {
      try {
        const response = await global.APIService.request('auth/login', 'POST', {
          username, password, fingerprint
        });
        if (response && response.token) {
          localStorage.setItem(this.sessionKey, response.token);
          localStorage.setItem('oms_refresh_token', response.refreshToken);
          localStorage.setItem(this.userKey, JSON.stringify(response.user));
          return { success: true, user: response.user };
        }
        return { success: false, error: 'Auth failed' };
      } catch (e) {
        console.error(e);
        return { success: false, error: e.message };
      }
    }
    
    logout() {
      localStorage.removeItem(this.sessionKey);
      localStorage.removeItem('oms_refresh_token');
      localStorage.removeItem(this.userKey);
      window.location.href = '../auth/login.html';
    }
    
    isAuthenticated() {
      return !!localStorage.getItem(this.sessionKey);
    }
    
    getUser() {
      const user = localStorage.getItem(this.userKey);
      return user ? JSON.parse(user) : null;
    }
  }
  
  global.AuthService = new AuthService();
})(window);
