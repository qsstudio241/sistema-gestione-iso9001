import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { RiskForm } from "../pages/RisksPage.jsx";

vi.mock("../services/apiService", () => ({
  default: {
    getContextFactors: vi.fn(),
    getInterestedParties: vi.fn(),
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
});
