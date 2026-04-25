/**
 * Sync Service - Gestione sincronizzazione offline-online
 * 
 * Features:
 * - Queue retry per chiamate API fallite
 * - Background sync quando connessione torna disponibile
 * - Conflict resolution timestamp-based
 * - Metadata tracking per audit modificati offline
 */

import { getDatabase } from './IndexedDBProvider';
import apiService from './apiService';
import { toNumericChecklistQuestionId } from '../utils/attachmentQuestionId';

const SYNC_QUEUE_STORE = 'syncQueue';
const STORE_SYNC_METADATA = 'sync_metadata';  // Store per tracking sync status
const SYNC_STATUS_KEY = 'lastSyncStatus';
const ATTACHMENTS_BLOB_STORE = 'attachments_offline'; // Store blob per upload offline

/**
 * Struttura SyncQueueItem
 * {
 *   id: string (UUID),
 *   type: 'create_audit' | 'update_audit' | 'delete_audit' | 'upload_attachment',
 *   payload: any,
 *   timestamp: number,
 *   retryCount: number,
 *   lastError: string
 * }
 */

export class SyncService {
    constructor(apiBaseUrl = null) {
        // Usa lo stesso base URL del backend delle API (critico su Netlify: frontend e API su domini diversi)
        this.apiBaseUrl = apiBaseUrl ?? (typeof apiService !== 'undefined' ? apiService.baseUrl : null) ?? '/api/v1';
        this.isOnline = navigator.onLine;
        this.isSyncing = false;
        this.syncInterval = null;
        this.retryCount = 0;

        // Configurazione auto-sync
        this.SYNC_INTERVAL_MS = 30000; // 30 secondi
        this.MAX_RETRIES = 5;
        this.MIN_BACKOFF_MS = 1000;
        this.MAX_BACKOFF_MS = 60000;

        // Monitor connessione
        window.addEventListener('online', () => this.handleOnline());
        window.addEventListener('offline', () => this.handleOffline());
    }

    /**
     * Inizializza sync queue in IndexedDB
     * Stores creati da IndexedDBProvider.getDatabase()
     */
    async init() {
        return await getDatabase();
    }

    /**
     * Valida payload audit prima di enqueue
     * @private
     */
    validateAuditPayload(payload) {
        const required = ['audit_uuid', 'audit_number', 'client_name'];
        const missing = required.filter(field => !payload[field]);

        if (missing.length > 0) {
            throw new Error(`Validazione audit fallita. Campi obbligatori mancanti: ${missing.join(', ')}`);
        }

        return true;
    }

    /**
     * Aggiungi operazione a sync queue
     */
    async enqueue(type, payload) {
        // Validazione payload per create_audit e update_audit
        if (type === 'create_audit' || type === 'update_audit') {
            try {
                this.validateAuditPayload(payload);
            } catch (error) {
                console.error(`❌ [SYNC QUEUE] Validazione fallita per ${type}:`, error.message);
                console.warn('⚠️ Audit payload:', payload);
                throw error; // Blocca enqueue di audit malformati
            }
        }

        const db = await this.init();

        const queueItem = {
            id: crypto.randomUUID(),
            type,
            payload,
            timestamp: Date.now(),
            retryCount: 0,
            lastError: null
        };

        const transaction = db.transaction([SYNC_QUEUE_STORE], 'readwrite');
        const store = transaction.objectStore(SYNC_QUEUE_STORE);

        await new Promise((resolve, reject) => {
            const request = store.add(queueItem);
            request.onsuccess = () => {
                console.log(`📤 [SYNC QUEUE] Aggiunto: ${type}`, queueItem.id);
                resolve(request.result);
            };
            request.onerror = () => reject(request.error);
        });

        // Tenta sync immediata se online
        if (this.isOnline) {
            this.processQueue();
        }

        return queueItem.id;
    }

    /**
     * Verifica se un'entità è stata sincronizzata al server
     * @param {string} entityType - Tipo entità ('audit', 'response')
     * @param {string} localId - ID locale dell'entità
     * @returns {Promise<boolean>} True se sincronizzato
     */
    async isSynced(entityType, localId) {
        try {
            const db = await this.init();
            return new Promise((resolve, reject) => {
                const transaction = db.transaction([STORE_SYNC_METADATA], 'readonly');
                const store = transaction.objectStore(STORE_SYNC_METADATA);
                const index = store.index('by_entity');
                const request = index.get([entityType, localId]);

                request.onsuccess = () => {
                    // Se esiste record in sync_metadata, è già stato sincronizzato
                    resolve(request.result ? true : false);
                };

                request.onerror = () => {
                    reject(request.error);
                };
            });
        } catch (error) {
            console.error('[SYNC] Errore isSynced check:', error);
            return false; // Default: assume non sincronizzato
        }
    }

    /**
     * Processa sync queue
     */
    async processQueue() {
        if (this.isSyncing || !this.isOnline) {
            return;
        }

        this.isSyncing = true;
        console.log('🔄 [SYNC] Inizio processamento queue...');

        try {
            const db = await this.init();
            const transaction = db.transaction([SYNC_QUEUE_STORE], 'readonly');
            const store = transaction.objectStore(SYNC_QUEUE_STORE);
            const index = store.index('timestamp');

            const items = await new Promise((resolve, reject) => {
                const request = index.getAll();
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });

            console.log(`📋 [SYNC] Trovati ${items.length} item in queue`);

            for (const item of items) {
                // Se la rete è caduta durante il ciclo, interrompi subito
                if (!this.isOnline) {
                    console.log('📵 [SYNC] Rete caduta durante il ciclo, interruzione');
                    break;
                }
                if (item?.isStalled) {
                    // Item già marcato in stallo permanente: non ritentare ad ogni timer,
                    // altrimenti la console viene inondata di AUDIT_LOCK_REQUIRED.
                    continue;
                }
                // Fallback: salta anche item con lastError che indica lock perso (es. item pre-fix senza isStalled)
                const lastErr = String(item?.lastError || '');
                if (/AUDIT_LOCK_REQUIRED|sessione di lock/i.test(lastErr)) {
                    // Marca retroattivamente come stalled per evitare log futuri
                    if (!item.isStalled) {
                        item.isStalled = true;
                        item.retryCount = Math.max(item.retryCount || 0, 5);
                        const txUpd = db.transaction([SYNC_QUEUE_STORE], 'readwrite');
                        txUpd.objectStore(SYNC_QUEUE_STORE).put(item);
                    }
                    continue;
                }
                try {
                    await this.syncItem(item);
                    await this.removeFromQueue(item.id);
                    console.log(`✅ [SYNC] Completato: ${item.type} (${item.id})`);
                } catch (error) {
                    const st = error?.status;
                    const code = error?.code;

                    // Errori transitori di rete: non incrementare retryCount.
                    // Il problema è la connessione mobile instabile, non il payload.
                    // L'item verrà riprovato al prossimo ciclo senza consumare tentativi.
                    const isTransientNetwork =
                        code === 'NETWORK_ERROR' ||
                        code === 'OFFLINE' ||
                        code === 'TIMEOUT' ||
                        st === 0;
                    if (isTransientNetwork) {
                        console.warn(`[SYNC] Errore rete transitorio, item preservato per retry: ${item.type} (${item.id})`);
                        continue;
                    }

                    const lockDenied =
                        st === 423 ||
                        code === 'AUDIT_LOCKED' ||
                        code === 'AUDIT_LOCK_REQUIRED' ||
                        code === 'AUDIT_LOCK_INVALID';
                    if (lockDenied) {
                        const forceStall =
                            code === 'AUDIT_LOCK_REQUIRED' &&
                            /sessione di lock/i.test(String(error?.message || ''));
                        // Non rimuovere la coda: spesso è una race con l'apertura audit (lock acquisito
                        // subito dopo in StorageContext). Rimuovere + alert causava popup a ogni selezione e perdeva l'item.
                        await this.updateRetryCount(item.id, error?.message || String(code), forceStall);
                        console.warn(
                            `[SYNC] Sync ritardato (lock audit), sarà riprovato: ${item.type}`,
                            code,
                            error?.message,
                        );
                        continue;
                    }
                    console.error(`❌ [SYNC] Errore: ${item.type} (${item.id})`, error);
                    await this.updateRetryCount(item.id, error.message);
                }
            }

            // Aggiorna last sync timestamp
            localStorage.setItem(SYNC_STATUS_KEY, JSON.stringify({
                lastSync: Date.now(),
                status: 'success',
                itemsProcessed: items.length
            }));

            // Reset retry count dopo successo
            this.retryCount = 0;

        } catch (error) {
            console.error('❌ [SYNC] Errore processamento queue:', error);

            // Incrementa retry count e calcola backoff
            this.retryCount++;
            const backoffMs = Math.min(
                this.MIN_BACKOFF_MS * Math.pow(2, this.retryCount),
                this.MAX_BACKOFF_MS
            );

            console.warn(`⚠️ [SYNC] Retry ${this.retryCount}/${this.MAX_RETRIES} in ${backoffMs}ms`);

            localStorage.setItem(SYNC_STATUS_KEY, JSON.stringify({
                lastSync: Date.now(),
                status: 'error',
                error: error.message,
                retryCount: this.retryCount,
                nextRetryIn: backoffMs
            }));

            // Ferma auto-sync dopo MAX_RETRIES fallimenti consecutivi
            if (this.retryCount >= this.MAX_RETRIES) {
                console.error('❌ [SYNC] Troppi fallimenti, fermo auto-sync');
                this.stopAutoSync();
            }
        } finally {
            this.isSyncing = false;
        }
    }

    /**
     * Sincronizza singolo item
     */
    async syncItem(item) {
        const { type, payload } = item;

        switch (type) {
            case 'create_audit':
                return await this.syncCreateAudit(payload);

            case 'update_audit':
                return await this.syncUpdateAudit(payload);

            case 'delete_audit':
                return await this.syncDeleteAudit(payload);

            case 'upload_attachment':
                return await this.syncUploadAttachment(payload);

            case 'save_responses':
                return await this.syncSaveResponses(payload);

            // Checklist custom: salva evidence_blocks per custom_item_id
            case 'save_custom_checklist_responses':
                return await this.syncSaveCustomChecklistResponses(payload);

            // Upload allegato custom offline -> patch evidence_blocks sul server
            // (usa pending_blobKey per riconoscere il blocco a cui associare attachment_id)
            case 'upload_custom_attachment_and_patch_custom_response':
                return await this.syncUploadCustomAttachmentAndPatchCustomResponse(payload);

            default:
                throw new Error(`Tipo sync non supportato: ${type}`);
        }
    }

    /**
     * Sync: Crea audit su server
     */
    async syncCreateAudit(auditData) {
        // Usa upsert invece di create (gestisce duplicati)
        return await this.syncUpsertAudit(auditData);
    }

    /**
     * Sync: Aggiorna audit su server (con conflict resolution)
     */
    async syncUpdateAudit(auditData) {
        // Usa upsert invece di update separato
        return await this.syncUpsertAudit(auditData);
    }

    /**
     * Sync: Upsert audit (INSERT or UPDATE)
     */
    async syncUpsertAudit(auditData) {
        // Mappa codici stringa norma → ID numerico backend
        const STANDARD_CODE_TO_ID = {
            ISO_9001: 1, ISO_9001_2015: 1,
            ISO_14001: 2, ISO_14001_2015: 2,
            ISO_45001: 3, ISO_45001_2018: 3,
            ISO_3834: 6, ISO_3834_2: 6, ISO_3834_2_2021: 6,
            RDP_MSN: 7,
        };
        /**
         * Ricava il primo standard_id numerico dalla lista selectedStandards.
         * Il backend /audits/sync accetta standard_id singolo (non array).
         */
        const resolveStandardId = (codes, hasCustomChecklist = false) => {
            // Niente fallback implicito a ISO 9001:
            // se non ci sono standard espliciti e non c'è custom checklist, lascia null
            // e lascia che il backend rifiuti payload incompleto (MISSING_AUDIT_TYPE).
            if (!Array.isArray(codes) || codes.length === 0) return hasCustomChecklist ? null : null;
            const first = codes[0];
            return typeof first === 'number' ? first : (STANDARD_CODE_TO_ID[first] ?? 1);
        };

        try {
            // Mappa campi frontend→backend per multi-standard support
            // selectedStandards può essere al top-level (payload piatto) oppure dentro metadata (oggetto audit completo)
            const hasCustomChecklistField =
                Object.prototype.hasOwnProperty.call(auditData || {}, 'custom_checklist_id') ||
                Object.prototype.hasOwnProperty.call(auditData?.metadata || {}, 'customChecklistId');
            const customChecklistId = auditData.custom_checklist_id
                ?? auditData.metadata?.customChecklistId
                ?? null;
            const hasCustomChecklist = customChecklistId != null && Number(customChecklistId) > 0;

            const rawCodes = auditData.selectedStandards
                || auditData.metadata?.selectedStandards
                || auditData.standard_ids
                || auditData.standardIds
                || (auditData.standardId ? [auditData.standardId] : []);

            // Converti ogni codice stringa → ID numerico (es. "ISO_14001" → 2)
            const resolvedIds = rawCodes.map(c =>
                typeof c === 'number' ? c : (STANDARD_CODE_TO_ID[c] ?? 1)
            );

            // Raccoglie i campi ricchi (dati generali, obiettivo, esito, tipologia audit) in un unico JSON
            const auditExtraData = {};
            if (auditData.generalData) auditExtraData.generalData = auditData.generalData;
            if (auditData.auditObjective) auditExtraData.auditObjective = auditData.auditObjective;
            if (auditData.auditOutcome) auditExtraData.auditOutcome = auditData.auditOutcome;
            // Tipologia audit (prima/seconda parte) e fornitore — sempre inviati per coerenza backend
            auditExtraData.auditPartyType = auditData.audit_party_type ?? auditData.metadata?.auditPartyType ?? 'first_party';
            auditExtraData.fornitoreName = auditData.fornitore_name ?? auditData.metadata?.fornitoreName ?? '';

            const mappedAudit = {
                ...auditData,
                // standard_id scalare (retrocompatibilità campo legacy audits.standard_id)
                standard_id: resolveStandardId(rawCodes, hasCustomChecklist),
                // standard_ids array → aggiorna audit_standards junction table con TUTTI gli standard
                standard_ids: resolvedIds,
                // company_id da metadata (Fase 1 multi-tenant)
                company_id: auditData.metadata?.companyId ?? auditData.company_id ?? null,
                // Persistenza campi ricchi (generalData, auditObjective, auditOutcome, auditPartyType, fornitoreName)
                audit_extra_data: Object.keys(auditExtraData).length > 0 ? auditExtraData : null,
            };
            // custom_checklist_id (Phase 6): invialo SOLO se il campo è esplicito nel payload.
            // Evita "stacco" accidentale a null durante update parziali.
            if (hasCustomChecklistField) {
                mappedAudit.custom_checklist_id = customChecklistId;
            }

            // Rimuovi campi legacy frontend per pulire payload
            delete mappedAudit.selectedStandards;
            delete mappedAudit.standardIds;
            delete mappedAudit.standardId;

            const result = await apiService.upsertAudit(mappedAudit);

            // Backend risponde con {audit_id, audit_uuid, action, updated_at}
            const responseData = result.data || result;
            const auditUuid = auditData.audit_uuid || auditData.id;

            // Aggiorna sync_metadata
            if (responseData.action === 'created') {
                await this.updateSyncMetadataLocal('audit', auditUuid, responseData.audit_id);
                // Notifica StorageContext del nuovo auditId numerico DB
                if (responseData.audit_id) {
                    window.dispatchEvent(new CustomEvent('sgq:auditIdAssigned', {
                        detail: { uuid: auditUuid, auditId: responseData.audit_id }
                    }));
                }
            }

            // Memorizza server updated_at → i sync futuri useranno questo valore
            // evitando conflict ciclici (server_ts > client_ts)
            if (responseData.updated_at) {
                localStorage.setItem(`sgq_srv_ts_${auditUuid}`, responseData.updated_at);
            }

            return result;
        } catch (error) {
            // Conflict: server ha versione più recente (409)
            // FIX: usa error.status/code (fetch-based ApiError), NON error.response (Axios-style)
            if (error.status === 409 && error.code === 'AUDIT_CONFLICT') {
                const auditUuid = auditData.audit_uuid || auditData.id;
                console.debug('[SYNC] Conflict server-wins per audit:', auditUuid);

                const serverData = error.data?.serverData;
                if (serverData?.audit_id) {
                    await this.updateSyncMetadataLocal('audit', auditUuid, serverData.audit_id);
                    if (serverData.updated_at) {
                        localStorage.setItem(`sgq_srv_ts_${auditUuid}`, serverData.updated_at);
                    }
                    return {
                        data: {
                            action: 'server_wins',
                            audit_id: serverData.audit_id,
                            message: 'Server più recente, versione server mantenuta'
                        }
                    };
                }

                // serverData mancante: accetta server-wins e memorizza timestamp corrente
                // per evitare conflict ciclici (meglio che richiamare resolveConflict che può fallire).
                localStorage.setItem(`sgq_srv_ts_${auditUuid}`, new Date().toISOString());
                return {
                    data: {
                        action: 'server_wins',
                        message: 'Server più recente (serverData non disponibile), versione server mantenuta'
                    }
                };
            }
            throw error;
        }
    }

    /**
     * Sync: Salva risposte checklist
     */
    async syncSaveResponses(payload) {
        const { auditId, responses } = payload;
        return await apiService.bulkSaveResponses(auditId, responses);
    }

    /**
     * Sync: Salva risposte checklist custom
     * payload: { auditId, responses: [{ custom_item_id, evidence_blocks }] }
     */
    async syncSaveCustomChecklistResponses(payload) {
        const { auditId, responses } = payload;
        if (!auditId) throw new Error('syncSaveCustomChecklistResponses: auditId mancante');
        if (!Array.isArray(responses)) throw new Error('syncSaveCustomChecklistResponses: responses deve essere un array');
        return await apiService.saveCustomChecklistResponses(auditId, responses);
    }

    /**
     * Risolve conflict timestamp-based (last-write-wins)
     */
    async resolveConflict(localAudit) {
        // Scarica versione server
        const serverResult = await apiService.getAudit(localAudit.id);
        const serverAudit = serverResult.data;

        // Confronta timestamp
        const localTime = new Date(localAudit.metadata?.lastModified || localAudit.updated_at).getTime();
        const serverTime = new Date(serverAudit.updated_at).getTime();

        if (localTime > serverTime) {
            // Locale più recente → forza update (riprova senza check conflict)
            console.log('🔧 [CONFLICT] Locale più recente, forzo update');
            return await apiService.updateAudit(localAudit.id, {
                ...localAudit,
                force: true
            });
            return await forceResponse.json();
        } else {
            // Server più recente → aggiorna locale
            console.log('🔧 [CONFLICT] Server più recente, aggiorno locale');
            await this.updateLocalAudit(serverAudit);
            throw new Error('CONFLICT_RESOLVED_SERVER_WINS');
        }
    }

    /**
     * Sync: Elimina audit su server
     */
    async syncDeleteAudit(payload) {
        try {
            await apiService.deleteAudit(payload.auditId);
            return { deleted: true };
        } catch (error) {
            if (error.status === 404) {
                // Già eliminato sul server, va bene
                return { deleted: true };
            }
            throw error;
        }
    }

    /**
     * Sync: Upload attachment
     * Supporta sia payload.file (diretto) che payload.blobKey (da IDB)
     */
    async syncUploadAttachment(payload) {
        let file = payload.file;

        // Se abbiamo un blobKey, recupera il blob da IDB
        if (!file && payload.blobKey) {
            const blobData = await this.getFileBlob(payload.blobKey);
            if (!blobData) {
                throw new Error(`Blob non trovato in IDB per key: ${payload.blobKey}`);
            }
            file = new Blob([blobData.arrayBuffer], { type: blobData.mimeType });
            // Aggiungi nome al blob (richiesto da uploadAttachment)
            file = new File([file], blobData.fileName || 'upload', { type: blobData.mimeType });
        }

        const result = await apiService.uploadAttachment(file, {
            auditId: payload.auditId,
            questionId: toNumericChecklistQuestionId(payload.questionId),
            category: payload.category,
            description: payload.description
        });

        // Pulizia blob da IDB dopo upload riuscito
        if (payload.blobKey) {
            await this.deleteBlobFromStore(payload.blobKey);
            console.log(`🗑️ [OFFLINE BLOB] Blob rimosso da IDB dopo sync: ${payload.blobKey}`);
        }

        return result;
    }

    /**
     * Sync: Upload allegato custom (custom_item_id) da blobKey offline e patch evidence_blocks sul server.
     *
     * payload:
     * {
     *   auditId,
     *   customItemId,
     *   blobKey,              // chiave del blob in attachments_offline
     *   blockText,           // testo del blocco (usato se la response row non esiste)
     *   category,            // default 'evidence'
     *   description          // opzionale
     * }
     */
    async syncUploadCustomAttachmentAndPatchCustomResponse(payload) {
        const {
            auditId,
            customItemId,
            blobKey,
            blockText = '',
            category = 'evidence',
            description = undefined,
        } = payload || {};

        if (!auditId) throw new Error('syncUploadCustomAttachmentAndPatchCustomResponse: auditId mancante');
        if (!customItemId) throw new Error('syncUploadCustomAttachmentAndPatchCustomResponse: customItemId mancante');
        if (!blobKey) throw new Error('syncUploadCustomAttachmentAndPatchCustomResponse: blobKey mancante');

        // Recupera blob da IDB
        const blobData = await this.getFileBlob(blobKey);
        if (!blobData) {
            throw new Error(`Blob non trovato in IDB per key: ${blobKey}`);
        }

        const file = new File([new Blob([blobData.arrayBuffer], { type: blobData.mimeType })], blobData.fileName || 'upload', {
            type: blobData.mimeType || 'application/octet-stream',
        });

        // 1) Upload allegato su server
        const uploadResult = await apiService.uploadAttachment(file, {
            auditId,
            customItemId,
            category,
            description,
        });

        const attachmentId = uploadResult?.data?.attachment_id;
        if (!attachmentId) {
            throw new Error('syncUploadCustomAttachmentAndPatchCustomResponse: attachment_id non ricevuto dal server');
        }

        // 2) Patch evidence_blocks sul server, usando pending_blobKey per trovare il blocco
        const rowsResult = await apiService.getCustomChecklistResponses(auditId);
        const rows = rowsResult?.data ?? [];

        // evidence_blocks può arrivare come stringa (JSON) o array
        const parseEvidenceBlocks = (v) => {
            if (Array.isArray(v)) return v;
            if (typeof v === 'string') {
                try { return JSON.parse(v || '[]'); } catch { return []; }
            }
            return [];
        };

        const existingRow = rows.find(r => Number(r.custom_item_id) === Number(customItemId));
        const evidenceBlocks = parseEvidenceBlocks(existingRow?.evidence_blocks);

        let found = false;
        const nextBlocks = (evidenceBlocks.length ? evidenceBlocks : []).map(b => {
            if (b && b.pending_blobKey === blobKey) {
                found = true;
                // Associa il nuovo attachment_id al blocco pendente
                return { ...b, attachment_id: attachmentId, pending_blobKey: undefined };
            }
            return b;
        });

        if (!found) {
            // Evita duplicati: aggiungi un blocco minimo solo se la row non esiste.
            if (!existingRow) {
                nextBlocks.push({
                    text: blockText,
                    attachment_id: attachmentId,
                    pending_blobKey: undefined,
                });
            }
        }

        await apiService.saveCustomChecklistResponses(auditId, [
            { custom_item_id: customItemId, evidence_blocks: nextBlocks }
        ]);

        // 3) Cleanup blob offline solo dopo successo patch
        await this.deleteBlobFromStore(blobKey);
        console.log(`🗑️ [OFFLINE BLOB] Blob ${blobKey} rimosso dopo patch custom_response`);

        return { attachmentId, savedBlocks: nextBlocks.length };
    }

    /**
     * Salva blob file in IDB per upload offline
     * @param {string} blobKey - Chiave univoca (es. `att_<timestamp>_<filename>`)
     * @param {ArrayBuffer} arrayBuffer - Contenuto file
     * @param {Object} metadata - { mimeType, fileName }
     */
    async storeFileBlob(blobKey, arrayBuffer, metadata = {}) {
        const db = await this.init();
        const transaction = db.transaction([ATTACHMENTS_BLOB_STORE], 'readwrite');
        const store = transaction.objectStore(ATTACHMENTS_BLOB_STORE);

        await new Promise((resolve, reject) => {
            const request = store.put({
                blobKey,
                arrayBuffer,
                mimeType: metadata.mimeType || 'application/octet-stream',
                fileName: metadata.fileName || blobKey,
                savedAt: Date.now()
            });
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });

        console.log(`📦 [OFFLINE BLOB] File salvato in IDB: ${blobKey}`);
    }

    /**
     * Recupera blob da IDB
     * @param {string} blobKey
     * @returns {Promise<{arrayBuffer, mimeType, fileName}|null>}
     */
    async getFileBlob(blobKey) {
        const db = await this.init();
        const transaction = db.transaction([ATTACHMENTS_BLOB_STORE], 'readonly');
        const store = transaction.objectStore(ATTACHMENTS_BLOB_STORE);

        return new Promise((resolve, reject) => {
            const request = store.get(blobKey);
            request.onsuccess = () => resolve(request.result || null);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Elimina blob da IDB
     * @param {string} blobKey
     */
    async deleteBlobFromStore(blobKey) {
        const db = await this.init();
        const transaction = db.transaction([ATTACHMENTS_BLOB_STORE], 'readwrite');
        const store = transaction.objectStore(ATTACHMENTS_BLOB_STORE);

        await new Promise((resolve, reject) => {
            const request = store.delete(blobKey);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Rimuovi item da sync queue
     */
    async removeFromQueue(itemId) {
        const db = await this.init();
        const transaction = db.transaction([SYNC_QUEUE_STORE], 'readwrite');
        const store = transaction.objectStore(SYNC_QUEUE_STORE);

        await new Promise((resolve, reject) => {
            const request = store.delete(itemId);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Pulisci sync queue da audit malformati
     * Rimuove item che falliscono validazione
     * @returns {Promise<number>} - Numero di item rimossi
     */
    async cleanMalformedAudits() {
        console.log('🧹 [SYNC CLEANUP] Pulizia audit malformati dalla queue...');

        try {
            const db = await this.init();
            const transaction = db.transaction([SYNC_QUEUE_STORE], 'readonly');
            const store = transaction.objectStore(SYNC_QUEUE_STORE);

            const items = await new Promise((resolve, reject) => {
                const request = store.getAll();
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });

            let removedCount = 0;

            for (const item of items) {
                // Verifica solo audit (create/update)
                if (item.type === 'create_audit' || item.type === 'update_audit') {
                    try {
                        this.validateAuditPayload(item.payload);
                        // Validazione OK, mantieni in queue
                    } catch (validationError) {
                        // Validazione FALLITA, rimuovi dalla queue
                        console.warn(`⚠️ [SYNC CLEANUP] Rimuovo audit malformato:`, item.id, validationError.message);
                        console.debug('Payload malformato:', item.payload);
                        await this.removeFromQueue(item.id);
                        removedCount++;
                    }
                }
            }

            console.log(`✅ [SYNC CLEANUP] Rimossi ${removedCount} audit malformati`);
            return removedCount;

        } catch (error) {
            console.error('❌ [SYNC CLEANUP] Errore durante pulizia:', error);
            throw error;
        }
    }

    /**
     * Aggiorna retry count
     */
    async updateRetryCount(itemId, errorMessage, forceStall = false) {
        const db = await this.init();
        const transaction = db.transaction([SYNC_QUEUE_STORE], 'readwrite');
        const store = transaction.objectStore(SYNC_QUEUE_STORE);

        const item = await new Promise((resolve, reject) => {
            const request = store.get(itemId);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });

        if (item) {
            item.retryCount += 1;
            item.lastError = errorMessage;

            // Hardening: non eliminare mai automaticamente item in errore.
            // La rimozione silenziosa può causare perdita dati locale non sincronizzata.
            if (forceStall || item.retryCount > 5) {
                item.retryCount = 5;
                item.isStalled = true;
                console.error(`❌ [SYNC] Item in stallo (retry max raggiunto), mantenuto in queue: ${itemId}`);
                try {
                    window.dispatchEvent(
                        new CustomEvent('sgq:syncQueueStalled', {
                            detail: { itemId, type: item.type, lastError: item.lastError },
                        }),
                    );
                } catch {
                    // no-op: ambiente non browser o evento non disponibile
                }
            }

            await new Promise((resolve, reject) => {
                const request = store.put(item);
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            });
        }
    }

    /**
     * Restituisce l'audit_id numerico (server) per un audit locale (uuid), se già sincronizzato.
     * Usato al caricamento per ripristinare metadata.auditId e far scomparire il banner "non sincronizzato".
     * @param {string} uuid - metadata.id dell'audit (UUID)
     * @returns {Promise<number|null>}
     */
    async getAuditIdForUuid(uuid) {
        if (!uuid) return null;
        try {
            const db = await this.init();
            return new Promise((resolve, reject) => {
                const transaction = db.transaction([STORE_SYNC_METADATA], 'readonly');
                const store = transaction.objectStore(STORE_SYNC_METADATA);
                const index = store.index('by_entity');
                const request = index.get(['audit', uuid]);
                request.onsuccess = () => {
                    const rec = request.result;
                    const id = rec?.serverId;
                    resolve(id != null ? Number(id) : null);
                };
                request.onerror = () => reject(request.error);
            });
        } catch (e) {
            return null;
        }
    }

    /**
     * Aggiorna sync_metadata locale (IndexedDB)
     */
    async updateSyncMetadataLocal(entityType, localId, serverId) {
        console.log(`📝 [SYNC METADATA] ${entityType} ${localId} → server:${serverId}`);

        const db = await this.init();
        const transaction = db.transaction([STORE_SYNC_METADATA], 'readwrite');
        const store = transaction.objectStore(STORE_SYNC_METADATA);

        // Usa index per trovare record esistente
        const index = store.index('by_entity');
        const getRequest = index.get([entityType, localId]);

        return new Promise((resolve, reject) => {
            getRequest.onsuccess = () => {
                const existing = getRequest.result;
                const record = {
                    ...existing,
                    entityType,
                    localId,
                    serverId,
                    syncedAt: Date.now()
                };

                const saveRequest = existing ? store.put(record) : store.add(record);
                saveRequest.onsuccess = () => resolve();
                saveRequest.onerror = () => reject(saveRequest.error);
            };
            getRequest.onerror = () => reject(getRequest.error);
        });
    }

    /**
     * Aggiorna audit locale con versione server
     */
    async updateLocalAudit(serverAudit) {
        console.log('📥 [SYNC] Aggiornamento audit locale:', serverAudit.id);
    }

    /**
     * Get auth token
     */
    getToken() {
        return localStorage.getItem('sgq_auth_token') || '';
    }

    /**
     * Handler: Connessione online
     */
    handleOnline() {
        console.log('🌐 [SYNC] Connessione ripristinata');
        this.isOnline = true;
        this.retryCount = 0; // Reset retry count

        // Avvia sync automatica dopo 2 secondi.
        // Prima di processare, resuscita item stalled per errore di rete:
        // questi non devono rimanere bloccati in eterno solo perché la rete
        // mobile era instabile al momento del tentativo.
        setTimeout(async () => {
            await this.unstallNetworkErrorItems();
            this.processQueue();
        }, 2000);

        // Riavvia auto-sync se era stato fermato
        this.startAutoSync();
    }

    /**
     * Resuscita item in stallo (isStalled=true) dovuti a errori transitori di rete.
     * Vengono riportati in stato attivo (isStalled=false, retryCount azzerato) così
     * il prossimo processQueue() li riprova correttamente.
     *
     * Gli item stalled per motivi non di rete (es. AUDIT_LOCK_REQUIRED con sessione di lock)
     * non vengono toccati.
     */
    async unstallNetworkErrorItems() {
        const NETWORK_ERROR_PATTERNS = /NETWORK_ERROR|OFFLINE|TIMEOUT|Connessione assente|Richiesta timeout|Failed to fetch|NetworkError/i;
        try {
            const db = await this.init();
            const transaction = db.transaction([SYNC_QUEUE_STORE], 'readonly');
            const store = transaction.objectStore(SYNC_QUEUE_STORE);
            const items = await new Promise((resolve, reject) => {
                const request = store.getAll();
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });

            let unstaledCount = 0;
            for (const item of items) {
                if (!item.isStalled) continue;
                const lastErr = String(item.lastError || '');
                // Resuscita solo se l'ultimo errore noto era di rete
                if (!NETWORK_ERROR_PATTERNS.test(lastErr)) continue;
                // Non resuscitare item con lock perso (separazione esplicita)
                if (/AUDIT_LOCK_REQUIRED|sessione di lock/i.test(lastErr)) continue;

                const txUpd = db.transaction([SYNC_QUEUE_STORE], 'readwrite');
                item.isStalled = false;
                item.retryCount = 0;
                item.lastError = null;
                txUpd.objectStore(SYNC_QUEUE_STORE).put(item);
                unstaledCount++;
            }

            if (unstaledCount > 0) {
                console.log(`♻️ [SYNC] Resuscitati ${unstaledCount} item stalled per errore di rete`);
            }
        } catch (error) {
            // Non bloccante: il normale ciclo sync gestisce tutto
            console.warn('⚠️ [SYNC] unstallNetworkErrorItems fallito (non bloccante):', error?.message);
        }
    }

    /**
     * Handler: Connessione offline
     */
    handleOffline() {
        console.log('📵 [SYNC] Connessione persa - modalità offline attiva');
        this.isOnline = false;
    }

    /**
     * Avvia auto-sync polling (30s interval)
     */
    startAutoSync() {
        if (this.syncInterval) {
            console.log('⏩ [SYNC] Auto-sync già attivo');
            return;
        }

        console.log(`🔄 [SYNC] Auto-sync avviato (intervallo: ${this.SYNC_INTERVAL_MS}ms)`);

        this.syncInterval = setInterval(async () => {
            if (!this.isOnline) {
                console.log('📴 [SYNC] Offline, skip polling');
                return;
            }

            try {
                await this.processQueue();
            } catch (error) {
                console.error('❌ [SYNC] Errore auto-sync:', error);
            }
        }, this.SYNC_INTERVAL_MS);
    }

    /**
     * Ferma auto-sync polling
     */
    stopAutoSync() {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
            console.log('⏸️ [SYNC] Auto-sync fermato');
        }
    }

    /**
     * Verifica se server è raggiungibile (health check)
     */
    async isServerReachable() {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3000); // 3s timeout

            const response = await fetch(`${this.apiBaseUrl.replace(/\/$/, '')}/health`, {
                method: 'GET',
                signal: controller.signal
            });

            clearTimeout(timeoutId);
            return response.ok;
        } catch (error) {
            console.warn('⚠️ [SYNC] Server non raggiungibile:', error.message);
            return false;
        }
    }

    /**
     * Ottieni stato sync
     */
    getSyncStatus() {
        const statusJson = localStorage.getItem(SYNC_STATUS_KEY);
        return statusJson ? JSON.parse(statusJson) : null;
    }

    /**
     * Rimuove dalla sync queue operazioni create_audit / update_audit chiaramente stantie:
     * solo se l'audit esiste sul server e ha mapping locale sync_metadata (uuid -> audit_id).
     *
     * Chiamare DOPO ogni download server riuscito: evita che operazioni
     * accumulatesi in sessioni precedenti (su questo o altri dispositivi)
     * sovrascrivano i dati più recenti appena scaricati.
     *
     * Le operazioni accodate DOPO questa chiamata (nuove modifiche utente)
     * vengono regolarmente processate.
     *
     * @param {string[]} serverAuditUuids - UUID degli audit scaricati dal server
     * @returns {Promise<number>} Numero di item rimossi
     */
    async clearQueueForServerAudits(serverAuditUuids) {
        if (!serverAuditUuids || serverAuditUuids.length === 0) return 0;

        const uuidSet = new Set(serverAuditUuids);

        try {
            const db = await this.init();
            const transaction = db.transaction([SYNC_QUEUE_STORE], 'readonly');
            const store = transaction.objectStore(SYNC_QUEUE_STORE);

            const items = await new Promise((resolve, reject) => {
                const request = store.getAll();
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });

            let removedCount = 0;

            for (const item of items) {
                if (item.type !== 'create_audit' && item.type !== 'update_audit') continue;

                const uuid = item.payload?.audit_uuid;
                if (uuid && uuidSet.has(uuid)) {
                    const mappedServerId = await this.getAuditIdForUuid(uuid);
                    // Rimuovi solo item "acknowledged" dal server (evita perdita update non ancora confermati).
                    if (mappedServerId == null || !Number.isFinite(Number(mappedServerId)) || Number(mappedServerId) <= 0) {
                        continue;
                    }
                    await this.removeFromQueue(item.id);
                    removedCount++;
                }
            }

            if (removedCount > 0) {
                console.log(`🧹 [SYNC] Rimossi ${removedCount} item stantii dalla queue (audit già sul server)`);
            }

            return removedCount;

        } catch (error) {
            // Non bloccante: se fallisce, il normale conflict-resolution gestisce tutto
            console.warn('⚠️ [SYNC] clearQueueForServerAudits fallito (non bloccante):', error.message);
            return 0;
        }
    }

    /**
     * Rimuove item di queue legati ad audit stale locali (es. LOCK-* test, bozze residue).
     * Usa UUID audit e/o audit_id numerico per intercettare payload diversi:
     * - create/update/delete_audit: payload.audit_uuid
     * - upload/save responses: payload.auditId / payload.audit_id
     *
     * @param {{ auditUuids?: string[], auditIds?: number[] }} refs
     * @returns {Promise<number>} Numero item rimossi
     */
    async clearQueueForStaleAudits(refs = {}) {
        const uuidSet = new Set((refs.auditUuids || []).map((u) => String(u).trim()).filter(Boolean));
        const idSet = new Set(
            (refs.auditIds || [])
                .map((n) => Number(n))
                .filter((n) => Number.isFinite(n) && n > 0),
        );
        if (uuidSet.size === 0 && idSet.size === 0) return 0;

        try {
            const db = await this.init();
            const transaction = db.transaction([SYNC_QUEUE_STORE], 'readonly');
            const store = transaction.objectStore(SYNC_QUEUE_STORE);
            const items = await new Promise((resolve, reject) => {
                const request = store.getAll();
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });

            let removedCount = 0;
            for (const item of items) {
                const payload = item?.payload || {};
                const auditUuid = payload.audit_uuid || payload.auditUuid || null;
                const auditIdRaw = payload.auditId ?? payload.audit_id ?? null;
                const auditId = Number(auditIdRaw);

                const matchUuid = auditUuid && uuidSet.has(String(auditUuid).trim());
                const matchId = Number.isFinite(auditId) && auditId > 0 && idSet.has(auditId);
                if (!matchUuid && !matchId) continue;

                if (payload.blobKey) {
                    await this.deleteBlobFromStore(payload.blobKey).catch(() => {});
                }
                await this.removeFromQueue(item.id);
                removedCount++;
            }

            if (removedCount > 0) {
                console.log(`🧹 [SYNC] Rimossi ${removedCount} item queue legati ad audit stale`);
            }
            return removedCount;
        } catch (error) {
            console.warn('⚠️ [SYNC] clearQueueForStaleAudits fallito (non bloccante):', error.message);
            return 0;
        }
    }

    /**
     * Conta item in queue (tutti, inclusi stalled).
     */
    async getQueueSize() {
        const db = await this.init();
        const transaction = db.transaction([SYNC_QUEUE_STORE], 'readonly');
        const store = transaction.objectStore(SYNC_QUEUE_STORE);

        return new Promise((resolve, reject) => {
            const request = store.count();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Conta solo item ATTIVI (non stalled) — usato dal guard di logout.
     * Item in stallo permanente (isStalled: true) non possono essere recuperati
     * e non devono bloccare l'uscita dell'utente.
     */
    async getActiveQueueSize() {
        const db = await this.init();
        const transaction = db.transaction([SYNC_QUEUE_STORE], 'readonly');
        const store = transaction.objectStore(SYNC_QUEUE_STORE);

        const items = await new Promise((resolve, reject) => {
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });

        return items.filter((it) => !it.isStalled).length;
    }

    /**
     * Logout / cambio utente: svuota queue sync, metadata uuid→audit_id, blob allegati offline.
     * Evita che un altro account sulla stessa macchina erediti operazioni o mapping del tenant precedente.
     */
    async clearSessionStoresOnLogout() {
        try {
            const db = await this.init();
            const storeNames = [SYNC_QUEUE_STORE, STORE_SYNC_METADATA, ATTACHMENTS_BLOB_STORE].filter(
                (n) => db.objectStoreNames.contains(n),
            );
            if (storeNames.length === 0) return;

            const transaction = db.transaction(storeNames, 'readwrite');
            await Promise.all(
                storeNames.map(
                    (name) =>
                        new Promise((resolve, reject) => {
                            const r = transaction.objectStore(name).clear();
                            r.onsuccess = () => resolve();
                            r.onerror = () => reject(r.error);
                        }),
                ),
            );
            console.log('🧹 [SYNC] Store sessione svuotati al logout (queue, sync_metadata, attachments_offline)');
        } catch (error) {
            console.warn('⚠️ [SYNC] clearSessionStoresOnLogout:', error?.message || error);
        }
    }
}

// Export singleton
export const syncService = new SyncService();
