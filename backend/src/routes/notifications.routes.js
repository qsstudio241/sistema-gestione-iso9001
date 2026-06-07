/**
 * notifications.routes.js — Rotte configurazione notifiche
 */

const express  = require('express');
const router   = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const { requireLicensedModule } = require('../middleware/moduleLicense.middleware');
const notifCtrl = require('../controllers/notifications.controller');
const contactsCtrl = require('../controllers/notificationContacts.controller');

router.use(authenticate);
router.use(requireLicensedModule('notifications'));

router.get ('/notifications-config',       notifCtrl.getConfig);
router.put ('/notifications-config',       notifCtrl.saveConfig);
router.post('/notifications-config/test',  notifCtrl.sendTestEmail);

router.get   ('/notification-contacts',           contactsCtrl.listContacts);
router.post  ('/notification-contacts',           contactsCtrl.createContact);
router.put   ('/notification-contacts/:id',       contactsCtrl.updateContact);
router.delete('/notification-contacts/:id',       contactsCtrl.deleteContact);

module.exports = router;
