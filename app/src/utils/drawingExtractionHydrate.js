/**
 * Helper per idratare il pannello "Requisiti da disegno" al mount (tab / remount).
 */

export function latestExtractionByAttachment(extractions) {
    const map = new Map();
    for (const ext of extractions || []) {
        const aid = ext.attachment_id;
        if (aid == null) continue;
        if (!map.has(aid)) map.set(aid, ext);
    }
    return map;
}

export function pickDrawingAttachmentId(drawings, selectedDocId) {
    if (selectedDocId != null && drawings.some((d) => d.attachment_id === selectedDocId)) {
        return selectedDocId;
    }
    return drawings[0]?.attachment_id ?? null;
}

/**
 * Carica l'ultima estrazione salvata per il disegno selezionato (o il primo).
 * @returns {Promise<{ targetDocId: number|null, extraction: object|null, reqs: object[], error: string|null }>}
 */
export async function hydrateDrawingRequirements({
    caseId,
    drawings,
    selectedDocId,
    listDrawingExtractions,
    getDrawingExtraction,
    onStartPolling,
}) {
    if (!caseId || !drawings?.length) {
        return { targetDocId: null, extraction: null, reqs: [], error: null };
    }

    const payload = await listDrawingExtractions(caseId);
    const extractions = payload?.extractions || payload || [];
    const latestByAttachment = latestExtractionByAttachment(extractions);
    const targetDocId = pickDrawingAttachmentId(drawings, selectedDocId);
    const latest = latestByAttachment.get(targetDocId);

    if (!latest) {
        return { targetDocId, extraction: null, reqs: [], error: null };
    }

    if (latest.status === 'processing') {
        onStartPolling?.(latest.id);
        return { targetDocId, extraction: latest, reqs: [], error: null };
    }

    if (latest.status === 'done' || latest.status === 'error') {
        const full = await getDrawingExtraction(caseId, latest.id);
        return {
            targetDocId,
            extraction: full,
            reqs: full.requirements || [],
            error: full.status === 'error'
                ? (full.error_message || 'Estrazione non riuscita.')
                : null,
        };
    }

    return { targetDocId, extraction: latest, reqs: [], error: null };
}
