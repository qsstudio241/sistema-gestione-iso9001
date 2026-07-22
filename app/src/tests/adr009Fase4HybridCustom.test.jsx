/**
 * ADR-009 Fase 4 — Checklist personalizzata come "norma virtuale" pari grado.
 *
 * Verifica che audit IBRIDI (ISO + checklist personalizzata insieme) mostrino
 * un blocco/tab separato per la checklist custom nella Sezione 11 (Rilievi) e
 * Sezione 12 (Conclusioni), senza alterare il comportamento di audit mono-ISO
 * o mono-custom (pre-esistenti, invarianti).
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import AuditOutcomeSection from "../components/AuditOutcomeSection";

const mockUseStorage = vi.fn();
vi.mock("../contexts/StorageContext", () => ({
  useStorage: () => mockUseStorage(),
}));
vi.mock("../contexts/RouterContext", () => ({
  useNavigate: () => () => {},
}));
vi.mock("../services/apiService", () => ({
  default: { get: vi.fn().mockResolvedValue({ data: [] }) },
}));

const hybridAudit = {
  metadata: { customChecklistId: 42, id: "audit-uuid-1" },
  checklist: {
    ISO_9001: {
      clause4: { questions: [{ status: "C", questionId: 1 }, { status: "NC", questionId: 2 }] },
    },
  },
  customChecklist: { id: 42, name: "Verbale Visita Mason", has_outcome_buttons: true },
  customStatuses: { 10: "OSS", 11: "C" },
};

const monoIsoAudit = {
  metadata: { id: "audit-uuid-2" },
  checklist: {
    ISO_9001: {
      clause4: { questions: [{ status: "C", questionId: 1 }] },
    },
  },
  customChecklist: null,
  customStatuses: {},
};

function renderOutcome(audit, props = {}) {
  mockUseStorage.mockReturnValue({ currentAudit: audit });
  return render(
    <AuditOutcomeSection
      auditOutcome={audit.metadata.auditOutcome || {}}
      onUpdate={vi.fn()}
      selectedStandards={Object.keys(audit.checklist || {})}
      {...props}
    />
  );
}

describe("AuditOutcomeSection — ADR-009 Fase 4 (audit ibrido ISO+custom)", () => {
  it("Sezione 11: mostra un blocco separato per la checklist personalizzata quando ibrido", () => {
    renderOutcome(hybridAudit, { showConclusions: false });
    expect(screen.getByText(/Verbale Visita Mason/)).toBeInTheDocument();
  });

  it("Sezione 12: mostra una textarea Conclusioni dedicata alla checklist personalizzata quando ibrido", () => {
    renderOutcome(hybridAudit, { showConclusions: true });
    expect(document.getElementById("conclusions-custom")).toBeTruthy();
  });

  it("audit mono-ISO senza custom: nessun blocco/tab custom (comportamento invariato)", () => {
    renderOutcome(monoIsoAudit, { showConclusions: false });
    expect(screen.queryByText(/Verbale Visita Mason/)).not.toBeInTheDocument();
  });

  it("audit mono-ISO senza custom: Sezione 12 non ha textarea custom (comportamento invariato)", () => {
    renderOutcome(monoIsoAudit, { showConclusions: true });
    expect(document.getElementById("conclusions-custom")).toBeFalsy();
    expect(document.getElementById("conclusions")).toBeTruthy();
  });
});
