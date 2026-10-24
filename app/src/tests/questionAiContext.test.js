import { describe, it, expect } from "vitest";
import { getStandardByKey } from "../data/standardsRegistry";
import {
  buildSuggestQuestionsPayload,
  formatQuestionAiError,
  resolveStandardCodeForQuestionAi,
  SUGGEST_QUESTIONS_MODE,
} from "../utils/questionAiContext";

describe("questionAiContext", () => {
  it("risolve ISO_9001 verso il codice con anno", () => {
    expect(getStandardByKey("ISO_9001")?.codes).toContain("ISO_9001_2015");
    expect(resolveStandardCodeForQuestionAi("ISO_9001")).toBe("ISO_9001_2015");
  });

  it("il payload Fase 1 non contiene azienda, P.IVA né allegati", () => {
    const payload = buildSuggestQuestionsPayload({
      id: "q1",
      text: "Come gestite le risorse?",
      clauseRef: "7.1.2",
      status: "C",
      notes: "Organigramma ok",
      checklistKey: "ISO_9001",
      vat_number: "IT123",
      companyName: "Rossi",
    });
    expect(payload.mode).toBe(SUGGEST_QUESTIONS_MODE);
    expect(payload.question.standardCode).toBe("ISO_9001_2015");
    expect(payload.question.currentStatus).toBe("C");
    expect(payload.question.notes).toBe("Organigramma ok");
    expect(payload).not.toHaveProperty("attachments");
    expect(payload).not.toHaveProperty("auditContext");
    const blob = JSON.stringify(payload);
    expect(blob).not.toContain("IT123");
    expect(blob).not.toContain("Rossi");
    expect(blob).not.toContain("company");
  });

  it("traduce gli errori AI in italiano chiaro", () => {
    expect(formatQuestionAiError({ code: "AI_NOT_CONFIGURED", status: 503 })).toMatch(
      /non disponibile/i
    );
    expect(formatQuestionAiError({ code: "RATE_LIMIT_AI", status: 429 })).toMatch(/Troppe/);
    expect(formatQuestionAiError({ code: "NETWORK_ERROR" })).toMatch(/connessione/i);
    expect(formatQuestionAiError({ status: 403 })).toMatch(/non è attivo/i);
  });
});
