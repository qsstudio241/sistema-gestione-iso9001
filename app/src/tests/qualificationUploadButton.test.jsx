/**
 * @vitest-environment jsdom
 */
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import QualificationUploadButton, { suggestedDocTypeFromTab } from "../components/QualificationUploadButton.jsx";

vi.mock("../services/apiService", () => ({
  default: {
    uploadQualificationsBatch: vi.fn(),
    confirmIngestStaging: vi.fn(),
    rejectIngestStaging: vi.fn(),
  },
}));
vi.mock("../components/IngestReviewDialog", () => ({ default: () => null }));

import apiService from "../services/apiService";

describe("suggestedDocTypeFromTab", () => {
  it("suggerisce cert_ndt dalla tab NDT", () => {
    expect(suggestedDocTypeFromTab("ndt")).toBe("cert_ndt");
  });

  it("suggerisce patentino dalle tab saldatori", () => {
    expect(suggestedDocTypeFromTab("iso9606_1")).toBe("patentino_saldatore");
    expect(suggestedDocTypeFromTab("iso9606_2")).toBe("patentino_saldatore");
  });

  it("suggerisce 14732 dalla tab operatori", () => {
    expect(suggestedDocTypeFromTab("iso14732")).toBe("qualifica_14732");
  });

  it("non impone default su tab Tutti / altre", () => {
    expect(suggestedDocTypeFromTab("tutti")).toBe("");
    expect(suggestedDocTypeFromTab("iso14731")).toBe("");
    expect(suggestedDocTypeFromTab("")).toBe("");
  });
});

describe("QualificationUploadButton — visibile anche senza azienda", () => {
  it("mostra il pulsante Carica qualifiche (batch) disabilitato se manca l'azienda", () => {
    render(<QualificationUploadButton companyId="" companyName="" onUploadComplete={() => {}} />);
    const btn = screen.getByRole("button", { name: /Carica qualifiche \(batch\)/i });
    expect(btn).toBeInTheDocument();
    expect(btn).toHaveAttribute("aria-disabled", "true");
  });

  it("resta cliccabile quando l'azienda e' valida", () => {
    render(
      <QualificationUploadButton companyId="47" companyName="C.M.P." onUploadComplete={() => {}} />
    );
    const btn = screen.getByRole("button", { name: /Carica qualifiche \(batch\)/i });
    expect(btn).not.toBeDisabled();
  });

  it("chiude il pannello se l'Ambito passa a un'altra azienda", async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <QualificationUploadButton companyId="47" companyName="C.M.P." onUploadComplete={() => {}} />
    );
    await user.click(screen.getByRole("button", { name: /Carica qualifiche \(batch\)/i }));
    expect(await screen.findByText(/Azienda:/)).toBeInTheDocument();
    rerender(
      <QualificationUploadButton companyId="11" companyName="Altra Srl" onUploadComplete={() => {}} />
    );
    expect(screen.queryByText(/Azienda:/)).not.toBeInTheDocument();
  });
});

describe("QualificationUploadButton — wrong_module non è «Errore sconosciuto»", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("mostra il messaggio del backend invece del fallback generico", async () => {
    const user = userEvent.setup();
    apiService.uploadQualificationsBatch.mockResolvedValue({
      results: [
        {
          fileName: "25-01341_DEDIC ADIL_14732_121.pdf",
          status: "wrong_module",
          detected_type: "wpqr",
          message:
            "Questo documento sembra una WPQR/PQR (ISO 15614). Caricarlo nel modulo Saldatura → WPQR.",
        },
      ],
      uploaded: 0,
      total: 1,
    });

    render(
      <QualificationUploadButton companyId="60" companyName="ADA" onUploadComplete={() => {}} activeTab="iso14732" />
    );
    await user.click(screen.getByRole("button", { name: /Carica qualifiche \(batch\)/i }));
    await user.selectOptions(screen.getByRole("combobox"), "qualifica_14732");

    const file = new File(["%PDF"], "25-01341_DEDIC ADIL_14732_121.pdf", { type: "application/pdf" });
    const input = document.querySelector('input[type="file"]');
    await user.upload(input, file);
    await user.click(screen.getByRole("button", { name: /Estrai e rivedi/i }));

    expect(await screen.findByText(/sembra una WPQR/i)).toBeInTheDocument();
    expect(screen.queryByText(/Errore sconosciuto/i)).toBeNull();
    await waitFor(() => {
      expect(apiService.uploadQualificationsBatch).toHaveBeenCalled();
    });
  });
});
