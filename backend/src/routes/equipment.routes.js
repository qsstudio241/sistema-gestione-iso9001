/**
 * equipment.routes.js — Strumenti e Attrezzature CND/SGQ/3834
 * ADR-016: CRUD con cnd|strumenti; lettura picker con saldatura (Welding Book).
 */
const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const { requireLicensedModuleAny } = require('../middleware/moduleLicense.middleware');
const ctrl = require('../controllers/equipment.controller');

const EQUIPMENT_READ_KEYS = ['cnd', 'strumenti', 'saldatura'];
const EQUIPMENT_WRITE_KEYS = ['cnd', 'strumenti'];

router.use(authenticate);

router.get('/equipment/stats', requireLicensedModuleAny(EQUIPMENT_READ_KEYS), ctrl.getEquipmentStats);
router.get('/equipment/for-report', requireLicensedModuleAny(EQUIPMENT_READ_KEYS), ctrl.getEquipmentForReport);
router.get('/equipment', requireLicensedModuleAny(EQUIPMENT_READ_KEYS), ctrl.listEquipment);
router.get('/equipment/:id', requireLicensedModuleAny(EQUIPMENT_READ_KEYS), ctrl.getEquipment);
router.get('/equipment/:id/calibrations', requireLicensedModuleAny(EQUIPMENT_READ_KEYS), ctrl.getCalibrations);

router.post('/equipment', requireLicensedModuleAny(EQUIPMENT_WRITE_KEYS), ctrl.createEquipment);
router.put('/equipment/:id', requireLicensedModuleAny(EQUIPMENT_WRITE_KEYS), ctrl.updateEquipment);
router.delete('/equipment/:id', requireLicensedModuleAny(EQUIPMENT_WRITE_KEYS), ctrl.deleteEquipment);
router.post('/equipment/:id/calibrations', requireLicensedModuleAny(EQUIPMENT_WRITE_KEYS), ctrl.addCalibration);

module.exports = router;
