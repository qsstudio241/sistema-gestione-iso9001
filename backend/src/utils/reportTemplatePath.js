/**
 * Path dei template Word di sistema.
 *
 * I file canonici stanno in app/public/templates (Netlify).
 * Duplica gira sul VPS, dove non c'e' la cartella frontend: copia in
 * backend/templates/ (deploy-manifest) e lookup qui.
 */
const path = require('path');
const fs = require('fs');

function getUploadDir() {
  return process.env.UPLOAD_DIR || './uploads';
}

function listStaticTemplateDirs() {
  return [
    process.env.REPORT_TEMPLATES_STATIC_DIR,
    path.join(__dirname, '../../templates'),
    path.join(__dirname, '../../../app/public/templates'),
    path.join(process.cwd(), 'templates'),
    path.join(process.cwd(), 'app/public/templates'),
    path.join(process.cwd(), '../app/public/templates'),
  ].filter(Boolean);
}

/**
 * @param {string|null|undefined} filePath es. /templates/ISO3834-audit-report.docx o /uploads/...
 * @returns {string|null} path assoluto se il file esiste
 */
function resolveTemplateSourcePath(filePath) {
  if (!filePath) return null;
  const fp = String(filePath);
  if (fp.startsWith('/uploads/')) {
    const rel = fp.replace(/^\/uploads\//, '');
    const full = path.join(path.resolve(getUploadDir()), rel);
    return fs.existsSync(full) ? full : null;
  }
  if (fp.startsWith('/templates/')) {
    const basename = path.basename(fp);
    for (const dir of listStaticTemplateDirs()) {
      const full = path.join(dir, basename);
      if (fs.existsSync(full)) return full;
    }
  }
  return null;
}

module.exports = {
  getUploadDir,
  listStaticTemplateDirs,
  resolveTemplateSourcePath,
};
