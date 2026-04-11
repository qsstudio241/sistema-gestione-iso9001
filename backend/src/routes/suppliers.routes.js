const express = require('express');
const router = express.Router();
const suppliersController = require('../controllers/suppliers.controller');
const { authenticate } = require('../middleware/auth.middleware');

router.use(authenticate);

// CRUD Suppliers
router.get('/', suppliersController.listSuppliers);
router.get('/:id', suppliersController.getSupplierById);
router.post('/', suppliersController.createSupplier);
router.put('/:id', suppliersController.updateSupplier);
router.delete('/:id', suppliersController.deleteSupplier);

// CRUD Evaluations
router.get('/:id/evaluations', suppliersController.listEvaluations);
router.post('/:id/evaluations', suppliersController.createEvaluation);
router.delete('/:id/evaluations/:evalId', suppliersController.deleteEvaluation);

module.exports = router;
