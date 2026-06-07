'use strict';
try {
  require('/var/www/sgq-backend/src/services/ncResponsibleOptions.service');
  require('/var/www/sgq-backend/src/services/personnelNotificationBridge.service');
  console.log('require OK');
} catch (e) {
  console.error('require FAIL:', e.message);
  process.exit(1);
}
