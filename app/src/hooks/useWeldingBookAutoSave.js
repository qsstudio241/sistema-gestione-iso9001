/**
 * useWeldingBookAutoSave — bozza locale Welding Book (pattern NdtReports)
 */
import { useEffect, useCallback, useRef } from 'react';

const DRAFT_KEY_PREFIX = 'sgq:wb_draft:';
const DEBOUNCE_MS = 800;

export function useWeldingBookAutoSave(bookId, formData, equipment, welds) {
    const draftKey = DRAFT_KEY_PREFIX + (bookId || 'new');
    const timerRef = useRef(null);

    useEffect(() => {
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
            try {
                localStorage.setItem(draftKey, JSON.stringify({
                    savedAt: new Date().toISOString(),
                    formData,
                    equipment,
                    welds,
                }));
            } catch (_) { /* ignore */ }
        }, DEBOUNCE_MS);
        return () => { if (timerRef.current) clearTimeout(timerRef.current); };
    }, [draftKey, formData, equipment, welds]);

    const clearDraft = useCallback(() => {
        try { localStorage.removeItem(draftKey); } catch (_) { /* ignore */ }
    }, [draftKey]);

    return { clearDraft };
}
