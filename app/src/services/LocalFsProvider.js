/**
 * Local File System Provider per Audit ISO 9001
 * 
 * Gestisce la connessione alla cartella locale per salvare:
 * - Report Word audit
 * - Allegati (foto, documenti, verbali)
 * - Export JSON (checkpoint)
 * 
 * Adattato da ESRS PWA - Approccio manuale senza IndexedDB
 * Permette sincronizzazione OneDrive per accesso multi-dispositivo
 */

export class LocalFsProvider {
    constructor() {
        this.auditDir = null;
        this.subDirs = null;
        this.lastAuditId = null;
        this.rootPath = null;
        this.clientName = null;
        this.auditYear = null;
    }

    /**
     * Verifica se il provider è pronto (cartella collegata)
     * @returns {boolean}
     */
    ready() {
        const isReady = !!this.auditDir && !!this.subDirs;
        console.log("🔍 LocalFsProvider.ready()", {
            isReady,
            auditDir: this.auditDir,
            subDirs: this.subDirs,
            auditDirType: this.auditDir?.constructor?.name,
            subDirsKeys: this.subDirs ? Object.keys(this.subDirs) : null,
        });
        return isReady;
    }

    /**
     * Verifica e richiede permessi per la cartella
     * @param {string} mode - 'read' | 'readwrite'
     */
    async ensurePermission(mode = "readwrite") {
        if (!this.auditDir) {
            throw new Error("Cartella audit non selezionata");
        }

        const queryResult = await this.auditDir.queryPermission({ mode });
        if (queryResult === "granted") return true;

        const requestResult = await this.auditDir.requestPermission({ mode });
        return requestResult === "granted";
    }

    /**
     * Inizializza NUOVO audit - chiede cartella PADRE dove creare struttura
     * @param {string} clientName - Nome cliente (es: "Raccorderia_Piacentina")
     * @param {Object} options - { year: 2025 }
     * @returns {Object} - { success, structure, year }
     */
    async initNewAudit(clientName, options = {}) {
        try {
            // Verifica supporto browser
            if (!window.showDirectoryPicker) {
                throw new Error(
                    "Il browser non supporta File System Access API. Usa Chrome/Edge versione recente."
                );
            }

            console.log(
                `🆕 Nuovo audit - selezione cartella PADRE per: ${clientName}`
            );

            // Mostra picker - utente seleziona dove creare la struttura
            const parentDir = await window.showDirectoryPicker({
                mode: "readwrite",
                startIn: "documents",
            });

            console.log("📁 Directory padre selezionata:", parentDir.name);

            const targetYear = parseInt(options?.year, 10) || new Date().getFullYear();
            this.clientName = clientName;

            // Crea cartella cliente nella directory selezionata
            console.log(
                `📂 Creazione cartella cliente: ${clientName} in ${parentDir.name}`
            );
            const clientDir = await parentDir.getDirectoryHandle(clientName, {
                create: true,
            });

            const result = await this.createAuditStructure(clientDir, {
                clientName,
                mode: "new",
                targetYear,
                parentLabel: parentDir.name,
            });

            return result;
        } catch (error) {
            console.error("❌ Errore durante la creazione nuovo audit:", error);
            this.resetState();
            throw this.handleDirectoryError(error);
        }
    }

    /**
     * Riprende audit ESISTENTE - chiede cartella CLIENTE
     * @param {string} clientName - Nome cliente
     * @param {Object} options - { year: 2025 }
     * @returns {Object} - { success, structure, year }
     */
    async resumeExistingAudit(clientName, options = {}) {
        try {
            // Verifica supporto browser
            if (!window.showDirectoryPicker) {
                throw new Error(
                    "Il browser non supporta File System Access API. Usa Chrome/Edge versione recente."
                );
            }

            console.log(
                `🔄 Ripresa audit - selezione cartella CLIENTE: ${clientName}`
            );

            // Mostra picker - utente seleziona direttamente cartella cliente
            const clientDir = await window.showDirectoryPicker({
                mode: "readwrite",
                startIn: "documents",
            });

            console.log("📁 Directory cliente selezionata:", clientDir.name);

            // Verifica che sia la cartella giusta
            if (!clientDir.name.includes(clientName)) {
                const confirm = window.confirm(
                    `⚠️ Hai selezionato la cartella "${clientDir.name}" ma l'audit è per "${clientName}".\n\nSei sicuro che sia la cartella corretta?`
                );
                if (!confirm) {
                    throw new Error("Selezione cartella annullata dall'utente");
                }
            }

            const expectedYear = parseInt(options?.year, 10) || null;
            this.clientName = clientName;

            const result = await this.createAuditStructure(clientDir, {
                clientName,
                mode: "resume",
                expectedYear,
            });

            return result;
        } catch (error) {
            console.error("❌ Errore durante la ripresa audit:", error);
            this.resetState();
            throw this.handleDirectoryError(error);
        }
    }

    /**
     * METODO UNIFICATO per creare/verificare struttura audit
     * @private
     */
    async createAuditStructure(clientDir, config = {}) {
        const {
            clientName,
            mode = "new",
            targetYear,
            expectedYear,
            parentLabel,
        } = config;

        let auditDir;
        let resolvedYear = targetYear || expectedYear || new Date().getFullYear();

        if (mode === "new") {
            // Crea nuova cartella audit con anno
            const auditDirName = `${resolvedYear}_Audit_ISO9001`;
            try {
                auditDir = await clientDir.getDirectoryHandle(auditDirName);
                console.log(`📂 Struttura audit esistente trovata: ${auditDirName}`);
            } catch {
                console.log(`🆕 Creazione nuova struttura audit: ${auditDirName}`);
                auditDir = await clientDir.getDirectoryHandle(auditDirName, {
                    create: true,
                });
            }
        } else {
            // Cerca cartella audit esistente (più recente se ce ne sono multiple)
            const matches = [];
            for await (const [name, handle] of clientDir.entries()) {
                if (handle?.kind === "directory" && /_Audit_ISO9001$/.test(name)) {
                    matches.push({ name, handle });
                }
            }

            if (!matches.length) {
                throw new Error(
                    "❌ Nessuna cartella audit trovata. Seleziona la cartella cliente che contiene almeno una cartella *YYYY_Audit_ISO9001*."
                );
            }

            let chosen = matches[0];
            if (expectedYear) {
                const preferred = matches.find((d) =>
                    d.name.startsWith(`${expectedYear}_`)
                );
                if (preferred) {
                    chosen = preferred;
                }
            } else {
                // Ordina per anno decrescente (più recente prima)
                matches.sort((a, b) => b.name.localeCompare(a.name));
                chosen = matches[0];
            }

            auditDir = chosen.handle;
            resolvedYear = parseInt(chosen.name.split("_")[0], 10) || resolvedYear;

            if (matches.length > 1 && !expectedYear) {
                console.log(
                    "ℹ️ Cartelle audit multiple trovate, collego automaticamente la più recente:",
                    matches.map((d) => d.name)
                );
            }
        }

        // Crea sottocartelle struttura ISO 9001
        const report = await auditDir.getDirectoryHandle("Report", {
            create: true,
        });
        const allegati = await auditDir.getDirectoryHandle("Allegati", {
            create: true,
        });
        const exportDir = await auditDir.getDirectoryHandle("Export", {
            create: true,
        });

        // Sottocartelle allegati per tipologia
        const allegatiSubs = {
            foto: await allegati.getDirectoryHandle("Foto", { create: true }),
            documenti: await allegati.getDirectoryHandle("Documenti", { create: true }),
            verbali: await allegati.getDirectoryHandle("Verbali", { create: true }),
        };

        this.auditDir = auditDir;
        this.subDirs = { report, allegati, allegatiSubs, export: exportDir };
        this.auditYear = resolvedYear;
        this.lastAuditId = `${clientName}_${resolvedYear}`;

        // Costruisci path root per display
        const rootSegments = [];
        if (mode === "new" && parentLabel) rootSegments.push(parentLabel);
        rootSegments.push(clientDir.name, auditDir.name);
        this.rootPath = rootSegments.filter(Boolean).join("/");

        // Notifica context del cambiamento stato (per re-render UI)
        if (this._triggerUpdate) {
            this._triggerUpdate();
        }

        console.log(
            `✅ Struttura audit ${mode === "new" ? "creata" : "collegata"} per ${clientName}:`,
            {
                client: clientName,
                audit: `${resolvedYear}_Audit_ISO9001`,
                structure: "Report | Allegati (Foto/Documenti/Verbali) | Export",
                mode: mode === "new" ? "NUOVO" : "RIPRESA",
            }
        );

        return {
            success: true,
            structure: `${clientName}/${resolvedYear}_Audit_ISO9001/[Report|Allegati|Export]`,
            isNewAudit: mode === "new",
            year: resolvedYear,
        };
    }

    /**
     * Reset stato provider (disconnessione)
     */
    resetState() {
        this.auditDir = null;
        this.subDirs = null;
        this.rootPath = null;
        this.clientName = null;
        this.auditYear = null;

        // Notifica context
        if (this._triggerUpdate) {
            this._triggerUpdate();
        }
    }

    /**
     * Gestione errori directory con messaggi user-friendly
     * @private
     */
    handleDirectoryError(error) {
        if (error.name === "AbortError") {
            return new Error("Selezione directory annullata dall'utente.");
        } else if (error.name === "NotAllowedError") {
            return new Error(
                "Permessi negati. Concedi i permessi per accedere al file system."
            );
        } else if (error.message.includes("not supported")) {
            return new Error(
                "Browser non compatibile. Usa Chrome o Edge versione recente."
            );
        } else {
            return new Error(`Errore nella selezione directory: ${error.message}`);
        }
    }

    /**
     * Scrive un blob su file
     * @private
     */
    async writeBlob(dir, fileName, blob) {
        try {
            console.log(`💾 Tentativo di scrittura file: ${fileName}`);

            const fileHandle = await dir.getFileHandle(fileName, { create: true });
            const writable = await fileHandle.createWritable();
            await writable.write(blob);
            await writable.close();

            console.log(`✅ File salvato con successo: ${fileName}`);
            return `./${fileName}`;
        } catch (error) {
            console.error("❌ Errore scrittura file:", error);
            throw new Error(
                `Impossibile salvare il file ${fileName}: ${error.message}`
            );
        }
    }

    /**
     * Salva allegato audit (foto, documento, verbale)
     * @param {File} file - File da salvare
     * @param {string} category - 'foto' | 'documenti' | 'verbali'
     * @param {string} questionId - ID domanda (opzionale, per naming)
     * @returns {Object} - { path, name, type, size }
     */
    async saveAttachment(file, category = "documenti", questionId = null) {
        if (!this.subDirs?.allegatiSubs) {
            throw new Error(
                "Cartella allegati non inizializzata. Seleziona prima una cartella audit."
            );
        }

        try {
            await this.ensurePermission("readwrite");

            // Verifica categoria valida
            const validCategories = ["foto", "documenti", "verbali"];
            if (!validCategories.includes(category)) {
                category = "documenti";
            }

            const categoryDir = this.subDirs.allegatiSubs[category];

            // Sanitizza nome file
            const safeFileName = file.name
                .replace(/[<>:"/\\|?*]/g, "_")
                .replace(/[^\w\s.-]/g, "_")
                .replace(/\s+/g, "_")
                .slice(0, 100);

            // Aggiungi prefisso domanda se specificato
            const prefix = questionId ? `${questionId}_` : "";
            const timestamp = new Date().toISOString().replace(/[:.]/g, "").slice(0, 15);
            const finalName = `${prefix}${timestamp}_${safeFileName}`;

            console.log(
                `💾 Salvataggio allegato: ${finalName} in Allegati/${category}/`
            );

            await this.writeBlob(categoryDir, finalName, file);

            // Costruisci path completo
            const year = this.auditYear || new Date().getFullYear();
            const basePath = this.rootPath || [this.clientName, `${year}_Audit_ISO9001`].filter(Boolean).join("/");
            const fullPath = `${basePath}/Allegati/${category}/${finalName}`;

            return {
                path: fullPath,
                relativePath: `./Allegati/${category}/${finalName}`,
                name: file.name,
                storedName: finalName,
                type: file.type,
                size: file.size,
                category,
            };
        } catch (error) {
            console.error("❌ Errore salvataggio allegato:", error);
            throw new Error(
                `Impossibile salvare allegato ${file.name}: ${error.message}`
            );
        }
    }

    /**
     * Salva checkpoint JSON (stato audit)
     * @param {Object} auditData - Dati audit completi
     * @returns {Object} - { path, fileName }
     */
    async saveCheckpoint(auditData) {
        if (!this.subDirs?.export) {
            throw new Error(
                "Cartella export non inizializzata. Seleziona prima una cartella audit."
            );
        }

        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, "").slice(0, 15);
            const clientPrefix = this.clientName ? `${this.clientName}_` : "";
            const fileName = `${clientPrefix}checkpoint_${timestamp}.json`;

            const blob = new Blob([JSON.stringify(auditData, null, 2)], {
                type: "application/json",
            });

            await this.writeBlob(this.subDirs.export, fileName, blob);

            return {
                path: `Export/${fileName}`,
                fileName,
            };
        } catch (error) {
            console.error("❌ Errore salvataggio checkpoint:", error);
            throw error;
        }
    }

    /**
     * Salva report Word audit
     * @param {Blob} blob - Blob documento Word
     * @param {string} fileName - Nome file (es: "Report_Audit_001.docx")
     * @returns {Object} - { path, fileName }
     */
    async saveReport(blob, fileName) {
        if (!this.subDirs?.report) {
            throw new Error(
                "Cartella report non inizializzata. Seleziona prima una cartella audit."
            );
        }

        try {
            await this.ensurePermission("readwrite");

            console.log(`📄 Salvataggio report Word: ${fileName}`);

            await this.writeBlob(this.subDirs.report, fileName, blob);

            const year = this.auditYear || new Date().getFullYear();
            const basePath = this.rootPath || [this.clientName, `${year}_Audit_ISO9001`].filter(Boolean).join("/");
            const fullPath = `${basePath}/Report/${fileName}`;

            console.log(`✅ Report salvato: ${fullPath}`);

            return {
                path: fullPath,
                fileName,
            };
        } catch (error) {
            console.error("❌ Errore salvataggio report:", error);
            throw new Error(
                `Impossibile salvare report ${fileName}: ${error.message}`
            );
        }
    }

    /**
     * Carica checkpoint da cartella export (per resume audit)
     * @returns {Object|null} - Dati audit o null se non trovato
     */
    async loadLatestCheckpoint() {
        if (!this.subDirs?.export) {
            throw new Error("Cartella export non inizializzata.");
        }

        try {
            const files = [];
            for await (const [name, handle] of this.subDirs.export.entries()) {
                if (handle.kind === "file" && name.endsWith(".json") && name.includes("checkpoint")) {
                    files.push({ name, handle });
                }
            }

            if (files.length === 0) {
                console.log("ℹ️ Nessun checkpoint trovato");
                return null;
            }

            // Ordina per nome (timestamp nel nome) - più recente prima
            files.sort((a, b) => b.name.localeCompare(a.name));
            const latestFile = files[0];

            console.log(`📂 Caricamento checkpoint: ${latestFile.name}`);

            const file = await latestFile.handle.getFile();
            const text = await file.text();
            const data = JSON.parse(text);

            return data;
        } catch (error) {
            console.error("❌ Errore caricamento checkpoint:", error);
            return null;
        }
    }
}
