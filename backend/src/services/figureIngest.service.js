/**
 * Colla MR-0 (extract locale) + MR-1 (persistFigures CLIP).
 * Multimodal RAG MR-3: PDF già sul disco → tavole isolate per organization_id.
 * Niente Gemini sui PNG. Niente fork di documentIngestPipeline.
 */

const { spawn } = require('child_process');
const fs = require('fs').promises;
const os = require('os');
const path = require('path');
const logger = require('../utils/logger');
const { persistFigures } = require('./figureKnowledge.service');

const SCRIPTS_DIR = path.resolve(__dirname, '../../scripts');
const PYTHON = process.env.PYTHON || process.env.PYTHON_BIN || 'python3';

function allowedRoots() {
  const upload = path.resolve(process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads'));
  return [
    upload,
    path.resolve(SCRIPTS_DIR, 'pdf_to_json'),
    path.resolve(os.tmpdir()),
  ];
}

function isPathInside(candidate, root) {
  const rel = path.relative(root, candidate);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

function assertAuthorizedPdfPath(pdfPath) {
  if (!pdfPath || typeof pdfPath !== 'string') {
    const err = new Error('Percorso PDF obbligatorio.');
    err.code = 'INVALID_PDF_PATH';
    throw err;
  }
  const resolved = path.resolve(pdfPath);
  if (path.extname(resolved).toLowerCase() !== '.pdf') {
    const err = new Error('Il file deve essere un PDF.');
    err.code = 'INVALID_PDF_PATH';
    throw err;
  }
  const ok = allowedRoots().some((root) => isPathInside(resolved, root));
  if (!ok) {
    const err = new Error('Percorso PDF non autorizzato.');
    err.code = 'INVALID_PDF_PATH';
    throw err;
  }
  return resolved;
}

function spawnExtract(pdfPath, outputDir) {
  const py = [
    'import json, sys',
    'from pdf_to_json.extract_figures import extract_and_save_figures',
    'extract_and_save_figures(sys.argv[1], sys.argv[2])',
    'print("ok")',
  ].join('; ');
  return new Promise((resolve, reject) => {
    const child = spawn(PYTHON, ['-c', py, pdfPath, outputDir], {
      cwd: SCRIPTS_DIR,
      env: process.env,
    });
    let stderr = '';
    child.stderr.on('data', (buf) => {
      stderr += buf.toString();
    });
    child.on('error', (err) => {
      err.code = err.code || 'FIGURE_EXTRACT_UNAVAILABLE';
      reject(err);
    });
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      const err = new Error(
        (stderr && stderr.trim()) || `Estrazione figure fallita (exit ${code}).`
      );
      err.code = 'FIGURE_EXTRACT_UNAVAILABLE';
      reject(err);
    });
  });
}

async function defaultExtractFigures(pdfPath, outputDir) {
  await fs.mkdir(outputDir, { recursive: true });
  await spawnExtract(pdfPath, outputDir);
  const stem = path.basename(pdfPath, path.extname(pdfPath));
  const jsonPath = path.join(outputDir, `${stem}.figures.json`);
  try {
    const raw = await fs.readFile(jsonPath, 'utf8');
    const parsed = JSON.parse(raw);
    const figures = Array.isArray(parsed.figures) ? parsed.figures : [];
    return { figures, figuresDir: outputDir };
  } catch (err) {
    if (err && err.code === 'ENOENT') {
      return { figures: [], figuresDir: outputDir };
    }
    throw err;
  }
}

/**
 * Estrae le tavole da un PDF locale e le persiste per organizationId.
 *
 * @param {object} opts
 * @param {number} opts.organizationId  dal JWT / chiamante, mai un id org libero dal client
 * @param {number|null} [opts.companyId]
 * @param {string} opts.pdfPath
 * @param {object} [opts.embedder]  mock CLIP in L1
 * @param {function} [opts.extractFigures]  mock spawn extract in L1
 * @returns {Promise<{ figures: Array, count: number }>}
 */
async function ingestFiguresFromPdf(opts) {
  const organizationId = Number(opts && opts.organizationId);
  if (!Number.isFinite(organizationId)) {
    const err = new Error('organizationId obbligatorio per ingestFiguresFromPdf');
    err.code = 'UNAUTHORIZED';
    throw err;
  }

  const pdfPath = assertAuthorizedPdfPath(opts.pdfPath);
  try {
    await fs.access(pdfPath);
  } catch {
    const err = new Error('PDF non trovato sul server.');
    err.code = 'PDF_NOT_FOUND';
    throw err;
  }

  const stem = path.basename(pdfPath, path.extname(pdfPath));
  const outputDir = opts.outputDir
    || path.join(os.tmpdir(), 'sgq-figures', String(organizationId), stem);
  const extract = typeof opts.extractFigures === 'function'
    ? opts.extractFigures
    : defaultExtractFigures;

  let extracted;
  try {
    extracted = await extract(pdfPath, outputDir);
  } catch (err) {
    logger.warn('[figureIngest] extract fallito: %s', err.message);
    throw err;
  }

  const figures = (extracted && Array.isArray(extracted.figures))
    ? extracted.figures
    : [];
  const figuresDir = (extracted && extracted.figuresDir) || outputDir;

  const inserted = await persistFigures({
    organizationId,
    companyId: opts.companyId != null ? opts.companyId : null,
    sourcePdf: path.basename(pdfPath),
    figures,
    figuresDir,
    embedder: opts.embedder,
  });

  logger.info(
    '[figureIngest] org %s pdf=%s figure=%s',
    organizationId,
    path.basename(pdfPath),
    (inserted && inserted.length) || 0
  );

  return {
    figures: inserted || [],
    count: (inserted && inserted.length) || 0,
  };
}

module.exports = {
  ingestFiguresFromPdf,
  assertAuthorizedPdfPath,
  defaultExtractFigures,
};
