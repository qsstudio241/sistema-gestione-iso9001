/**
 * useAttachmentManager.js
 * 
 * Hook per la gestione degli allegati audit ISO 9001.
 * Adattato da useEvidenceManager (ESG app) per struttura ISO 9001.
 * 
 * Categorie allegati:
 * - foto: Immagini da fotocamera/gallery
 * - documenti: PDF, Excel, Word, etc.
 * - verbali: Documenti testuali specifici
 * 
 * Differenze rispetto a ESG:
 * - NO compressione immagini (mantiene qualità originale)
 * - NO fallback base64 (richiede File System API)
 * - Struttura: Allegati/{Foto,Documenti,Verbali}/
 * - Metadata salvati in audit.attachments (non in IndexedDB)
 */

import { useState, useCallback } from "react";
import { useStorage } from "../contexts/StorageContext";

/**
 * Mappa categoria → subfolder
 */
const CATEGORY_FOLDERS = {
    foto: "Foto",
    documenti: "Documenti",
    verbali: "Verbali",
};

/**
 * Limiti upload (più generosi di ESG per documenti tecnici)
 */
const LIMITS = {
    maxFilesPerQuestion: 10, // Max 10 file per domanda
    maxFileSize: 10 * 1024 * 1024, // 10MB per file
    maxCumulativeSize: 50 * 1024 * 1024, // 50MB totali per domanda
};

/**
 * Accept types per categoria
 */
const ACCEPT_TYPES = {
    foto: "image/*",
    documenti: ".pdf,.doc,.docx,.xls,.xlsx,.txt",
    verbali: ".pdf,.doc,.docx,.txt",
};

/**
 * Hook per gestione allegati
 * 
 * @param {Object} audit - Audit corrente
 * @param {Function} onUpdate - Callback quando allegati cambiano
 * @returns {Object} API per gestione allegati
 */
export function useAttachmentManager(audit, onUpdate) {
    const storage = useStorage();
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(null);

    /**
     * Ottiene lista allegati per una domanda
     */
    const listAttachments = useCallback(
        (questionId) => {
            if (!audit?.attachments) return [];
            return audit.attachments.filter((att) => att.questionId === questionId);
        },
        [audit]
    );

    /**
     * Valida limiti upload
     */
    const validateLimits = useCallback(
        (questionId, newFiles) => {
            const existing = listAttachments(questionId);

            // Check numero file
            if (existing.length + newFiles.length > LIMITS.maxFilesPerQuestion) {
                return {
                    valid: false,
                    error: `Massimo ${LIMITS.maxFilesPerQuestion} file per domanda (attualmente: ${existing.length})`,
                };
            }

            // Check dimensione singoli file
            for (const file of newFiles) {
                if (file.size > LIMITS.maxFileSize) {
                    const mb = (LIMITS.maxFileSize / (1024 * 1024)).toFixed(1);
                    return {
                        valid: false,
                        error: `File "${file.name}" troppo grande. Max ${mb}MB per file`,
                    };
                }
            }

            // Check dimensione cumulativa
            const existingSize = existing.reduce((sum, att) => sum + (att.size || 0), 0);
            const newSize = newFiles.reduce((sum, file) => sum + file.size, 0);
            const totalSize = existingSize + newSize;

            if (totalSize > LIMITS.maxCumulativeSize) {
                const mb = (LIMITS.maxCumulativeSize / (1024 * 1024)).toFixed(1);
                return {
                    valid: false,
                    error: `Limite cumulativo ${mb}MB superato per questa domanda`,
                };
            }

            return { valid: true };
        },
        [listAttachments]
    );

    /**
     * Aggiunge allegati per una domanda
     * 
     * @param {String} questionId - ID domanda (es. "4.1", "7.5.3")
     * @param {String} category - Categoria ("foto", "documenti", "verbali")
     * @param {FileList|Array} fileList - File da caricare
     * @returns {Promise<Object>} Risultato con success/error
     */
    const addAttachments = useCallback(
        async (questionId, category, fileList) => {
            if (!storage.fsProvider?.ready()) {
                return {
                    success: false,
                    error: "Nessuna cartella collegata. Seleziona una cartella prima di caricare allegati.",
                };
            }

            const files = Array.from(fileList || []);
            if (files.length === 0) {
                return { success: false, error: "Nessun file selezionato" };
            }

            // Valida limiti
            const validation = validateLimits(questionId, files);
            if (!validation.valid) {
                return { success: false, error: validation.error };
            }

            setIsUploading(true);
            setUploadProgress({ current: 0, total: files.length });

            const results = [];
            const errors = [];

            try {
                for (let i = 0; i < files.length; i++) {
                    const file = files[i];
                    setUploadProgress({ current: i + 1, total: files.length, fileName: file.name });

                    try {
                        // Salva file tramite LocalFsProvider
                        const metadata = await storage.fsProvider.saveAttachment(
                            file,
                            category,
                            questionId
                        );

                        // Aggiungi metadata completo
                        const attachment = {
                            questionId,
                            category,
                            name: file.name,
                            storedName: metadata.storedName,
                            type: file.type,
                            size: file.size,
                            path: metadata.relativePath,
                            uploadDate: new Date().toISOString(),
                        };

                        results.push(attachment);
                    } catch (err) {
                        console.error(`Errore salvataggio ${file.name}:`, err);
                        errors.push({ fileName: file.name, error: err.message });
                    }
                }

                // Aggiorna audit con nuovi allegati
                if (results.length > 0) {
                    const updatedAttachments = [...(audit.attachments || []), ...results];
                    const updatedAudit = {
                        ...audit,
                        attachments: updatedAttachments,
                    };

                    // Callback per aggiornare stato globale
                    if (onUpdate) {
                        await onUpdate(updatedAudit);
                    }
                }

                setIsUploading(false);
                setUploadProgress(null);

                if (errors.length > 0) {
                    return {
                        success: true,
                        partial: true,
                        uploaded: results.length,
                        failed: errors.length,
                        errors,
                    };
                }

                return {
                    success: true,
                    uploaded: results.length,
                    attachments: results,
                };
            } catch (err) {
                console.error("Errore durante upload allegati:", err);
                setIsUploading(false);
                setUploadProgress(null);

                return {
                    success: false,
                    error: err.message || "Errore sconosciuto durante upload",
                };
            }
        },
        [audit, storage.fsProvider, validateLimits, onUpdate]
    );

    /**
     * Rimuove allegato
     * 
     * @param {String} questionId - ID domanda
     * @param {Number} attachmentIndex - Indice allegato in lista
     * @returns {Promise<Object>} Risultato con success/error
     */
    const removeAttachment = useCallback(
        async (questionId, attachmentIndex) => {
            const attachments = listAttachments(questionId);
            if (attachmentIndex < 0 || attachmentIndex >= attachments.length) {
                return { success: false, error: "Indice allegato non valido" };
            }

            const attachment = attachments[attachmentIndex];

            try {
                // Rimuovi da metadata audit (file fisico rimane su disco per tracciabilità)
                const updatedAttachments = audit.attachments.filter(
                    (att) =>
                        !(att.questionId === questionId && att.storedName === attachment.storedName)
                );

                const updatedAudit = {
                    ...audit,
                    attachments: updatedAttachments,
                };

                // Callback aggiornamento
                if (onUpdate) {
                    await onUpdate(updatedAudit);
                }

                // Copia percorso in clipboard per riferimento (pattern ESG)
                if (navigator.clipboard) {
                    await navigator.clipboard.writeText(attachment.path);
                }

                return {
                    success: true,
                    message: `Allegato rimosso (file preservato in: ${attachment.path})`,
                };
            } catch (err) {
                console.error("Errore rimozione allegato:", err);
                return {
                    success: false,
                    error: err.message || "Errore durante rimozione",
                };
            }
        },
        [audit, listAttachments, onUpdate]
    );

    /**
     * Crea input dinamico per selezione file (pattern ESG)
     * 
     * @param {String} questionId - ID domanda
     * @param {String} category - Categoria allegato
     * @param {String} source - "gallery" (default) o "camera" (mobile)
     * @returns {Promise<Object>} Risultato upload
     */
    const openFilePicker = useCallback(
        (questionId, category = "documenti", source = "gallery") => {
            return new Promise((resolve) => {
                const input = document.createElement("input");
                input.type = "file";
                input.multiple = true;
                input.accept = source === "camera" ? "image/*" : ACCEPT_TYPES[category] || "*/*";

                // Capture camera su mobile
                if (source === "camera") {
                    input.capture = "environment";
                }

                input.onchange = async (e) => {
                    const fileList = e.target.files;
                    const result = await addAttachments(questionId, category, fileList);

                    // Cleanup input element (non lasciare in DOM)
                    document.body.removeChild(input);

                    resolve(result);
                };

                input.oncancel = () => {
                    document.body.removeChild(input);
                    resolve({ success: false, error: "Selezione annullata" });
                };

                // Aggiungi al DOM e trigger click
                document.body.appendChild(input);
                input.style.display = "none";
                input.click();
            });
        },
        [addAttachments]
    );

    /**
     * Ottiene statistiche allegati per domanda
     */
    const getStats = useCallback(
        (questionId) => {
            const attachments = listAttachments(questionId);
            const totalSize = attachments.reduce((sum, att) => sum + (att.size || 0), 0);
            const byCategory = {
                foto: attachments.filter((att) => att.category === "foto").length,
                documenti: attachments.filter((att) => att.category === "documenti").length,
                verbali: attachments.filter((att) => att.category === "verbali").length,
            };

            return {
                count: attachments.length,
                totalSize,
                totalSizeMB: (totalSize / (1024 * 1024)).toFixed(2),
                byCategory,
                remaining: LIMITS.maxFilesPerQuestion - attachments.length,
                remainingSize: LIMITS.maxCumulativeSize - totalSize,
            };
        },
        [listAttachments]
    );

    return {
        // Operazioni
        addAttachments,
        removeAttachment,
        openFilePicker,

        // Query
        listAttachments,
        getStats,

        // Stato
        isUploading,
        uploadProgress,

        // Costanti
        limits: LIMITS,
        acceptTypes: ACCEPT_TYPES,
    };
}

export default useAttachmentManager;
