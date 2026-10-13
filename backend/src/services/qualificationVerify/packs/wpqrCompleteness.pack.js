/**
 * wpqrCompleteness.pack.js — famiglia «completezza» WPQR (15614-1 BW/FW/UNKNOWN, 15614-2, 14555). Piano: PLAN_VERIFICA_WPQR_SLICES.md § 5.1 (WV-5a).
 * Stub (WV-1): nessuna regola; la slice dell'onda 2 sovrascrive SOLO questo file.
 * Codici dei finding: prefisso `WPQR15614_1.COMP.*`, `WPQR15614_2.COMP.*`, `WPQR14555.COMP.*` (unico globalmente).
 */

'use strict';

module.exports = {
    id: 'wpqr.completeness',
    standardFamily: '15614-1',
    editions: ['2017', '2017+A1:2019'],
    profiles: ['15614-1:BW', '15614-1:FW', '15614-1:UNKNOWN', '15614-2:BW', '15614-2:FW', '14555:SW'],
    rules: [],
};
