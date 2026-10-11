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
      <div data-testid="ingest-review-stub" data-doctype={props.docType}>
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

    const file = new File(["%PDF"], "25-01341_DEDIC ADIL_14732_121.pdf", { type: "application/pdf" });
    const input = document.querySelector('input[type="file"]');
    await user.upload(input, file);

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
    const file = new File(["%PDF"], "a.pdf", { type: "application/pdf" });
    await user.upload(document.querySelector('input[type="file"]'), file);
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
    await user.upload(
      document.querySelector('input[type="file"]'),
      new File(["%PDF"], "a.pdf", { type: "application/pdf" }),
    );

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

describe("QualificationUploadButton — riconoscimento automatico del tipo per file", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const cls = (docType, confidence, source, needsChoice = false, reasons = []) => ({
    detected_doc_type: docType,
    classification_confidence: confidence,
    classification_source: source,
    classification: { detected_doc_type: docType, confidence, classification_source: source, reasons, needs_choice: needsChoice },
  });

  const pendingRes = (name, id, docType, confidence = "high", source = "rules") => ({
    fileName: name,
    status: "pending_review",
    staging_id: id,
    warnings: [],
    fields: {},
    doc_type: docType,
    ...cls(docType, confidence, source),
  });

  const unresolvedRes = (name) => ({
    fileName: name,
    status: "type_unresolved",
    warnings: [],
    ...cls("altro", "low", "ai", true, ["Nessuna norma o indizio riconoscibile nel testo"]),
  });

  async function openAndUpload(user, results, names = ["a.pdf"]) {
    apiService.uploadQualificationsBatch.mockResolvedValueOnce({ results, uploaded: 0, total: results.length });
    render(
      <QualificationUploadButton companyId="60" companyName="ADA" onUploadComplete={() => {}} activeTab="tutti" />
    );
    await user.click(screen.getByRole("button", { name: /Carica qualifiche \(batch\)/i }));
    await user.upload(
      document.querySelector('input[type="file"]'),
      names.map((n) => new File(["%PDF"], n, { type: "application/pdf" })),
    );
  }

  it("nessuna tendina obbligatoria e nessun pulsante «Estrai e rivedi»: il file si carica subito, senza doc_type", async () => {
    const user = userEvent.setup();
    await openAndUpload(user, [pendingRes("a.pdf", 1, "cert_ndt")]);

    expect(screen.queryByText(/Tipo qualifica da caricare/i)).toBeNull();
    expect(screen.queryByRole("button", { name: /Estrai e rivedi/i })).toBeNull();
    await waitFor(() => expect(apiService.uploadQualificationsBatch).toHaveBeenCalledTimes(1));
    const [files, companyId, docType] = apiService.uploadQualificationsBatch.mock.calls[0];
    expect(files).toHaveLength(1);
    expect(companyId).toBe(60);
    expect(docType).toBeUndefined();
  });

  it("nessuna sequenza \\uXXXX letterale a schermo (pannello iniziale e risultati)", async () => {
    const user = userEvent.setup();
    render(<QualificationUploadButton companyId="60" companyName="ADA" onUploadComplete={() => {}} />);
    await user.click(screen.getByRole("button", { name: /Carica qualifiche \(batch\)/i }));
    expect(document.body.textContent).not.toMatch(/\\u[0-9a-f]{4}/i);
    apiService.uploadQualificationsBatch.mockResolvedValueOnce({
      results: [unresolvedRes("a.pdf")], uploaded: 0, total: 1,
    });
    await user.upload(document.querySelector('input[type="file"]'), new File(["%PDF"], "a.pdf", { type: "application/pdf" }));
    await screen.findByText("Tipo da scegliere");
    expect(document.body.textContent).not.toMatch(/\\u[0-9a-f]{4}/i);
  });

  it("mostra per ogni file il tipo rilevato (badge + select) e consente la conferma se chiaro", async () => {
    const user = userEvent.setup();
    await openAndUpload(user, [pendingRes("a.pdf", 1, "cert_ndt")]);

    expect(await screen.findByText("Tipo riconosciuto")).toBeInTheDocument();
    expect(screen.getByTestId("qual-upload-type-select")).toHaveValue("cert_ndt");
    const review = screen.getByRole("button", { name: /Rivedi campi/i });
    expect(review).not.toBeDisabled();
  });

  it("confidenza media: badge «da verificare», conferma comunque abilitata", async () => {
    const user = userEvent.setup();
    await openAndUpload(user, [pendingRes("a.pdf", 1, "patentino_saldatore", "medium", "ai")]);

    expect(await screen.findByText("Tipo da verificare")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Rivedi campi/i })).not.toBeDisabled();
  });

  it("tipo non chiaro: file «da scegliere», conferma disabilitata con title esplicativo", async () => {
    const user = userEvent.setup();
    await openAndUpload(user, [unresolvedRes("a.pdf")]);

    expect(await screen.findByText("Tipo da scegliere")).toBeInTheDocument();
    expect(screen.getByTestId("qual-upload-type-select")).toHaveValue("");
    const review = screen.getByRole("button", { name: /Rivedi campi/i });
    expect(review).toBeDisabled();
    expect(review).toHaveAttribute("title", expect.stringMatching(/Scegli prima il tipo/i));
    expect(screen.getByTestId("qual-upload-unresolved-count")).toHaveTextContent("1 da scegliere");
    expect(screen.getByText(/Nessuna norma o indizio/)).toBeInTheDocument();
  });

  it("stato misto: i file chiari restano confermabili, quello incerto no", async () => {
    const user = userEvent.setup();
    await openAndUpload(
      user,
      [pendingRes("a.pdf", 1, "qualifica_14732"), unresolvedRes("b.pdf"), pendingRes("c.pdf", 3, "patentino_saldatore")],
      ["a.pdf", "b.pdf", "c.pdf"],
    );

    const buttons = await screen.findAllByRole("button", { name: /Rivedi campi/i });
    expect(buttons).toHaveLength(3);
    expect(buttons[0]).not.toBeDisabled();
    expect(buttons[1]).toBeDisabled();
    expect(buttons[2]).not.toBeDisabled();
    expect(screen.getByTestId("qual-upload-unresolved-count")).toHaveTextContent("1 da scegliere");
  });

  it("override su file «da scegliere»: rielabora quel solo file con doc_type esplicito e sblocca la conferma", async () => {
    const user = userEvent.setup();
    await openAndUpload(user, [unresolvedRes("b.pdf")], ["b.pdf"]);
    apiService.uploadQualificationsBatch.mockResolvedValueOnce({
      results: [pendingRes("b.pdf", 9, "cert_ndt", "high", "override")],
      uploaded: 1,
      total: 1,
    });

    await user.selectOptions(await screen.findByTestId("qual-upload-type-select"), "cert_ndt");

    await waitFor(() => expect(apiService.uploadQualificationsBatch).toHaveBeenCalledTimes(2));
    const [files, , docType] = apiService.uploadQualificationsBatch.mock.calls[1];
    expect(files.map((f) => f.name)).toEqual(["b.pdf"]);
    expect(docType).toBe("cert_ndt");
    expect(await screen.findByText("Tipo scelto da te")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Rivedi campi/i })).not.toBeDisabled();
    expect(screen.queryByTestId("qual-upload-unresolved-count")).toBeNull();
    expect(apiService.rejectIngestStaging).not.toHaveBeenCalled();
  });

  it("override su file già rilevato: rielabora con il nuovo tipo e scarta il vecchio staging", async () => {
    const user = userEvent.setup();
    apiService.rejectIngestStaging.mockResolvedValue({});
    await openAndUpload(user, [pendingRes("a.pdf", 5, "patentino_saldatore", "medium", "ai")]);
    apiService.uploadQualificationsBatch.mockResolvedValueOnce({
      results: [pendingRes("a.pdf", 6, "qualifica_14732", "high", "override")],
      uploaded: 1,
      total: 1,
    });

    await user.selectOptions(await screen.findByTestId("qual-upload-type-select"), "qualifica_14732");

    await waitFor(() => expect(apiService.uploadQualificationsBatch).toHaveBeenCalledTimes(2));
    expect(apiService.uploadQualificationsBatch.mock.calls[1][2]).toBe("qualifica_14732");
    await waitFor(() => expect(apiService.rejectIngestStaging).toHaveBeenCalledWith(5));
    expect(await screen.findByText("Tipo scelto da te")).toBeInTheDocument();
    expect(screen.getByTestId("qual-upload-type-select")).toHaveValue("qualifica_14732");
  });

  it("override fallito: il file resta com'era e compare l'errore", async () => {
    const user = userEvent.setup();
    await openAndUpload(user, [unresolvedRes("b.pdf")], ["b.pdf"]);
    apiService.uploadQualificationsBatch.mockRejectedValueOnce(new Error("Rete assente"));

    await user.selectOptions(await screen.findByTestId("qual-upload-type-select"), "patentino_saldatore");

    expect(await screen.findByText("Rete assente")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Rivedi campi/i })).toBeDisabled();
  });

  it("apre la revisione col tipo effettivo del file (non uno stato globale)", async () => {
    const user = userEvent.setup();
    await openAndUpload(user, [pendingRes("a.pdf", 1, "cert_ndt")]);
    await user.click(await screen.findByRole("button", { name: /Rivedi campi/i }));
    expect(await screen.findByTestId("ingest-review-stub")).toHaveAttribute("data-doctype", "cert_ndt");
  });
});
