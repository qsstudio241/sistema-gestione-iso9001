import { useState, useCallback } from 'react';
import apiService, { ApiError } from '../services/apiService';

export function useAiAssist() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [suggestion, setSuggestion] = useState(null);

  const suggest = useCallback(async (feature, context) => {
    setLoading(true);
    setError(null);
    setSuggestion(null);
    try {
      const result = await apiService.aiSuggest(feature, context);
      setSuggestion(result.suggestion);
      return result.suggestion;
    } catch (err) {
      let msg =
        (err instanceof ApiError && err.data && err.data.error) ||
        err.message ||
        'Errore AI';
      if (err instanceof ApiError && err.status === 429) {
        const waitSec = err.data?.retryAfterMs
          ? Math.ceil(err.data.retryAfterMs / 1000)
          : null;
        msg = waitSec
          ? `Troppe richieste al server. Attendi circa ${waitSec} secondi e riprova.`
          : 'Troppe richieste al server. Chiudi schede duplicate, attendi qualche minuto e riprova.';
      }
      setError(msg);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const clear = useCallback(() => {
    setSuggestion(null);
    setError(null);
  }, []);

  return { suggest, suggestion, loading, error, clear };
}
