/**
 * Multer Configuration
 * Gestisce upload file con validazione size e tipo
 */

const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// Directory upload (crea se non esiste)
const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';
if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Storage configuration
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        // Organizza per data: uploads/2025/12/
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const uploadPath = path.join(UPLOAD_DIR, String(year), month);

        // Crea directory se non esiste
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }

        cb(null, uploadPath);
    },
    filename: function (req, file, cb) {
        // Nome file: timestamp_random_originalname
        const timestamp = Date.now();
        const randomString = crypto.randomBytes(8).toString('hex');
        const ext = path.extname(file.originalname);
        const basename = path.basename(file.originalname, ext)
            .replace(/[^a-zA-Z0-9]/g, '_') // Sanitize
            .substring(0, 50); // Max 50 chars

        const filename = `${timestamp}_${randomString}_${basename}${ext}`;
        cb(null, filename);
    }
});

// File filter (tipi ammessi)
const fileFilter = function (req, file, cb) {
    // Tipi MIME ammessi
    const allowedMimeTypes = [
        // Immagini
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/gif',
        'image/webp',
        // Audio
        'audio/mpeg',
        'audio/mp3',
        'audio/wav',
        'audio/webm',
        'audio/ogg',
        // Video
        'video/mp4',
        'video/webm',
        'video/ogg',
        'video/quicktime',
        // Documenti
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'text/plain',
        'text/csv'
    ];

    if (allowedMimeTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error(`Tipo file non supportato: ${file.mimetype}`), false);
    }
};

// Multer instance
const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB max
        files: 1 // 1 file per request
    }
});

// Storage per report template (.docx) - uploads/templates/{org_id}/
const templateStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        const orgId = req.user?.organization_id || 'unknown';
        const templatePath = path.join(UPLOAD_DIR, 'templates', String(orgId));
        if (!fs.existsSync(templatePath)) {
            fs.mkdirSync(templatePath, { recursive: true });
        }
        cb(null, templatePath);
    },
    filename: function (req, file, cb) {
        const timestamp = Date.now();
        const randomString = crypto.randomBytes(6).toString('hex');
        const ext = path.extname(file.originalname).toLowerCase() || '.docx';
        const basename = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9]/g, '_').substring(0, 40);
        cb(null, `${timestamp}_${randomString}_${basename}${ext}`);
    }
});

const templateFileFilter = (req, file, cb) => {
    const allowed = ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (allowed.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Solo file .docx consentiti'), false);
    }
};

const uploadTemplate = multer({
    storage: templateStorage,
    fileFilter: templateFileFilter,
    limits: { fileSize: 5 * 1024 * 1024, files: 1 } // 5MB
});

module.exports = { upload, uploadTemplate };

// ─── Multer per file allegati a documenti del registro ──────────────────────
// Approccio blacklist: accetta qualsiasi formato eccetto eseguibili.
// Il percorso è organizzato per documento: uploads/docs/{org_id}/{doc_id}/

const BLOCKED_EXTENSIONS = [
    '.exe', '.bat', '.cmd', '.ps1', '.sh', '.msi', '.vbs', '.js',
    '.jar', '.com', '.scr', '.pif', '.reg', '.dll', '.sys'
];

const docStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        const orgId  = req.user?.organization_id || 'unknown';
        const docId  = req.params.docId || 'misc';
        const docPath = path.join(UPLOAD_DIR, 'docs', String(orgId), String(docId));
        if (!fs.existsSync(docPath)) fs.mkdirSync(docPath, { recursive: true });
        cb(null, docPath);
    },
    filename: function (req, file, cb) {
        const timestamp    = Date.now();
        const randomString = crypto.randomBytes(6).toString('hex');
        const ext          = path.extname(file.originalname).toLowerCase();
        const basename     = path.basename(file.originalname, ext)
            .replace(/[^a-zA-Z0-9._\- ]/g, '_')
            .substring(0, 80);
        cb(null, `${timestamp}_${randomString}_${basename}${ext}`);
    }
});

const docFileFilter = (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (BLOCKED_EXTENSIONS.includes(ext)) {
        return cb(new Error(`Formato non consentito per sicurezza: ${ext}`), false);
    }
    cb(null, true);
};

const uploadDocFile = multer({
    storage: docStorage,
    fileFilter: docFileFilter,
    limits: { fileSize: 500 * 1024 * 1024, files: 1 } // 500 MB — bounded da spazio disco VPS
});

module.exports = { upload, uploadTemplate, uploadDocFile };
