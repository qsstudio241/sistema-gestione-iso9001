import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { waitFor } from "@testing-library/react";
import { getStandardByKey } from "../data/standardsRegistry";
import {
  abandonQuestionAiHistory,
  AI_PANEL_HISTORY_KEY,
  buildSuggestQuestionsPayload,
  claimQuestionAiHistory,
  formatQuestionAiError,
  pickStandardCodeForQuestionAi,
  releaseQuestionAiHistory,
  resetQuestionAiHistoryForTests,
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

  it("checklist custom senza norma non manda standardCode né inventa 9001", () => {
    expect(pickStandardCodeForQuestionAi(null, {}, "custom")).toBeNull();
    expect(pickStandardCodeForQuestionAi(null, { standardCode: "custom" }, "custom")).toBeNull();
    const payload = buildSuggestQuestionsPayload({
      id: "c1",
      text: "Avete il registro?",
      clauseRef: "A.1",
      checklistKey: "custom",
    });
    expect(payload.question.standardCode).toBeUndefined();
    expect(payload.question.standardLabel).toBeUndefined();
    const blob = JSON.stringify(payload);
    expect(blob).not.toContain("custom");
    expect(blob).not.toContain("ISO_9001");
  });

  it("checklist custom con norma dedotta manda il codice con anno", () => {
    expect(pickStandardCodeForQuestionAi("ISO_14001", {}, "custom")).toBe("ISO_14001_2015");
    const payload = buildSuggestQuestionsPayload(
      { id: "c1", text: "x", clauseRef: "A.1", checklistKey: "custom" },
      { standardCode: "ISO_14001" }
    );
    expect(payload.question.standardCode).toBe("ISO_14001_2015");
  });
});

describe("questionAi history — una sola voce", () => {
  beforeEach(() => {
    resetQuestionAiHistoryForTests();
    window.history.replaceState({}, "", window.location.href);
  });

  afterEach(() => {
    resetQuestionAiHistoryForTests();
  });

  it("il secondo claim riusa la stessa voce con la nuova domanda", () => {
    claimQuestionAiHistory("q1");
    const afterFirst = window.history.length;
    expect(window.history.state[AI_PANEL_HISTORY_KEY]).toBe("q1");
    claimQuestionAiHistory("q2");
    expect(window.history.length).toBe(afterFirst);
    expect(window.history.state[AI_PANEL_HISTORY_KEY]).toBe("q2");
  });

  it("release toglie la voce e Indietro non lascia il marker", async () => {
    const before = window.history.length;
    claimQuestionAiHistory("q1");
    expect(window.history.length).toBeGreaterThan(before);
    const popped = releaseQuestionAiHistory("q1");
    expect(popped).toBe(true);
    await waitFor(() => {
      expect(window.history.state?.[AI_PANEL_HISTORY_KEY]).toBeFalsy();
    });
  });

  it("unmount (abandon) toglie la voce nello stesso tick successivo", async () => {
    claimQuestionAiHistory("q1");
    expect(window.history.state[AI_PANEL_HISTORY_KEY]).toBe("q1");
    abandonQuestionAiHistory("q1");
    await waitFor(() => {
      expect(window.history.state?.[AI_PANEL_HISTORY_KEY]).toBeFalsy();
    });
  });

  it("unmount di una domanda non toglie la voce se un'altra l'ha già reclamata", async () => {
    claimQuestionAiHistory("q1");
    abandonQuestionAiHistory("q1");
    claimQuestionAiHistory("q2");
    await Promise.resolve();
    expect(window.history.state[AI_PANEL_HISTORY_KEY]).toBe("q2");
  });
});
