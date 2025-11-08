/**
 * Storage Version Management
 * Sistema Gestione ISO 9001 - QS Studio
 * 
 * Gestione versioning e migrazione dati localStorage
 * quando cambiano i mock audits o la struttura dati
 */

const STORAGE_VERSION_KEY = 'sgiso_storage_version';
const CURRENT_STORAGE_VERSION = '2.0.0'; // Incrementato per FASE 2 (26 domande ISO 9001)

/**
 * Versioni storage:
 * - 1.0.0: Versione iniziale (22 domande ISO 9001 - pre-FASE 2)
 * - 2.0.0: FASE 2 completata (26 domande ISO 9001 con evidence dettagliato)
 */

/**
 * Controlla se localStorage necessita reset per nuova versione
 * @returns {boolean} true se serve reset
 */
export function needsStorageReset() {
    try {
        const storedVersion = localStorage.getItem(STORAGE_VERSION_KEY);

        if (!storedVersion) {
            // Prima installazione o pre-versioning
            return false; // Non resettiamo se non c'è versione (sarà inizializzato)
        }

        // Confronta versioni
        if (storedVersion !== CURRENT_STORAGE_VERSION) {
            console.log(`🔄 Storage version mismatch: ${storedVersion} → ${CURRENT_STORAGE_VERSION}`);
            return true;
        }

        return false;
    } catch (error) {
        console.error('Errore controllo versione storage:', error);
        return false;
    }
}

/**
 * Resetta localStorage e imposta nuova versione
 * Preserva solo preferenze UI non legate ai dati audit
 */
export function resetStorage() {
    try {
        console.log('🗑️ Pulizia localStorage per upgrade versione...');

        // Preserva solo impostazioni UI se necessario (future implementation)
        // const preservedSettings = localStorage.getItem('ui_theme');

        // Rimuovi solo dati audit obsoleti
        localStorage.removeItem('sgiso_audits');
        localStorage.removeItem('sgiso_current_audit_id');
        localStorage.removeItem('sgiso_fs_connected');

        // Imposta nuova versione
        localStorage.setItem(STORAGE_VERSION_KEY, CURRENT_STORAGE_VERSION);

        console.log(`✅ Storage reset completato. Versione: ${CURRENT_STORAGE_VERSION}`);
        return true;
    } catch (error) {
        console.error('Errore reset storage:', error);
        return false;
    }
}

/**
 * Inizializza versione storage se non esiste
 */
export function initStorageVersion() {
    try {
        const storedVersion = localStorage.getItem(STORAGE_VERSION_KEY);

        if (!storedVersion) {
            localStorage.setItem(STORAGE_VERSION_KEY, CURRENT_STORAGE_VERSION);
            console.log(`✅ Storage versioning inizializzato: ${CURRENT_STORAGE_VERSION}`);
        }
    } catch (error) {
        console.error('Errore inizializzazione versione storage:', error);
    }
}

/**
 * Ottieni versione corrente storage
 * @returns {string} Versione storage
 */
export function getStorageVersion() {
    return localStorage.getItem(STORAGE_VERSION_KEY) || 'unknown';
}

/**
 * Hook automatico: controlla e resetta storage se necessario
 * Da chiamare all'avvio app
 */
export function checkAndMigrateStorage() {
    if (needsStorageReset()) {
        const confirmed = window.confirm(
            '⚠️ Nuova versione dati disponibile!\n\n' +
            'Il sistema ha rilevato un aggiornamento dei dati audit (da 22 a 26 domande ISO 9001).\n\n' +
            'Per caricare i nuovi dati è necessario resettare il localStorage.\n' +
            'Eventuali modifiche locali andranno perse.\n\n' +
            'Vuoi procedere con l\'aggiornamento?'
        );

        if (confirmed) {
            resetStorage();
            window.location.reload(); // Ricarica per applicare nuovi mock data
        } else {
            console.warn('⚠️ Aggiornamento storage annullato dall\'utente');
        }
    } else {
        initStorageVersion(); // Inizializza versione se non esiste
    }
}
