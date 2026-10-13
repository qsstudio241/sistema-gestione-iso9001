'use strict';

/**
 * ingestErrorMessage.js — messaggio errore difensivo per la pipeline di ingest batch
 * (patentini saldatori, WPQR, WPS, norme).
 *
 * Origine (feedback cliente Studio Mason, 16/07/2026): upload di una singola WQ falliva
 * mostrando "Errore Sconosciuto" senza indicazioni utili. Causa individuata: i catch dei
 * loop di upload batch usavano `error: fileErr.message` senza fallback né logging — se
 * l'errore lanciato non era un'istanza di `Error` con `.message` (es. libreria di terze
 * parti che rifiuta una Promise con una stringa o un oggetto nudo), il messaggio finiva
 * `undefined`, il frontend cadeva sul fallback generico "Errore sconosciuto" e non restava
 * alcuna traccia server-side per diagnosticare il caso reale.
 *
 * Questa utility garantisce SEMPRE un messaggio utile all'utente e permette di loggare lo
 * stack quando disponibile.
 */

/**
 * @param {unknown} err
 * @param {string} [fallback]
 * @returns {string}
 */
function describeIngestFileError(err, fallback = "Errore imprevisto durante l'elaborazione del file \u2014 verifica che il PDF non sia protetto da password, corrotto o vuoto.") {
    if (err == null) return fallback;
    if (typeof err === 'string') return err.trim() || fallback;
    if (typeof err.message === 'string' && err.message.trim()) return err.message.trim();
    if (err.code) return `Errore (${err.code}) durante l'elaborazione del file.`;
    return fallback;
}

const crypto = require('crypto');

const LOG_SAFE_EXTENSIONS = new Set([
    'pdf', 'png', 'jpg', 'jpeg', 'webp', 'tif', 'tiff', 'doc', 'docx', 'xls', 'xlsx', 'txt', 'zip',
]);

/**
 * Forma NON identificante del nome file per i log: `file#<hash8>.<ext>`.
 * Il nome originale puo' contenere il titolare (es. `25-01341_<COGNOME NOME>_14732_121.pdf`):
 * nei log non finisce nessuna parte del nome, solo un hash breve (stesso nome => stesso hash,
 * quindi le righe dello stesso ingest restano correlabili) e l'estensione se e' di un tipo noto.
 * Accetta anche path (separatori Windows e POSIX): conta solo il nome finale.
 * @param {unknown} name
 * @returns {string}
 */
function redactFileNameForLog(name) {
    if (typeof name !== 'string' || !name.trim()) return 'file#none';
    const base = name.normalize('NFC').split(/[\\/]/).pop().trim();
    if (!base) return 'file#none';
    const hash = crypto.createHash('sha256').update(base, 'utf8').digest('hex').slice(0, 8);
    const dot = base.lastIndexOf('.');
    const ext = dot > 0 ? base.slice(dot + 1).toLowerCase() : '';
    return LOG_SAFE_EXTENSIONS.has(ext) ? `file#${hash}.${ext}` : `file#${hash}`;
}

/**
 * Forma NON identificante di una persona (titolare di qualifica, saldatore, operatore, contatto) per i log:
 * `person#<hash8>`. Nessuna parte del nome compare, nemmeno le iniziali. Il valore e' normalizzato
 * (Unicode NFC, spazi multipli collassati, maiuscole/minuscole ignorate) prima dell'hash: stesso nome
 * scritto uguale => stesso hash, quindi le righe dello stesso titolare restano correlabili.
 * Limiti noti: "ROSSI MARIO" e "MARIO ROSSI" danno hash diversi (nessun riordino nome/cognome);
 * 8 caratteri di hash non sono un'anonimizzazione forte (un nome noto si puo' confrontare a mano).
 * Input non stringa o vuoto => `person#none`. Per le email usare `redactEmailForLog`.
 * @param {unknown} name
 * @returns {string}
 */
function redactPersonForLog(name) {
    if (typeof name !== 'string') return 'person#none';
    const norm = name.normalize('NFC').replace(/\s+/g, ' ').trim().toLowerCase();
    if (!norm) return 'person#none';
    return `person#${crypto.createHash('sha256').update(norm, 'utf8').digest('hex').slice(0, 8)}`;
}

/**
 * Forma NON identificante di un indirizzo email per i log: `email#<hash8>`. Ne' la parte locale ne'
 * il dominio compaiono. Valore normalizzato (NFC, trim, minuscolo): stesso indirizzo => stesso hash,
 * quindi le righe dello stesso utente restano correlabili. 8 caratteri di hash non sono
 * un'anonimizzazione forte. Input non stringa o vuoto => `email#none`.
 * @param {unknown} email
 * @returns {string}
 */
function redactEmailForLog(email) {
    if (typeof email !== 'string') return 'email#none';
    const norm = email.normalize('NFC').trim().toLowerCase();
    if (!norm) return 'email#none';
    return `email#${crypto.createHash('sha256').update(norm, 'utf8').digest('hex').slice(0, 8)}`;
}

/**
 * Come `redactEmailForLog` per un elenco di destinatari (array o stringa separata da `,` o `;`,
 * come `recipients_email`): ogni indirizzo diventa `email#<hash8>`, uniti da `, `.
 * @param {unknown} list
 * @returns {string}
 */
function redactEmailsForLog(list) {
    const items = Array.isArray(list)
        ? list
        : (typeof list === 'string' ? list.split(/[,;]/) : []);
    const parts = items
        .filter((x) => typeof x === 'string' && x.trim())
        .map(redactEmailForLog);
    return parts.length ? parts.join(', ') : 'email#none';
}

const JSON_SOURCE_SNIPPET_RE = /,?\s*(?:\.\.\.)?"[^]*?"(?:\.\.\.)?\s+is not valid JSON/g;

/**
 * I messaggi di JSON.parse (Node >= 20) riportano un estratto del testo analizzato
 * (`Unexpected token 'R', "ROSSI MARIO..." is not valid JSON`): nelle risposte AI sono campi
 * estratti dal certificato, quindi dati personali. Toglie l'estratto da messaggi e stack.
 * @param {unknown} text
 * @returns {string}
 */
function redactJsonSnippetForLog(text) {
    if (text == null) return '';
    return String(text).replace(JSON_SOURCE_SNIPPET_RE, ' [estratto omesso] is not valid JSON');
}

module.exports = {
    describeIngestFileError,
    redactFileNameForLog,
    redactPersonForLog,
    redactEmailForLog,
    redactEmailsForLog,
    redactJsonSnippetForLog,
};
