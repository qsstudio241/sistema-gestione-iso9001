/**
 * useGuidedCompletion — hook riusabile per navigazione guidata ai campi obbligatori mancanti.
 *
 * Riceve un array di descrittori di campo:
 *   { id, text, sectionId, fieldId, isMissing: boolean }
 *
 * Espone:
 *   - missingFields: array dei soli campi non compilati
 *   - currentIndex: indice del campo correntemente evidenziato (navigazione sequenziale)
 *   - navigateTo(sectionId, fieldId): salta a una sezione+campo specifici
 *   - navigateToNext(): avanza al prossimo campo mancante
 *   - navigateToCurrent(): ri-naviga al campo corrente
 *
 * Il hook usa l'evento DOM personalizzato `sgq:openAndScrollToSection`
 * intercettato da AuditAccordionLayout (e da qualsiasi altro layout che lo supporti).
 *
 * Pattern di utilizzo in qualsiasi pannello di chiusura/verifica:
 *   const { missingFields, navigateToNext, currentIndex } = useGuidedCompletion(fieldDescriptors);
 */
import { useState, useCallback } from "react";

function fireNavigationEvent(sectionId, fieldId) {
  window.dispatchEvent(
    new CustomEvent("sgq:openAndScrollToSection", {
      detail: { sectionId, fieldId },
    })
  );
}

export function useGuidedCompletion(fieldDescriptors) {
  const missingFields = fieldDescriptors.filter((f) => f.isMissing);
  const [currentIndex, setCurrentIndex] = useState(0);

  const navigateTo = useCallback((sectionId, fieldId) => {
    fireNavigationEvent(sectionId, fieldId);
  }, []);

  const navigateToCurrent = useCallback(() => {
    const field = missingFields[currentIndex];
    if (field) fireNavigationEvent(field.sectionId, field.fieldId);
  }, [missingFields, currentIndex]);

  const navigateToNext = useCallback(() => {
    if (missingFields.length === 0) return;
    const nextIndex = (currentIndex + 1) % missingFields.length;
    setCurrentIndex(nextIndex);
    const field = missingFields[nextIndex];
    if (field) fireNavigationEvent(field.sectionId, field.fieldId);
  }, [missingFields, currentIndex]);

  const navigateToFirst = useCallback(() => {
    if (missingFields.length === 0) return;
    setCurrentIndex(0);
    const field = missingFields[0];
    if (field) fireNavigationEvent(field.sectionId, field.fieldId);
  }, [missingFields]);

  return {
    missingFields,
    currentIndex,
    navigateTo,
    navigateToCurrent,
    navigateToNext,
    navigateToFirst,
  };
}
