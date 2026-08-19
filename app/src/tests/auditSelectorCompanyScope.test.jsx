/**
 * Test L1 — AuditSelector: Ambito è l'unica fonte azienda.
 * Lo screenshot committente: tendina AZIENDA in pagina è ridondante.
 * Resta il menu Audit (filtrato da Ambito) e «Azienda auditata» (controparte).
 */
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const storageState = {
  audits: [],
  currentAudit: null,
  currentAuditId: null,
  switchAudit: vi.fn(),
  createAudit: vi.fn(),
  deleteAudit: vi.fn(),
  isSaving: false,
};

const scopeState = {
  companyId: "",
  scopeCompanyName: "Tutto lo studio",
  companies: [],
  isStudioPatrimonio: false,
};

vi.mock("../contexts/StorageContext", () => ({
  useStorage: () => storageState,
}));

vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({ user: { user_id: 1, organization_id: 1001, role: "admin" } }),
}));

vi.mock("../contexts/CompanyScopeContext", () => ({
  useCompanyScope: () => scopeState,
}));

const mockGetCustomChecklists = vi.hoisted(() => vi.fn());
const mockCheckReaudit = vi.hoisted(() => vi.fn());
const mockGetSuppliers = vi.hoisted(() => vi.fn());
const mockGetClientAuditHistory = vi.hoisted(() => vi.fn());
const mockGetNcResponses = vi.hoisted(() => vi.fn());

vi.mock("../services/apiService", () => ({
  default: {
    getCustomChecklists: (...args) => mockGetCustomChecklists(...args),
    checkReaudit: (...args) => mockCheckReaudit(...args),
    getSuppliers: (...args) => mockGetSuppliers(...args),
    getClientAuditHistory: (...args) => mockGetClientAuditHistory(...args),
    getNcResponses: (...args) => mockGetNcResponses(...args),
  },
}));

import AuditSelector from "../components/AuditSelector";

function makeAudit({ id, number, companyId, clientName, status = "in_progress" }) {
  return {
    id,
    metadata: {
      id,
      auditNumber: number,
      companyId,
      clientName,
      status,
      auditDate: "2026-08-01",
      selectedStandards: ["ISO_9001"],
    },
    checklist: {},
    metrics: { completionPercentage: 0 },
  };
}

const MASON = makeAudit({
  id: "a-mason",
  number: "2026-01",
  companyId: 11,
  clientName: "Mason Demo",
});
const ADMIN = makeAudit({
  id: "a-admin",
  number: "2026-02",
  companyId: 20,
  clientName: "Admin_test",
});
const ADMIN_CLOSED = makeAudit({
  id: "a-admin-closed",
  number: "2025-09",
  companyId: 20,
  clientName: "Admin_test",
  status: "completed",
});

describe("AuditSelector — Ambito al posto del filtro Azienda", () => {
  beforeEach(() => {
    mockGetCustomChecklists.mockResolvedValue({ data: [] });
    mockCheckReaudit.mockResolvedValue({ has_previous_audit: false, pending_count: 0 });
    mockGetSuppliers.mockResolvedValue({ data: [{ id: 99, name: "Fornitore XYZ" }] });
    mockGetClientAuditHistory.mockResolvedValue({ history: [] });
    mockGetNcResponses.mockResolvedValue({ responses: [] });
    storageState.audits = [MASON, ADMIN, ADMIN_CLOSED];
    storageState.currentAudit = null;
    storageState.currentAuditId = null;
    scopeState.companyId = "";
    scopeState.scopeCompanyName = "Tutto lo studio";
    scopeState.isStudioPatrimonio = false;
  });

  it("non mostra la tendina Azienda / Tutte le aziende", () => {
    render(<AuditSelector />);
    expect(screen.queryByLabelText(/^Azienda$/i)).toBeNull();
    expect(screen.queryByRole("option", { name: /Tutte le aziende/i })).toBeNull();
    expect(screen.getByLabelText(/^Audit$/i)).toBeInTheDocument();
  });

  it("Tutto lo studio: il menu Audit elenca tutte le aziende (aperte); chiusi dietro checkbox", async () => {
    const user = userEvent.setup();
    render(<AuditSelector />);
    const auditSelect = screen.getByLabelText(/^Audit$/i);
    expect(within(auditSelect).getByRole("option", { name: /2026-01 - Mason Demo/ })).toBeInTheDocument();
    expect(within(auditSelect).getByRole("option", { name: /2026-02 - Admin_test/ })).toBeInTheDocument();
    expect(within(auditSelect).queryByRole("option", { name: /2025-09/ })).toBeNull();

    await user.click(screen.getByLabelText(/Mostra audit completati/i));
    expect(within(auditSelect).getByRole("option", { name: /2025-09 - Admin_test/ })).toBeInTheDocument();
  });

  it("Ambito azienda: solo gli audit di quell'azienda", () => {
    scopeState.companyId = "20";
    scopeState.scopeCompanyName = "Admin_test";
    render(<AuditSelector />);
    const auditSelect = screen.getByLabelText(/^Audit$/i);
    expect(within(auditSelect).getByRole("option", { name: /2026-02 - Admin_test/ })).toBeInTheDocument();
    expect(within(auditSelect).queryByRole("option", { name: /Mason Demo/ })).toBeNull();
    expect(screen.getByLabelText(/Mostra audit completati/i)).toBeInTheDocument();
  });

  it("Ambito senza audit chiusi: la checkbox completati non compare", () => {
    scopeState.companyId = "11";
    scopeState.scopeCompanyName = "Mason Demo";
    render(<AuditSelector />);
    expect(screen.queryByLabelText(/Mostra audit completati/i)).toBeNull();
  });

  it("Tutto lo studio: Nuovo è disabilitato (gate Ambito)", () => {
    render(<AuditSelector />);
    expect(screen.getByRole("button", { name: /Nuovo/ })).toBeDisabled();
  });

  it("Ambito azienda: crea senza select tenant; resta Azienda auditata", async () => {
    const user = userEvent.setup();
    scopeState.companyId = "11";
    scopeState.scopeCompanyName = "Mason Demo";
    render(<AuditSelector />);

    const nuovo = screen.getByRole("button", { name: /Nuovo/ });
    expect(nuovo).toBeEnabled();
    await user.click(nuovo);

    expect(screen.queryByRole("option", { name: /Seleziona azienda/i })).toBeNull();
    expect(screen.getByLabelText("Azienda non modificabile")).toHaveValue("Mason Demo");

    await user.click(screen.getByRole("radio", { name: /Seconda parte/i }));
    expect(await screen.findByLabelText(/Azienda auditata/i)).toBeInTheDocument();
  });
});
