'use strict';

/**
 * certificateFileUrl.service.js — validazione di `qualifications.certificate_file_url` in scrittura.
 *
 * Il valore e' un percorso `/uploads/...` che la rotta protetta `GET /api/v1/files/content` (A1, #788)
 * risolve su disco: se un utente potesse salvare un percorso arbitrario o di un'altra organizzazione,
 * potrebbe puntare a file altrui (o far negare l'accesso al legittimo proprietario, perche' un file
 * rivendicato da due organizzazioni viene negato a entrambe).
 *
 * Forme accettate (le uniche che l'app genera per le qualifiche):
 *   /uploads/qualifications/<file>                    upload singolo/batch (cartella piatta, senza org)
 *   /uploads/imports/<organization_id>/<job_id>/<file>  commit da job di importazione
 * La cartella `imports` deve appartenere all'organizzazione del record. Per la forma piatta
 * l'appartenenza si verifica a DB: nessun'altra organizzazione deve gia' referenziare lo stesso file.
 */

const { query } = require('../config/database');
const { parseUploadsUrl, resolveUploadFile } = require('../utils/uploadsPath');

const CLAIM_TABLES = ['qualifications', 'wpqr_records', 'welding_procedures'];

/**
 * Forma attesa (solo sintassi, senza I/O): `/uploads/qualifications/<file>` o
 * `/uploads/imports/<organizationId>/<jobId>/<file>`.
 * @param {unknown} raw
 * @param {number|string} organizationId
 * @returns {string|null} URL normalizzato, o null se non valido
 */
function expectedQualificationUrl(raw, organizationId) {
    const parsed = parseUploadsUrl(raw);
    if (!parsed) return null;
    const { segments } = parsed;
    if (segments[0] === 'qualifications' && segments.length === 2) return parsed.url;
    if (
        segments[0] === 'imports'
        && segments.length === 4
        && /^\d+$/.test(segments[2])
        && organizationId != null
        && segments[1] === String(organizationId)
    ) {
        return parsed.url;
    }
    return null;
}

/** true se il file e' gia' referenziato da un record di un'altra organizzazione. */
async function isClaimedByOtherOrganization(url, organizationId) {
    const parts = CLAIM_TABLES.map(
        (table) => `SELECT TOP 1 1 AS hit FROM ${table}
                    WHERE organization_id <> @organizationId AND certificate_file_url = @url`,
    );
    const r = await query(parts.join('\nUNION ALL\n'), { organizationId, url });
    return ((r && r.recordset) || []).length > 0;
}

/**
 * Valida il valore di `certificate_file_url` proposto da un utente.
 * - `null` / `undefined` / stringa vuota: consentiti (rimozione del certificato) -> `value: null`.
 * - altro: forma attesa, file esistente e regolare dentro la root uploads (symlink inclusi),
 *   non rivendicato da un'altra organizzazione.
 * Non restituisce mai il valore rifiutato nel risultato.
 * @param {unknown} raw
 * @param {{ organizationId: number|string }} ctx
 * @returns {Promise<{ ok: true, value: string|null } | { ok: false }>}
 */
async function validateCertificateFileUrl(raw, { organizationId }) {
    if (raw == null) return { ok: true, value: null };
    if (typeof raw === 'string' && raw.trim() === '') return { ok: true, value: null };

    const url = expectedQualificationUrl(raw, organizationId);
    if (!url) return { ok: false };

    const file = await resolveUploadFile(url.slice('/uploads/'.length));
    if (!file) return { ok: false };

    if (await isClaimedByOtherOrganization(url, organizationId)) return { ok: false };

    return { ok: true, value: url };
}

/** Risposta 400 uniforme: messaggio in italiano, senza echo del percorso. */
const CERTIFICATE_FILE_URL_ERROR = Object.freeze({
    status: 400,
    body: {
        error: 'Il file del certificato indicato non è valido. Caricalo con il pulsante di caricamento oppure lascia il campo vuoto.',
        code: 'VALIDATION_ERROR',
        field: 'certificate_file_url',
    },
});

module.exports = {
    expectedQualificationUrl,
    isClaimedByOtherOrganization,
    validateCertificateFileUrl,
    CERTIFICATE_FILE_URL_ERROR,
};
