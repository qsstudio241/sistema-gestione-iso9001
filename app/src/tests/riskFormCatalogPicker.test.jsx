import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { RiskForm } from "../pages/RisksPage.jsx";

vi.mock("../services/apiService", () => ({
  default: {
    getContextFactors: vi.fn(),
    getInterestedParties: vi.fn(),
    getRiskReviews: vi.fn(),
  },
}));

import apiService from "../services/apiService";

describe("RiskForm picker catalogo ROO-8", () => {
  beforeEach(() => {
    apiService.getContextFactors.mockResolvedValue({
      data: [{ id: 1, category: "Mercato", description: "Nuovo competitor" }],
    });
    apiService.getInterestedParties.mockResolvedValue({
      data: [{ id: 9, name: "Cliente", requirements: "On time" }],
    });
    apiService.getRiskReviews.mockResolvedValue({ data: [] });
  });

  it("accoda dal catalogo e non duplica", async () => {
    render(
      <RiskForm
        initial={{ title: "Prova", context_text: "Già", interested_parties_text: "" }}
        onSave={vi.fn()}
        onClose={vi.fn()}
        filterCompany="48"
      />,
    );

    const ctxPick = await screen.findByLabelText("Dal catalogo contesto");
    fireEvent.change(ctxPick, { target: { value: "1" } });
    expect(screen.getByLabelText("Contesto (§4.1)")).toHaveValue("Già\nMercato: Nuovo competitor");
    fireEvent.change(ctxPick, { target: { value: "1" } });
    expect(screen.getByLabelText("Contesto (§4.1)")).toHaveValue("Già\nMercato: Nuovo competitor");

    const ipPick = screen.getByLabelText("Dal catalogo parti");
    fireEvent.change(ipPick, { target: { value: "9" } });
    expect(screen.getByLabelText("Parti interessate (§4.2)")).toHaveValue("Cliente — On time");
  });

  it("mostra quadrante e segno G solo se metodo SWOT", async () => {
    render(
      <RiskForm initial={{ title: "X" }} onSave={vi.fn()} onClose={vi.fn()} />,
    );
    await waitFor(() => expect(apiService.getContextFactors).toHaveBeenCalled());
    expect(screen.queryByLabelText("Quadrante SWOT")).toBeNull();
    fireEvent.change(screen.getByLabelText("Metodo"), { target: { value: "swot_signed" } });
    expect(screen.getByLabelText("Quadrante SWOT")).toBeInTheDocument();
    expect(screen.getByLabelText("Segno G")).toBeInTheDocument();
  });

  it("senza catalogo non mostra i picker", async () => {
    apiService.getContextFactors.mockResolvedValue({ data: [] });
    apiService.getInterestedParties.mockResolvedValue({ data: [] });
    render(
      <RiskForm initial={{ title: "X" }} onSave={vi.fn()} onClose={vi.fn()} />,
    );
    await waitFor(() => expect(apiService.getContextFactors).toHaveBeenCalled());
    expect(screen.queryByLabelText("Dal catalogo contesto")).toBeNull();
    expect(screen.queryByLabelText("Dal catalogo parti")).toBeNull();
  });

  it("mostra lo storico se la riga ha review", async () => {
    apiService.getRiskReviews.mockResolvedValue({
      data: [{
        id: 1,
        probability: 2,
        impact: 3,
        score: 6,
        residual_score: 2,
        effectiveness_note: "Mitigazione efficace",
        recorded_at: "2026-06-10",
        recorded_by_name: "Marco",
      }],
    });
    render(
      <RiskForm initial={{ risk_id: 1043, title: "X" }} onSave={vi.fn()} onClose={vi.fn()} />,
    );
    expect(await screen.findByLabelText("Storico aggiornamenti")).toBeInTheDocument();
    expect(screen.getByText("Mitigazione efficace")).toBeInTheDocument();
    expect(screen.getByText(/P 2/)).toBeInTheDocument();
  });

  it("con Ambito azienda non mostra Nessuna azienda", async () => {
    render(
      <RiskForm
        initial={{ title: "Prova" }}
        onSave={vi.fn()}
        onClose={vi.fn()}
        filterCompany="48"
        companies={[{ id: 48, name: "Smoke Ingest Test SRL" }]}
      />,
    );
    await waitFor(() => expect(apiService.getContextFactors).toHaveBeenCalled());
    expect(screen.queryByText("-- Nessuna azienda --")).toBeNull();
    expect(screen.queryByLabelText("Azienda")).toBeNull();
  });

  it("orfano in Tutto lo studio richiede l'azienda", async () => {
    const onSave = vi.fn();
    render(
      <RiskForm
        initial={{ title: "Orfano", risk_id: 9, company_id: "" }}
        onSave={onSave}
        onClose={vi.fn()}
        companies={[{ id: 48, name: "Smoke Ingest Test SRL" }]}
      />,
    );
    await waitFor(() => expect(apiService.getContextFactors).toHaveBeenCalled());
    expect(screen.getByLabelText("Azienda")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Salva" }));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText(/Seleziona un'azienda in Ambito/)).toBeInTheDocument();
  });

  it("in salvataggio usa l'azienda dell'Ambito", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <RiskForm
        initial={{ title: "Prova" }}
        onSave={onSave}
        onClose={vi.fn()}
        filterCompany="48"
      />,
    );
    await waitFor(() => expect(apiService.getContextFactors).toHaveBeenCalled());
    fireEvent.click(screen.getByRole("button", { name: "Salva" }));
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(onSave.mock.calls[0][0].company_id).toBe("48");
  });
});
