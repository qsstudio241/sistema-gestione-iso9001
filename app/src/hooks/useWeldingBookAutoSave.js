/**
 * useWeldingBookAutoSave — bozza locale Welding Book (pattern NdtReports / CND).
 *
 * Multi-tenant: ogni bozza porta organization_id; loadWeldingBookDraft filtra
 * lo studio corrente. Bozze legacy senza org_id non vengono ripristinate se
 * l'utente ha un org noto (evita leak cross-tenant sullo stesso browser).
 */

import { useEffect, useCallback, useRef } from 'react';
import apiService from '../services/apiService.js';

export const WB_DRAFT_KEY_PREFIX = 'sgq:wb_draft:';
const DEBOUNCE_MS = 800;

/**
 * @param {string|number|null|undefined} explicitOrgId
 * @returns {string|number|null}
 */
export function resolveWbDraftOrganizationId(explicitOrgId) {
    if (explicitOrgId != null && explicitOrgId !== '') return explicitOrgId;
    try {
        const u = apiService.getStoredUser?.();
        if (u?.organization_id != null && u.organization_id !== '') return u.organization_id;
    } catch (_) { /* ignore */ }
    return null;
}

/**
 * @param {object|null|undefined} draft
 * @param {string|number|null|undefined} currentOrgId
 */
export function wbDraftMatchesOrganization(draft, currentOrgId) {
    if (currentOrgId == null || currentOrgId === '') return false;
    if (draft == null || draft.organization_id == null || draft.organization_id === '') return false;
    return String(draft.organization_id) === String(currentOrgId);
}

/** Chiave bozza localStorage per un welding book (id o "new"). */
export function wbDraftKey(bookId) {
    return WB_DRAFT_KEY_PREFIX + (bookId || 'new');
}

/**
 * Carica bozza solo se appartiene allo studio corrente.
 * @param {string|number|null|undefined} bookId
 * @param {string|number|null|undefined} [organizationId]
 * @returns {object|null}
 */
export function loadWeldingBookDraft(bookId, organizationId) {
    const currentOrgId = resolveWbDraftOrganizationId(organizationId);
    const key = wbDraftKey(bookId);
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return null;
        const data = JSON.parse(raw);
        if (!data || typeof data !== 'object') return null;
        if (!wbDraftMatchesOrganization(data, currentOrgId)) return null;
        return data;
    } catch (_) {
        return null;
    }
}

/**
 * @param {string|number|null|undefined} bookId
 * @param {object} formData
 * @param {Array} equipment
 * @param {Array} welds
 * @param {string|number|null|undefined} [organizationId]
 */
export function useWeldingBookAutoSave(bookId, formData, equipment, welds, organizationId) {
    const draftKey = wbDraftKey(bookId);
    const timerRef = useRef(null);
    const orgId = resolveWbDraftOrganizationId(organizationId);

    useEffect(() => {
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
            try {
                localStorage.setItem(draftKey, JSON.stringify({
                    savedAt: new Date().toISOString(),
                    formData,
                    equipment,
                    welds,
                    ...(orgId != null ? { organization_id: orgId } : {}),
                }));
            } catch (_) { /* ignore */ }
        }, DEBOUNCE_MS);
        return () => { if (timerRef.current) clearTimeout(timerRef.current); };
    }, [draftKey, formData, equipment, welds, orgId]);

    const clearDraft = useCallback(() => {
        try { localStorage.removeItem(draftKey); } catch (_) { /* ignore */ }
    }, [draftKey]);

    const loadDraft = useCallback(
        () => loadWeldingBookDraft(bookId, orgId),
        [bookId, orgId],
    );

    return { clearDraft, loadDraft, draftKey };
}
