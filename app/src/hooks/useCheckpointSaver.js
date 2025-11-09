/**
 * useCheckpointSaver.js
 * 
 * Hook per auto-save checkpoint su File System tramite LocalFsProvider.
 * Complementare a useAutoSave (che gestisce localStorage).
 * 
 * Usage:
 * const { lastCheckpointTime, isSaving } = useCheckpointSaver(
 *   audit, 
 *   fsProvider, 
 *   { intervalMs: 30000 }
 * );
 */

import { useState, useEffect, useRef } from "react";

/**
 * Hook per salvataggio periodico checkpoint su File System
 * @param {Object} audit - Audit corrente da salvare
 * @param {LocalFsProvider} fsProvider - File System Provider
 * @param {Object} options - Opzioni configurazione
 * @returns {Object} Stato checkpoint saver
 */
export function useCheckpointSaver(audit, fsProvider, options = {}) {
    const {
        intervalMs = 30000, // Default: 30 secondi
        enabled = true,
        onSave = null, // Callback dopo save
        onError = null, // Callback errore
    } = options;

    const [lastCheckpointTime, setLastCheckpointTime] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [checkpointCount, setCheckpointCount] = useState(0);
    const intervalRef = useRef(null);

    useEffect(() => {
        // Non avviare se disabilitato o mancano parametri
        if (!enabled || !audit || !fsProvider) {
            return;
        }

        // Non avviare se workspace non collegato
        if (!fsProvider.ready()) {
            return;
        }

        // Funzione save checkpoint
        const doSave = async () => {
            try {
                setIsSaving(true);

                await fsProvider.saveCheckpoint(audit);

                const now = new Date();
                setLastCheckpointTime(now);
                setCheckpointCount((prev) => prev + 1);

                console.log(`[Checkpoint] Salvato: ${now.toLocaleTimeString()}`);

                if (onSave) {
                    onSave(now);
                }
            } catch (error) {
                console.error("[Checkpoint] Errore salvataggio:", error);

                if (onError) {
                    onError(error);
                }
            } finally {
                setIsSaving(false);
            }
        };

        // Salvataggio iniziale immediato
        doSave();

        // Intervallo periodico
        intervalRef.current = setInterval(doSave, intervalMs);

        // Cleanup
        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        };
    }, [audit, fsProvider, enabled, intervalMs, onSave, onError]);

    return {
        lastCheckpointTime,
        isSaving,
        checkpointCount,
    };
}

export default useCheckpointSaver;
