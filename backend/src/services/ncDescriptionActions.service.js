/**
 * Estrae righe OM/NC dalla descrizione NC (testo audit pushato) e le materializza in nc_actions.
 * Pattern tipici Camellini: "OM:", "OM1:", "NC:", anche a inizio riga dopo OSS/OSSERVAZIONE.
 */

const OM_LINE_RE = /(?:^|\n)\s*(OM\d*|NC\d*)\s*:\s*([^\n]+)/gi;

/**
 * @param {string|null|undefined} description
 * @returns {{ label: string, description: string }[]}
 */
function extractActionLinesFromDescription(description) {
    if (!description || !String(description).trim()) return [];

    const seen = new Set();
    const items = [];
    let match;

    while ((match = OM_LINE_RE.exec(String(description))) !== null) {
        const label = match[1].toUpperCase();
        const text = match[2].trim();
        if (!text) continue;
        const key = `${label}:${text.toLowerCase()}`;
        if (seen.has(key)) continue;
        seen.add(key);
        items.push({ label, description: text });
    }

    return items;
}

/**
 * Inserisce azioni correttive da descrizione se nc_actions � vuota (idempotente per NC).
 * @param {Function} queryFn - query DB del controller
 * @param {{ ncId: number, description: string, createdBy?: number|null }} params
 * @returns {Promise<number>} numero azioni create
 */
async function materializeNcActionsFromDescription(queryFn, { ncId, description, createdBy = null }) {
    const lines = extractActionLinesFromDescription(description);
    if (!lines.length) return 0;

    const existing = await queryFn(`
        SELECT COUNT(*) AS cnt FROM nc_actions WHERE nc_id = @nc_id
    `, { nc_id: ncId });

    if ((existing.recordset?.[0]?.cnt || 0) > 0) return 0;

    let created = 0;
    for (const line of lines) {
        await queryFn(`
            INSERT INTO nc_actions (nc_id, action_type, description, created_by)
            VALUES (@nc_id, 'corrective', @description, @created_by)
        `, {
            nc_id: ncId,
            description: line.description,
            created_by: createdBy ?? null,
        });
        created += 1;
    }

    return created;
}

module.exports = {
    extractActionLinesFromDescription,
    materializeNcActionsFromDescription,
    OM_LINE_RE,
};
