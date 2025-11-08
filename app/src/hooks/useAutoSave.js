/**
 * Hook Auto-Save
 * Gestisce il salvataggio automatico su localStorage con debounce
 * Sistema Gestione ISO 9001 - QS Studio
 */

import { useState, useEffect, useRef } from 'react';

/**
 * Hook per auto-save con debounce
 * @param {Object} data - Dati da salvare
 * @param {string} storageKey - Chiave localStorage
 * @param {number} delay - Delay debounce in ms (default 2000)
 * @returns {string} saveStatus - 'idle' | 'saving' | 'saved' | 'error'
 */
export function useAutoSave(data, storageKey, delay = 2000) {
    const [saveStatus, setSaveStatus] = useState('idle');
    const timeoutRef = useRef(null);
    const previousDataRef = useRef(null);

    useEffect(() => {
        // Skip se dati non forniti
        if (!data || !storageKey) {
            return;
        }

        // Skip se dati identici a salvataggio precedente
        const currentDataString = JSON.stringify(data);
        if (currentDataString === previousDataRef.current) {
            return;
        }

        // Clear timeout precedente
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }

        // Imposta status saving
        setSaveStatus('saving');

        // Debounce save
        timeoutRef.current = setTimeout(() => {
            try {
                localStorage.setItem(storageKey, currentDataString);
                previousDataRef.current = currentDataString;
                setSaveStatus('saved');

                // Reset a idle dopo 1s
                setTimeout(() => {
                    setSaveStatus('idle');
                }, 1000);

            } catch (error) {
                console.error('Auto-save error:', error);
                setSaveStatus('error');

                // Reset a idle dopo 2s
                setTimeout(() => {
                    setSaveStatus('idle');
                }, 2000);
            }
        }, delay);

        // Cleanup
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, [data, storageKey, delay]);

    return saveStatus;
}

/**
 * Hook per auto-save multipli (audit + lista audits)
 * @param {Object} currentAudit - Audit corrente
 * @param {Array} audits - Lista tutti gli audit
 * @returns {Object} { auditSaveStatus, listSaveStatus }
 */
export function useAutoSaveMultiple(currentAudit, audits) {
    const auditSaveStatus = useAutoSave(
        currentAudit,
        currentAudit ? `audit_${currentAudit.metadata.id}` : null,
        2000
    );

    const listSaveStatus = useAutoSave(
        audits,
        'audits',
        2000
    );

    return {
        auditSaveStatus,
        listSaveStatus,
        isSaving: auditSaveStatus === 'saving' || listSaveStatus === 'saving',
        allSaved: auditSaveStatus === 'saved' && listSaveStatus === 'saved'
    };
}

export default useAutoSave;
