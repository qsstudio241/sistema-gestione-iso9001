/**
 * Test L1 — ProjectsPage azioni di riga a icone
 *
 * Verifica che ogni riga commessa esponga i pulsanti icona SVG
 * (matita = modifica, cestino = elimina) con aria-label corretto,
 * e che non siano presenti pulsanti emoji testuali.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import ProjectsPage from "../pages/ProjectsPage";

const mockGetProjects     = vi.fn();
const mockGetWPSList      = vi.fn();
const mockGetQualifications = vi.fn();
const mockDeleteProject   = vi.fn();

vi.mock("../services/apiService", () => ({
  default: {
    getProjects:      (...args) => mockGetProjects(...args),
    getWPSList:       (...args) => mockGetWPSList(...args),
    getQualifications:(...args) => mockGetQualifications(...args),
    deleteProject:    (...args) => mockDeleteProject(...args),
  },
}));

const ONE_PROJECT = {
  id: 7,
  project_code: "COMM-001",
  client_name: "Cliente Test",
  status: "aperta",
  start_date: null,
  end_date: null,
  applicable_wps_ids: "[]",
};

describe("ProjectsPage — azioni di riga a icone", () => {
  beforeEach(() => {
    mockGetProjects.mockReset().mockResolvedValue({ data: [ONE_PROJECT], pagination: { total: 1 } });
    mockGetWPSList.mockReset().mockResolvedValue({ data: [] });
    mockGetQualifications.mockReset().mockResolvedValue({ qualifications: [] });
    mockDeleteProject.mockReset().mockResolvedValue({});
  });

  it("mostra il pulsante matita con aria-label e SVG", async () => {
    render(<ProjectsPage />);

    const pencilBtn = await screen.findByRole("button", { name: "Modifica commessa" });
    expect(pencilBtn).toBeInTheDocument();
    expect(pencilBtn.querySelector("svg")).toBeTruthy();
    expect(pencilBtn.title).toBe("Modifica commessa");
  });

  it("mostra il pulsante cestino con aria-label e SVG", async () => {
    render(<ProjectsPage />);

    const trashBtn = await screen.findByRole("button", { name: "Elimina commessa" });
    expect(trashBtn).toBeInTheDocument();
    expect(trashBtn.querySelector("svg")).toBeTruthy();
    expect(trashBtn.title).toBe("Elimina commessa");
  });

  it("non espone pulsanti emoji ?? o ???", async () => {
    render(<ProjectsPage />);

    await screen.findByRole("button", { name: "Modifica commessa" });

    const allButtons = screen.getAllByRole("button");
    const emojiEdit  = allButtons.find(b => b.textContent.includes("??"));
    const emojiTrash = allButtons.find(b => b.textContent.includes("???"));
    expect(emojiEdit).toBeUndefined();
    expect(emojiTrash).toBeUndefined();
  });

  it("il pulsante cestino mostra il pannello di conferma inline", async () => {
    render(<ProjectsPage />);

    const trashBtn = await screen.findByRole("button", { name: "Elimina commessa" });
    fireEvent.click(trashBtn);

    await waitFor(() => {
      expect(screen.getByText("Eliminare?")).toBeInTheDocument();
    });
  });

  it("il pulsante matita apre il form modale di modifica", async () => {
    render(<ProjectsPage />);

    const pencilBtn = await screen.findByRole("button", { name: "Modifica commessa" });
    fireEvent.click(pencilBtn);

    await waitFor(() => {
      expect(screen.getByText("Modifica commessa")).toBeInTheDocument();
    });
  });
});
