/**
 * Admin routes - Gestione utenti e assegnazione standard (solo admin)
 */

const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth.middleware');
const adminController = require('../controllers/admin.controller');

const adminOnly = [authenticate, authorize('admin', 'superadmin')];

router.get('/admin/users', adminOnly, adminController.listUsers);
router.post('/admin/users', adminOnly, adminController.createUser);
router.patch('/admin/users/:id', adminOnly, adminController.updateUser);
router.delete('/admin/users/:id', adminOnly, adminController.deactivateUser);
router.put('/admin/users/:id/standards', adminOnly, adminController.updateUserStandards);

router.get('/admin/licenses', adminOnly, adminController.getOrgLicenses);
router.patch('/admin/licenses', adminOnly, adminController.updateOrgLicenses);

module.exports = router;
