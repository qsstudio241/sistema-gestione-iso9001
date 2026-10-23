/** Messaggio visibile quando una lista non si ricarica. */
export function loadErrorMessage(err) {
  const status = err?.status;
  const code = err?.code;
  if (status === 429 || code === 'RATE_LIMIT_API' || code === 'RATE_LIMIT_AUTH') {
    return 'Troppe richieste, riprova tra poco';
  }
  return 'Non riesco a caricare i dati. Quelli già visti restano in pagina.';
}
