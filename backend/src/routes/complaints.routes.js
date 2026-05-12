/**
 * Complaints Routes — ISO 9001:2015 §8.8 + §10.2
 */

const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/complaints.controller');
const { authenticate } = require('../middleware/auth.middleware');

router.use(authenticate);

router.get('/',           ctrl.listComplaints);
router.get('/stats',      ctrl.getComplaintsStats);
router.get('/:id',        ctrl.getComplaintById);
router.post('/',          ctrl.createComplaint);
router.put('/:id',        ctrl.updateComplaint);
router.delete('/:id',     ctrl.deleteComplaint);
router.post('/:id/promote-to-nc', ctrl.promoteToNc);

module.exports = router;
