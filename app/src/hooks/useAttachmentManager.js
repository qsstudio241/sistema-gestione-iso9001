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
import apiService from "../services/apiService";
import { syncService } from "../services/syncService";
import { toNumericChecklistQuestionId } from "../utils/attachmentQuestionId";

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
     * Ottiene lista allegati per una domanda.
     * Usa loose equality per gestire questionId numerico vs stringa (es. post-hydration).
     */
    const listAttachments = useCallback(
        (questionId) => {
            if (!audit?.attachments) return [];
            return audit.attachments.filter(
                (att) => att.questionId == questionId || att.questionRef === questionId
            );
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
     * @param {String} questionId - ID domanda ISO (es. "4.1") oppure custom_item_id come stringa
     * @param {String} category - Categoria ("foto", "documenti", "verbali")
     * @param {FileList|Array} fileList - File da caricare
     * @param {{ customItemId?: number }} opts - Opzioni extra (per item checklist custom)
     * @returns {Promise<Object>} Risultato con success/error
     */
    const addAttachments = useCallback(
        async (questionId, category, fileList, opts = {}) => {
            if (questionId == null || questionId === '') {
                return {
                    success: false,
                    error: "ID domanda non disponibile. Attendi il caricamento della checklist o ricarica la pagina.",
                };
            }

            if (!storage.fsProvider) {
                return {
                    success: false,
                    error: "Storage non inizializzato. Ricarica la pagina e riprova.",
                };
            }
            if (!storage.fsProvider.ready()) {
                const isIndexedDB = storage.fsProvider?.constructor?.name === 'IndexedDBProvider';
                return {
                    success: false,
                    error: isIndexedDB
                        ? "Storage non pronto. Attendi qualche secondo e riprova."
                        : "Nessuna cartella collegata. Seleziona una cartella prima di caricare allegati.",
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
                        const auditId = audit?.metadata?.auditId || audit?.metadata?.id || audit?.id;
                        const serverQuestionId = toNumericChecklistQuestionId(questionId);
                        const metadata = await storage.fsProvider.saveAttachment(
                            file,
                            category,
                            questionId,
                            { auditId }
                        );

                        // Aggiungi metadata completo (questionRef per match post-hydration)
                        const attachment = {
                            questionId,
                            questionRef: questionId,
                            category,
                            name: file.name,
                            storedName: metadata.storedName,
                            type: file.type,
                            size: file.size,
                            path: metadata.relativePath,
                            uploadDate: new Date().toISOString(),
                        };

                        // Tenta upload server (best-effort, non bloccante)

                        // Mapping categorie IT→EN per compatibilità backend
                        const CATEGORY_MAP = {
                            foto: 'photo',
                            documenti: 'document',
                            verbali: 'document',
                            evidence: 'evidence',
                            audio: 'audio',
                            video: 'video',
                        };
                        const serverCategory = CATEGORY_MAP[category] || 'evidence';

                        if (auditId) {
                            // Per item checklist custom: usa customItemId invece di questionId
                            const uploadParams = opts.customItemId
                                ? { auditId, customItemId: opts.customItemId, category: serverCategory, description: `${category} - ${questionId}` }
                                : { auditId, questionId: serverQuestionId, category: serverCategory, description: `${category} - ${questionId}` };
                            try {
                                const serverResult = await apiService.uploadAttachment(file, uploadParams);
                                attachment.serverAttachmentId = serverResult?.data?.attachment_id || null;
                                console.log(`☁️ [UPLOAD] File ${file.name} caricato su server`);
                            } catch (uploadErr) {
                                // Offline o errore server: salva blob in IDB per sync futuro
                                console.warn(`📦 [OFFLINE] Upload fallito per ${file.name}, enqueue per sync:`, uploadErr.message);
                                try {
                                    const buffer = await file.arrayBuffer();
                                    const blobKey = `att_${Date.now()}_${file.name}`;
                                    await syncService.storeFileBlob(blobKey, buffer, {
                                        mimeType: file.type,
                                        fileName: file.name,
                                    });
                                    await syncService.enqueue('upload_attachment', {
                                        blobKey,
                                        auditId,
                                        auditUuid: audit?.id || audit?.metadata?.id || null,
                                        ...(opts.customItemId
                                            ? { customItemId: opts.customItemId }
                                            : { questionId: serverQuestionId }),
                                        category: serverCategory,
                                        description: `${category} - ${questionId}`,
                                        fileName: file.name,
                                    });
                                    attachment.pendingSync = true;
                                    attachment.blobKey = blobKey;
                                } catch (syncErr) {
                                    console.error(`❌ [OFFLINE] Errore enqueue sync per ${file.name}:`, syncErr);
                                }
                            }
                        }

                        results.push(attachment);
                    } catch (err) {
                        console.error(`Errore salvataggio ${file.name}:`, err);
                        errors.push({ fileName: file.name, error: err.message });
                    }
                }

                // Aggiorna audit con nuovi allegati (usa funzione per merge con stato più recente)
                if (results.length > 0 && onUpdate) {
                    await onUpdate((prev) => ({
                        ...prev,
                        attachments: [...(prev.attachments || []), ...results],
                    }));
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
                // Rimuovi da metadata audit locale (file fisico rimane su disco per tracciabilità)
                if (onUpdate) {
                    await onUpdate((prev) => {
                        const updatedAttachments = (prev.attachments || []).filter(
                            (att) =>
                                !((att.questionId == questionId || att.questionRef === questionId) &&
                                  (att.storedName === attachment.storedName || att.name === attachment.name))
                        );
                        return { ...prev, attachments: updatedAttachments };
                    });
                }

                // Pulizia blob offline se l'allegato non era mai stato caricato sul server
                if (attachment.blobKey && !attachment.serverAttachmentId) {
                    try {
                        await syncService.deleteBlobFromStore(attachment.blobKey);
                    } catch (blobErr) {
                        console.warn('[ATTACHMENT] Errore pulizia blob offline:', blobErr.message);
                    }
                }

                // Cancella allegato dal server (se già caricato)
                if (attachment.serverAttachmentId) {
                    if (navigator.onLine) {
                        try {
                            await apiService.deleteAttachment(attachment.serverAttachmentId);
                        } catch (delErr) {
                            const status = delErr?.response?.status;
                            if (status === 404) {
                                // Già eliminato sul server — ok
                            } else {
                                // Errore di rete o altro: accoda per sync futuro
                                console.warn('[ATTACHMENT] Delete fallita, accodo in sync:', delErr.message);
                                await syncService.enqueue('delete_attachment', {
                                    attachmentId: attachment.serverAttachmentId,
                                });
                            }
                        }
                    } else {
                        await syncService.enqueue('delete_attachment', {
                            attachmentId: attachment.serverAttachmentId,
                        });
                    }
                }

                return {
                    success: true,
                    message: `Allegato rimosso`,
                };
            } catch (err) {
                console.error("Errore rimozione allegato:", err);
                return {
                    success: false,
                    error: err.message || "Errore durante rimozione",
                };
            }
        },
        [listAttachments, onUpdate]
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
        (questionId, category = "documenti", source = "gallery", opts = {}) => {
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
                    const result = await addAttachments(questionId, category, fileList, opts);

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
                totalSizeMB: totalSize / (1024 * 1024),  // Numero (non string) per permettere .toFixed() nei componenti
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
