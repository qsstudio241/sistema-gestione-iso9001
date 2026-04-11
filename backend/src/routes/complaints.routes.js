const express = require('express');
const router = express.Router();
const complaintsController = require('../controllers/complaints.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { requireLicensedModule } = require('../middleware/moduleLicense.middleware');

router.use(authenticate);
router.use(requireLicensedModule('reclami'));

router.get('/stats', complaintsController.getComplaintsStats);
router.get('/', complaintsController.listComplaints);
router.get('/:id', complaintsController.getComplaintById);
router.post('/', complaintsController.createComplaint);
router.put('/:id', complaintsController.updateComplaint);
router.delete('/:id', complaintsController.deleteComplaint);

module.exports = router;
