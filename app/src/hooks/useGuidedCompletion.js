/**
 * useGuidedCompletion — navigazione guidata ai campi obbligatori mancanti.
 *
 * fieldDescriptors: Array<{
 *   id, text, isMissing,
 *   sectionId,    — chiave openSections (es. "general-data")
 *   subSectionId, — chiave openSubSections (es. "general-data-form") o null
 *   fieldId,      — id DOM del campo (es. "field-auditObject") o null
 * }>
 *
 * onNavigateTo: (sectionId, subSectionId, fieldId) => void
 */
import { useState, useCallback, useMemo } from "react";

export function useGuidedCompletion(fieldDescriptors, onNavigateTo) {
  const [currentIndex, setCurrentIndex] = useState(0);

  const missingFields = useMemo(
    () => fieldDescriptors.filter((f) => f.isMissing),
    // Ricalcola solo quando cambia quali campi sono missing
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(fieldDescriptors.map((f) => ({ id: f.id, isMissing: f.isMissing })))]
  );

  const navigateToFirst = useCallback(() => {
    if (!missingFields.length || !onNavigateTo) return;
    setCurrentIndex(0);
    const f = missingFields[0];
    onNavigateTo(f.sectionId, f.subSectionId ?? null, f.fieldId ?? null);
  }, [missingFields, onNavigateTo]);

  const navigateToNext = useCallback(() => {
    if (!missingFields.length || !onNavigateTo) return;
    const next = (currentIndex + 1) % missingFields.length;
    setCurrentIndex(next);
    const f = missingFields[next];
    onNavigateTo(f.sectionId, f.subSectionId ?? null, f.fieldId ?? null);
  }, [missingFields, currentIndex, onNavigateTo]);

  return { missingFields, currentIndex, navigateToFirst, navigateToNext };
}
