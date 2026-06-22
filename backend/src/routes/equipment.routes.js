/**
 * equipment.routes.js — Strumenti e Attrezzature CND/SGQ
 */
const express = require('express');
const router  = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const { requireLicensedModule } = require('../middleware/moduleLicense.middleware');
const ctrl = require('../controllers/equipment.controller');

router.use(authenticate);
router.use(requireLicensedModule('cnd'));

// Stats e rotte statiche PRIMA di /:id
router.get('/equipment/stats',      ctrl.getEquipmentStats);
router.get('/equipment/for-report', ctrl.getEquipmentForReport);

// CRUD anagrafica
router.get   ('/equipment',     ctrl.listEquipment);
router.post  ('/equipment',     ctrl.createEquipment);
router.get   ('/equipment/:id', ctrl.getEquipment);
router.put   ('/equipment/:id', ctrl.updateEquipment);
router.delete('/equipment/:id', ctrl.deleteEquipment);

// Storico tarature
router.get ('/equipment/:id/calibrations', ctrl.getCalibrations);
router.post('/equipment/:id/calibrations', ctrl.addCalibration);

module.exports = router;
