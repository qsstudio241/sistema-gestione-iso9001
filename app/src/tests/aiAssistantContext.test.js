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
  });
});
