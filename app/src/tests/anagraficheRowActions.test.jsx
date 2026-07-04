/**
 * Test L1 — AnagrafichePage azioni di riga a icone
 *
 * Verifica che le tab Fornitori e Reparti espongano i pulsanti icona SVG
 * (matita = modifica, cestino = elimina) con aria-label corretto,
 * e che non siano presenti pulsanti emoji testuali.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import AnagrafichePage from "../pages/AnagrafichePage";

const mockGetSuppliers           = vi.fn();
const mockGetDepartments         = vi.fn();
const mockGetSupplierEvaluations = vi.fn();
const mockDeleteSupplier         = vi.fn();
const mockDeleteDepartment       = vi.fn();

vi.mock("../services/apiService", () => ({
  default: {
    getSuppliers:           (...a) => mockGetSuppliers(...a),
    getDepartments:         (...a) => mockGetDepartments(...a),
    getSupplierEvaluations: (...a) => mockGetSupplierEvaluations(...a),
    deleteSupplier:         (...a) => mockDeleteSupplier(...a),
    deleteDepartment:       (...a) => mockDeleteDepartment(...a),
    updateSupplier:         vi.fn().mockResolvedValue({}),
    updateDepartment:       vi.fn().mockResolvedValue({}),
    createSupplier:         vi.fn().mockResolvedValue({}),
    createDepartment:       vi.fn().mockResolvedValue({}),
  },
}));

const ONE_SUPPLIER = {
  id: 1,
  name: "Fornitore Alpha Srl",
  supplier_type: "external",
  code: "SUP-001",
  category: "Materie prime",
  contact_person: "Mario Rossi",
  is_qualified: true,
  last_score: 4,
  complaints_count: 0,
};

const ONE_DEPARTMENT = {
  id: 10,
  name: "Reparto Produzione",
  code: "PROD",
  parent_id: null,
  parent_name: null,
  manager_name: "Luca Bianchi",
  complaints_count: 0,
  is_active: true,
};

describe("AnagrafichePage — Tab Fornitori — azioni di riga a icone", () => {
  beforeEach(() => {
    mockGetSuppliers.mockReset().mockResolvedValue({ data: [ONE_SUPPLIER] });
    mockGetDepartments.mockReset().mockResolvedValue({ data: [ONE_DEPARTMENT] });
    mockGetSupplierEvaluations.mockReset().mockResolvedValue({ data: [] });
    mockDeleteSupplier.mockReset().mockResolvedValue({});
    mockDeleteDepartment.mockReset().mockResolvedValue({});
  });

  it("mostra il pulsante matita con aria-label e SVG nel tab Fornitori", async () => {
    render(<AnagrafichePage />);

    const pencilBtn = await screen.findByRole("button", { name: "Modifica fornitore" });
    expect(pencilBtn).toBeInTheDocument();
    expect(pencilBtn.querySelector("svg")).toBeTruthy();
    expect(pencilBtn.title).toBe("Modifica fornitore");
  });

  it("mostra il pulsante cestino con aria-label e SVG nel tab Fornitori", async () => {
    render(<AnagrafichePage />);

    const trashBtn = await screen.findByRole("button", { name: "Elimina fornitore" });
    expect(trashBtn).toBeInTheDocument();
    expect(trashBtn.querySelector("svg")).toBeTruthy();
    expect(trashBtn.title).toBe("Elimina fornitore");
  });

  it("non espone pulsanti emoji ?? o  nel tab Fornitori", async () => {
    render(<AnagrafichePage />);
    await screen.findByRole("button", { name: "Modifica fornitore" });

    const allButtons = screen.getAllByRole("button");
    const emojiEdit  = allButtons.find(b => b.textContent.includes("\u270F") || b.textContent.includes("??"));
    const emojiTrash = allButtons.find(b => /\uD83D\uDDD1/.test(b.textContent));
    expect(emojiEdit).toBeUndefined();
    expect(emojiTrash).toBeUndefined();
  });

  it("il cestino fornitore chiama deleteSupplier dopo conferma", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<AnagrafichePage />);

    const trashBtn = await screen.findByRole("button", { name: "Elimina fornitore" });
    fireEvent.click(trashBtn);

    await waitFor(() => {
      expect(mockDeleteSupplier).toHaveBeenCalledWith(1);
    });
    confirmSpy.mockRestore();
  });
});

describe("AnagrafichePage — Tab Reparti — azioni di riga a icone", () => {
  beforeEach(() => {
    mockGetSuppliers.mockReset().mockResolvedValue({ data: [ONE_SUPPLIER] });
    mockGetDepartments.mockReset().mockResolvedValue({ data: [ONE_DEPARTMENT] });
    mockGetSupplierEvaluations.mockReset().mockResolvedValue({ data: [] });
    mockDeleteSupplier.mockReset().mockResolvedValue({});
    mockDeleteDepartment.mockReset().mockResolvedValue({});
  });

  it("mostra pulsante matita con aria-label e SVG nel tab Reparti", async () => {
    render(<AnagrafichePage />);

    const tabReparti = screen.getByRole("button", { name: /Reparti produttivi/i });
    fireEvent.click(tabReparti);

    const pencilBtn = await screen.findByRole("button", { name: "Modifica reparto" });
    expect(pencilBtn).toBeInTheDocument();
    expect(pencilBtn.querySelector("svg")).toBeTruthy();
    expect(pencilBtn.title).toBe("Modifica reparto");
  });

  it("mostra pulsante cestino con aria-label e SVG nel tab Reparti", async () => {
    render(<AnagrafichePage />);

    const tabReparti = screen.getByRole("button", { name: /Reparti produttivi/i });
    fireEvent.click(tabReparti);

    const trashBtn = await screen.findByRole("button", { name: "Elimina reparto" });
    expect(trashBtn).toBeInTheDocument();
    expect(trashBtn.querySelector("svg")).toBeTruthy();
    expect(trashBtn.title).toBe("Elimina reparto");
  });
});
