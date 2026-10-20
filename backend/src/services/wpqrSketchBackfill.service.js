/**
 * Backfill libreria schizzi per WPQR già ingestite (PDF persistito, nessuna riga
 * in weld_sketches). Idempotente. Gli schizzi restano bozza / da dividere —
 * conferma in Rivedi. Non approva.
 */

const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');
const { getUploadRoot, parseUploadsUrl } = require('../utils/uploadsPath');
const { decodePng, encodePng } = require('./weldSketchPng');

const CANDIDATE_SQL = `
SELECT
    w.id, w.organization_id, w.company_id,
    w.reference_number, w.wpqr_code, w.certificate_number,
    w.certificate_file_url,
    w.joint_type, w.joint_preparation, w.product_type,
    w.thickness_min, w.thickness_max, w.throat_test_mm,
    w.diameter_test_mm, w.diameter_min, w.welding_process,
    w.welding_positions, w.welding_position_test,
    w.single_multi_run, w.backing_gas
FROM dbo.wpqr_records w
WHERE w.deleted_at IS NULL
  AND w.certificate_file_url IS NOT NULL
  AND LTRIM(RTRIM(w.certificate_file_url)) <> N''
  AND NOT EXISTS (
      SELECT 1 FROM dbo.weld_sketches s
      WHERE s.wpqr_id = w.id
        AND s.organization_id = w.organization_id
  )
ORDER BY w.organization_id, w.company_id, w.id
`;

const EXISTS_SQL = `
SELECT TOP 1 id
FROM dbo.weld_sketches
WHERE wpqr_id = @wpqr_id AND organization_id = @organization_id
`;

function wpqrLabel(row) {
    return row.reference_number || row.wpqr_code || row.certificate_number || `#${row.id}`;
}

function classifyStored(stored) {
    const list = Array.isArray(stored) ? stored : [];
    if (!list.length) return 'empty';
    if (list.some((s) => s.status === 'da dividere' || s.slot === 'combined')) return 'da_dividere';
    if (list.some((s) => s.slot === 'joint_design' || s.slot === 'welding_sequence')) return 'auto_split';
    return 'draft';
}

function defaultQuery() {
    return require('../config/database').query;
}

async function listCandidates({ queryFn } = {}) {
    const query = queryFn || defaultQuery();
    const result = await query(CANDIDATE_SQL);
    return result.recordset || [];
}

async function hasSketches(queryFn, wpqrId, organizationId) {
    const result = await queryFn(EXISTS_SQL, {
        wpqr_id: wpqrId,
        organization_id: organizationId,
    });
    return !!(result.recordset && result.recordset[0]);
}

function resolveSketchPngPath(fileUrl) {
    const parsed = parseUploadsUrl(fileUrl);
    if (!parsed) return null;
    const abs = path.join(getUploadRoot(), parsed.rel);
    return fs.existsSync(abs) ? abs : null;
}

function scaleRgba(rgba, srcW, srcH, dstW, dstH) {
    const out = Buffer.alloc(dstW * dstH * 4, 255);
    for (let y = 0; y < dstH; y += 1) {
        const sy = Math.min(srcH - 1, Math.floor((y * srcH) / dstH));
        for (let x = 0; x < dstW; x += 1) {
            const sx = Math.min(srcW - 1, Math.floor((x * srcW) / dstW));
            const si = (sy * srcW + sx) * 4;
            const di = (y * dstW + x) * 4;
            out[di] = rgba[si];
            out[di + 1] = rgba[si + 1];
            out[di + 2] = rgba[si + 2];
            out[di + 3] = 255;
        }
    }
    return out;
}

function barColor(kind) {
    if (kind === 'auto_split') return [34, 139, 34];
    if (kind === 'da_dividere') return [201, 140, 0];
    return [90, 90, 90];
}

/**
 * Griglia PNG delle bozze estratte. Nessun PDF cliente: solo PNG già in libreria.
 */
function composeContactSheet(items, opts = {}) {
    const cellW = opts.cellW != null ? opts.cellW : 160;
    const cellH = opts.cellH != null ? opts.cellH : 180;
    const pad = opts.pad != null ? opts.pad : 8;
    const bar = 8;
    const list = (items || []).filter((it) => it && Buffer.isBuffer(it.png));
    if (!list.length) return null;
    const cols = Math.min(opts.cols || 4, list.length);
    const rows = Math.ceil(list.length / cols);
    const width = cols * (cellW + pad) + pad;
    const height = rows * (cellH + pad + bar) + pad;
    const canvas = Buffer.alloc(width * height * 4, 245);
    for (let i = 0; i < width * height; i += 1) canvas[i * 4 + 3] = 255;

    for (let i = 0; i < list.length; i += 1) {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const x0 = pad + col * (cellW + pad);
        const y0 = pad + row * (cellH + pad + bar);
        const rgb = barColor(list[i].kind);
        for (let y = 0; y < bar; y += 1) {
            for (let x = 0; x < cellW; x += 1) {
                const di = ((y0 + y) * width + (x0 + x)) * 4;
                canvas[di] = rgb[0];
                canvas[di + 1] = rgb[1];
                canvas[di + 2] = rgb[2];
            }
        }
        const decoded = decodePng(list[i].png);
        if (!decoded) continue;
        const scaled = scaleRgba(decoded.rgba, decoded.width, decoded.height, cellW, cellH);
        for (let y = 0; y < cellH; y += 1) {
            for (let x = 0; x < cellW; x += 1) {
                const si = (y * cellW + x) * 4;
                const di = ((y0 + bar + y) * width + (x0 + x)) * 4;
                canvas[di] = scaled[si];
                canvas[di + 1] = scaled[si + 1];
                canvas[di + 2] = scaled[si + 2];
            }
        }
    }
    return encodePng(width, height, canvas);
}

function logLine(log, level, msg, extra) {
    const text = extra != null ? `${msg} ${JSON.stringify(extra)}` : msg;
    if (log && typeof log[level] === 'function') log[level](text);
    else if (level === 'warn') logger.warn(text);
    else logger.info(text);
}

async function backfillWpqrSketches({
    dryRun = true,
    queryFn,
    extractFn,
    log,
} = {}) {
    const query = queryFn || defaultQuery();
    const extract = extractFn || require('./weldSketches.service').extractAfterWpqrCommit;
    const candidates = await listCandidates({ queryFn: query });
    logLine(log, 'info', '[wpqr-sketch-backfill] candidati', {
        n: candidates.length, dryRun: !!dryRun,
    });

    const results = [];
    for (const row of candidates) {
        const code = wpqrLabel(row);
        const base = {
            wpqr_id: row.id,
            organization_id: row.organization_id,
            company_id: row.company_id,
            code,
            pdf: row.certificate_file_url,
        };
        if (dryRun) {
            logLine(log, 'info', '[wpqr-sketch-backfill] DRY_RUN', base);
            results.push({ ...base, kind: 'dry_run' });
            continue;
        }
        if (await hasSketches(query, row.id, row.organization_id)) {
            logLine(log, 'info', '[wpqr-sketch-backfill] skip già presente', base);
            results.push({ ...base, kind: 'skip' });
            continue;
        }
        try {
            // throwOnError: extractAfterWpqrCommit di default ingoia gli errori
            // (ingest non bloccante) e restituisce []. Senza questo flag il
            // backfill classificherebbe PDF/I/O rotto come empty.
            const stored = await extract({
                organizationId: row.organization_id,
                companyId: row.company_id,
                wpqrId: row.id,
                wpqr: row,
                certificateFileUrl: row.certificate_file_url,
                throwOnError: true,
            });
            const kind = classifyStored(stored);
            const slots = (stored || []).map((s) => `${s.slot}:${s.status}`).join(',');
            logLine(log, 'info', '[wpqr-sketch-backfill] ok', { ...base, kind, n: (stored || []).length, slots });
            results.push({
                ...base,
                kind,
                n: (stored || []).length,
                stored: stored || [],
            });
        } catch (err) {
            logLine(log, 'warn', '[wpqr-sketch-backfill] fail', { ...base, error: err.message });
            results.push({ ...base, kind: 'fail', error: err.message });
        }
    }

    const summary = {
        dryRun: !!dryRun,
        candidates: candidates.length,
        processed: results.filter((r) => r.kind !== 'dry_run' && r.kind !== 'skip').length,
        auto_split: results.filter((r) => r.kind === 'auto_split').length,
        da_dividere: results.filter((r) => r.kind === 'da_dividere').length,
        draft: results.filter((r) => r.kind === 'draft').length,
        empty: results.filter((r) => r.kind === 'empty').length,
        skip: results.filter((r) => r.kind === 'skip').length,
        fail: results.filter((r) => r.kind === 'fail').length,
    };
    logLine(log, 'info', '[wpqr-sketch-backfill] summary', summary);
    return { summary, results, candidates };
}

function collectSheetItems(results) {
    const items = [];
    for (const row of results || []) {
        if (row.kind === 'fail' || row.kind === 'dry_run' || row.kind === 'skip' || row.kind === 'empty') continue;
        for (const sk of row.stored || []) {
            const abs = resolveSketchPngPath(sk.file_url);
            if (!abs) continue;
            items.push({ png: fs.readFileSync(abs), kind: row.kind, wpqr_id: row.wpqr_id, slot: sk.slot });
        }
    }
    return items;
}

module.exports = {
    CANDIDATE_SQL,
    listCandidates,
    hasSketches,
    classifyStored,
    wpqrLabel,
    backfillWpqrSketches,
    composeContactSheet,
    collectSheetItems,
};
