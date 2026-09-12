import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  filterStandardsForUser,
  resolveAutoStandardFromAudit,
  resolveAutoCompanyFromAudit,
  saveChecklistFocus,
  loadChecklistFocus,
  resolveActiveChecklistFocus,
  buildAuditContextSeparatorLabel,
  buildAiChatContextPayload,
  collectQuestionAttachments,
  buildChecklistAskAiFocus,
  isLegalComplianceStandard,
  inferLegalChecklistStandardKey,
  inferStandardKeyFromAudit,
  isWpsCoverageRequest,
  extractWpsRequestFromText,
  applyWpsAnswersToRequest,
  formatWpsNeedInputMessage,
  formatWpsGenerateResultMessage,
  toGenerateWpsApiPayload,
  WPS_GENERATE_MASON_CHIP,
} from "../utils/aiAssistantContext";

describe("aiAssistantContext", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("filterStandardsForUser returns all when allowed is null", () => {
    const all = filterStandardsForUser(null);
    expect(all.length).toBeGreaterThan(0);
    expect(all.some((e) => e.key === "ISO_9001")).toBe(true);
  });

  it("filterStandardsForUser respects allowed_standard_ids", () => {
    const filtered = filterStandardsForUser([1, 2]);
    expect(filtered.every((e) => [1, 2].includes(e.standardId))).toBe(true);
    expect(filtered.some((e) => e.key === "ISO_45001")).toBe(false);
  });

  it("resolveAutoStandardFromAudit picks first selected standard", () => {
    const auto = resolveAutoStandardFromAudit(["ISO_14001_2015", "ISO_9001"]);
    expect(auto).toEqual({
      standardId: 2,
      key: "ISO_14001",
      label: "14001",
    });
  });

  it("resolveAutoStandardFromAudit returns null for empty selection", () => {
    expect(resolveAutoStandardFromAudit([])).toBeNull();
    expect(resolveAutoStandardFromAudit(undefined)).toBeNull();
  });

  it("resolveAutoCompanyFromAudit reads company from audit metadata", () => {
    const audit = {
      metadata: { companyId: 42, clientName: "Acme" },
    };
    const companies = [{ id: 42, name: "Acme Srl" }];
    expect(resolveAutoCompanyFromAudit(audit, companies)).toEqual({
      companyId: 42,
      companyName: "Acme Srl",
    });
  });

  it("saveChecklistFocus and loadChecklistFocus round-trip", () => {
    saveChecklistFocus("audit-uuid-1", {
      standardKey: "ISO_9001",
      clauseRef: "7.5",
      questionId: "q1",
      questionText: "Documentazione",
    });
    expect(loadChecklistFocus("audit-uuid-1")).toMatchObject({
      clauseRef: "7.5",
      questionId: "q1",
    });
  });

  it("resolveActiveChecklistFocus prefers sessionStorage focus", () => {
    saveChecklistFocus("a1", {
      standardKey: "ISO_9001",
      clauseRef: "8.4",
      questionId: "2",
      questionText: "Fornitori",
    });
    const audit = {
      id: "a1",
      checklist: {
        ISO_9001: {
          "4.1": { questions: [{ id: "1", status: "NON_COMPLIANT" }] },
        },
      },
    };
    expect(resolveActiveChecklistFocus(audit)?.clauseRef).toBe("8.4");
  });

  it("buildAuditContextSeparatorLabel includes clause when present", () => {
    const label = buildAuditContextSeparatorLabel({
      companyName: "Beta",
      standardLabel: "9001",
      focus: { clauseRef: "7.5", questionId: "3" },
    });
    expect(label).toContain("Beta");
    expect(label).toContain("Clausola:");
    expect(label).toContain("7.5");
  });

  it("buildAiChatContextPayload merges audit fields", () => {
    const audit = {
      id: "uuid-99",
      metadata: {
        id: "uuid-99",
        selectedStandards: ["ISO_9001_2015"],
        companyId: 10,
        auditNumber: "A-2026-01",
      },
      checklist: {},
    };
    const payload = buildAiChatContextPayload(audit, [{ id: 10, name: "Cliente X" }]);
    expect(payload.standardId).toBe(1);
    expect(payload.companyId).toBe(10);
    expect(payload.auditId).toBe("uuid-99");
    expect(payload.attachments).toEqual([]);
  });

  it("collectQuestionAttachments filtra per domanda e custom item", () => {
    const audit = {
      attachments: [
        { questionId: 135, name: "AUA_2024.pdf", category: "documenti", serverAttachmentId: 77, mimeType: "application/pdf" },
        { questionId: 99, name: "altro.pdf", serverAttachmentId: 78 },
        { customItemId: 20, name: "DVR.pdf", category: "documenti", serverAttachmentId: 79 },
      ],
    };
    expect(collectQuestionAttachments(audit, { numericQuestionId: 135 })).toEqual([
      { id: 77, name: "AUA_2024.pdf", category: "documenti", mimeType: "application/pdf" },
    ]);
    expect(collectQuestionAttachments(audit, { questionId: "q135", numericQuestionId: 135 })[0].name).toBe("AUA_2024.pdf");
    expect(collectQuestionAttachments(audit, { customItemId: 20 })[0].name).toBe("DVR.pdf");
    expect(collectQuestionAttachments(audit, { questionId: "manca" })).toEqual([]);
  });

  it("saveChecklistFocus persiste allegati e legalFocus 14001", () => {
    saveChecklistFocus("audit-leg", {
      standardKey: "ISO_14001",
      clauseRef: "16",
      questionId: "q136",
      questionText: "AIA e IPPC",
      numericQuestionId: 136,
      legalFocus: true,
      attachments: [{ id: 77, name: "AUA_2024.pdf", category: "documenti" }],
    });
    expect(loadChecklistFocus("audit-leg")).toMatchObject({
      clauseRef: "16",
      legalFocus: true,
      numericQuestionId: 136,
      attachments: [expect.objectContaining({ name: "AUA_2024.pdf", id: 77 })],
    });
  });

  it("buildChecklistAskAiFocus e payload includono clausola + allegati", () => {
    const audit = {
      id: "a-14001",
      metadata: {
        id: "a-14001",
        auditId: 55,
        selectedStandards: ["ISO_14001_2015"],
        companyId: 10,
      },
      attachments: [
        { questionId: 136, name: "AUA_2024.pdf", serverAttachmentId: 77, category: "documenti" },
      ],
      checklist: {},
    };
    const focus = buildChecklistAskAiFocus({
      audit,
      standardKey: "ISO_14001",
      clauseRef: "16",
      questionId: "q136",
      questionText: "AIA e IPPC",
      numericQuestionId: 136,
    });
    expect(focus.legalFocus).toBe(true);
    expect(focus.attachments).toHaveLength(1);
    saveChecklistFocus("a-14001", focus);
    const payload = buildAiChatContextPayload(audit, [{ id: 10, name: "Cliente X" }]);
    expect(payload.clauseRef).toBe("16");
    expect(payload.standardKey).toBe("ISO_14001");
    expect(payload.attachments[0].name).toBe("AUA_2024.pdf");
    expect(payload.legalFocus).toBe(true);
    expect(payload.auditNumericId).toBe(55);
  });

  it("Ask AI senza allegati: payload resta valido (niente evidenze inventate)", () => {
    saveChecklistFocus("a-empty", {
      standardKey: "ISO_9001",
      clauseRef: "7.5",
      questionId: "q1",
      questionText: "Documentazione",
    });
    const audit = { id: "a-empty", metadata: { id: "a-empty" }, checklist: {}, attachments: [] };
    const payload = buildAiChatContextPayload(audit, []);
    expect(payload.clauseRef).toBe("7.5");
    expect(payload.attachments).toEqual([]);
    expect(payload.legalFocus).toBe(false);
  });

  it("isLegalComplianceStandard e marker registro legale", () => {
    expect(isLegalComplianceStandard("ISO_45001")).toBe(true);
    expect(isLegalComplianceStandard("ISO_45000")).toBe(true);
    expect(isLegalComplianceStandard("ISO_9001")).toBe(false);
    expect(inferLegalChecklistStandardKey({
      description: "[SGQ_TEMPLATE:LEG_AMBIENTE_152] matrice",
    })).toBe("ISO_14001");
    expect(inferLegalChecklistStandardKey({
      description: "[SGQ_TEMPLATE:LEG_SICUREZZA_81] registro",
    })).toBe("ISO_45001");
    expect(inferStandardKeyFromAudit({
      metadata: { selectedStandards: ["ISO_45001_2018"] },
    })).toBe("ISO_45001");
  });
});

describe("P4 WPS coverage orchestration helpers", () => {
  it("isWpsCoverageRequest riconosce chip Mason e richieste copertura", () => {
    expect(isWpsCoverageRequest(WPS_GENERATE_MASON_CHIP)).toBe(true);
    expect(isWpsCoverageRequest("Verifica copertura WPQR per questo giunto")).toBe(true);
    expect(isWpsCoverageRequest("Quante NC aperte?")).toBe(false);
  });

  it("extractWpsRequestFromText sul caso Mason", () => {
    const r = extractWpsRequestFromText(WPS_GENERATE_MASON_CHIP);
    expect(r.joint_type).toBe("FW");
    expect(r.parent_material_a).toMatch(/S355/i);
    expect(r.parent_material_b).toMatch(/S235/i);
    expect(r.thickness_a_mm).toBe("10");
    expect(r.thickness_b_mm).toBe("5");
  });

  it("applyWpsAnswersToRequest completa materiali mancanti", () => {
    const next = applyWpsAnswersToRequest(
      { joint_type: "FW", thickness_a_mm: "10", thickness_b_mm: "5" },
      "materiali S355 e S235",
      [
        { field: "parent_material_a", question: "A?" },
        { field: "parent_material_b", question: "B?" },
      ]
    );
    expect(next.parent_material_a).toMatch(/S355/i);
    expect(next.parent_material_b).toMatch(/S235/i);
  });

  it("formatWpsNeedInputMessage elenca le domande", () => {
    const msg = formatWpsNeedInputMessage([
      { field: "parent_material_a", question: "Qual \u00e8 il materiale A?" },
    ]);
    expect(msg).toMatch(/non li invento/i);
    expect(msg).toMatch(/materiale A/i);
  });

  it("formatWpsGenerateResultMessage per not_possible", () => {
    const msg = formatWpsGenerateResultMessage({
      status: "not_possible",
      extensions_needed: ["Nessuna WPQR copre il gruppo"],
      warnings: [],
    });
    expect(msg).toMatch(/Non risulta realizzabile/i);
    expect(msg).toMatch(/Nessuna WPQR/);
  });

  it("toGenerateWpsApiPayload converte spessori in numeri", () => {
    expect(toGenerateWpsApiPayload({
      joint_type: "FW",
      parent_material_a: "S355",
      parent_material_b: "S235",
      thickness_a_mm: "10",
      thickness_b_mm: "5",
    }, 42)).toEqual({
      joint_type: "FW",
      parent_material_a: "S355",
      parent_material_b: "S235",
      thickness_a_mm: 10,
      thickness_b_mm: 5,
      company_id: 42,
    });
  });
});
