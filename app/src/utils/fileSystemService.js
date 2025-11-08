/**
 * File System Integration Service
 * Gestisce salvataggio master dei dati SGQ su file system (cartella Export/)
 * Conforme al pattern: File System = Master, localStorage = Backup
 */

const EXPORT_PATH = '../../../Export/';

/**
 * Salva i dati sul file system come fonte master
 * Nota: In ambiente browser, usa File System Access API o download automatico
 */
export const saveToFileSystem = async (data, filename, tipo = 'json') => {
    try {
        // Verifica supporto File System Access API
        if ('showSaveFilePicker' in window) {
            return await saveWithFilePicker(data, filename, tipo);
        } else {
            // Fallback: salva nella cartella Download dell'utente
            return await saveToDownloads(data, filename, tipo);
        }
    } catch (error) {
        console.error('Errore salvataggio file system:', error);
        return {
            success: false,
            message: `Errore salvataggio: ${error.message}`
        };
    }
};

/**
 * Salva usando File System Access API (Chrome 86+, Edge 86+)
 * Permette salvataggio diretto nella cartella Export/
 */
const saveWithFilePicker = async (data, filename, tipo) => {
    try {
        const options = {
            suggestedName: filename,
            types: getFileTypes(tipo),
            startIn: 'documents'
        };

        const handle = await window.showSaveFilePicker(options);
        const writable = await handle.createWritable();

        let content;
        if (tipo === 'json') {
            content = JSON.stringify(data, null, 2);
        } else {
            content = data; // Già blob per Word/PDF
        }

        await writable.write(content);
        await writable.close();

        return {
            success: true,
            message: `File salvato con successo: ${filename}`,
            path: handle.name
        };
    } catch (error) {
        if (error.name === 'AbortError') {
            return { success: false, message: 'Salvataggio annullato dall\'utente' };
        }
        throw error;
    }
};

/**
 * Fallback: salva nella cartella Downloads
 */
const saveToDownloads = async (data, filename, tipo) => {
    const blob = tipo === 'json'
        ? new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
        : data;

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    return {
        success: true,
        message: `File scaricato: ${filename}`,
        path: 'Downloads'
    };
};

/**
 * Carica dati da file system
 */
export const loadFromFileSystem = async () => {
    try {
        if ('showOpenFilePicker' in window) {
            const [handle] = await window.showOpenFilePicker({
                types: [{
                    description: 'File SGQ',
                    accept: { 'application/json': ['.json'] }
                }],
                multiple: false
            });

            const file = await handle.getFile();
            const content = await file.text();
            const data = JSON.parse(content);

            return {
                success: true,
                data,
                message: `Dati caricati da: ${file.name}`
            };
        } else {
            // Fallback: usa input file tradizionale
            return await loadWithFileInput();
        }
    } catch (error) {
        console.error('Errore caricamento file system:', error);
        return {
            success: false,
            message: `Errore caricamento: ${error.message}`
        };
    }
};

/**
 * Fallback caricamento con input file
 */
const loadWithFileInput = () => {
    return new Promise((resolve) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';

        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) {
                resolve({ success: false, message: 'Nessun file selezionato' });
                return;
            }

            try {
                const content = await file.text();
                const data = JSON.parse(content);
                resolve({
                    success: true,
                    data,
                    message: `Dati caricati da: ${file.name}`
                });
            } catch (error) {
                resolve({
                    success: false,
                    message: `Errore lettura file: ${error.message}`
                });
            }
        };

        input.click();
    });
};

/**
 * Sincronizza dati dal Context al File System
 * Esegue backup automatico periodico
 */
export const syncToFileSystem = async (data) => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `sgq_backup_${timestamp}.json`;

    return await saveToFileSystem(data, filename, 'json');
};

/**
 * Verifica se il File System Access API è supportato
 */
export const isFileSystemAccessSupported = () => {
    return 'showSaveFilePicker' in window;
};

/**
 * Ottiene informazioni sulla cartella Export
 */
export const getExportFolderInfo = async () => {
    try {
        if ('showDirectoryPicker' in window) {
            const dirHandle = await window.showDirectoryPicker({
                id: 'sgq-export-folder',
                mode: 'readwrite',
                startIn: 'documents'
            });

            return {
                success: true,
                name: dirHandle.name,
                supported: true
            };
        }

        return {
            success: false,
            message: 'API accesso cartelle non supportata',
            supported: false
        };
    } catch (error) {
        return {
            success: false,
            message: error.message,
            supported: false
        };
    }
};

/**
 * Salva automaticamente su file system ad ogni modifica
 * Implementa il pattern: File System = Master
 */
export const setupAutoSave = (getData, interval = 60000) => {
    let timeoutId;
    let lastSave = Date.now();

    const autoSave = async () => {
        const now = Date.now();
        if (now - lastSave >= interval) {
            const data = getData();
            await syncToFileSystem(data);
            lastSave = now;
        }

        timeoutId = setTimeout(autoSave, interval);
    };

    // Avvia auto-save
    autoSave();

    // Ritorna funzione di cleanup
    return () => {
        if (timeoutId) clearTimeout(timeoutId);
    };
};

/**
 * Salva manualmente nella cartella Export
 */
export const saveToExportFolder = async (data, filename) => {
    const result = await saveToFileSystem(data, filename, 'json');

    if (result.success) {
        console.log(`✓ Dati master salvati su file system: ${filename}`);
    } else {
        console.warn(`✗ Errore salvataggio master: ${result.message}`);
    }

    return result;
};

/**
 * Ripristina dati dalla cartella Export
 */
export const restoreFromExportFolder = async () => {
    const result = await loadFromFileSystem();

    if (result.success) {
        console.log(`✓ Dati master caricati da file system`);
    } else {
        console.warn(`✗ Errore caricamento master: ${result.message}`);
    }

    return result;
};

// ============= UTILITY =============

const getFileTypes = (tipo) => {
    const types = {
        json: [{
            description: 'File JSON',
            accept: { 'application/json': ['.json'] }
        }],
        word: [{
            description: 'Documento Word',
            accept: {
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx']
            }
        }],
        pdf: [{
            description: 'Documento PDF',
            accept: { 'application/pdf': ['.pdf'] }
        }]
    };

    return types[tipo] || types.json;
};

/**
 * Verifica integrità dati caricati
 */
export const validateData = (data) => {
    const requiredFields = ['audits', 'nonConformita', 'contesto', 'processi', 'rischiOpportunita', 'documenti'];

    for (const field of requiredFields) {
        if (!(field in data)) {
            return {
                valid: false,
                message: `Campo mancante: ${field}`
            };
        }
    }

    return {
        valid: true,
        message: 'Dati validi'
    };
};

export default {
    saveToFileSystem,
    loadFromFileSystem,
    syncToFileSystem,
    isFileSystemAccessSupported,
    getExportFolderInfo,
    setupAutoSave,
    saveToExportFolder,
    restoreFromExportFolder,
    validateData
};
