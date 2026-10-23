/**
 * Testi degli avvisi di discrepanza. Un solo file, italiano con accenti.
 * La UI e le regole leggono da qui: non duplicare le frasi nel JSX.
 */

'use strict';

const HELP = Object.freeze({
    conferma: "Il dato è giusto così: l'avviso si chiude e resta nello storico",
    correggi: 'Modifichi il valore: resta traccia di chi, quando e del valore precedente',
    segnala: 'Non puoi o non devi decidere tu: la WPQR resta da rivedere e non conforme finché la segnalazione è aperta',
});

const REASONS = Object.freeze([
    Object.freeze({
        id: 'documento_originale',
        label: 'Errore nel documento originale',
        example: "Esempio: sul certificato c'è la lettera O (16VE01735PO2/A) e nel codice è stato scritto lo zero (16VE01735P02/A).",
    }),
    Object.freeze({
        id: 'lettura_app',
        label: "Errore di lettura dell'app",
        example: "Esempio: l'app ha letto un pezzo di parola dentro il numero del certificato.",
    }),
    Object.freeze({
        id: 'parere',
        label: 'Serve un parere',
        example: "Esempio: il certificato cita l'edizione 2012 e in libreria le regole sono per il 2017.",
    }),
]);

const REASON_IDS = new Set(REASONS.map((item) => item.id));

const STATUS_LABEL = Object.freeze({
    aperto: 'Aperto',
    confermato: 'Confermato',
    in_correzione: 'In correzione',
    segnalato: 'Segnalato',
    corretto: 'Corretto',
});

const UI = Object.freeze({
    sectionTitle: 'Avvisi di discrepanza',
    signalsTitle: 'Segnalazioni',
    inAppOnly: "Queste segnalazioni restano nell'app. Nessuna email parte da qui.",
    signalsEmpty: 'Nessuna segnalazione con questi filtri.',
    filterReason: 'Motivo',
    filterStatus: 'Stato',
    filterAll: 'Tutti',
    noteLabel: 'Motivazione breve',
    notePlaceholder: 'Scrivi perché il dato è giusto, o cosa non torna.',
    valueLabel: 'Nuovo valore',
    currentValue: 'Valore attuale',
    emptyValue: 'vuoto',
    submitConfirm: 'Registra conferma',
    submitCorrect: 'Registra correzione',
    submitSignal: 'Registra segnalazione',
    historyTitle: 'Storico',
    draftLabel: 'Bozza di richiesta, nessuna email inviata.',
    learningLabel: "Esempio anonimo per l'autoapprendimento",
    approveLearning: "Approva l'esempio anonimo",
    learningPending: "In attesa di approvazione: dopo il sì dello studio resta un esempio anonimo, senza PDF del cliente.",
    pageUnknown: 'La pagina del PDF non è indicata sul record.',
    noteRequired: 'Scrivi una motivazione breve.',
    reasonRequired: 'Scegli il motivo della segnalazione.',
    valueRequired: 'Scrivi il valore corretto.',
    valueUnchanged: 'Il valore è uguale a quello già registrato.',
    fieldNotCorrectable: 'Questo avviso non si corregge da qui: modifica il campo nella scheda.',
    locked: "Sola lettura: non puoi confermare, correggere o segnalare l'avviso",
    saveFirst: "Salva la WPQR prima di registrare l'azione",
    openCount: 'Segnalazioni aperte',
});

function reasonById(id) {
    return REASONS.find((item) => item.id === id) || null;
}

function reasonLabel(id) {
    const found = reasonById(id);
    return found ? found.label : '';
}

function knownPdfPage(record) {
    if (!record || typeof record !== 'object') return null;
    for (const key of ['pdf_page', 'certificate_page', 'source_page']) {
        if (!Object.prototype.hasOwnProperty.call(record, key)) continue;
        const raw = record[key];
        let n = NaN;
        if (typeof raw === 'number') n = raw;
        else if (typeof raw === 'string' && /^\d{1,4}$/.test(raw.trim())) n = Number(raw.trim());
        if (Number.isInteger(n) && n > 0 && n <= 9999) return n;
    }
    return null;
}

function pdfPageLine(page) {
    const n = Number(page);
    if (!Number.isInteger(n) || n <= 0 || n > 9999) return null;
    return `Pagina del PDF: ${n}.`;
}

function withPdfPage(message, page) {
    const line = pdfPageLine(page);
    if (!line) return message;
    return `${message} ${line}`;
}

function codeCertMessage({ kind, dove, cert, code }) {
    const where = dove || 'Sul certificato';
    if (kind === 'cert_o') {
        return `\u26A0\uFE0F Il numero del certificato non coincide con il codice WPQR. ${where} c'è la lettera O (${cert}), nel codice c'è lo zero (${code}). Controlla sul PDF.`;
    }
    if (kind === 'code_o') {
        return `\u26A0\uFE0F Il numero del certificato non coincide con il codice WPQR. ${where} c'è lo zero (${cert}), nel codice c'è la lettera O (${code}). Controlla sul PDF.`;
    }
    if (kind === 'mixed') {
        return `\u26A0\uFE0F Il numero del certificato non coincide con il codice WPQR. ${where} c'è ${cert}, nel codice c'è ${code}. La differenza è tra la lettera O e lo zero. Controlla sul PDF.`;
    }
    return `\u26A0\uFE0F Il numero del certificato (${cert}) non coincide con il codice WPQR (${code}). Controlla sul PDF.`;
}

function fillerMessage({ cover, inner, extra }) {
    return `Il materiale d'apporto della copertina (${cover}) non coincide con quello delle pagine interne (${inner})${extra || ''}. Controlla sul PDF.`;
}

function materialMessage({ inside, test, raw }) {
    if (inside === false) {
        return `Il gruppo materiale del saggio (${test}) non è coerente con il campo di validità (${raw}). Controlla sul PDF.`;
    }
    return `Il gruppo materiale del saggio (${test}) non si riesce a confrontare con il campo di validità (${raw}). Controlla sul PDF.`;
}

function filletMessage(quoted) {
    return `Il campo di validità è incompleto: manca il range d'angolo${quoted || ''}. Controlla sul PDF.`;
}

function editionMessage({ raw, coveredText }) {
    return `La verifica di conformità non è completa: sul certificato c'è ${raw} e questa edizione non è in libreria.${coveredText || ''} Non si può verificare la conformità su questa edizione.`;
}

function editionUnreadableMessage(raw) {
    return `La verifica di conformità non è completa: la norma letta (${raw}) non si può controllare. Non è un esito di conformità.`;
}

function keyFieldsMessage({ onlyEnte, missing }) {
    if (onlyEnte) return "L'ente emittente è vuoto. Controlla sul PDF.";
    return `Mancano dati chiave: ${(missing || []).join(', ')}. Controlla sul PDF.`;
}

function draftRequest({ wpqrCode, note, page }) {
    const where = pdfPageLine(page);
    return [
        'Bozza di richiesta (non inviata, nessuna email).',
        `WPQR ${wpqrCode || 'senza codice'}.`,
        `Motivo: ${note}`,
        where,
        "Chiedere il documento corretto. Va inviata a mano, fuori da questa app.",
    ].filter(Boolean).join(' ');
}

function parereDraft({ note, page }) {
    const where = pdfPageLine(page) || UI.pageUnknown;
    return `${note} ${where} Nota per il responsabile, solo in app.`;
}

function anonymizeLearningExample(text, record) {
    let s = String(text || '');
    const secrets = [
        record && record.welder_name,
        record && record.company_name,
        record && record.wpqr_code,
        record && record.certificate_number,
        record && record.reference_number,
    ].filter((value) => value != null && String(value).trim().length >= 3);
    for (const secret of secrets) {
        s = s.split(String(secret)).join('[DATO]');
    }
    s = s.replace(/[A-Za-z]:\\[^\s]+/g, '[FILE]');
    s = s.replace(/\/uploads\/[^\s]+/gi, '[FILE]');
    s = s.replace(/\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b/g, '[EMAIL]');
    s = s.replace(/\b(?=[A-Za-z0-9./-]*\d)(?=[A-Za-z0-9./-]*[A-Za-z])[A-Za-z0-9][A-Za-z0-9./-]{4,}\b/g, '[NUMERO]');
    s = s.replace(/\b\d{5,}\b/g, '[NUMERO]');
    s = s.replace(/\.pdf\b/gi, '');
    return s.replace(/\s+/g, ' ').trim().slice(0, 1000);
}

function validateNoticeAction(action, payload) {
    const body = payload || {};
    const note = String(body.note == null ? '' : body.note).trim();
    if (action === 'conferma') {
        if (!note) return { ok: false, error: UI.noteRequired };
        return { ok: true, note: note.slice(0, 500) };
    }
    if (action === 'segnala') {
        const reason = String(body.reason == null ? '' : body.reason).trim();
        if (!REASON_IDS.has(reason)) return { ok: false, error: UI.reasonRequired };
        if (!note) return { ok: false, error: UI.noteRequired };
        return { ok: true, note: note.slice(0, 500), reason };
    }
    if (action === 'correggi') {
        const value = String(body.new_value == null ? '' : body.new_value).trim();
        if (!value) return { ok: false, error: UI.valueRequired };
        return { ok: true, note: note ? note.slice(0, 500) : null, newValue: value.slice(0, 500) };
    }
    return { ok: false, error: 'Azione non valida' };
}

function formatStamp(value) {
    if (!value) return 'data non registrata';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'data non registrata';
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(date.getUTCDate())}/${pad(date.getUTCMonth() + 1)}/${date.getUTCFullYear()} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())} UTC`;
}

function personName(who) {
    const name = who == null ? '' : String(who).trim();
    return name || 'nome non in elenco';
}

function confirmHistoryLine({ who, when, note }) {
    return `Avviso chiuso. Chi: ${personName(who)}. Quando: ${formatStamp(when)}. Motivo: ${note || ''}`;
}

function correctHistoryLine({ who, when, previous, next }) {
    const before = previous == null || previous === '' ? UI.emptyValue : previous;
    const after = next == null || next === '' ? UI.emptyValue : next;
    return `Valore modificato. Chi: ${personName(who)}. Quando: ${formatStamp(when)}. Valore precedente: ${before}. Valore nuovo: ${after}.`;
}

function signalOpenLine({ who, when, reason, note }) {
    const label = reasonLabel(reason) || 'Segnalazione';
    return `Segnalazione aperta. Chi: ${personName(who)}. Quando: ${formatStamp(when)}. Motivo: ${label}. ${note || ''}`;
}

module.exports = {
    HELP,
    REASONS,
    REASON_IDS,
    STATUS_LABEL,
    UI,
    reasonById,
    reasonLabel,
    knownPdfPage,
    pdfPageLine,
    withPdfPage,
    codeCertMessage,
    fillerMessage,
    materialMessage,
    filletMessage,
    editionMessage,
    editionUnreadableMessage,
    keyFieldsMessage,
    draftRequest,
    parereDraft,
    anonymizeLearningExample,
    validateNoticeAction,
    formatStamp,
    confirmHistoryLine,
    correctHistoryLine,
    signalOpenLine,
};
