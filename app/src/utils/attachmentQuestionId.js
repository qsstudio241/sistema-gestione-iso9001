/**
 * Converte questionId checklist in ID numerico per API /attachments (colonna question_id INT).
 * Il backend accetta solo interi checklist_questions.question_id.
 * Stringhe tipo "87" → 87; riferimenti clausola tipo "7.5.3" → undefined (non sono ID DB).
 */
export function toNumericChecklistQuestionId(questionId) {
  if (questionId == null || questionId === "") return undefined;
  if (typeof questionId === "number" && Number.isFinite(questionId) && questionId > 0) {
    return questionId;
  }
  const s = String(questionId).trim();
  if (/^\d+$/.test(s)) {
    const n = parseInt(s, 10);
    return n > 0 ? n : undefined;
  }
  return undefined;
}
