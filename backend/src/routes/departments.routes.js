/**
 * Departments Routes — ISO 9001:2015 §8.5 (Reparti produttivi)
 */

const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/departments.controller');
const { authenticate } = require('../middleware/auth.middleware');

router.use(authenticate);

router.get('/',       ctrl.listDepartments);
router.get('/:id',    ctrl.getDepartmentById);
router.post('/',      ctrl.createDepartment);
router.put('/:id',    ctrl.updateDepartment);
router.delete('/:id', ctrl.deleteDepartment);

module.exports = router;
