const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const { requireLicensedModule } = require('../middleware/moduleLicense.middleware');
const { logAiInteraction } = require('../middleware/aiAuditTrail.middleware');
const { upload } = require('../config/multer');
const ctrl = require('../controllers/contractReview.controller');

const guard = [authenticate, requireLicensedModule('ai_review')];

function multerSingle(req, res, next) {
    upload.single('file')(req, res, (err) => {
        if (err) {
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(413).json({ error: 'File troppo grande (max 10MB)', code: 'FILE_TOO_LARGE' });
            }
            return res.status(415).json({ error: err.message, code: 'UNSUPPORTED_MEDIA_TYPE' });
        }
        next();
    });
}

router.get('/contract-reviews/summary', ...guard, ctrl.getSummary);
router.get('/contract-reviews/inbox', ...guard, ctrl.getInbox);

router.get('/contract-reviews', ...guard, ctrl.listCases);
router.post('/contract-reviews', ...guard, ctrl.createCase);
router.post('/contract-reviews/import-from-job', ...guard, ctrl.importFromJob);

router.get('/contract-reviews/:id/transition-options', ...guard, ctrl.getTransitionOptions);
router.get('/contract-reviews/:id/clarifications', ...guard, ctrl.listClarifications);
router.post('/contract-reviews/:id/clarifications', ...guard, ctrl.createClarification);
router.patch('/contract-reviews/:id/clarifications/:clarificationId', ...guard, ctrl.updateClarification);

router.get('/contract-reviews/:id/documents', ...guard, ctrl.listCaseDocuments);
router.post('/contract-reviews/:id/documents/link', ...guard, ctrl.linkDocument);
router.delete('/contract-reviews/:id/documents/:linkId', ...guard, ctrl.unlinkDocument);

router.get('/contract-reviews/:id/attachments', ...guard, ctrl.listCaseAttachments);
router.post('/contract-reviews/:id/attachments/upload', ...guard, multerSingle, ctrl.uploadCaseAttachment);

router.post('/contract-reviews/:id/ai/analyze-requirements', ...guard, logAiInteraction('review'), ctrl.analyzeRequirements);

router.get('/contract-reviews/:id/capability-gap-report', ...guard, ctrl.getCapabilityGapReport);
router.post('/contract-reviews/:id/capability-gap-report', ...guard, ctrl.regenerateCapabilityGapReport);

router.get('/contract-reviews/:id', ...guard, ctrl.getCase);
router.put('/contract-reviews/:id', ...guard, ctrl.updateCase);
router.post('/contract-reviews/:id/transition', ...guard, ctrl.transitionStatus);
router.post('/contract-reviews/:id/handoff', ...guard, ctrl.registerHandoff);
router.post('/contract-reviews/:id/generate-checklist', ...guard, ctrl.generateChecklist);
router.put('/contract-reviews/:id/checklist/:itemId', ...guard, ctrl.saveChecklistAnswer);

module.exports = router;
