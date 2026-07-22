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

module.exports = { describeIngestFileError };
