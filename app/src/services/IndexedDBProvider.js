/**
 * IndexedDBProvider - Storage locale per dispositivi mobili
 * Alternativa a LocalFsProvider quando File System Access API non disponibile
 * Sistema Gestione ISO 9001 - QS Studio
 */

const DB_NAME = 'SGQ_ISO9001_Storage';
const DB_VERSION = 1;
const STORE_AUDITS = 'audits';
const STORE_ATTACHMENTS = 'attachments';

export class IndexedDBProvider {
    constructor() {
        this.db = null;
        this.isReady = false;
    }

    /**
     * Inizializza database IndexedDB
     */
    async initialize() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = () => {
                console.error('❌ Errore apertura IndexedDB:', request.error);
                reject(request.error);
            };

            request.onsuccess = () => {
                this.db = request.result;
                this.isReady = true;
                console.log('✅ IndexedDB inizializzato (mobile storage)');
                resolve(this);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // Store per audit completi
                if (!db.objectStoreNames.contains(STORE_AUDITS)) {
                    const auditStore = db.createObjectStore(STORE_AUDITS, {
                        keyPath: 'id',
                    });
                    auditStore.createIndex('auditNumber', 'metadata.auditNumber', {
                        unique: false,
                    });
                    auditStore.createIndex('clientName', 'metadata.clientName', {
                        unique: false,
                    });
                    console.log('📦 Store audit creato');
                }

                // Store per allegati (blob files)
                if (!db.objectStoreNames.contains(STORE_ATTACHMENTS)) {
                    const attachmentStore = db.createObjectStore(STORE_ATTACHMENTS, {
                        keyPath: 'id',
                    });
                    attachmentStore.createIndex('auditId', 'auditId', { unique: false });
                    attachmentStore.createIndex('questionId', 'questionId', {
                        unique: false,
                    });
                    console.log('📎 Store allegati creato');
                }
            };
        });
    }

    /**
     * Verifica se provider è pronto
     */
    ready() {
        return this.isReady;
    }

    /**
     * Salva audit completo
     */
    async saveAudit(audit) {
        if (!this.db) throw new Error('Database non inizializzato');

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([STORE_AUDITS], 'readwrite');
            const store = transaction.objectStore(STORE_AUDITS);

            // Preserva struttura originale con metadata
            const auditData = {
                ...audit,
                // NON sovrascrivere id se già presente in audit
                id: audit.id || audit.metadata?.id,
                lastSaved: new Date().toISOString(),
            };

            const request = store.put(auditData);

            request.onsuccess = () => {
                console.log(`✅ Audit ${auditData.id} salvato in IndexedDB`);
                resolve(auditData);
            };

            request.onerror = () => {
                console.error('❌ Errore salvataggio audit:', request.error);
                reject(request.error);
            };
        });
    }

    /**
     * Salva checkpoint audit (alias per saveAudit)
     * Compatibility layer per useCheckpointSaver hook
     * @param {Object} audit - Audit da salvare
     * @returns {Promise<Object>} Audit salvato
     */
    async saveCheckpoint(audit) {
        return this.saveAudit(audit);
    }

    /**
     * Carica audit per ID
     */
    async loadAudit(auditId) {
        if (!this.db) throw new Error('Database non inizializzato');

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([STORE_AUDITS], 'readonly');
            const store = transaction.objectStore(STORE_AUDITS);
            const request = store.get(auditId);

            request.onsuccess = () => {
                resolve(request.result || null);
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    }

    /**
     * Svuota lo store audit (per sostituzione completa con dati server)
     * Usato quando online: server è fonte di verità, cache locale viene sostituita
     */
    async clearAuditsStore() {
        if (!this.db) throw new Error('Database non inizializzato');

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([STORE_AUDITS], 'readwrite');
            const store = transaction.objectStore(STORE_AUDITS);
            const request = store.clear();

            request.onsuccess = () => {
                console.log('🗑️ [IndexedDB] Cache audit svuotata (sostituzione con dati server)');
                resolve();
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    }

    /**
     * Carica tutti gli audit
     */
    async loadAllAudits() {
        if (!this.db) throw new Error('Database non inizializzato');

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([STORE_AUDITS], 'readonly');
            const store = transaction.objectStore(STORE_AUDITS);
            const request = store.getAll();

            request.onsuccess = () => {
                console.log(`📂 Caricati ${request.result.length} audit da IndexedDB`);
                resolve(request.result);
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    }

    /**
     * Elimina audit
     */
    async deleteAudit(auditId) {
        if (!this.db) throw new Error('Database non inizializzato');

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([STORE_AUDITS], 'readwrite');
            const store = transaction.objectStore(STORE_AUDITS);
            const request = store.delete(auditId);

            request.onsuccess = () => {
                console.log(`🗑️ Audit ${auditId} eliminato da IndexedDB`);
                resolve();
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    }

    /**
     * Salva allegato (blob).
     * Supporta due signature per compatibilità con LocalFsProvider:
     * - (file, category, questionId, { auditId }) — da useAttachmentManager
     * - (auditId, questionId, file, metadata) — signature legacy
     */
    async saveAttachment(auditIdOrFile, questionIdOrCategory, fileOrQuestionId, metadata = {}) {
        if (!this.db) throw new Error('Database non inizializzato');

        let auditId, questionId, file;
        if (auditIdOrFile instanceof File) {
            file = auditIdOrFile;
            const category = questionIdOrCategory;
            questionId = fileOrQuestionId;
            auditId = metadata?.auditId ?? null;
        } else {
            auditId = auditIdOrFile;
            questionId = questionIdOrCategory;
            file = fileOrQuestionId;
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(
                [STORE_ATTACHMENTS],
                'readwrite'
            );
            const store = transaction.objectStore(STORE_ATTACHMENTS);

            const attachmentData = {
                id: `${auditId || 'local'}_${questionId}_${Date.now()}`,
                auditId: auditId || null,
                questionId,
                fileName: file.name,
                fileType: file.type,
                fileSize: file.size,
                blob: file,
                uploadDate: new Date().toISOString(),
                ...metadata,
            };

            const request = store.put(attachmentData);

            request.onsuccess = () => {
                console.log(`📎 Allegato ${file.name} salvato in IndexedDB`);
                resolve({
                    id: attachmentData.id,
                    storedName: file.name,
                    fileName: file.name,
                    size: file.size,
                    relativePath: `indexeddb://${attachmentData.id}`,
                    path: `indexeddb://${attachmentData.id}`,
                    uploadDate: attachmentData.uploadDate,
                });
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    }

    /**
     * Carica allegati per audit
     */
    async loadAttachments(auditId) {
        if (!this.db) throw new Error('Database non inizializzato');

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([STORE_ATTACHMENTS], 'readonly');
            const store = transaction.objectStore(STORE_ATTACHMENTS);
            const index = store.index('auditId');
            const request = index.getAll(auditId);

            request.onsuccess = () => {
                resolve(request.result);
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    }

    /**
     * Esporta tutti i dati per backup
     */
    async exportAllData() {
        const audits = await this.loadAllAudits();
        const attachments = await this.loadAllAttachments();

        return {
            version: DB_VERSION,
            exportDate: new Date().toISOString(),
            audits,
            attachments: attachments.map((att) => ({
                ...att,
                blob: null, // Non esportare blob (troppo grande per JSON)
            })),
        };
    }

    async loadAllAttachments() {
        if (!this.db) throw new Error('Database non inizializzato');

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([STORE_ATTACHMENTS], 'readonly');
            const store = transaction.objectStore(STORE_ATTACHMENTS);
            const request = store.getAll();

            request.onsuccess = () => {
                resolve(request.result);
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    }

    /**
     * Statistiche storage
     */
    async getStorageStats() {
        const audits = await this.loadAllAudits();
        const attachments = await this.loadAllAttachments();

        const totalSize = attachments.reduce((sum, att) => sum + att.fileSize, 0);

        return {
            auditsCount: audits.length,
            attachmentsCount: attachments.length,
            totalSizeMB: totalSize / (1024 * 1024),  // Numero (non string) per permettere .toFixed() nei componenti
            lastUpdate: audits.reduce((latest, audit) => {
                const auditDate = new Date(audit.lastSaved || 0);
                return auditDate > latest ? auditDate : latest;
            }, new Date(0)),
        };
    }
}

// === SINGLETON per sync queue ===
const SYNC_DB_NAME = 'SGQ_ISO9001_DB';
const SYNC_DB_VERSION = 3;  // Incrementata per aggiungere attachments_offline store

let syncDbInstance = null;

/**
 * Ottiene istanza database per sync queue
 * Usato da syncService.js
 */
export async function getDatabase() {
    // Verifica che il singleton sia ancora in stato aperto.
    // Dopo un clear data del browser, Chrome invalida la connessione
    // senza chiamare onclose — il singleton punta a un oggetto stale
    // che genera InvalidStateError su ogni transazione.
    if (syncDbInstance) {
        try {
            // Prova a leggere readyState: se il DB è chiuso/invalido lancia
            const stores = syncDbInstance.objectStoreNames;
            if (!stores || syncDbInstance.version === 0) {
                console.warn('⚠️ [IndexedDB] Singleton stale, riapertura...');
                syncDbInstance = null;
            }
        } catch {
            console.warn('⚠️ [IndexedDB] Singleton non valido, riapertura...');
            syncDbInstance = null;
        }
    }

    if (syncDbInstance) {
        return syncDbInstance;
    }

    return new Promise((resolve, reject) => {
        const request = indexedDB.open(SYNC_DB_NAME, SYNC_DB_VERSION);

        request.onerror = () => {
            console.error('❌ Errore apertura sync database:', request.error);
            reject(request.error);
        };

        request.onsuccess = () => {
            syncDbInstance = request.result;

            // Ascolta la chiusura forzata del DB (es. clear data, upgrade versione).
            // Azzera il singleton così la prossima getDatabase() lo riapre correttamente
            // invece di usare un oggetto stale che genera InvalidStateError.
            syncDbInstance.onclose = () => {
                console.warn('⚠️ [IndexedDB] Connessione chiusa inaspettatamente — singleton azzerato');
                syncDbInstance = null;
            };
            syncDbInstance.onversionchange = () => {
                console.warn('⚠️ [IndexedDB] Versione cambiata — chiusura connessione corrente');
                syncDbInstance.close();
                syncDbInstance = null;
            };

            console.log('✅ Sync database connesso');
            resolve(syncDbInstance);
        };

        request.onupgradeneeded = (event) => {
            const db = event.target.result;

            // Store per sync queue
            if (!db.objectStoreNames.contains('syncQueue')) {
                const store = db.createObjectStore('syncQueue', { keyPath: 'id' });
                store.createIndex('timestamp', 'timestamp', { unique: false });
                store.createIndex('type', 'type', { unique: false });
                console.log('📤 Sync queue store creato');
            }

            // Store per sync metadata (tracking entity sync status)
            if (!db.objectStoreNames.contains('sync_metadata')) {
                const metaStore = db.createObjectStore('sync_metadata', { keyPath: 'id', autoIncrement: true });
                metaStore.createIndex('by_entity', ['entityType', 'localId'], { unique: true });
                metaStore.createIndex('serverId', 'serverId', { unique: false });
                console.log('📋 Sync metadata store creato');
            }

            // Store per blob allegati offline (ArrayBuffer + metadata)
            if (!db.objectStoreNames.contains('attachments_offline')) {
                db.createObjectStore('attachments_offline', { keyPath: 'blobKey' });
                console.log('📦 Attachments offline blob store creato');
            }
        };
    });
}
