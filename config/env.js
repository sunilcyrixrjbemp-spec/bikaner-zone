// Cyrix OMS v3.5 — Environment Configuration
(function(global) {
  'use strict';
  
  global.ENV = {
    VERSION: '3.5.0',
    RELEASE_STAGE: 'Production',
    SECURE_HEADERS: true,
    MAX_UPLOAD_CHUNK_BYTES: 1024 * 1024 * 2 // 2MB
  };
})(window);
