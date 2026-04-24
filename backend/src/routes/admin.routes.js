/**
 * Admin routes - Gestione utenti e assegnazione standard (solo admin)
 *
 * RBAC:
 *   adminOnly      → admin (org) + superadmin: gestione utenti, lettura licenze
 *   superadminOnly → solo superadmin: modifica licenze (decide chi può usare quali moduli)
 */

const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth.middleware');
const adminController = require('../controllers/admin.controller');

const adminOnly      = [authenticate, authorize('admin', 'superadmin')];
const superadminOnly = [authenticate, authorize('superadmin')];

router.get('/admin/users', adminOnly, adminController.listUsers);
router.post('/admin/users', adminOnly, adminController.createUser);
router.patch('/admin/users/:id', adminOnly, adminController.updateUser);
router.delete('/admin/users/:id', adminOnly, adminController.deactivateUser);
router.put('/admin/users/:id/standards', adminOnly, adminController.updateUserStandards);

// Licenze: admin può LEGGERE le proprie licenze; solo superadmin può MODIFICARLE
router.get('/admin/licenses', adminOnly, adminController.getOrgLicenses);
router.patch('/admin/licenses', superadminOnly, adminController.updateOrgLicenses);

module.exports = router;
