/**
 * Merge backlog Libreria: snapshot piattaforma + richieste Assistente (server).
 * Le richieste le propone solo l'AI — niente form utente / localStorage studio.
 */

import { libraryGapCodesMatch } from "./libraryGapDeepLink";

const DIGITIZED = new Set(["digitalizzata", "digitized"]);

/**
 * True se lo snapshot piattaforma ha già una riga digitalizzata che matcha il codice
 * (es. «ISO 15614-1:2017» vs «ISO 15614-1:2017+A1:2019 (…)»).
 */
export function isSatisfiedByPlatformDigitized(platformItems, code) {
  return (platformItems || []).some(
    (p) =>
      DIGITIZED.has(String(p?.status || "").toLowerCase()) &&
      libraryGapCodesMatch(p?.code, code)
  );
}

/**
 * Unisce richieste server (Assistente) e snapshot piattaforma.
 * - Gap AI ancora aperti ma già digitalizzati in piattaforma → nascosti (evita «Da richiedere» fantasma).
 * - Dedup fuzzy: se c'è riga Assistente, non duplicare la stessa voce piattaforma.
 */
export function mergeAiAndPlatformBacklog(platformItems, serverRows) {
  const platform = Array.isArray(platformItems) ? platformItems : [];
  const server = (Array.isArray(serverRows) ? serverRows : []).filter(Boolean);

  const visibleServer = server.filter((row) => {
    // Se lo snapshot piattaforma ha già digitalizzato lo stesso codice
    // (anche con edizione/A1 diverso), non mostrare il gap AI — aperto o chiuso.
    if (isSatisfiedByPlatformDigitized(platform, row.code)) {
      return false;
    }
    return true;
  });

  const platformMapped = platform.map((row) => ({
    ...row,
    source: "piattaforma",
    id: row.id || `plat-${row.code}`,
  }));

  const filteredPlatform = platformMapped.filter((p) => {
    return !visibleServer.some((s) => libraryGapCodesMatch(s.code, p.code));
  });

  return [...visibleServer, ...filteredPlatform];
}

/** @deprecated alias — preferire mergeAiAndPlatformBacklog */
export function mergeBacklogRows(platformItems, _studioItemsIgnored) {
  return mergeAiAndPlatformBacklog(platformItems, []);
}
