/**
 * useNdtAutoSave — Auto-salvataggio bozze verbali CND in LocalStorage
 *
 * Pattern: localStorage = backup locale mentre si compila; in caso di
 * create/update fallito per rete/offline → coda IndexedDB `syncQueue`
 * (tipi create_ndt_report / update_ndt_report già in syncService).
 * Non usa il motore audit_events.
 *
 * Multi-tenant: ogni bozza porta organization_id; listNdtDrafts filtra lo studio
 * corrente. Bozze legacy senza org_id non compaiono se l'utente ha un org noto
 * (evita leak cross-tenant sullo stesso browser). Orfane: cancellabili da
 * DevTools → Application → Local Storage (chiavi sgq:ndt_draft:*).
 */

import { useEffect, useCallback, useRef } from 'react';
import apiService from '../services/apiService.js';

export const NDT_DRAFT_KEY_PREFIX = 'sgq:ndt_draft:';
/** Indice chiavi bozza (jsdom/vitest: localStorage.length/key spesso assenti). */
export const NDT_DRAFT_INDEX_KEY = 'sgq:ndt_draft_index';
const DEBOUNCE_MS = 800;

/**
 * organization_id dello studio corrente (multi-tenant).
 * @param {string|number|null|undefined} explicitOrgId
 * @returns {string|number|null}
 */
export function resolveNdtDraftOrganizationId(explicitOrgId) {
    if (explicitOrgId != null && explicitOrgId !== '') return explicitOrgId;
    try {
        const u = apiService.getStoredUser?.();
        if (u?.organization_id != null && u.organization_id !== '') return u.organization_id;
    } catch (_) { /* ignore */ }
    return null;
}

/**
 * True se la bozza appartiene allo studio corrente.
 * Bozze legacy senza organization_id: escluse quando currentOrgId è noto.
 *
 * @param {object} draft
 * @param {string|number|null|undefined} currentOrgId
 */
export function ndtDraftMatchesOrganization(draft, currentOrgId) {
    if (currentOrgId == null || currentOrgId === '') return false;
    if (draft == null || draft.organization_id == null || draft.organization_id === '') return false;
    return String(draft.organization_id) === String(currentOrgId);
}

/** Chiave bozza localStorage per un verbale (id o "new"). */
export function ndtDraftKey(reportId) {
    return NDT_DRAFT_KEY_PREFIX + (reportId || 'new');
}

function readDraftIndex() {
    try {
        const raw = localStorage.getItem(NDT_DRAFT_INDEX_KEY);
        if (!raw) return [];
        const arr = JSON.parse(raw);
        return Array.isArray(arr) ? arr.filter((k) => typeof k === 'string') : [];
    } catch (_) {
        return [];
    }
}

function writeDraftIndex(keys) {
    try {
        const uniq = [...new Set(keys.filter(Boolean))];
        localStorage.setItem(NDT_DRAFT_INDEX_KEY, JSON.stringify(uniq));
    } catch (_) { /* ignore */ }
}

function registerDraftKey(draftKey) {
    if (!draftKey || draftKey.endsWith(':client_uuid')) return;
    const keys = readDraftIndex();
    if (!keys.includes(draftKey)) {
        keys.push(draftKey);
        writeDraftIndex(keys);
    }
}

function unregisterDraftKey(draftKey) {
    if (!draftKey) return;
    writeDraftIndex(readDraftIndex().filter((k) => k !== draftKey));
}

/** Elenco chiavi bozza: indice + scan length/key se disponibile. */
function collectDraftKeys() {
    const fromIndex = readDraftIndex();
    const fromScan = [];
    try {
        const len = localStorage.length;
        if (typeof len === 'number' && len > 0) {
            for (let i = 0; i < len; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith(NDT_DRAFT_KEY_PREFIX) && !key.endsWith(':client_uuid')) {
                    fromScan.push(key);
                }
            }
        }
    } catch (_) { /* ignore */ }
    return [...new Set([...fromIndex, ...fromScan])];
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
    unregisterDraftKey(draftKey);
}

/**
 * @param {string|null} reportId  - ID verbale esistente (null = nuovo)
 * @param {object}      formData  - dati form correnti
 * @param {Array}       items     - righe Elenco Marche
 * @param {{ organizationId?: string|number|null }} [options] — studio corrente (persist su save)
 * @returns {{ clearDraft: () => void, loadDraft: () => object|null, draftKey: string }}
 */
export function useNdtAutoSave(reportId, formData, items, options = {}) {
    const draftKey = ndtDraftKey(reportId);
    const timerRef = useRef(null);
    const organizationIdOpt = options?.organizationId;

    // Salva con debounce
    useEffect(() => {
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
            try {
                let prev = null;
                try {
                    prev = JSON.parse(localStorage.getItem(draftKey) || "null");
                } catch (_) { /* ignore */ }
                const clientUuid =
                    (prev && prev.client_uuid) ||
                    (reportId && !/^\d+$/.test(String(reportId)) ? String(reportId) : null);
                const organization_id =
                    resolveNdtDraftOrganizationId(organizationIdOpt)
                    ?? (prev && prev.organization_id != null ? prev.organization_id : null);
                localStorage.setItem(draftKey, JSON.stringify({
                    savedAt: new Date().toISOString(),
                    formData,
                    items,
                    ...(organization_id != null ? { organization_id } : {}),
                    ...(clientUuid ? { client_uuid: clientUuid } : {}),
                    ...(prev && prev.queued ? { queued: true, queuedAt: prev.queuedAt } : {}),
                }));
                registerDraftKey(draftKey);
            } catch (e) {
                // localStorage pieno o non disponibile — ignora silenziosamente
            }
        }, DEBOUNCE_MS);

        return () => { if (timerRef.current) clearTimeout(timerRef.current); };
    }, [draftKey, formData, items, organizationIdOpt]);

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

/** Riga Elenco Marche vuota (seed bozza CND-8). */
export const EMPTY_NDT_MARK_ITEM = {
    position_code: '',
    quantity: '1',
    description: '',
    examined_part: 'SALDATURA',
    surface_condition: 'M/S',
    inspection_percentage: 100,
    defects: 'NESSUNO',
    evaluation: 'A',
    notes: '',
};

/**
 * Form minimo di una bozza verbale (status draft) — schema mentale createAudit.
 */
export function buildEmptyNdtDraftForm({
    inspector = '',
    companyId = '',
    reportType = 'VT',
} = {}) {
    return {
        company_id: companyId != null && companyId !== '' ? String(companyId) : '',
        report_type: reportType || 'VT',
        client: '',
        supplier_name: '',
        job_order: '',
        project_id: '',
        wps_number: '',
        wps_id: '',
        base_material: '',
        material_standard: 'UNI EN ISO 10025-2',
        joint_type: 'SALDATURA AD ANGOLO MONO E MULTI PASSATA',
        quality_level: 'UNI EN ISO 5817 Lev.C',
        method_params: { lux_min: '' },
        notes: "NULLA DA SEGNALARE, L\u2019ESITO \u00C8 DA RITENERSI SODDISFACENTE.",
        inspection_date: '',
        certificate_date: '',
        responsible: '',
        inspector: inspector || '',
        client_representative: '',
        status: 'draft',
    };
}

/**
 * CND-8: crea subito una bozza locale con UUID (come createAudit), senza aspettare "Salva".
 * Chiave localStorage = sgq:ndt_draft:<uuid> (più bozze parallele ammesse).
 * Persiste organization_id per isolare le bozze per studio sullo stesso browser.
 *
 * @returns {{ uuid: string, draftKey: string, formData: object, items: Array, savedAt: string, organization_id: string|number|null }}
 */
export function seedNdtLocalDraft({
    inspector = '',
    companyId = '',
    reportType = 'VT',
    organizationId = null,
} = {}) {
    const uuid = (typeof crypto !== 'undefined' && crypto.randomUUID)
        ? crypto.randomUUID()
        : `ndt-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const draftKey = ndtDraftKey(uuid);
    const formData = buildEmptyNdtDraftForm({ inspector, companyId, reportType });
    const items = [{ ...EMPTY_NDT_MARK_ITEM }];
    const savedAt = new Date().toISOString();
    const organization_id = resolveNdtDraftOrganizationId(organizationId);
    const record = {
        savedAt,
        formData,
        items,
        client_uuid: uuid,
        queued: false,
        ...(organization_id != null ? { organization_id } : {}),
    };
    try {
        localStorage.setItem(draftKey, JSON.stringify(record));
        localStorage.setItem(offlineCreateUuidKey(draftKey), uuid);
        registerDraftKey(draftKey);
    } catch (_) { /* ignore */ }
    return { uuid, draftKey, formData, items, savedAt, organization_id };
}

/** Segna/toglie flag "in coda" su una bozza locale (lista onesta). */
export function markNdtDraftQueued(draftKey, queued = true) {
    if (!draftKey) return;
    try {
        const raw = localStorage.getItem(draftKey);
        if (!raw) return;
        const data = JSON.parse(raw);
        data.queued = !!queued;
        if (queued) data.queuedAt = new Date().toISOString();
        else delete data.queuedAt;
        localStorage.setItem(draftKey, JSON.stringify(data));
    } catch (_) { /* ignore */ }
}

/**
 * Recupera le bozze NdtReport in localStorage per lo studio corrente.
 * Salta le chiavi companion `:client_uuid` (stringa UUID grezza).
 * Usa indice dedicato (CND-8): in jsdom length/key spesso non funzionano.
 *
 * @param {string|number|null|undefined} [organizationId] — default da getStoredUser()
 * @returns {Array<object>}
 */
export function listNdtDrafts(organizationId) {
    const currentOrgId = resolveNdtDraftOrganizationId(organizationId);
    const drafts = [];
    try {
        for (const key of collectDraftKeys()) {
            if (!key || !key.startsWith(NDT_DRAFT_KEY_PREFIX)) continue;
            if (key.endsWith(':client_uuid')) continue;
            try {
                const data = JSON.parse(localStorage.getItem(key));
                if (!data || typeof data !== 'object' || !data.formData) continue;
                if (!ndtDraftMatchesOrganization(data, currentOrgId)) continue;
                let clientUuid = data.client_uuid || null;
                if (!clientUuid) {
                    try {
                        clientUuid = localStorage.getItem(offlineCreateUuidKey(key)) || null;
                    } catch (_) { /* ignore */ }
                }
                const suffix = key.slice(NDT_DRAFT_KEY_PREFIX.length);
                const looksLikeServerId = /^\d+$/.test(suffix);
                drafts.push({
                    key,
                    ...data,
                    client_uuid: clientUuid,
                    _serverIdHint: looksLikeServerId ? Number(suffix) : null,
                });
            } catch (e) { /* skip */ }
        }
    } catch (e) { /* ignore */ }
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
