import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, act, cleanup } from "@testing-library/react";

vi.mock("../services/apiService", () => ({
  default: { verifyQualification: vi.fn() },
}));
import apiService from "../services/apiService";

import IngestReviewDialog, {
  buildVerifyFields,
  isVerifiableDocType,
  isFieldConfirmedByAi,
  formatReadonlyDisplay,
} from "../components/IngestReviewDialog.jsx";

beforeEach(() => {
  apiService.verifyQualification.mockReset();
  apiService.verifyQualification.mockReturnValue(new Promise(() => {}));
  window.matchMedia = vi.fn(() => ({
    matches: false,
    media: "",
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
});

const SELECT_FIELD = {
  key: "welding_process",
  label: "Processo di saldatura",
  type: "select",
  required: true,
  options: [
    { value: "111", label: "111 - SMAW" },
    { value: "141", label: "141 - TIG" },
  ],
};

describe("isFieldConfirmedByAi", () => {
  it("è confermato solo con confidenza alta e valore presente", () => {
    expect(isFieldConfirmedByAi("high", "141")).toBe(true);
    expect(isFieldConfirmedByAi("high", "")).toBe(false);
    expect(isFieldConfirmedByAi("high", null)).toBe(false);
    expect(isFieldConfirmedByAi("high", [])).toBe(false);
    expect(isFieldConfirmedByAi("medium", "141")).toBe(false);
    expect(isFieldConfirmedByAi("low", "141")).toBe(false);
    expect(isFieldConfirmedByAi(undefined, "141")).toBe(false);
  });
});

describe("formatReadonlyDisplay", () => {
  it("mostra la label dell'opzione select, non il codice grezzo", () => {
    expect(formatReadonlyDisplay(SELECT_FIELD, "141")).toBe("141 - TIG");
  });

  it("gestisce array (multiselect) e valori mancanti", () => {
    expect(formatReadonlyDisplay({ type: "multiselect" }, ["PA", "PB"])).toBe("PA, PB");
    expect(formatReadonlyDisplay(SELECT_FIELD, "")).toBe("\u2014");
  });
});

describe("IngestReviewDialog — campo diametro tubo condizionato al tipo prodotto (27/07/2026)", () => {
  const baseProps = {
    open: true,
    docType: "patentino_saldatore",
    fileName: "certificato.pdf",
    onConfirm: vi.fn(),
    onReject: vi.fn(),
    onClose: vi.fn(),
  };

  it("prodotto = Piastra (P): diametro tubo non è editabile, mostra 'Non applicabile'", () => {
    render(
      <IngestReviewDialog
        {...baseProps}
        fields={{ product_type: "P", pipe_diameter_mm: 60 }}
      />,
    );

    expect(document.getElementById("ingest-field-pipe_diameter_mm")).toBeNull();
    expect(screen.getByText(/Non applicabile — prodotto: Piastra/)).toBeInTheDocument();
  });

  it("prodotto = Tubo (T): diametro tubo resta editabile", () => {
    render(
      <IngestReviewDialog
        {...baseProps}
        fields={{ product_type: "T", pipe_diameter_mm: 60 }}
      />,
    );

    expect(document.getElementById("ingest-field-pipe_diameter_mm")).not.toBeNull();
    // Regex specifica sulla dicitura "N.A." del campo diametro tubo (non un match
    // generico su "Non applicabile", che dal 28/07/2026 compare anche nell'hint
    // testuale del campo transfer_mode — "Non applicabile a MMA/TIG/SAW" — senza
    // relazione con la logica piastra/tubo qui testata).
    expect(screen.queryByText(/Non applicabile — prodotto: Piastra/)).not.toBeInTheDocument();
  });

  it("il campo 'Tipo prodotto' mostra la nota su derivazione/branch tubo-piastra (segnalazione Mason, 27/07/2026)", () => {
    render(
      <IngestReviewDialog
        {...baseProps}
        fields={{ product_type: "T", pipe_diameter_mm: 60 }}
      />,
    );

    expect(screen.getByText(/tubo che si inserisce in una piastra/)).toBeInTheDocument();
  });

  it("cambiando prodotto da Tubo a Piastra il campo diametro si nasconde e il valore residuo viene azzerato", () => {
    render(
      <IngestReviewDialog
        {...baseProps}
        fields={{ product_type: "T", pipe_diameter_mm: 60 }}
      />,
    );

    expect(document.getElementById("ingest-field-pipe_diameter_mm").value).toBe("60");

    fireEvent.change(document.getElementById("ingest-field-product_type"), { target: { value: "P" } });

    expect(document.getElementById("ingest-field-pipe_diameter_mm")).toBeNull();
    expect(screen.getByText(/Non applicabile — prodotto: Piastra/)).toBeInTheDocument();
  });
});

describe("IngestReviewDialog — select con fallback 'Altro' non perde valori fuori elenco (08/08/2026)", () => {
  const baseProps = {
    open: true,
    docType: "patentino_saldatore",
    fileName: "certificato.pdf",
    onConfirm: vi.fn(),
    onReject: vi.fn(),
    onClose: vi.fn(),
  };

  it("valore che corrisponde a un'opzione nota: mostra solo il select, nessun campo testo extra", () => {
    render(
      <IngestReviewDialog
        {...baseProps}
        fields={{ issuing_body: "tuv" }}
        fieldConfidence={{ issuing_body: "low" }}
      />,
    );

    expect(document.getElementById("ingest-field-issuing_body").value).toBe("tuv");
    expect(document.querySelector(".ingest-review__input--other")).toBeNull();
  });

  it("valore estratto dall'AI non presente in elenco (es. ente non ancora catalogato): non viene scartato, resta visibile in un campo testo", () => {
    render(
      <IngestReviewDialog
        {...baseProps}
        fields={{ issuing_body: "Istituto Italiano di Saldatura" }}
        fieldConfidence={{ issuing_body: "low" }}
      />,
    );

    expect(document.getElementById("ingest-field-issuing_body").value).toBe("altro");
    const otherInput = document.querySelector(".ingest-review__input--other");
    expect(otherInput).not.toBeNull();
    expect(otherInput.value).toBe("Istituto Italiano di Saldatura");
  });

  it("selezionando 'Altro' manualmente compare un campo testo vuoto, e digitando si aggiorna il valore del campo", () => {
    render(
      <IngestReviewDialog
        {...baseProps}
        fields={{ issuing_body: "tuv" }}
        fieldConfidence={{ issuing_body: "low" }}
      />,
    );

    fireEvent.change(document.getElementById("ingest-field-issuing_body"), { target: { value: "altro" } });
    const otherInput = document.querySelector(".ingest-review__input--other");
    expect(otherInput.value).toBe("");

    fireEvent.change(otherInput, { target: { value: "Ente XYZ" } });
    expect(document.querySelector(".ingest-review__input--other").value).toBe("Ente XYZ");
  });

  it("IIS - ISSCERT è ora tra le opzioni dell'elenco enti (gap segnalato dal committente 08/08/2026)", () => {
    render(
      <IngestReviewDialog
        {...baseProps}
        fields={{ issuing_body: "" }}
        fieldConfidence={{ issuing_body: "low" }}
      />,
    );

    expect(screen.getByText(/IIS - ISSCERT/)).toBeInTheDocument();
  });
});

describe("IngestReviewDialog — revisione adattiva per confidenza", () => {
  const baseProps = {
    open: true,
    docType: "patentino_saldatore",
    fileName: "certificato.pdf",
    onConfirm: vi.fn(),
    onReject: vi.fn(),
    onClose: vi.fn(),
  };

  it("campo con confidenza alta è mostrato come confermato (readonly + pulsante Modifica), non come select", () => {
    render(
      <IngestReviewDialog
        {...baseProps}
        fields={{ welding_process: "141" }}
        fieldConfidence={{ welding_process: "high" }}
      />,
    );

    expect(screen.getByText(/141 - TIG/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Processo di saldatura/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Modifica" })).toBeInTheDocument();
  });

  it("cliccando Modifica il campo confermato diventa editabile e può tornare readonly", () => {
    render(
      <IngestReviewDialog
        {...baseProps}
        fields={{ welding_process: "141" }}
        fieldConfidence={{ welding_process: "high" }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Modifica" }));
    expect(document.getElementById("ingest-field-welding_process").tagName).toBe("SELECT");

    fireEvent.click(screen.getByRole("button", { name: /Annulla modifica/ }));
    expect(document.getElementById("ingest-field-welding_process")).toBeNull();
    expect(screen.getByText(/141 - TIG/)).toBeInTheDocument();
  });

  it("campo con confidenza bassa/assente è mostrato subito editabile (select aperto)", () => {
    render(
      <IngestReviewDialog
        {...baseProps}
        fields={{ welding_process: "" }}
        fieldConfidence={{ welding_process: "low" }}
      />,
    );

    expect(document.getElementById("ingest-field-welding_process").tagName).toBe("SELECT");
    expect(screen.queryByRole("button", { name: "Modifica" })).not.toBeInTheDocument();
  });

  it("campo con confidenza media è mostrato editabile ed evidenziato", () => {
    render(
      <IngestReviewDialog
        {...baseProps}
        fields={{ welding_process: "141" }}
        fieldConfidence={{ welding_process: "medium" }}
      />,
    );

    const select = document.getElementById("ingest-field-welding_process");
    expect(select.tagName).toBe("SELECT");
    expect(select.closest(".ingest-review__field--medium")).not.toBeNull();
  });
});

describe("IngestReviewDialog — verifica qualifica vs norma (VQ-9)", () => {
  const WARN_MSG = "Spessore massimo 40 mm oltre il campo qualificato (\u00a75.7 Tab. 6).";
  const verification = {
    profile: "9606-1:BW",
    standard: { family: "9606-1", edition: "2017" },
    findings: [{
      code: "WQ9606_1.CORR.THK_BW",
      family: "correttezza",
      severity: "warn",
      status: "verificabile",
      field: "thickness_max_mm",
      direction: "over_claim",
      read_value: 40,
      expected_value: { min: 3, max: 24 },
      source: { norm: "ISO 9606-1", edition: "2017", clause: "\u00a75.7 Tab. 6", text_status: "md_integrale" },
      message_it: WARN_MSG,
    }],
    summary: { warn: 1, info: 0, verificabili: 1, non_verificabili: 0 },
    engine_version: "1",
    mode: "review",
  };
  const baseProps = {
    open: true,
    docType: "patentino_saldatore",
    fileName: "certificato.pdf",
    qualificationType: "Saldatore ISO 9606-1",
    fields: { person_name: "Mario Rossi", thickness_max_mm: 40, joint_type: "BW" },
    fieldConfidence: {},
    onConfirm: vi.fn(),
    onReject: vi.fn(),
    onClose: vi.fn(),
  };

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    Object.defineProperty(window.navigator, "onLine", { value: true, configurable: true });
  });

  it("buildVerifyFields scarta vuoti/oggetti e tiene scalari e array di scalari", () => {
    expect(
      buildVerifyFields({ a: "x", b: "  ", c: null, d: 3, e: true, f: [], g: ["PA", "", "PB"], h: { x: 1 } }),
    ).toEqual({ a: "x", d: 3, e: true, g: ["PA", "PB"] });
    expect(buildVerifyFields({ a: 1, b: 2 }, ["b", "z"])).toEqual({ b: 2 });
  });

  it("isVerifiableDocType: solo patentino saldatore e qualifica 14732", () => {
    expect(isVerifiableDocType("patentino_saldatore")).toBe(true);
    expect(isVerifiableDocType("qualifica_14732")).toBe(true);
    expect(isVerifiableDocType("cert_ndt")).toBe(false);
    expect(isVerifiableDocType("wps")).toBe(false);
  });

  it("senza `verification` chiama l'endpoint una volta all'apertura e mostra il pannello", async () => {
    apiService.verifyQualification.mockResolvedValue({ verification });
    await act(async () => { render(<IngestReviewDialog {...baseProps} />); });

    expect(apiService.verifyQualification).toHaveBeenCalledTimes(1);
    const [fields, opts] = apiService.verifyQualification.mock.calls[0];
    expect(fields).toEqual(expect.objectContaining({ thickness_max_mm: 40, joint_type: "BW" }));
    expect(opts).toEqual({ qualificationType: "Saldatore ISO 9606-1" });
    expect(await screen.findByTestId("vfy-panel")).toBeInTheDocument();
    expect(screen.getAllByText(WARN_MSG).length).toBeGreaterThan(0);
  });

  it("con `verification` gia' presente non chiama l'endpoint e non duplica l'avviso tra i warning", async () => {
    await act(async () => {
      render(<IngestReviewDialog {...baseProps} verification={verification} warnings={[WARN_MSG, "Nome titolare non trovato"]} />);
    });
    expect(apiService.verifyQualification).not.toHaveBeenCalled();
    expect(screen.getAllByTestId("vfy-finding")).toHaveLength(1);
    expect(screen.getAllByText(WARN_MSG)).toHaveLength(1);
    expect(screen.getByText(/Nome titolare non trovato/)).toBeInTheDocument();
  });

  it("notifica l'esito al genitore (per il riepilogo del caricamento)", async () => {
    const onVerificationChange = vi.fn();
    await act(async () => {
      render(<IngestReviewDialog {...baseProps} verification={verification} onVerificationChange={onVerificationChange} />);
    });
    expect(onVerificationChange).toHaveBeenCalledWith(verification);
  });

  it("modifica: nessuna chiamata a ogni tasto; una sola al blur dopo il debounce; blur senza modifiche no", async () => {
    vi.useFakeTimers();
    await act(async () => { render(<IngestReviewDialog {...baseProps} verification={verification} />); });
    const input = document.getElementById("ingest-field-thickness_max_mm");

    fireEvent.change(input, { target: { value: "2" } });
    fireEvent.change(input, { target: { value: "20" } });
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    expect(apiService.verifyQualification).not.toHaveBeenCalled();

    fireEvent.blur(input);
    fireEvent.blur(input);
    await act(async () => { await vi.advanceTimersByTimeAsync(700); });
    expect(apiService.verifyQualification).toHaveBeenCalledTimes(1);
    expect(apiService.verifyQualification.mock.calls[0][0].thickness_max_mm).toBe("20");

    fireEvent.blur(input);
    await act(async () => { await vi.advanceTimersByTimeAsync(1500); });
    expect(apiService.verifyQualification).toHaveBeenCalledTimes(1);
  });

  it("errore di verifica: pannello in errore, salvataggio comunque possibile", async () => {
    apiService.verifyQualification.mockRejectedValue(new Error("Verifica non disponibile. Riprovare."));
    const onConfirm = vi.fn();
    await act(async () => { render(<IngestReviewDialog {...baseProps} onConfirm={onConfirm} />); });

    expect(await screen.findByTestId("vfy-error")).toHaveTextContent("Verifica non disponibile");
    const save = screen.getByRole("button", { name: /Conferma e salva/i });
    expect(save).not.toBeDisabled();
    await act(async () => { fireEvent.click(save); });
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("offline: nessuna chiamata, messaggio del pannello, pulsanti operativi visibili", async () => {
    Object.defineProperty(window.navigator, "onLine", { value: false, configurable: true });
    await act(async () => { render(<IngestReviewDialog {...baseProps} />); });
    expect(apiService.verifyQualification).not.toHaveBeenCalled();
    expect(screen.getByTestId("vfy-offline")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Conferma e salva/i })).not.toBeDisabled();
    expect(screen.getByRole("button", { name: /Scarta/i })).toBeInTheDocument();
  });

  it("dialog chiuso e senza `fields`: nessun re-render infinito ne' chiamata (reset idempotente)", () => {
    const { container } = render(<IngestReviewDialog open={false} docType="wps" fileName="x.pdf" onConfirm={vi.fn()} onReject={vi.fn()} onClose={vi.fn()} />);
    expect(container.firstChild).toBeNull();
    expect(apiService.verifyQualification).not.toHaveBeenCalled();
  });

  it("tipi documento senza verifica (NDT): nessuna chiamata e nessun pannello", async () => {
    await act(async () => {
      render(<IngestReviewDialog {...baseProps} docType="cert_ndt" fields={{ person_name: "Mario Rossi" }} />);
    });
    expect(apiService.verifyQualification).not.toHaveBeenCalled();
    expect(screen.queryByTestId("ingest-verify")).toBeNull();
  });
});
