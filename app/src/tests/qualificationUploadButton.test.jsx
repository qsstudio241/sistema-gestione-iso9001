/**
 * @vitest-environment jsdom
 */
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import QualificationUploadButton, { suggestedDocTypeFromTab, summarizeNormVerification } from "../components/QualificationUploadButton.jsx";

vi.mock("../services/apiService", () => ({
  default: {
    uploadQualificationsBatch: vi.fn(),
    confirmIngestStaging: vi.fn(),
    rejectIngestStaging: vi.fn(),
  },
}));
vi.mock("../components/IngestReviewDialog", () => ({
  default: function IngestReviewDialogStub(props) {
    if (!props.open) return null;
    return (
      <div data-testid="ingest-review-stub">
        <button
          type="button"
          data-testid="ingest-review-sim-verify"
          onClick={() => props.onVerificationChange?.({
            summary: { warn: 2, info: 0, verificabili: 2, non_verificabili: 0 },
            findings: [],
          })}
        >
          Simula verifica
        </button>
        <button
          type="button"
          data-testid="ingest-review-confirm"
          onClick={() => props.onConfirm?.({ person_name: "Mario Rossi" })}
        >
          Conferma revisione
        </button>
      </div>
    );
  },
}));

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

describe("QualificationUploadButton — riepilogo avvisi norma (VQ-9)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const verif = (warn) => ({ summary: { warn, info: 0, verificabili: warn, non_verificabili: 0 }, findings: [] });

  it("summarizeNormVerification: null senza esiti, somma avvisi e file con avvisi", () => {
    expect(summarizeNormVerification(null)).toBeNull();
    expect(summarizeNormVerification([{ status: "pending_review" }])).toBeNull();
    expect(
      summarizeNormVerification([
        { verification: verif(2) },
        { verification: verif(0) },
        { status: "error" },
        { verification: verif(1) },
      ]),
    ).toEqual({ warn: 3, filesWithWarn: 2, files: 3 });
  });

  async function uploadWith(results) {
    const user = userEvent.setup();
    apiService.uploadQualificationsBatch.mockResolvedValue({ results, uploaded: results.length, total: results.length });
    render(
      <QualificationUploadButton companyId="60" companyName="ADA" onUploadComplete={() => {}} activeTab="iso9606_1" />
    );
    await user.click(screen.getByRole("button", { name: /Carica qualifiche \(batch\)/i }));
    await user.selectOptions(screen.getByRole("combobox"), "patentino_saldatore");
    const file = new File(["%PDF"], "a.pdf", { type: "application/pdf" });
    await user.upload(document.querySelector('input[type="file"]'), file);
    await user.click(screen.getByRole("button", { name: /Estrai e rivedi/i }));
  }

  it("mostra il riepilogo quando i risultati hanno gia' l'esito di verifica", async () => {
    await uploadWith([
      { fileName: "a.pdf", status: "pending_review", staging_id: 1, warnings: [], verification: verif(2) },
      { fileName: "b.pdf", status: "pending_review", staging_id: 2, warnings: [], verification: verif(0) },
    ]);
    const box = await screen.findByTestId("qual-upload-verify-summary");
    expect(box.textContent).toMatch(/2 avvisi in 1 su 2 file verificati/);
    expect(box.textContent).toMatch(/non impediscono il salvataggio/);
    expect(screen.getAllByRole("button", { name: /Rivedi campi/i })).toHaveLength(2);
  });

  it("senza esiti di verifica non mostra nulla e non inventa conteggi", async () => {
    await uploadWith([
      { fileName: "a.pdf", status: "pending_review", staging_id: 1, warnings: ["Nome titolare non trovato"] },
    ]);
    expect(await screen.findByText(/Nome titolare non trovato/)).toBeInTheDocument();
    expect(screen.queryByTestId("qual-upload-verify-summary")).toBeNull();
  });

  it("la verification da onVerificationChange resta dopo conferma (confirm non la restituisce)", async () => {
    const user = userEvent.setup();
    apiService.uploadQualificationsBatch.mockResolvedValue({
      results: [
        { fileName: "a.pdf", status: "pending_review", staging_id: 11, warnings: [], fields: {} },
      ],
      uploaded: 1,
      total: 1,
    });
    apiService.confirmIngestStaging.mockResolvedValue({
      qualification_id: 99,
      person_name: "Mario Rossi",
      qualification_type: "ISO 9606-1",
      warnings: [],
    });

    render(
      <QualificationUploadButton companyId="60" companyName="ADA" onUploadComplete={() => {}} activeTab="iso9606_1" />
    );
    await user.click(screen.getByRole("button", { name: /Carica qualifiche \(batch\)/i }));
    await user.selectOptions(screen.getByRole("combobox"), "patentino_saldatore");
    await user.upload(
      document.querySelector('input[type="file"]'),
      new File(["%PDF"], "a.pdf", { type: "application/pdf" }),
    );
    await user.click(screen.getByRole("button", { name: /Estrai e rivedi/i }));

    expect(await screen.findByRole("button", { name: /Rivedi campi/i })).toBeInTheDocument();
    expect(screen.queryByTestId("qual-upload-verify-summary")).toBeNull();

    await user.click(screen.getByRole("button", { name: /Rivedi campi/i }));
    await user.click(screen.getByTestId("ingest-review-sim-verify"));
    expect(await screen.findByTestId("qual-upload-verify-summary")).toHaveTextContent(/2 avvisi/);

    await user.click(screen.getByTestId("ingest-review-confirm"));
    await waitFor(() => {
      expect(apiService.confirmIngestStaging).toHaveBeenCalledWith(11, { person_name: "Mario Rossi" });
    });
    expect(await screen.findByText("Mario Rossi")).toBeInTheDocument();
    expect(screen.getByTestId("qual-upload-verify-summary")).toHaveTextContent(
      /2 avvisi in 1 su 1 file verificati/,
    );
  });
});
