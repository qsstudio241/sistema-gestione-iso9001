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

            const auditData = {
                ...audit,
                id: audit.metadata?.id || audit.id,
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
     * Salva allegato (blob)
     */
    async saveAttachment(auditId, questionId, file, metadata = {}) {
        if (!this.db) throw new Error('Database non inizializzato');

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(
                [STORE_ATTACHMENTS],
                'readwrite'
            );
            const store = transaction.objectStore(STORE_ATTACHMENTS);

            const attachmentData = {
                id: `${auditId}_${questionId}_${Date.now()}`,
                auditId,
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
                    fileName: file.name,
                    size: file.size,
                    uploadDate: attachmentData.uploadDate,
                    path: `indexeddb://${attachmentData.id}`,
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
            totalSizeMB: (totalSize / (1024 * 1024)).toFixed(2),
            lastUpdate: audits.reduce((latest, audit) => {
                const auditDate = new Date(audit.lastSaved || 0);
                return auditDate > latest ? auditDate : latest;
            }, new Date(0)),
        };
    }
}
