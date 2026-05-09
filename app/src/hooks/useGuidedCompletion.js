/**
 * useGuidedCompletion — navigazione guidata ai campi obbligatori mancanti.
 *
 * Riceve:
 *   fieldDescriptors: Array<{ id, text, sectionId, fieldId, isMissing }>
 *   onNavigateTo: (sectionId, fieldId) => void  — callback dal layout padre
 *
 * Espone:
 *   missingFields     — solo i campi con isMissing === true
 *   currentIndex      — indice del campo corrente nella navigazione sequenziale
 *   navigateToFirst() — vai al primo campo mancante
 *   navigateToNext()  — vai al successivo (ciclico)
 *
 * Riusabile in qualsiasi pannello di verifica completezza:
 *   const { missingFields, navigateToFirst, navigateToNext, currentIndex } =
 *     useGuidedCompletion(fieldDescriptors, onNavigateTo);
 */
import { useState, useCallback, useMemo } from "react";

export function useGuidedCompletion(fieldDescriptors, onNavigateTo) {
  const [currentIndex, setCurrentIndex] = useState(0);

  const missingFields = useMemo(
    () => fieldDescriptors.filter((f) => f.isMissing),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(fieldDescriptors.map((f) => ({ id: f.id, isMissing: f.isMissing })))]
  );

  const navigateToFirst = useCallback(() => {
    if (!missingFields.length || !onNavigateTo) return;
    setCurrentIndex(0);
    const f = missingFields[0];
    onNavigateTo(f.sectionId, f.fieldId);
  }, [missingFields, onNavigateTo]);

  const navigateToNext = useCallback(() => {
    if (!missingFields.length || !onNavigateTo) return;
    const next = (currentIndex + 1) % missingFields.length;
    setCurrentIndex(next);
    const f = missingFields[next];
    onNavigateTo(f.sectionId, f.fieldId);
  }, [missingFields, currentIndex, onNavigateTo]);

  return { missingFields, currentIndex, navigateToFirst, navigateToNext };
}
