/**
 * Indicatori file allegato — Registro Documenti (catalogo / priorità).
 */

export function documentHasFile(doc) {
    if (!doc) return false;
    if (doc.has_file === true || doc.has_file === 1) return true;
    if (doc.has_file === false || doc.has_file === 0) return false;
    return Boolean(doc.current_file_name);
}

/** Etichetta breve per colonna catalogo e card mobile. */
export function formatDocumentFileLabel(doc) {
    if (!documentHasFile(doc)) {
        return { short: 'Manca file', title: 'Nessun file allegato caricato' };
    }
    const name = doc.current_file_name || 'File allegato';
    const short = name.length > 28 ? `${name.slice(0, 25)}…` : name;
    return { short, title: name };
}

/** Documenti rilasciati/vigenti senza allegato — utili in tab Priorità. */
export function isReleasedWithoutFile(doc) {
    if (!doc || documentHasFile(doc)) return false;
    const st = doc.status;
    return st === 'rilasciato' || st === 'vigente';
}
