/**
 * clientLogger — wrapper logging frontend
 *
 * In produzione (import.meta.env.PROD) console.log/debug/info sono già
 * eliminati da Vite (define no-op). Questo modulo offre un'alternativa
 * esplicita per i nuovi moduli: usare logger.log invece di console.log
 * rende chiaro l'intento e facilita la rimozione futura.
 *
 * console.warn e console.error sono sempre attivi (visibilità errori reali).
 *
 * Utilizzo:
 *   import { logger } from '../utils/clientLogger';
 *   logger.log('...'); // silenzioso in produzione
 *   logger.error('...'); // sempre visibile
 */

const noop = () => {};
const isDev = import.meta.env.DEV;

export const logger = {
    log:   isDev ? console.log.bind(console)   : noop,
    debug: isDev ? console.debug.bind(console) : noop,
    info:  isDev ? console.info.bind(console)  : noop,
    warn:  console.warn.bind(console),
    error: console.error.bind(console),
    group: isDev ? console.group?.bind(console)   ?? noop : noop,
    groupEnd: isDev ? console.groupEnd?.bind(console) ?? noop : noop,
    time:  isDev ? console.time?.bind(console)   ?? noop : noop,
    timeEnd: isDev ? console.timeEnd?.bind(console) ?? noop : noop,
};
