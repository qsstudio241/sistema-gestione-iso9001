/**
 * Hook Auto-Save
 * Gestisce il salvataggio automatico su IndexedDB (via storageProvider) con debounce
 * e flush immediato se c'è un salvataggio in attesa (pagehide / scheda hidden / unmount).
 * Sistema Gestione ISO 9001 - QS Studio
 */

import { useState, useEffect, useRef } from 'react';

/**
 * Scrive lo snapshot su IndexedDB. Non lancia: il chiamante gestisce l'errore.
 * @param {Object} storageProvider
 * @param {string} entityType
 * @param {Object|Array} snapshot
 */
async function persistAuditSnapshot(storageProvider, entityType, snapshot) {
    if (entityType === 'audit' && snapshot.metadata?.id) {
        await storageProvider.saveAudit(snapshot);
        console.log(`💾 [AUTO-SAVE] Audit ${snapshot.metadata.id} salvato in IndexedDB`);
    } else if (entityType === 'audits' && Array.isArray(snapshot)) {
        for (const audit of snapshot) {
            await storageProvider.saveAudit(audit);
        }
        console.log(`💾 [AUTO-SAVE] ${snapshot.length} audit salvati in IndexedDB`);
    }
}

/**
 * Hook per auto-save con debounce (IndexedDB)
 * @param {Object} data - Dati da salvare
 * @param {Object} storageProvider - Provider IndexedDB (fsProvider)
 * @param {string} entityType - Tipo entità: 'audit' | 'audits'
 * @param {number} delay - Delay debounce in ms (default 2000)
 * @returns {string} saveStatus - 'idle' | 'saving' | 'saved' | 'error'
 */
export function useAutoSave(data, storageProvider, entityType, delay = 2000) {
    const [saveStatus, setSaveStatus] = useState('idle');
    const timeoutRef = useRef(null);
    const previousDataRef = useRef(null);
    /** Snapshot in attesa di debounce: sopravvive al clearTimeout del cleanup effect. */
    const pendingRef = useRef(null);

    const runPersist = (pending) => {
        if (!pending) {
            return;
        }
        const { snapshot, dataString, provider, type } = pending;
        persistAuditSnapshot(provider, type, snapshot)
            .then(() => {
                previousDataRef.current = dataString;
                setSaveStatus('saved');
            })
            .catch((error) => {
                console.error('❌ Auto-save error (IndexedDB):', error);
                setSaveStatus('error');
            });
    };

    const flushPending = () => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
        const pending = pendingRef.current;
        if (!pending) {
            return;
        }
        pendingRef.current = null;
        runPersist(pending);
    };

    const flushPendingRef = useRef(flushPending);
    flushPendingRef.current = flushPending;

    useEffect(() => {
        // Skip se dati non forniti o provider non pronto
        if (!data || !storageProvider) {
            return;
        }

        // Skip se dati identici a salvataggio precedente
        const currentDataString = JSON.stringify(data);
        if (currentDataString === previousDataRef.current) {
            return;
        }

        // Clear timeout precedente (debounce: niente write a ogni tasto)
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }

        setSaveStatus('saving');
        pendingRef.current = {
            snapshot: data,
            dataString: currentDataString,
            provider: storageProvider,
            type: entityType,
        };

        timeoutRef.current = setTimeout(() => {
            timeoutRef.current = null;
            const pending = pendingRef.current;
            pendingRef.current = null;
            runPersist(pending);
        }, delay);

        // Cleanup su cambio dati: solo clearTimeout, non flush
        // (altrimenti ogni tasto scriverebbe IndexedDB).
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
                timeoutRef.current = null;
            }
        };
    }, [data, storageProvider, entityType, delay]);

    // Flush su chiusura pagina / cambio scheda (PWA)
    useEffect(() => {
        const onPageHide = () => {
            flushPendingRef.current();
        };
        const onVisibilityChange = () => {
            if (document.visibilityState === 'hidden') {
                flushPendingRef.current();
            }
        };
        window.addEventListener('pagehide', onPageHide);
        document.addEventListener('visibilitychange', onVisibilityChange);
        return () => {
            window.removeEventListener('pagehide', onPageHide);
            document.removeEventListener('visibilitychange', onVisibilityChange);
        };
    }, []);

    // Flush all'unmount: pendingRef resta valorizzato dopo il clearTimeout dell'effect debounce
    useEffect(() => {
        return () => {
            flushPendingRef.current();
        };
    }, []);

    return saveStatus;
}

/**
 * Hook per auto-save multipli (audit + lista audits) in IndexedDB
 * @param {Object} currentAudit - Audit corrente
 * @param {Array} audits - Lista tutti gli audit
 * @param {Object} storageProvider - Provider IndexedDB
 * @returns {Object} { auditSaveStatus, listSaveStatus, isSaving, allSaved }
 */
export function useAutoSaveMultiple(currentAudit, audits, storageProvider) {
    const auditSaveStatus = useAutoSave(
        currentAudit,
        storageProvider,
        'audit',
        2000
    );

    const listSaveStatus = useAutoSave(
        audits,
        storageProvider,
        'audits',
        3000 // Delay maggiore per batch save
    );

    return {
        auditSaveStatus,
        listSaveStatus,
        isSaving: auditSaveStatus === 'saving' || listSaveStatus === 'saving',
        allSaved: auditSaveStatus === 'saved' && listSaveStatus === 'saved'
    };
}

export default useAutoSave;
