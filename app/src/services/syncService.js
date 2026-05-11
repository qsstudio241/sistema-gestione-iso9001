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
import apiService, { hasAuditLockToken } from './apiService';
import { toNumericChecklistQuestionId } from '../utils/attachmentQuestionId';

const SYNC_QUEUE_STORE = 'syncQueue';
const STORE_SYNC_METADATA = 'sync_metadata';  // Store per tracking sync status
const SYNC_STATUS_KEY = 'lastSyncStatus';
const ATTACHMENTS_BLOB_STORE = 'attachments_offline'; // Store blob per upload offline

/**
 * Struttura SyncQueueItem
 * {
 *   id: string (UUID),
 *   type: 'create_audit' | 'update_audit' | 'delete_audit'
 *       | 'upload_attachment' | 'delete_attachment'
 *       | 'save_responses' | 'save_custom_checklist_responses'
 *       | 'upload_custom_attachment_and_patch_custom_response'
 *       | 'send_audit_event',
 *   payload: any,
 *   timestamp: number,
 *   retryCount: number,
 *   lastError: string
 * }
 *
 * Payload 'upload_attachment':
 *   { blobKey, auditId, auditUuid, questionId?, customItemId?, category, description, fileName }
 *
 * Payload 'delete_attachment':
 *   { attachmentId }
 */

export class SyncService {
    /**
     * Verifica se un errore è dovuto a quota IndexedDB esaurita.
     * @param {any} error
     * @returns {boolean}
     */
    static _isQuotaError(error) {
        if (!error) return false;
        const name = String(error?.name || '');
        const msg  = String(error?.message || error || '');
        return (
            name === 'QuotaExceededError' ||
            msg.includes('kQuotaBytes') ||
            msg.includes('QuotaExceeded') ||
            msg.includes('quota exceeded')
        );
    }

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

        // Backoff rete instabile: conta cicli consecutivi con soli errori di rete.
        // Evita log e tentativi eccessivi quando la SIM è connessa ma le chiamate falliscono.
        this.networkErrorCycles = 0;
        this.MAX_NETWORK_ERROR_CYCLES = 3; // dopo 3 cicli tutti-rete, aspetta 2 minuti
        this.NETWORK_BACKOFF_INTERVAL_MS = 120000; // 2 minuti
        this._networkBackoffTimer = null;

        /** Pausa globale dopo HTTP 429: nessun item consuma retry; stop burst verso l'API. */
        this._globalRateLimitUntil = 0;
        this._rateLimitTimer = null;

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
     * Aggiungi operazione a sync queue.
     * Per save_responses, save_custom_checklist_responses e update_audit applica
     * la deduplicazione per auditId/audit_uuid: tiene solo l'ultimo item (coalescenza).
     * Evita lo "storm" di centinaia di chiamate identiche quando il device torna online
     * dopo una sessione offline lunga — solo l'ultima versione del dato interessa.
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

        // Deduplicazione: per questi tipi mantieni solo l'ultimo item per audit.
        // I tipi idempotenti (create_audit, delete_audit, send_audit_event, upload/delete_attachment)
        // NON vengono deduplicati — ogni operazione è atomica e va inviata una volta.
        const DEDUP_KEY_BY_TYPE = {
            'save_responses': 'auditId',
            'save_custom_checklist_responses': 'auditId',
            'update_audit': 'audit_uuid',
        };
        const dedupKey = DEDUP_KEY_BY_TYPE[type];
        if (dedupKey) {
            const dedupValue = payload[dedupKey];
            if (dedupValue != null) {
                await this._deduplicateQueueItem(type, dedupKey, String(dedupValue));
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
            request.onerror = () => {
                // Quota IDB esaurita: l'item non può essere accodato.
                // I dati sono gestiti via server al prossimo fetch; non lanciare per non bloccare l'UI.
                if (SyncService._isQuotaError(request.error)) {
                    console.warn(`[SYNC QUEUE] Quota IDB esaurita: item ${type} non accodato (skip graceful)`);
                    resolve(null);
                } else {
                    reject(request.error);
                }
            };
        });

        // Tenta sync immediata se online
        if (this.isOnline) {
            this.processQueue();
        }

        return queueItem.id;
    }

    /**
     * Rimuove dalla sync queue tutti gli item NON stalled dello stesso tipo e stessa chiave audit.
     * Chiamato da enqueue() per coalescenza: mantiene solo l'ultima versione del dato.
     * Operazione non bloccante — eventuali errori IDB vengono loggati ma non propagati.
     *
     * @private
     * @param {string} type         - Tipo item (es. 'save_responses', 'update_audit')
     * @param {string} payloadKey   - Chiave nel payload per identificare l'audit (es. 'auditId')
     * @param {string} payloadValue - Valore atteso (audit UUID normalizzato in minuscolo)
     */
    async _deduplicateQueueItem(type, payloadKey, payloadValue) {
        try {
            const db = await this.init();
            const normalizedValue = payloadValue.toLowerCase();

            await new Promise((resolve, reject) => {
                const tx = db.transaction([SYNC_QUEUE_STORE], 'readwrite');
                const store = tx.objectStore(SYNC_QUEUE_STORE);

                tx.oncomplete = () => resolve();
                tx.onerror = () => reject(tx.error);

                const req = store.getAll();
                req.onsuccess = () => {
                    let removed = 0;
                    for (const item of req.result) {
                        if (
                            item.type === type &&
                            !item.isStalled &&
                            item.payload?.[payloadKey] != null &&
                            String(item.payload[payloadKey]).toLowerCase() === normalizedValue
                        ) {
                            store.delete(item.id);
                            removed++;
                        }
                    }
                    if (removed > 0) {
                        console.log(`[SYNC] Dedup: rimossi ${removed} item ${type} obsoleti per ${payloadKey}=${payloadValue}`);
                    }
                };
                req.onerror = () => reject(req.error);
            });
        } catch (e) {
            // Non bloccante: se la dedup fallisce, l'item viene aggiunto normalmente
            console.warn('[SYNC] _deduplicateQueueItem fallito (non bloccante):', e?.message);
        }
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

        if (Date.now() < this._globalRateLimitUntil) {
            this._scheduleRateLimitProcessQueue();
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

            let successCount = 0;
            let networkErrorCount = 0;

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
                    // Guard: update_audit richiede un lock attivo sul server.
                    // Se non c'è token in memoria, non tentare la rete — evita 423 a raffica
                    // (es. migrazione dati ricchi al login prima che l'utente apra l'audit).
                    // L'item resta in coda e verrà riprovato quando il lock sarà acquisito.
                    if (item.type === 'update_audit') {
                        const uuid = item.payload?.audit_uuid;
                        if (uuid && !hasAuditLockToken(uuid)) {
                            continue; // Nessun lock → salta silenziosamente
                        }
                    }
                    await this.syncItem(item);
                    await this.removeFromQueue(item.id);
                    successCount++;
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
                        networkErrorCount++;
                        // Log solo per il primo errore di rete del ciclo (evita spam)
                        if (networkErrorCount === 1) {
                            console.warn(`[SYNC] Rete instabile — ${items.length} item in coda, saranno riprocessati quando la connessione stabilizzerà`);
                        }
                        continue;
                    }

                    const rateLimited =
                        st === 429 ||
                        code === 'RATE_LIMIT_API' ||
                        code === 'RATE_LIMIT_AUTH';
                    if (rateLimited) {
                        const hint = Number.isFinite(error?.data?.retryAfterMs)
                            ? error.data.retryAfterMs
                            : 60000;
                        this._enterGlobalRateLimit(hint);
                        const waitSec = Math.max(1, Math.round((this._globalRateLimitUntil - Date.now()) / 1000));
                        console.warn(
                            `[SYNC] Rate limit server (429) — pausa globale ~${waitSec}s, item in coda non penalizzati`,
                        );
                        try {
                            window.dispatchEvent(
                                new CustomEvent('sgq:syncRateLimited', {
                                    detail: { resumeAt: this._globalRateLimitUntil },
                                }),
                            );
                        } catch (_) { /* ambiente senza window */ }
                        break;
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

                    // Audit eliminato sul server (o mai esistito per questo tenant): operazioni dipendenti
                    // non avranno mai successo — rimuovi dalla coda invece di stall permanente + spam console.
                    const orphanAuditQueueTypes = new Set([
                        'save_responses',
                        'save_custom_checklist_responses',
                        'update_audit',
                        'upload_attachment',
                        'delete_attachment',
                        'upload_custom_attachment_and_patch_custom_response',
                        'send_audit_event',
                    ]);
                    if (
                        st === 404 &&
                        (code === 'AUDIT_NOT_FOUND' || code === 'NOT_FOUND') &&
                        orphanAuditQueueTypes.has(item.type)
                    ) {
                        console.warn(
                            `[SYNC] Audit assente sul server (404 ${code}): rimozione item obsoleto ${item.type} (${item.id})`,
                        );
                        await this.removeFromQueue(item.id);
                        continue;
                    }

                    // Errori permanenti di business logic (payload rifiutato dal server in modo definitivo):
                    // stall immediato senza consumare tutti e 5 i retry.
                    // Il payload non cambierà da solo: riprovare 5 volte non serve, genera solo spam.
                    const isPermanentError =
                        (st === 403 && (
                            code === 'STANDARDS_NOT_ALLOWED' ||
                            code === 'MODULE_NOT_LICENSED' ||
                            code === 'AUDIT_DEPRECATED' ||
                            code === 'AUDIT_READ_ONLY' ||
                            code === 'FORBIDDEN'
                        )) ||
                        (st === 400 && code === 'VALIDATION_ERROR') ||
                        (st === 404 && code !== undefined); // risorsa non trovata con codice noto
                    if (isPermanentError) {
                        console.warn(`[SYNC] Errore permanente (${st} ${code}), item stalled: ${item.type} (${item.id})`);
                        await this.updateRetryCount(item.id, error?.message || String(code), true); // forceStall=true
                        continue;
                    }

                    console.error(`❌ [SYNC] Errore: ${item.type} (${item.id})`, error);
                    await this.updateRetryCount(item.id, error.message);
                }
            }

            // Backoff rete instabile: se il ciclo ha prodotto solo errori di rete,
            // aumenta il contatore e rallenta l'intervallo per evitare spam.
            const activeItems = items.filter(it => !it.isStalled).length;
            if (networkErrorCount > 0 && successCount === 0 && activeItems > 0) {
                this.networkErrorCycles++;
                if (this.networkErrorCycles >= this.MAX_NETWORK_ERROR_CYCLES) {
                    console.warn(`[SYNC] ${this.networkErrorCycles} cicli consecutivi con soli errori di rete — prossimo retry tra ${this.NETWORK_BACKOFF_INTERVAL_MS / 1000}s`);
                    this._scheduleNetworkBackoffRetry();
                }
            } else if (successCount > 0 || networkErrorCount === 0) {
                this.networkErrorCycles = 0;
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

            case 'delete_attachment':
                return await this.syncDeleteAttachment(payload);

            case 'save_responses':
                return await this.syncSaveResponses(payload);

            // Checklist custom: salva evidence_blocks per custom_item_id
            case 'save_custom_checklist_responses':
                return await this.syncSaveCustomChecklistResponses(payload);

            // Upload allegato custom offline -> patch evidence_blocks sul server
            // (usa pending_blobKey per riconoscere il blocco a cui associare attachment_id)
            case 'upload_custom_attachment_and_patch_custom_response':
                return await this.syncUploadCustomAttachmentAndPatchCustomResponse(payload);

            case 'send_audit_event':
                return await this.syncSendAuditEvent(payload);

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

            // Ricalcola updated_at al momento dell'invio (non all'enqueue).
            // Gli item in coda possono avere un timestamp obsoleto se un altro item
            // per lo stesso audit ha già ricevuto un 409 e aggiornato sgq_srv_ts.
            // Usando Max(now, serverTs+1) qui, garantiamo sempre clientTs > serverTs.
            const auditUuidForTs = auditData.audit_uuid || auditData.id;
            if (auditUuidForTs) {
                const storedTs = localStorage.getItem(`sgq_srv_ts_${auditUuidForTs}`);
                const serverTsMs = storedTs ? new Date(storedTs).getTime() : 0;
                mappedAudit.updated_at = new Date(Math.max(Date.now(), serverTsMs + 1)).toISOString();
            }

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

            // SYNC-3: notifica UI quando il backend ha applicato un field-level merge.
            // Il componente SyncMergeBanner ascolta questo evento e mostra un avviso
            // discreto all'utente, senza bloccare il flusso di lavoro.
            if (responseData.merged === true) {
                window.dispatchEvent(new CustomEvent('sgq:auditMerged', {
                    detail: {
                        auditUuid,
                        audit_id: responseData.audit_id,
                        message: responseData.message,
                    }
                }));
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

                // serverData mancante: accetta server-wins e memorizza timestamp FUTURO
                // (Data.now() + 1s garantisce che il prossimo update sia sempre più recente).
                localStorage.setItem(`sgq_srv_ts_${auditUuid}`, new Date(Date.now() + 1000).toISOString());
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

    // ─── T3: percorso event-based (VITE_SYNC_MODE=events) ───────────────────

    /**
     * Genera idempotency_key deterministica per un evento risposta.
     * Stessa coppia (auditUuid, questionId) entro lo stesso minuto → stessa chiave.
     * Garantisce che lo stesso evento non venga inserito due volte.
     * @param {string} auditUuid
     * @param {number|string} questionId
     * @returns {string} chiave UUID-like (36 caratteri)
     */
    generateResponseEventKey(auditUuid, questionId) {
        const minute = Math.floor(Date.now() / 60000); // granularità 1 minuto
        const raw = `${auditUuid}:${questionId}:${minute}`;
        let hash = 0;
        for (let i = 0; i < raw.length; i++) {
            hash = ((hash << 5) - hash) + raw.charCodeAt(i);
            hash |= 0;
        }
        const ts = Date.now().toString(16).padStart(12, '0');
        const h = Math.abs(hash).toString(16).padStart(8, '0');
        return `${ts.slice(0, 8)}-${ts.slice(8, 12)}-4${h.slice(0, 3)}-8${h.slice(3, 6)}-${h.slice(6)}${ts}`.slice(0, 36);
    }

    /**
     * Accoda un evento response_set per il percorso event-based (T3).
     * Usato solo se VITE_SYNC_MODE === 'events'.
     * @param {string} auditUuid
     * @param {number|string} questionId
     * @param {string|null} conformityStatus - 'C'|'NC'|'OSS'|'OM'|'NA'|'NV'|null
     * @param {string|null} notes
     */
    async enqueueResponseEvent(auditUuid, questionId, conformityStatus, notes = null) {
        const idempotencyKey = this.generateResponseEventKey(auditUuid, questionId);
        const event = {
            event_type: conformityStatus ? 'response_set' : 'response_cleared',
            field_path: `responses.${questionId}`,
            new_value: conformityStatus
                ? JSON.stringify({ conformity_status: conformityStatus, notes })
                : null,
            client_ts: new Date().toISOString(),
            client_ts_offset_ms: 0,
            idempotency_key: idempotencyKey,
            device_type: /Mobi|Android/i.test(navigator.userAgent) ? 'mobile' : 'desktop',
        };
        return this.enqueue('send_audit_event', { auditUuid, event });
    }

    /**
     * GAP-B3: accoda un evento custom_response_set per il percorso event-based T3 custom.
     * Analogo a enqueueResponseEvent ma per audit_custom_checklist_responses.
     * Usato solo se VITE_SYNC_MODE === 'events'.
     * @param {string} auditUuid
     * @param {number|string} itemId  — custom_item_id
     * @param {string|null} status    — 'C'|'NC'|'OSS'|'OM'|'NA'|'NV'|null
     * @param {Array|null} evidenceBlocks
     */
    async enqueueCustomResponseEvent(auditUuid, itemId, status, evidenceBlocks = null) {
        const rawKey = `${auditUuid}:custom:${itemId}`;
        let hash = 0;
        for (let i = 0; i < rawKey.length; i++) {
            hash = ((hash << 5) - hash) + rawKey.charCodeAt(i);
            hash |= 0;
        }
        const ts = Date.now().toString(16).padStart(12, '0');
        const h = Math.abs(hash).toString(16).padStart(8, '0');
        const idempotencyKey = `${ts.slice(0, 8)}-${ts.slice(8, 12)}-4${h.slice(0, 3)}-8${h.slice(3, 6)}-${h.slice(6)}${ts}`.slice(0, 36);

        const event = {
            event_type: 'custom_response_set',
            field_path: `custom_responses.${itemId}`,
            new_value: JSON.stringify({ status, evidence_blocks: evidenceBlocks }),
            client_ts: new Date().toISOString(),
            client_ts_offset_ms: 0,
            idempotency_key: idempotencyKey,
            device_type: /Mobi|Android/i.test(navigator.userAgent) ? 'mobile' : 'desktop',
        };
        return this.enqueue('send_audit_event', { auditUuid, event });
    }

    /**
     * T4: accoda un evento field_updated per un campo testo ricco dell'audit.
     * Chiamato con debounce 500ms da StorageContext.
     * @param {string} auditUuid
     * @param {string} fieldKey - es. 'generalData', 'auditObjective', 'auditOutcome', 'notes'
     * @param {any} value - valore attuale del campo (oggetto o stringa)
     */
    async enqueueFieldUpdatedEvent(auditUuid, fieldKey, value) {
        const ts = Date.now().toString(16).padStart(12, '0');
        // Idempotency: stessa chiave per stesso audit+campo entro 1 secondo → deduplica
        const rawKey = `${auditUuid}:field:${fieldKey}:${Math.floor(Date.now() / 1000)}`;
        let hash = 0;
        for (let i = 0; i < rawKey.length; i++) {
            hash = ((hash << 5) - hash) + rawKey.charCodeAt(i);
            hash |= 0;
        }
        const h = Math.abs(hash).toString(16).padStart(8, '0');
        const idempotencyKey = `${ts.slice(0, 8)}-${ts.slice(8, 12)}-4${h.slice(0, 3)}-8${h.slice(3, 6)}-${h.slice(6)}${ts}`.slice(0, 36);

        const event = {
            event_type: 'field_updated',
            field_path: `audit.${fieldKey}`,
            new_value: value != null ? JSON.stringify(value) : null,
            client_ts: new Date().toISOString(),
            client_ts_offset_ms: 0,
            idempotency_key: idempotencyKey,
            device_type: /Mobi|Android/i.test(navigator.userAgent) ? 'mobile' : 'desktop',
        };
        return this.enqueue('send_audit_event', { auditUuid, event });
    }

    /**
     * Invia un singolo evento audit al server.
     * Risposta 207 con "skipped" = idempotency già presente → ok.
     */
    async syncSendAuditEvent(payload) {
        const { auditUuid, event } = payload;
        try {
            await apiService.post(`/audits/${auditUuid}/events`, { events: [event] });
            return { sent: true };
        } catch (error) {
            // 207 con skipped = idempotency già registrata → non è un errore
            if (error?.status === 207) return { sent: true, skipped: true };
            throw error;
        }
    }

    // ─────────────────────────────────────────────────────────────────────────

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
     * Supporta sia payload.file (diretto) che payload.blobKey (da IDB).
     * Gestisce sia allegati ISO (questionId) che custom (customItemId).
     */
    async syncUploadAttachment(payload) {
        let file = payload.file;

        if (!file && payload.blobKey) {
            const blobData = await this.getFileBlob(payload.blobKey);
            if (!blobData) {
                throw new Error(`Blob non trovato in IDB per key: ${payload.blobKey}`);
            }
            file = new Blob([blobData.arrayBuffer], { type: blobData.mimeType });
            file = new File([file], blobData.fileName || 'upload', { type: blobData.mimeType });
        }

        const uploadParams = {
            auditId: payload.auditId,
            category: payload.category,
            description: payload.description,
        };
        if (payload.customItemId) {
            uploadParams.customItemId = payload.customItemId;
        } else {
            uploadParams.questionId = toNumericChecklistQuestionId(payload.questionId);
        }

        const result = await apiService.uploadAttachment(file, uploadParams);

        // Pulizia blob da IDB dopo upload riuscito
        if (payload.blobKey) {
            await this.deleteBlobFromStore(payload.blobKey);
            console.log(`🗑️ [OFFLINE BLOB] Blob rimosso da IDB dopo sync: ${payload.blobKey}`);
        }

        // Notifica l'app che l'allegato ha un serverAttachmentId definitivo
        const serverAttachmentId = result?.data?.attachment_id || result?.attachment_id;
        if (serverAttachmentId && payload.blobKey) {
            window.dispatchEvent(new CustomEvent('sgq:attachmentSynced', {
                detail: {
                    blobKey: payload.blobKey,
                    serverAttachmentId,
                    auditUuid: payload.auditUuid || null,
                },
            }));
        }

        return result;
    }

    /**
     * Sync: Delete attachment
     * Elimina un allegato già caricato sul server.
     */
    async syncDeleteAttachment(payload) {
        if (!payload.attachmentId) throw new Error('syncDeleteAttachment: attachmentId mancante');
        return await apiService.deleteAttachment(payload.attachmentId);
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
        this.retryCount = 0;
        this.networkErrorCycles = 0; // Reset backoff rete
        // Cancella timer backoff se attivo
        if (this._networkBackoffTimer) {
            clearTimeout(this._networkBackoffTimer);
            this._networkBackoffTimer = null;
        }

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
     * Schedula un retry ritardato (backoff rete instabile).
     * Stoppa l'auto-sync corrente e lo fa ripartire dopo NETWORK_BACKOFF_INTERVAL_MS.
     * All'evento 'online' il backoff viene azzerato da handleOnline.
     */
    _scheduleNetworkBackoffRetry() {
        if (this._networkBackoffTimer) return; // già schedulato
        this.stopAutoSync();
        this._networkBackoffTimer = setTimeout(() => {
            this._networkBackoffTimer = null;
            this.networkErrorCycles = 0;
            if (this.isOnline) {
                console.log('[SYNC] Backoff rete scaduto — riprendo auto-sync');
                this.startAutoSync();
                this.processQueue().catch(() => {});
            }
        }, this.NETWORK_BACKOFF_INTERVAL_MS);
    }

    /**
     * Dopo 429: estende la finestra di pausa globale e schedula un processQueue al termine.
     * Non consuma retry degli item (evita stalli falsi sotto stress).
     */
    _enterGlobalRateLimit(delayMs) {
        const minWait = 5000;
        const maxWait = 15 * 60 * 1000;
        const d = Math.min(Math.max(Number(delayMs) || 60000, minWait), maxWait);
        const until = Date.now() + d;
        if (until > this._globalRateLimitUntil) {
            this._globalRateLimitUntil = until;
        }
        this._scheduleRateLimitProcessQueue();
    }

    _scheduleRateLimitProcessQueue() {
        if (this._rateLimitTimer) {
            clearTimeout(this._rateLimitTimer);
            this._rateLimitTimer = null;
        }
        const delay = Math.max(0, this._globalRateLimitUntil - Date.now()) + 50;
        this._rateLimitTimer = setTimeout(() => {
            this._rateLimitTimer = null;
            this._globalRateLimitUntil = 0;
            if (this.isOnline) {
                this.processQueue().catch(() => {});
            }
        }, delay);
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
                if (!uuid || !uuidSet.has(uuid)) continue;

                // Rimuovi se:
                // (a) già confermato dal server (sync_metadata presente) — l'update è ormai stantio
                // (b) in stallo per lock scaduto — il server ha già i dati più recenti
                //     (la riconciliazione appena finita ha scaricato lo stato server)
                const mappedServerId = await this.getAuditIdForUuid(uuid);
                const hasServerMapping =
                    mappedServerId != null &&
                    Number.isFinite(Number(mappedServerId)) &&
                    Number(mappedServerId) > 0;
                const isLockStall =
                    item.isStalled ||
                    /AUDIT_LOCK_REQUIRED|sessione di lock/i.test(String(item.lastError || ''));

                if (!hasServerMapping && !isLockStall) {
                    // Update non ancora mai sincronizzato e non in lock stall: mantieni
                    continue;
                }
                await this.removeFromQueue(item.id);
                removedCount++;
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
                const auditIdNum = Number(auditIdRaw);

                // save_responses / upload usano spesso auditId = UUID stringa (non audit_uuid).
                const matchUuid =
                    (auditUuid && uuidSet.has(String(auditUuid).trim())) ||
                    (typeof auditIdRaw === 'string' &&
                        auditIdRaw.trim() &&
                        uuidSet.has(String(auditIdRaw).trim()));
                const matchId =
                    Number.isFinite(auditIdNum) && auditIdNum > 0 && idSet.has(auditIdNum);
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
     * Rimuove dalla sync queue tutti gli item relativi ad audit che il server
     * non conosce (UUID non presenti nella lista server post-reconcile).
     * Protegge i draft intenzionali (isIntentionalDraft) e i create_audit
     * non ancora confermati (potrebbero essere in volo).
     *
     * @param {string[]} knownServerUuids - UUID restituiti dal server nell'ultimo fetch
     * @returns {Promise<number>} Numero item rimossi
     */
    async clearQueueForUnknownAudits(knownServerUuids = []) {
        if (!knownServerUuids.length) return 0;
        const knownSet = new Set(knownServerUuids.map((u) => String(u).trim()));

        try {
            const db = await this.init();
            const tx = db.transaction([SYNC_QUEUE_STORE], 'readonly');
            const store = tx.objectStore(SYNC_QUEUE_STORE);
            const items = await new Promise((resolve, reject) => {
                const req = store.getAll();
                req.onsuccess = () => resolve(req.result);
                req.onerror = () => reject(req.error);
            });

            let removed = 0;
            for (const item of items) {
                const payload = item?.payload || {};

                // Estrai UUID dell'audit a cui appartiene questo item
                const auditUuid = String(
                    payload.audit_uuid || payload.auditId || payload.auditUuid || ''
                ).trim();
                if (!auditUuid) continue;

                // UUID noto al server → mantieni
                if (knownSet.has(auditUuid)) continue;

                // create_audit non ancora confermato: potrebbe essere in volo → mantieni
                if (item.type === 'create_audit') continue;

                // delete_audit: il server potrebbe già averlo eliminato → rimuovi dalla queue
                // (è già sparito dal server, il delete è implicitamente completato)
                if (item.type === 'delete_audit') {
                    await this.removeFromQueue(item.id);
                    removed++;
                    continue;
                }

                // save_responses / update_audit / upload per UUID sconosciuto → stale
                if (payload.blobKey) {
                    await this.deleteBlobFromStore(payload.blobKey).catch(() => {});
                }
                await this.removeFromQueue(item.id);
                removed++;
            }

            if (removed > 0) {
                console.log(`🧹 [SYNC] Rimossi ${removed} item queue per audit sconosciuti al server`);
            }
            return removed;
        } catch (err) {
            console.warn('⚠️ [SYNC] clearQueueForUnknownAudits fallito (non bloccante):', err.message);
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
     * Item update_audit senza lock attivo sono "in pausa" (non verranno inviati finché
     * l'utente non riapre l'audit) e non devono bloccare il logout.
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

        return items.filter((it) => {
            if (it.isStalled) return false;
            // update_audit senza lock attivo: in attesa di riapertura audit — non blocca logout
            if (it.type === 'update_audit') {
                const uuid = it.payload?.audit_uuid;
                if (uuid && !hasAuditLockToken(uuid)) return false;
            }
            return true;
        }).length;
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
