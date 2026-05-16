/**
 * useGuidedCompletion — navigazione guidata ai campi obbligatori mancanti.
 *
 * Ogni field descriptor dichiara il proprio `path[]` completo verso il campo:
 *
 *   path: [
 *     { type: 'section',      key: 'general-data' },        // openSections
 *     { type: 'subsection',   key: 'general-data-form' },   // openSubSections
 *     { type: 'clauseExpand' },                             // ChecklistModule interno
 *     // aggiungere altri tipi per future strutture annidate
 *   ]
 *
 * Il parent (AuditAccordionLayout) riceve `onNavigateTo(path, fieldId)` e
 * apre in batch tutti i livelli dichiarati nel path, poi scrolla al fieldId.
 * Non importa quanti livelli ci siano — basta aggiungerli al path.
 *
 * fieldDescriptors: Array<{
 *   id, text, isMissing,
 *   fieldId,   — id DOM del campo target (es. "field-auditObject") o null
 *   path,      — Array<PathStep> — percorso completo per aprire il campo
 * }>
 *
 * onNavigateTo: (path: PathStep[], fieldId: string|null) => void
 */
import { useState, useCallback, useMemo } from "react";

export function useGuidedCompletion(fieldDescriptors, onNavigateTo) {
  const [currentIndex, setCurrentIndex] = useState(0);

  const missingFields = useMemo(
    () => fieldDescriptors.filter((f) => f.isMissing),
    // Ricalcola solo quando cambia quali campi sono missing (non ad ogni render)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(fieldDescriptors.map((f) => ({ id: f.id, isMissing: f.isMissing })))]
  );

  const navigateToFirst = useCallback(() => {
    if (!missingFields.length || !onNavigateTo) return;
    setCurrentIndex(0);
    const f = missingFields[0];
    onNavigateTo(f.path ?? [], f.fieldId ?? null);
  }, [missingFields, onNavigateTo]);

  const navigateToNext = useCallback(() => {
    if (!missingFields.length || !onNavigateTo) return;
    const next = (currentIndex + 1) % missingFields.length;
    setCurrentIndex(next);
    const f = missingFields[next];
    onNavigateTo(f.path ?? [], f.fieldId ?? null);
  }, [missingFields, currentIndex, onNavigateTo]);

  return { missingFields, currentIndex, navigateToFirst, navigateToNext };
}
