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
      const msg =
        (err instanceof ApiError && err.data && err.data.error) ||
        err.message ||
        'Errore AI';
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
