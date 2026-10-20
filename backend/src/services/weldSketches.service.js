/**
 * Libreria schizzi di giunto (ISO 15609-1 Annex A).
 * Estrae crop PNG dal PDF WPQR, suggerisce match in generazione WPS,
 * non disegna mai lo schizzo.
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');
const { getUploadRoot, parseUploadsUrl, resolveUploadFile } = require('../utils/uploadsPath');

function getQuery() {
    return require('../config/database').query;
}

const SLOTS = Object.freeze(['joint_design', 'welding_sequence', 'combined', 'hardness_map']);
const SOURCE_KINDS = Object.freeze(['wpqr_crop', 'upload', 'library_std']);
const STATUS_DRAFT = 'bozza';
const STATUS_CONFIRMED = 'confermato';
const RENDER = Object.freeze({ density: 200, width: 1654, height: 2339 });
const PT_PAGE = Object.freeze({ width: 595, height: 842 });

const KEYWORD_JOINT = /joint\s*design|disegno\s+del\s+giunto|\bschizzo\b/i;
const KEYWORD_SEQUENCE = /welding\s*sequence|sequenza\s+di\s+saldatura/i;
const KEYWORD_SKETCH = /\bsketch\b|\bschizzo\b/i;
const KEYWORD_HARDNESS = /hardness|hv\s*10|location of measurements/i;

const FILLET_PREP = /fillet|filetto|close\s*square\s*t|angolo|t\s*prep/i;

function tableAvailableCache() {
    return { value: undefined };
}
const _tableCache = tableAvailableCache();

async function sketchesTableAvailable() {
    if (_tableCache.value !== undefined) return _tableCache.value;
    try {
        const r = await getQuery()(`
            SELECT CASE WHEN OBJECT_ID(N'dbo.weld_sketches', N'U') IS NULL THEN 0 ELSE 1 END AS present
        `);
        _tableCache.value = Number(r.recordset[0] && r.recordset[0].present) === 1;
    } catch (err) {
        logger.warn('[weldSketches] probe tabella fallito', { error: err.message });
        _tableCache.value = false;
    }
    return _tableCache.value;
}

function resetTableCache() {
    _tableCache.value = undefined;
}

async function presentWpsSketchColumns() {
    try {
        const r = await getQuery()(`
            SELECT c.name AS name
            FROM sys.columns c
            WHERE c.object_id = OBJECT_ID(N'dbo.welding_procedures')
              AND c.name IN (N'joint_sketch_id', N'sequence_sketch_id')
        `);
        return new Set((r.recordset || []).map((row) => row.name));
    } catch (err) {
        logger.warn('[weldSketches] probe colonne WPS fallito', { error: err.message });
        return new Set();
    }
}

function normalizeJointType(raw) {
    const s = String(raw || '').trim().toUpperCase();
    if (s === 'FW' || s === 'BW' || s === 'SW' || s === 'T-BW') return s;
    if (/fillet|filetto|angolo/.test(s)) return 'FW';
    if (/butt|testa/.test(s)) return 'BW';
    return s || null;
}

function normalizePreparation(raw) {
    const s = String(raw || '').trim().toLowerCase();
    if (!s) return null;
    if (FILLET_PREP.test(s)) return 'fillet';
    if (/\bx\b|double-?v|doppia\s*v/.test(s)) return 'X';
    if (/half-?v|mezza\s*v|k\b/.test(s) && /\bk\b/.test(s)) return 'K';
    if (/half-?v|mezza\s*v/.test(s)) return 'half-V';
    if (/\bu\b/.test(s)) return 'U';
    if (/\bv\b|single-?v/.test(s)) return 'V';
    if (/\bi\b|square|quadra/.test(s)) return 'I';
    return s.slice(0, 40);
}

function preparationEquivalent(a, b) {
    const na = normalizePreparation(a);
    const nb = normalizePreparation(b);
    if (!na || !nb) return false;
    if (na === nb) return true;
    return na === 'fillet' && nb === 'fillet';
}

function normalizeProductForm(raw) {
    const s = String(raw || '').trim().toLowerCase();
    if (!s) return null;
    if (/tube-?to-?plate|t-on-p|tubo.?piastra|pipe.+plate/.test(s)) return 'T-on-P';
    if (/\bt\b|pipe|tubo|tube/.test(s) && !/plate|piastra/.test(s)) return 'T';
    if (/\bp\b|plate|piastra|lamiera/.test(s)) return 'P';
    return s.slice(0, 20);
}

function processFamily(code) {
    const n = String(code || '').replace(/[^\d]/g, '').slice(0, 3);
    if (!n) return null;
    if (n === '135' || n === '136' || n === '138') return '13x';
    return n;
}

function processEqual(a, b) {
    const na = String(a || '').replace(/[^\d]/g, '').slice(0, 3);
    const nb = String(b || '').replace(/[^\d]/g, '').slice(0, 3);
    return Boolean(na && na === nb);
}

function runModeOf(raw, nPasses) {
    const s = String(raw || '').toLowerCase();
    if (/multi/.test(s)) return 'multi';
    if (/single|mono/.test(s)) return 'single';
    if (Number(nPasses) > 1) return 'multi';
    if (Number(nPasses) === 1) return 'single';
    return null;
}

function thicknessInRange(requestMm, sketch) {
    const t = Number(requestMm);
    if (!Number.isFinite(t) || t <= 0) return false;
    const min = Number(sketch.thickness_min_mm);
    const max = Number(sketch.thickness_max_mm);
    if (Number.isFinite(min) && Number.isFinite(max)) {
        if (t >= min && t <= max) return true;
        const mid = (min + max) / 2;
        return t >= mid * 0.5 && t <= mid * 1.5;
    }
    const only = Number.isFinite(min) ? min : max;
    if (!Number.isFinite(only)) return false;
    return t >= only * 0.5 && t <= only * 1.5;
}

function scoreSketch(sketch, request = {}) {
    const jtSketch = normalizeJointType(sketch.joint_type);
    const jtReq = normalizeJointType(request.joint_type);
    if (!jtSketch || !jtReq || jtSketch !== jtReq) return null;

    let score = 0;
    if (preparationEquivalent(sketch.preparation, request.preparation || request.joint_preparation)) {
        score += 40;
    }
    const pfS = normalizeProductForm(sketch.product_form);
    const pfR = normalizeProductForm(request.product_form || request.product_type);
    if (pfS && pfR && pfS === pfR) score += 20;

    const tReq = request.thickness_mm != null ? request.thickness_mm : request.thickness_a_mm;
    if (thicknessInRange(tReq, sketch)) score += 15;

    if (processEqual(sketch.process_iso4063, request.welding_process)) score += 10;
    else if (processFamily(sketch.process_iso4063) && processFamily(sketch.process_iso4063) === processFamily(request.welding_process)) {
        score += 5;
    }

    const rmS = runModeOf(sketch.run_mode, sketch.n_passes);
    const rmR = runModeOf(request.run_mode || request.single_multi_run, request.n_passes);
    if (rmS && rmR && rmS === rmR) score += 10;

    const posS = String(sketch.position_iso6947 || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2);
    const posR = String(request.position || request.welding_positions || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2);
    if (posS && posR && posS === posR) score += 5;

    return score;
}

function dimensionTextFromWpqr(wpqr = {}) {
    const bits = [];
    const t1 = wpqr.thickness_tested != null ? wpqr.thickness_tested : wpqr.thickness_t1_test_mm;
    const t2 = wpqr.thickness_t2_test_mm;
    if (t1 != null && t2 != null && Number(t1) !== Number(t2)) {
        bits.push(`t1=${Number(t1)} mm; t2=${Number(t2)} mm`);
    } else if (t1 != null) {
        bits.push(`t=${Number(t1)} mm`);
    }
    if (wpqr.throat_test_mm != null && wpqr.throat_test_mm !== '') {
        bits.push(`a: ${Number(wpqr.throat_test_mm)} mm`);
    }
    const d = wpqr.diameter_test_mm != null ? wpqr.diameter_test_mm : wpqr.diameter_min;
    if (d != null && d !== '') bits.push(`d: ${Number(d)} mm`);
    return bits.join(' - ').slice(0, 200) || null;
}

function metadataFromWpqr(wpqr = {}, extra = {}) {
    const nPasses = extra.nPasses != null
        ? extra.nPasses
        : (Array.isArray(wpqr.test_runs) ? wpqr.test_runs.length : null);
    return {
        joint_type: normalizeJointType(wpqr.joint_type),
        preparation: normalizePreparation(wpqr.joint_preparation),
        product_form: normalizeProductForm(wpqr.product_type),
        thickness_min_mm: wpqr.thickness_min != null ? Number(wpqr.thickness_min) : null,
        thickness_max_mm: wpqr.thickness_max != null ? Number(wpqr.thickness_max) : null,
        throat_mm: wpqr.throat_test_mm != null ? Number(wpqr.throat_test_mm) : null,
        outside_diameter_mm: wpqr.diameter_test_mm != null
            ? Number(wpqr.diameter_test_mm)
            : (wpqr.diameter_min != null ? Number(wpqr.diameter_min) : null),
        process_iso4063: wpqr.welding_process || null,
        position_iso6947: wpqr.welding_positions || wpqr.welding_position_test || null,
        run_mode: runModeOf(wpqr.single_multi_run, nPasses),
        n_passes: nPasses,
        backing: wpqr.backing_gas || null,
        dimension_text: dimensionTextFromWpqr(wpqr),
    };
}

function classifyPageText(text) {
    const t = String(text || '');
    const hardness = KEYWORD_HARDNESS.test(t);
    const joint = KEYWORD_JOINT.test(t);
    const sequence = KEYWORD_SEQUENCE.test(t);
    const sketch = KEYWORD_SKETCH.test(t);
    if (hardness && !joint && !sequence) return 'hardness_map';
    if (joint && sequence) return 'combined';
    if (joint || (sketch && !sequence)) return 'joint_design';
    if (sequence) return 'welding_sequence';
    return null;
}

function findSketchPages(pages = []) {
    const hits = [];
    for (const page of pages) {
        const slot = classifyPageText(page.text);
        if (!slot) continue;
        hits.push({
            page: page.page,
            slot,
            text: page.text,
            items: page.items || [],
        });
    }
    return hits;
}

function bboxFromItems(items, pageSlot) {
    const list = Array.isArray(items) ? items : [];
    const jointItems = list.filter((it) => KEYWORD_JOINT.test(it.str || ''));
    const seqItems = list.filter((it) => KEYWORD_SEQUENCE.test(it.str || ''));
    const sketchItems = list.filter((it) => KEYWORD_SKETCH.test(it.str || ''));
    const titles = [...jointItems, ...seqItems, ...sketchItems];
    if (!titles.length) {
        return { x0: 40, y0: 220, x1: 555, y1: 620, split: null };
    }
    const ys = titles.map((it) => Number(it.y)).filter(Number.isFinite);
    const xs = titles.map((it) => Number(it.x)).filter(Number.isFinite);
    const titleY = Math.max(...ys);
    const minX = xs.length ? Math.min(...xs) : 40;
    const maxX = xs.length ? Math.max(...xs) : 555;
    const below = Math.max(80, titleY - 280);
    const x0 = Math.max(20, minX - 20);
    const x1 = Math.min(PT_PAGE.width - 20, Math.max(maxX + 180, 555));
    const y0 = Math.max(40, below);
    const y1 = Math.min(PT_PAGE.height - 40, titleY + 10);

    let split = null;
    if (pageSlot === 'combined' && jointItems.length && seqItems.length) {
        const jx = Number(jointItems[0].x);
        const sx = Number(seqItems[0].x);
        if (Number.isFinite(jx) && Number.isFinite(sx) && Math.abs(jx - sx) > 150) {
            const mid = (jx + sx) / 2;
            split = { verticalAt: mid };
        }
    }
    return { x0, y0, x1, y1, split };
}

function formatBbox(b) {
    if (!b) return null;
    return [b.x0, b.y0, b.x1, b.y1].map((n) => Math.round(n)).join(',');
}

function ptToPx(pt, pagePx, pagePt) {
    return Math.round((pt / pagePt) * pagePx);
}

function cropRectFromBbox(bbox, pngSize) {
    const wPx = pngSize.width;
    const hPx = pngSize.height;
    const pdfYTop = bbox.y1;
    const pdfYBot = bbox.y0;
    const x = ptToPx(bbox.x0, wPx, PT_PAGE.width);
    const width = Math.max(8, ptToPx(bbox.x1 - bbox.x0, wPx, PT_PAGE.width));
    const yFromTop = ptToPx(PT_PAGE.height - pdfYTop, hPx, PT_PAGE.height);
    const height = Math.max(8, ptToPx(pdfYTop - pdfYBot, hPx, PT_PAGE.height));
    return {
        x: Math.max(0, Math.min(wPx - 8, x)),
        y: Math.max(0, Math.min(hPx - 8, yFromTop)),
        width: Math.min(width, wPx),
        height: Math.min(height, hPx),
    };
}

async function extractPdfPages(pdfBuffer, pdfParseImpl) {
    const pdfParse = pdfParseImpl || require('pdf-parse');
    const pages = [];
    await pdfParse(pdfBuffer, {
        max: 20,
        pagerender: async (pageData) => {
            let items = [];
            try {
                const tc = await pageData.getTextContent();
                items = (tc.items || []).map((it) => ({
                    str: it.str || '',
                    x: it.transform ? it.transform[4] : 0,
                    y: it.transform ? it.transform[5] : 0,
                }));
            } catch (_) {
                items = [];
            }
            const text = items.map((it) => it.str).join(' ');
            pages.push({ page: pages.length + 1, text, items });
            return text;
        },
    });
    return pages;
}

async function renderAndCrop(pdfBuffer, pageNumber, bbox, deps = {}) {
    const render = deps.renderPdfPagePng || require('../utils/ocrExtractor').renderPdfPagePng;
    const cropPng = deps.cropPng || require('../utils/ocrExtractor').cropPng;
    const pngSize = deps.pngSize || require('../utils/ocrExtractor').pngSize;
    const pagePng = await render(pdfBuffer, pageNumber, RENDER);
    const size = pngSize(pagePng);
    if (!size) throw new Error('PNG pagina non leggibile');
    const rect = cropRectFromBbox(bbox, size);
    const cropped = await cropPng(pagePng, rect);
    const outSize = pngSize(cropped) || size;
    return { png: cropped, width: outSize.width, height: outSize.height, rect };
}

function sha256Of(buf) {
    return crypto.createHash('sha256').update(buf).digest('hex');
}

function resolveSourcePdfPath(filePath) {
    if (!filePath) return null;
    if (path.isAbsolute(filePath) && fs.existsSync(filePath)) return filePath;
    const parsed = parseUploadsUrl(String(filePath).startsWith('/uploads/') ? filePath : null);
    const root = getUploadRoot();
    if (parsed) {
        const abs = path.join(root, parsed.rel);
        if (fs.existsSync(abs)) return abs;
    }
    const asRel = String(filePath).replace(/^\/?uploads\/?/, '');
    const joined = path.join(root, asRel);
    return fs.existsSync(joined) ? joined : null;
}

function publicFileUrl(absPath) {
    const root = getUploadRoot();
    return '/uploads/' + path.relative(root, absPath).replace(/\\/g, '/');
}

function sketchDir(organizationId, companyId) {
    const root = getUploadRoot();
    const dir = path.join(root, 'sketches', String(organizationId), String(companyId || 'shared'));
    fs.mkdirSync(dir, { recursive: true });
    return dir;
}

async function writePngFile({ organizationId, companyId, slot, png }) {
    const dir = sketchDir(organizationId, companyId);
    const name = `sk_${Date.now()}_${crypto.randomBytes(4).toString('hex')}_${slot}.png`;
    const abs = path.join(dir, name);
    fs.writeFileSync(abs, png);
    return { abs, file_url: publicFileUrl(abs) };
}

function publicSketch(row) {
    if (!row) return null;
    return {
        id: row.id,
        organization_id: row.organization_id,
        company_id: row.company_id,
        slot: row.slot,
        source_kind: row.source_kind,
        wpqr_id: row.wpqr_id,
        source_page: row.source_page,
        crop_bbox_pt: row.crop_bbox_pt,
        file_url: row.file_url,
        width_px: row.width_px,
        height_px: row.height_px,
        joint_type: row.joint_type,
        preparation: row.preparation,
        product_form: row.product_form,
        thickness_min_mm: row.thickness_min_mm,
        thickness_max_mm: row.thickness_max_mm,
        throat_mm: row.throat_mm,
        outside_diameter_mm: row.outside_diameter_mm,
        process_iso4063: row.process_iso4063,
        position_iso6947: row.position_iso6947,
        run_mode: row.run_mode,
        n_passes: row.n_passes,
        dimension_text: row.dimension_text,
        status: row.status,
        created_at: row.created_at,
    };
}

async function insertSketch(row) {
    if (!(await sketchesTableAvailable())) return null;
    const result = await getQuery()(`
        INSERT INTO weld_sketches (
            organization_id, company_id, slot, source_kind, wpqr_id,
            source_attachment_id, source_page, crop_bbox_pt, file_url,
            width_px, height_px, sha256, joint_type, preparation, product_form,
            thickness_min_mm, thickness_max_mm, throat_mm, outside_diameter_mm,
            process_iso4063, position_iso6947, run_mode, n_passes, backing,
            dimension_text, status, created_by
        )
        OUTPUT INSERTED.id
        VALUES (
            @organization_id, @company_id, @slot, @source_kind, @wpqr_id,
            @source_attachment_id, @source_page, @crop_bbox_pt, @file_url,
            @width_px, @height_px, @sha256, @joint_type, @preparation, @product_form,
            @thickness_min_mm, @thickness_max_mm, @throat_mm, @outside_diameter_mm,
            @process_iso4063, @position_iso6947, @run_mode, @n_passes, @backing,
            @dimension_text, @status, @created_by
        )
    `, {
        organization_id: row.organization_id,
        company_id: row.company_id || null,
        slot: row.slot,
        source_kind: row.source_kind || 'wpqr_crop',
        wpqr_id: row.wpqr_id || null,
        source_attachment_id: row.source_attachment_id || null,
        source_page: row.source_page || null,
        crop_bbox_pt: row.crop_bbox_pt || null,
        file_url: row.file_url,
        width_px: row.width_px || null,
        height_px: row.height_px || null,
        sha256: row.sha256 || null,
        joint_type: row.joint_type || null,
        preparation: row.preparation || null,
        product_form: row.product_form || null,
        thickness_min_mm: row.thickness_min_mm != null ? row.thickness_min_mm : null,
        thickness_max_mm: row.thickness_max_mm != null ? row.thickness_max_mm : null,
        throat_mm: row.throat_mm != null ? row.throat_mm : null,
        outside_diameter_mm: row.outside_diameter_mm != null ? row.outside_diameter_mm : null,
        process_iso4063: row.process_iso4063 || null,
        position_iso6947: row.position_iso6947 || null,
        run_mode: row.run_mode || null,
        n_passes: row.n_passes != null ? row.n_passes : null,
        backing: row.backing || null,
        dimension_text: row.dimension_text || null,
        status: row.status || STATUS_DRAFT,
        created_by: row.created_by || null,
    });
    return result.recordset[0] && result.recordset[0].id;
}

async function extractAndStoreFromPdf({
    pdfBuffer,
    organizationId,
    companyId,
    wpqrId,
    wpqr = {},
    userId = null,
    deps = {},
}) {
    if (!(await sketchesTableAvailable())) return [];
    if (!pdfBuffer || !Buffer.isBuffer(pdfBuffer)) return [];

    const pages = await extractPdfPages(pdfBuffer, deps.pdfParse);
    const hits = findSketchPages(pages).filter((h) => h.slot !== 'hardness_map');
    if (!hits.length) return [];

    const meta = metadataFromWpqr(wpqr);
    const stored = [];
    const seenPages = new Set();

    for (const hit of hits) {
        if (seenPages.has(hit.page)) continue;
        seenPages.add(hit.page);
        const bbox = bboxFromItems(hit.items, hit.slot);
        try {
            const cropped = await renderAndCrop(pdfBuffer, hit.page, bbox, deps);
            const file = await writePngFile({
                organizationId, companyId, slot: hit.slot, png: cropped.png,
            });
            const id = await insertSketch({
                organization_id: organizationId,
                company_id: companyId,
                slot: hit.slot,
                source_kind: 'wpqr_crop',
                wpqr_id: wpqrId,
                source_page: hit.page,
                crop_bbox_pt: formatBbox(bbox),
                file_url: file.file_url,
                width_px: cropped.width,
                height_px: cropped.height,
                sha256: sha256Of(cropped.png),
                ...meta,
                status: STATUS_DRAFT,
                created_by: userId,
            });
            if (id) stored.push({ id, slot: hit.slot, page: hit.page, file_url: file.file_url, status: STATUS_DRAFT });
        } catch (err) {
            logger.warn('[weldSketches] crop pagina fallito', {
                wpqrId, page: hit.page, error: err.message,
            });
        }
    }
    return stored;
}

async function extractAfterWpqrCommit({ organizationId, companyId, wpqrId, wpqr, filePath, userId }) {
    try {
        if (!(await sketchesTableAvailable())) return [];
        const abs = resolveSourcePdfPath(filePath);
        if (!abs) {
            logger.info('[weldSketches] PDF sorgente assente, skip estrazione', { wpqrId });
            return [];
        }
        const pdfBuffer = fs.readFileSync(abs);
        return await extractAndStoreFromPdf({
            pdfBuffer, organizationId, companyId, wpqrId, wpqr, userId,
        });
    } catch (err) {
        logger.warn('[weldSketches] estrazione post-commit non bloccante', {
            wpqrId, error: err.message,
        });
        return [];
    }
}

async function listSketches({ organizationId, companyId = null, wpqrId = null, status = null, slot = null }) {
    if (!(await sketchesTableAvailable())) return [];
    const cond = ['organization_id = @organizationId'];
    const params = { organizationId };
    if (companyId != null) {
        cond.push('(company_id = @companyId OR company_id IS NULL)');
        params.companyId = companyId;
    }
    if (wpqrId != null) {
        cond.push('wpqr_id = @wpqrId');
        params.wpqrId = wpqrId;
    }
    if (status) {
        cond.push('status = @status');
        params.status = status;
    }
    if (slot) {
        cond.push('slot = @slot');
        params.slot = slot;
    }
    const r = await getQuery()(`
        SELECT TOP 80 *
        FROM weld_sketches
        WHERE ${cond.join(' AND ')}
        ORDER BY created_at DESC, id DESC
    `, params);
    return (r.recordset || []).map(publicSketch);
}

async function getSketchById({ id, organizationId }) {
    if (!(await sketchesTableAvailable())) return null;
    const r = await getQuery()(`
        SELECT TOP 1 * FROM weld_sketches
        WHERE id = @id AND organization_id = @organizationId
    `, { id, organizationId });
    return r.recordset[0] ? publicSketch(r.recordset[0]) : null;
}

async function confirmSketch({ id, organizationId, user }) {
    if (!(await sketchesTableAvailable())) {
        const err = new Error('Libreria schizzi non disponibile');
        err.code = 'SKETCHES_UNAVAILABLE';
        err.status = 404;
        throw err;
    }
    const row = await getSketchById({ id, organizationId });
    if (!row) {
        const err = new Error('Schizzo non trovato');
        err.code = 'SKETCH_NOT_FOUND';
        err.status = 404;
        throw err;
    }
    await getQuery()(`
        UPDATE weld_sketches SET status = @status
        WHERE id = @id AND organization_id = @organizationId
    `, { id, organizationId, status: STATUS_CONFIRMED });
    return { ...row, status: STATUS_CONFIRMED, confirmed_by: user && user.user_id };
}

async function storeUploadedPng({
    pngBuffer, organizationId, companyId, userId,
    slot = 'combined', wpqrId = null, meta = {},
}) {
    if (!(await sketchesTableAvailable())) {
        const err = new Error('Libreria schizzi non disponibile');
        err.code = 'SKETCHES_UNAVAILABLE';
        err.status = 404;
        throw err;
    }
    const pngSize = require('../utils/ocrExtractor').pngSize;
    const size = pngSize(pngBuffer) || { width: null, height: null };
    const file = await writePngFile({
        organizationId, companyId, slot, png: pngBuffer,
    });
    const id = await insertSketch({
        organization_id: organizationId,
        company_id: companyId,
        slot: SLOTS.includes(slot) ? slot : 'combined',
        source_kind: 'upload',
        wpqr_id: wpqrId,
        file_url: file.file_url,
        width_px: size.width,
        height_px: size.height,
        sha256: sha256Of(pngBuffer),
        ...meta,
        status: STATUS_DRAFT,
        created_by: userId,
    });
    return getSketchById({ id, organizationId });
}

function suggestSketches({ own = [], library = [], request = {} }) {
    const ownFirst = own
        .filter((s) => s.slot !== 'hardness_map')
        .map((s) => ({ ...publicSketch(s), score: 100, source: 'wpqr' }));

    const scored = [];
    for (const s of library) {
        if (ownFirst.some((o) => o.id === s.id)) continue;
        if (s.status && s.status !== STATUS_CONFIRMED) continue;
        const score = scoreSketch(s, request);
        if (score == null) continue;
        scored.push({ ...publicSketch(s), score, source: 'library' });
    }
    scored.sort((a, b) => b.score - a.score);

    const bySlot = { joint_design: [], welding_sequence: [], combined: [] };
    const pushUnique = (slot, item) => {
        if (!bySlot[slot]) return;
        if (bySlot[slot].some((x) => x.id === item.id)) return;
        if (bySlot[slot].length >= 3 && item.source === 'library') return;
        bySlot[slot].push(item);
    };

    for (const item of ownFirst) {
        pushUnique(item.slot, item);
        if (item.slot === 'combined') {
            if (!bySlot.joint_design.length) pushUnique('joint_design', item);
            if (!bySlot.welding_sequence.length) pushUnique('welding_sequence', item);
        }
    }
    for (const item of scored) {
        pushUnique(item.slot, item);
        if (item.slot === 'combined') {
            if (bySlot.joint_design.length < 3) pushUnique('joint_design', item);
            if (bySlot.welding_sequence.length < 3) pushUnique('welding_sequence', item);
        }
    }
    for (const slot of Object.keys(bySlot)) {
        bySlot[slot] = bySlot[slot].slice(0, 3);
    }
    return bySlot;
}

async function suggestForWps({ organizationId, companyId, wpqr, request }) {
    if (!(await sketchesTableAvailable()) || !wpqr || !wpqr.id) {
        return { joint_design: [], welding_sequence: [], combined: [] };
    }
    const own = await listSketches({ organizationId, wpqrId: wpqr.id });
    const library = await listSketches({
        organizationId,
        companyId,
        status: STATUS_CONFIRMED,
    });
    const req = {
        joint_type: request.joint_type || wpqr.joint_type,
        preparation: wpqr.joint_preparation,
        product_form: wpqr.product_type,
        thickness_a_mm: request.thickness_a_mm,
        welding_process: request.welding_process || wpqr.welding_process,
        run_mode: wpqr.single_multi_run,
        position: wpqr.welding_positions,
    };
    return suggestSketches({ own, library, request: req });
}

async function resolveSketchFile(row) {
    if (!row || !row.file_url) return null;
    const parsed = parseUploadsUrl(row.file_url);
    if (!parsed) return null;
    return resolveUploadFile(parsed.rel);
}

module.exports = {
    SLOTS,
    SOURCE_KINDS,
    STATUS_DRAFT,
    STATUS_CONFIRMED,
    sketchesTableAvailable,
    resetTableCache,
    presentWpsSketchColumns,
    normalizeJointType,
    normalizePreparation,
    preparationEquivalent,
    normalizeProductForm,
    processFamily,
    scoreSketch,
    dimensionTextFromWpqr,
    metadataFromWpqr,
    classifyPageText,
    findSketchPages,
    bboxFromItems,
    suggestSketches,
    suggestForWps,
    extractAndStoreFromPdf,
    extractAfterWpqrCommit,
    listSketches,
    getSketchById,
    confirmSketch,
    storeUploadedPng,
    resolveSketchFile,
    publicSketch,
};
