/**
 * Import strutturato delle norme ISO da markdown (docs/Normative) → JSON seed.
 *
 * Uso: node backend/scripts/import-norms-from-markdown.js
 */
'use strict';

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const NORMATIVE_DIR = path.join(REPO_ROOT, 'docs', 'Normative');
const OUT_DIR = path.join(__dirname, '..', 'data');
const OUT_JSON = path.join(OUT_DIR, 'norm_requirements_seed.json');

/** Righe che iniziano con numero di clausola + titolo */
const CLAUSE_HEADER_RE = /^(\d+(?:\.\d+)*)\s+(.+)$/;

/** Voci indice: titolo terminato da numero di pagina */
const TOC_PAGE_RE = /\s+\d{1,4}\s*$/;

/** Righe riempitive dell'indice */
const DOT_FILLER_RE = /^[.\s\u2026·]+$/;

const NORM_FILES = [
    {
        file: 'UNI EN ISO 9001_2015 Rev. 0.md',
        standard_code: 'ISO_9001_2015',
        norm_version: '2015',
        minMajor: 4,
    },
    {
        file: 'Normative NORMA_00003_ UNI EN ISO 14001_2015 Rev. 0.md',
        standard_code: 'ISO_14001_2015',
        norm_version: '2015',
        minMajor: 4,
    },
    {
        file: 'Normative NORMA_00002_ UNI ISO 45001_2018 Rev. 0.md',
        standard_code: 'ISO_45001_2018',
        norm_version: '2018',
        minMajor: 4,
    },
    {
        file: 'Normative NORMA_00005_ UNI EN ISO 3834-1_2021 Rev. 0.md',
        standard_code: 'ISO_3834_1_2021',
        norm_version: '2021',
        minMajor: 4,
    },
    {
        file: 'Normative NORMA_00009_ UNI EN ISO 3834-3_2021 Rev. 0.md',
        standard_code: 'ISO_3834_3_2021',
        norm_version: '2021',
        minMajor: 4,
    },
    {
        file: 'Normative NORMA_00008_ UNI EN ISO 3834-5_2021 Rev. 0.md',
        standard_code: 'ISO_3834_5_2021',
        norm_version: '2021',
        minMajor: 4,
    },
];

function stripTrailingPageNumber(title) {
    return title.replace(/\s+\d{1,4}\s*$/, '').trim();
}

function isLikelyTocEntry(titlePart) {
    return TOC_PAGE_RE.test(titlePart.trim());
}

function majorSegment(ref) {
    return parseInt(String(ref).split('.')[0], 10);
}

function shouldDropLine(raw) {
    const line = raw.trim();
    if (!line) return false;
    if (/^\|/.test(line)) return true;
    if (/^#{1,6}\s/.test(line)) return true;
    if (/^>\s/.test(line)) return true;
    if (/^---+$/.test(line)) return true;
    if (/^Tecnove\s+Spa$/i.test(line)) return true;
    if (/^TECNOVE\s+SPA$/i.test(line)) return true;
    if (/^UNIstore\s*-/i.test(line)) return true;
    if (/^Via\s+Sannio/i.test(line)) return true;
    if (/^Via\s+delle\s+Colonnelle/i.test(line)) return true;
    if (/^www\.uni\.com/i.test(line)) return true;
    if (DOT_FILLER_RE.test(line)) return true;
    if (/^UNI\s+EN\s+ISO[\s\S]*Pagina\s+[IVXLCDM\d]+\s*$/i.test(line)) return true;
    return false;
}

/** Fine parte normativa: esclude righe indice con numero pagina in coda */
function isEndOfNormativeSection(trimmed) {
    if (/^APPENDICE\b/i.test(trimmed) || /^Annex\s+[A-Z0-9]/i.test(trimmed)) {
        return !TOC_PAGE_RE.test(trimmed);
    }
    if (/^BIBLIOGRAFIA\b/i.test(trimmed)) {
        return !TOC_PAGE_RE.test(trimmed);
    }
    return false;
}

/** Righe indice/prospetti incollati (es. titolo che ripete un numero di clausola ISO 14001:2004) */
function isJunkClauseTitle(titleRaw) {
    const t = stripTrailingPageNumber(titleRaw);
    if (/^\d+(?:\.\d+)+\s+/u.test(t)) return true;
    const refs = t.match(/\d+\.\d+/g);
    return refs !== null && refs.length >= 2;
}

/** Inizio probabile del corpo (frase/nota/elenco) dopo il titolo */
function isBodyStart(line) {
    const t = line.trim();
    if (/^[a-zàèéìòù]/u.test(t)) return true;
    if (
        /^(La |L'|L’|Il |I |Le |Lo |Gli |Un |Una |Un'|Un’|Nel |Nella |Nei |Negli |Alle |Alla |Per |Più |Più |Si |Questo|Questa|Questi|Queste|Tutti|Tutte|Tutto|Tutta|Non |Né |In |A |Al |All|Con |Come |Da |Dal |Viene |Vengono |Mediante |Riguardo |Qualora |Quando |Se |Tra |Fra |Ogni |Chi |Che |È |E'|É |Sono |E |O |Ma |Ho |Ha |Hanno |Quest'|Lasciando |Affinché |Coloro |Dette |Nonostante |Benché|Chiunque|Durante|Un\s+elenco|Possono\s+)/iu.test(
            t,
        )
    ) {
        return true;
    }
    if (/^(NOTA|Nota)(\s+\d+|\s*:|\s)/iu.test(t)) return true;
    if (/^\*[)\s]/.test(t)) return true;
    if (/^[a-z]\)\s/i.test(t)) return true;
    if (/^\d+\)\s/.test(t)) return true;
    if (/^-\s/.test(t)) return true;
    return false;
}

function parseMarkdown(content, meta) {
    const lines = content.split(/\r?\n/);
    /** @type {{ ref: string, titleParts: string[], bodyLines: string[] } | null} */
    let current = null;
    let sawBodyForCurrent = false;
    /** True dopo la prima clausola estratta (maj >= minMajor): evita stop su righe indice/appendice prima del corpo */
    let sawEligibleClause = false;
    /** L'indice (Pagina 3) contiene righe tipo "5 CRITERI ..." senza numero pagina: ignora fino a ## Pagina >= 4 */
    let allowClauseHeaders = false;
    const clauses = [];

    function flush() {
        if (!current) return;
        let clause_title = current.titleParts.join(' ').replace(/\s+/g, ' ').trim();
        clause_title = stripTrailingPageNumber(clause_title);
        const requirement_text = current.bodyLines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
        const maj = majorSegment(current.ref);
        if (maj >= meta.minMajor && clause_title.length > 0 && !isJunkClauseTitle(clause_title)) {
            sawEligibleClause = true;
            clauses.push({
                standard_code: meta.standard_code,
                clause_ref: current.ref,
                clause_title,
                requirement_text,
                norm_version: meta.norm_version,
                source: 'local_file',
            });
        }
        current = null;
        sawBodyForCurrent = false;
    }

    for (const raw of lines) {
        const trimmedLine = raw.trim();
        const paginaM = trimmedLine.match(/^##\s+Pagina\s+(\d+)/i);
        if (paginaM) {
            const pn = parseInt(paginaM[1], 10);
            if (pn >= 4) allowClauseHeaders = true;
            continue;
        }

        if (shouldDropLine(raw)) continue;

        const line = raw.trimEnd();
        const trimmed = line.trim();

        if (isEndOfNormativeSection(trimmed) && sawEligibleClause) {
            flush();
            break;
        }

        const m = trimmed.match(CLAUSE_HEADER_RE);
        if (m) {
            if (!allowClauseHeaders) continue;

            const titleRaw = m[2];
            if (isLikelyTocEntry(titleRaw)) continue;
            if (isJunkClauseTitle(titleRaw)) continue;

            flush();
            current = {
                ref: m[1],
                titleParts: [stripTrailingPageNumber(titleRaw)],
                bodyLines: [],
            };
            sawBodyForCurrent = false;
            continue;
        }

        if (!current) continue;

        if (!trimmed) {
            if (sawBodyForCurrent) current.bodyLines.push('');
            continue;
        }

        if (!sawBodyForCurrent && !isBodyStart(trimmed)) {
            current.titleParts.push(trimmed);
        } else {
            sawBodyForCurrent = true;
            current.bodyLines.push(trimmed);
        }
    }
    flush();
    const merged = dedupePreferRicherBody(clauses);
    return merged;
}

/** Stesso clause_ref può comparire nell'indice / appendice: sceglie la voce più plausibilmente normativa */
function dedupePreferRicherBody(rows) {
    const m = new Map();
    for (const row of rows) {
        const k = row.clause_ref;
        const prev = m.get(k);
        const score = normativityScore(row);
        const prevScore = prev ? normativityScore(prev) : -1;
        if (!prev || score > prevScore || (score === prevScore && row.requirement_text.length > prev.requirement_text.length)) {
            m.set(k, row);
        }
    }
    return [...m.values()];
}

function normativityScore(row) {
    const b = String(row.requirement_text || '');
    const t = String(row.clause_title || '');
    const deveHits = (b.match(/\bdeve\b/gi) || []).length;
    const deveScore = deveHits * 4000;
    const lenScore = b.length;
    const capsTitle =
        /^[A-ZÀÈÉÌÒÙÁÍÓÚÇ\s\d,'\-]+$/.test(t.replace(/\s+/g, ' ').trim()) ? 25000 : 0;
    return lenScore + deveScore + capsTitle;
}

function clauseSortKey(ref) {
    return String(ref)
        .split('.')
        .map((p) => parseInt(p, 10) || 0);
}

function compareClauseRefs(a, b) {
    const pa = clauseSortKey(a);
    const pb = clauseSortKey(b);
    const n = Math.max(pa.length, pb.length);
    for (let i = 0; i < n; i++) {
        const da = pa[i] || 0;
        const db = pb[i] || 0;
        if (da !== db) return da - db;
    }
    return 0;
}

function main() {
    const issues = [];

    if (!fs.existsSync(NORMATIVE_DIR)) {
        console.error('Cartella norme non trovata:', NORMATIVE_DIR);
        process.exit(1);
    }

    const all = [];

    for (const meta of NORM_FILES) {
        const fp = path.join(NORMATIVE_DIR, meta.file);
        if (!fs.existsSync(fp)) {
            issues.push(`File mancante: ${meta.file}`);
            continue;
        }
        const content = fs.readFileSync(fp, 'utf8');
        const parsed = parseMarkdown(content, meta);
        all.push(...parsed);
        console.log(`${meta.standard_code}: ${parsed.length} clausole estratte`);
    }

    all.sort((x, y) => {
        const c = String(x.standard_code).localeCompare(String(y.standard_code));
        if (c !== 0) return c;
        return compareClauseRefs(x.clause_ref, y.clause_ref);
    });

    fs.mkdirSync(OUT_DIR, { recursive: true });
    fs.writeFileSync(OUT_JSON, `${JSON.stringify(all, null, 2)}\n`, 'utf8');

    console.log('');
    console.log('Totale record (unici per standard_code + clause_ref):', all.length);
    console.log('Scritto:', OUT_JSON);
    if (issues.length) {
        console.warn('Avvisi:', issues.join('; '));
    }
}

main();
