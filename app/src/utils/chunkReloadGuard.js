/**
 * Guardia anti "chunk obsoleto dopo deploy Netlify".
 *
 * Con Vite/Rollup ogni asset ha un hash nel nome (es. NCPage-abc123.js).
 * Se un utente ha una tab già aperta quando Netlify pubblica un nuovo deploy,
 * il bundle principale già caricato in memoria continua a puntare ai vecchi
 * hash: un successivo React.lazy() o import() dinamico su quella pagina
 * cerca di scaricare un file che il nuovo deploy ha già sovrascritto e
 * fallisce con "Failed to fetch dynamically imported module" (o varianti
 * equivalenti nei diversi browser).
 *
 * Non è un bug applicativo: la correzione corretta è ricaricare la pagina
 * una volta per ottenere l'`index.html` e i chunk aggiornati. La guardia
 * anti-loop (sessionStorage) evita ricariche infinite se il problema
 * persistesse per un motivo diverso (es. asset realmente rimosso/rotto).
 */

const RELOAD_FLAG_KEY = "sgq_chunk_reload_attempt_at";
const RELOAD_GUARD_WINDOW_MS = 30000;

const CHUNK_ERROR_PATTERN =
  /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|ChunkLoadError/i;

function extractMessage(error) {
  if (!error) return "";
  if (typeof error === "string") return error;
  return error.message || error.reason?.message || String(error);
}

export function isChunkLoadError(error) {
  return CHUNK_ERROR_PATTERN.test(extractMessage(error));
}

function hasAttemptedReloadRecently() {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_FLAG_KEY) || 0);
    return Date.now() - last < RELOAD_GUARD_WINDOW_MS;
  } catch {
    // sessionStorage non disponibile (privacy mode, ecc.): non bloccare il tentativo
    return false;
  }
}

function markReloadAttempt() {
  try {
    sessionStorage.setItem(RELOAD_FLAG_KEY, String(Date.now()));
  } catch {
    // ignora: storage non disponibile
  }
}

/**
 * Se l'errore è un chunk obsoleto e non abbiamo già ricaricato di recente,
 * forza un reload della pagina e ritorna true. Altrimenti ritorna false
 * (errore diverso, oppure ricarica già tentata senza successo: evita loop).
 */
export function reloadIfChunkError(error) {
  if (!isChunkLoadError(error)) return false;
  if (hasAttemptedReloadRecently()) return false;
  markReloadAttempt();
  window.location.reload();
  return true;
}
