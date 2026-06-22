/**
 * useNdtAutoSave — Auto-salvataggio bozze verbali CND in LocalStorage
 *
 * Pattern leggero (online-first): salva la bozza in localStorage come backup
 * temporaneo tra un salvataggio esplicito e l'altro. Se la connessione cade
 * prima del salvataggio, il dato non va perso.
 *
 * Note: i verbali CND sono online-first (come NC, Riesame Direzione), non
 * offline-first come gli audit ISO. Usano localStorage invece di IndexedDB
 * per semplicità. L'integrazione IndexedDB completa (Slice 6) aggiunge la
 * sync queue per operazioni offline più robuste.
 */

import { useEffect, useCallback, useRef } from 'react';

const DRAFT_KEY_PREFIX = 'sgq:ndt_draft:';
const DEBOUNCE_MS = 800;

/**
 * @param {string|null} reportId  - ID verbale esistente (null = nuovo)
 * @param {object}      formData  - dati form correnti
 * @param {Array}       items     - righe Elenco Marche
 * @returns {{ clearDraft: () => void, loadDraft: () => object|null }}
 */
export function useNdtAutoSave(reportId, formData, items) {
    const draftKey = DRAFT_KEY_PREFIX + (reportId || 'new');
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

    // Cancella la bozza (chiamare dopo salvataggio riuscito)
    const clearDraft = useCallback(() => {
        try { localStorage.removeItem(draftKey); } catch (e) {}
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

    return { clearDraft, loadDraft };
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
            if (key && key.startsWith(DRAFT_KEY_PREFIX)) {
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
 * Estende la sync queue esistente con i tipi per i verbali CND.
 * Aggiunge 'create_ndt_report' e 'update_ndt_report' alla coda di sync,
 * così i verbali creati offline vengono sincronizzati al reconnect.
 *
 * Uso: chiamare dopo aver fallito un apiService.createNdtReport/updateNdtReport
 * per la mancanza di connessione.
 */
export async function enqueueNdtReportSync(type, payload) {
    // type: 'create_ndt_report' | 'update_ndt_report' | 'delete_ndt_report'
    try {
        // Usa lo stesso DB di sync degli audit (SGQ_Sync / syncQueue store)
        const { getDatabase } = await import('../services/IndexedDBProvider.js');
        const db = await getDatabase();
        const uuid = payload.uuid || crypto.randomUUID();
        const item = {
            id:        uuid,
            type,
            payload:   { ...payload, uuid },
            timestamp: Date.now(),
            retryCount: 0,
            lastError: null,
        };
        const tx = db.transaction(['syncQueue'], 'readwrite');
        tx.objectStore('syncQueue').put(item);
        await new Promise((resolve, reject) => {
            tx.oncomplete = resolve;
            tx.onerror = () => reject(tx.error);
        });
        return uuid;
    } catch (e) {
        console.warn('[useNdtAutoSave] enqueueNdtReportSync error:', e);
        return null;
    }
}
