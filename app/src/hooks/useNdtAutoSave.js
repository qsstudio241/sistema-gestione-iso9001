/**
 * useNdtAutoSave — Auto-salvataggio bozze verbali CND in LocalStorage
 *
 * Pattern: localStorage = backup locale mentre si compila; in caso di
 * create/update fallito per rete/offline → coda IndexedDB `syncQueue`
 * (tipi create_ndt_report / update_ndt_report già in syncService).
 * Non usa il motore audit_events.
 */

import { useEffect, useCallback, useRef } from 'react';

export const NDT_DRAFT_KEY_PREFIX = 'sgq:ndt_draft:';
const DEBOUNCE_MS = 800;

/** Chiave bozza localStorage per un verbale (id o "new"). */
export function ndtDraftKey(reportId) {
    return NDT_DRAFT_KEY_PREFIX + (reportId || 'new');
}

/** UUID client stabile per create offline (sopravvive al refresh). */
export function offlineCreateUuidKey(draftKey) {
    return (draftKey || ndtDraftKey(null)) + ':client_uuid';
}

export function getOrCreateOfflineCreateUuid(draftKey) {
    const key = offlineCreateUuidKey(draftKey);
    try {
        const existing = localStorage.getItem(key);
        if (existing) return existing;
    } catch (_) { /* ignore */ }
    const uuid = (typeof crypto !== 'undefined' && crypto.randomUUID)
        ? crypto.randomUUID()
        : `ndt-${Date.now()}`;
    try {
        localStorage.setItem(key, uuid);
    } catch (_) { /* ignore */ }
    return uuid;
}

export function clearOfflineCreateUuid(draftKey) {
    if (!draftKey) return;
    try {
        localStorage.removeItem(offlineCreateUuidKey(draftKey));
    } catch (_) { /* ignore */ }
}

/**
 * True se l'errore di salvataggio è dovuto a rete assente / instabile
 * (non a validazione o gate 9712).
 */
export function isNdtNetworkSaveError(err) {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
    const code = err?.code;
    const status = err?.status;
    return (
        code === 'OFFLINE' ||
        code === 'NETWORK_ERROR' ||
        code === 'TIMEOUT' ||
        status === 0
    );
}

/** Rimuove una bozza localStorage per chiave completa (+ uuid create offline). */
export function clearNdtDraftByKey(draftKey) {
    if (!draftKey) return;
    try {
        localStorage.removeItem(draftKey);
    } catch (e) {
        /* ignore */
    }
    clearOfflineCreateUuid(draftKey);
}

/**
 * @param {string|null} reportId  - ID verbale esistente (null = nuovo)
 * @param {object}      formData  - dati form correnti
 * @param {Array}       items     - righe Elenco Marche
 * @returns {{ clearDraft: () => void, loadDraft: () => object|null, draftKey: string }}
 */
export function useNdtAutoSave(reportId, formData, items) {
    const draftKey = ndtDraftKey(reportId);
    const timerRef = useRef(null);

    // Salva con debounce
    useEffect(() => {
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
            try {
                localStorage.setItem(draftKey, JSON.stringify({
                    savedAt: new Date().toISOString(),
                    formData,
                    items,
                }));
            } catch (e) {
                // localStorage pieno o non disponibile — ignora silenziosamente
            }
        }, DEBOUNCE_MS);

        return () => { if (timerRef.current) clearTimeout(timerRef.current); };
    }, [draftKey, formData, items]);

    // Cancella la bozza (chiamare dopo salvataggio riuscito online o dopo sync coda)
    const clearDraft = useCallback(() => {
        clearNdtDraftByKey(draftKey);
    }, [draftKey]);

    // Recupera la bozza salvata
    const loadDraft = useCallback(() => {
        try {
            const raw = localStorage.getItem(draftKey);
            if (!raw) return null;
            return JSON.parse(raw);
        } catch (e) {
            return null;
        }
    }, [draftKey]);

    return { clearDraft, loadDraft, draftKey };
}

/**
 * Recupera tutte le bozze NdtReport salvate in localStorage.
 * Utile per mostrare un banner "Hai una bozza non salvata" all'apertura.
 */
export function listNdtDrafts() {
    const drafts = [];
    try {
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith(NDT_DRAFT_KEY_PREFIX)) {
                try {
                    const data = JSON.parse(localStorage.getItem(key));
                    if (data) drafts.push({ key, ...data });
                } catch (e) {}
            }
        }
    } catch (e) {}
    return drafts;
}

/**
 * Accoda create/update verbale CND nella syncQueue esistente (IndexedDB SGQ_Sync).
 * Usa syncService.enqueue così al reconnect processQueue gestisce i tipi NDT.
 *
 * Uso: dopo fallimento rete di createNdtReport / updateNdtReport.
 *
 * @param {'create_ndt_report'|'update_ndt_report'|'delete_ndt_report'} type
 * @param {object} payload — body API; opzionale draftKey per clear post-sync
 * @returns {Promise<string|null>} id item in coda
 */
export async function enqueueNdtReportSync(type, payload) {
    try {
        const { syncService } = await import('../services/syncService.js');
        const uuid = payload.uuid || (typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID()
            : `ndt-${Date.now()}`);
        const enriched = { ...payload, uuid };
        const queueId = await syncService.enqueue(type, enriched);
        // syncService.enqueue risolve null su quota IDB: non fingere successo
        if (!queueId) return null;
        try {
            window.dispatchEvent(new CustomEvent('sgq:ndtReportEnqueued', {
                detail: {
                    type,
                    uuid,
                    draftKey: payload.draftKey || null,
                    queueId,
                },
            }));
        } catch (_) { /* ambiente senza window */ }
        return queueId;
    } catch (e) {
        console.warn('[useNdtAutoSave] enqueueNdtReportSync error:', e);
        return null;
    }
}
