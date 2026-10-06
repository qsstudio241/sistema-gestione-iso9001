/**
 * @vitest-environment jsdom
 */
import React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, within, cleanup } from "@testing-library/react";
import QualificationVerifyPanel, {
  VERIFY_NOTE,
  formatVerifyValue,
  groupVerifyFindings,
} from "../components/QualificationVerifyPanel";
import { apiService } from "../services/apiService";

afterEach(() => cleanup());

const overClaim = {
  code: "WQ9606_1.CORR.THK_BW",
  family: "correttezza",
  severity: "warn",
  status: "verificabile",
  field: "thickness_max_mm",
  direction: "over_claim",
  read_value: 40,
  expected_value: { min: 3, max: 24 },
  source: {
    norm: "ISO 9606-1",
    edition: "2017",
    clause: "\u00a75.7 Tab. 6",
    text_status: "md_integrale",
    ref: "docs/Normative/NORMA_00018",
  },
  message_it: "Spessore massimo 40 mm oltre il campo qualificato (\u00a75.7 Tab. 6).",
};

const underClaim = {
  code: "WQ9606_1.CORR.PIPE_DIAMETER",
  family: "correttezza",
  severity: "info",
  status: "verificabile",
  field: "pipe_diameter_min_mm",
  direction: "under_claim",
  read_value: 50,
  expected_value: 25,
  source: {
    norm: "ISO 9606-1",
    edition: "2017",
    clause: "\u00a75.7 Tab. 7",
    text_status: "estratto_ocr",
    ref: "docs/reference/x.md",
  },
  message_it: "Diametro minimo pi\u00f9 stretto di quanto la norma consentirebbe (\u00a75.7 Tab. 7).",
};

const fonteMancante = {
  code: "WQ9606_2.ENGINE.PROFILE",
  family: "completezza",
  severity: "info",
  status: "non_verificabile_fonte_mancante",
  field: "standard_reference",
  direction: null,
  read_value: "EN ISO 9606-5",
  expected_value: null,
  source: { norm: "ISO 9606-5", edition: null, clause: null, text_status: "assente", ref: null },
  message_it: "Norma non coperta dalla libreria di verifica.",
};

const datoMancante = {
  code: "WQ9606_1.CORR.THK_FW",
  family: "correttezza",
  severity: "info",
  status: "non_verificabile_dato_mancante",
  field: "thickness_max_mm",
  direction: null,
  read_value: null,
  expected_value: null,
  source: {
    norm: "ISO 9606-1",
    edition: "2017",
    clause: "\u00a75.7 Tab. 8",
    text_status: "md_integrale",
    ref: "docs/Normative/NORMA_00018",
  },
  message_it: "Spessore di prova assente: ricalcolo non eseguibile (\u00a75.7 Tab. 8).",
};

function resultOf(findings, extra = {}) {
  return {
    profile: "9606-1:BW",
    standard: { family: "9606-1", edition: "2017" },
    findings,
    summary: {
      warn: findings.filter((f) => f.severity === "warn").length,
      info: findings.filter((f) => f.severity === "info" && f.status === "verificabile").length,
      verificabili: findings.filter((f) => f.status === "verificabile").length,
      non_verificabili: findings.filter((f) => f.status !== "verificabile").length,
    },
    engine_version: "test",
    mode: "review",
    ...extra,
  };
}

describe("QualificationVerifyPanel - risultato", () => {
  const full = resultOf([overClaim, underClaim, fonteMancante, datoMancante]);

  it("mostra il riepilogo e raggruppa per severit\u00e0", () => {
    render(<QualificationVerifyPanel result={full} />);
    expect(screen.getByTestId("vfy-summary").textContent).toBe(
      "1 avvisi \u00b7 1 informazioni \u00b7 2 non verificabili"
    );
    const warn = screen.getByTestId("vfy-group-warn");
    expect(within(warn).getAllByTestId("vfy-finding")).toHaveLength(1);
    expect(within(warn).getByText(overClaim.message_it)).toBeTruthy();
    expect(screen.getByTestId("vfy-group-unverifiable")).toBeTruthy();
    expect(screen.getByTestId("vfy-group-info")).toBeTruthy();
  });

  it("l'ordine dei gruppi \u00e8 avvisi, non verificabili, informazioni", () => {
    render(<QualificationVerifyPanel result={full} />);
    const ids = screen
      .getAllByTestId(/^vfy-group-/)
      .map((el) => el.getAttribute("data-testid"));
    expect(ids).toEqual(["vfy-group-warn", "vfy-group-unverifiable", "vfy-group-info"]);
  });

  it("mostra le colonne Letto / Atteso dalla norma / Clausola", () => {
    render(<QualificationVerifyPanel result={full} />);
    const warn = screen.getByTestId("vfy-group-warn");
    expect(within(warn).getByText("Letto")).toBeTruthy();
    expect(within(warn).getByText(/Atteso dalla norma/)).toBeTruthy();
    expect(within(warn).getByText("Clausola")).toBeTruthy();
    expect(within(warn).getByTestId("vfy-read").textContent).toBe("40");
    expect(within(warn).getByTestId("vfy-expected").textContent).toContain("La norma darebbe:");
    expect(within(warn).getByTestId("vfy-expected").textContent).toContain("3 \u2013 24");
    expect(within(warn).getByTestId("vfy-clause").textContent).toBe(
      "ISO 9606-1 \u00b7 2017 \u00b7 \u00a75.7 Tab. 6"
    );
  });

  it("le informazioni sono ripiegate di default e si aprono", () => {
    render(<QualificationVerifyPanel result={full} />);
    const toggle = screen.getByRole("button", { name: /Informazioni \(1\)/ });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByText(underClaim.message_it)).toBeNull();
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText(underClaim.message_it)).toBeTruthy();
    const info = screen.getByTestId("vfy-group-info");
    expect(within(info).getByTestId("vfy-clause").textContent).toContain("\u00a75.7 Tab. 7");
    fireEvent.click(toggle);
    expect(screen.queryByText(underClaim.message_it)).toBeNull();
  });

  it("badge text_status solo se diverso da md_integrale", () => {
    render(<QualificationVerifyPanel result={full} />);
    expect(within(screen.getByTestId("vfy-group-warn")).queryByTestId("vfy-text-status")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Informazioni/ }));
    expect(within(screen.getByTestId("vfy-group-info")).getByTestId("vfy-text-status").textContent).toBe(
      "estratto OCR"
    );
    expect(
      within(screen.getByTestId("vfy-group-unverifiable")).getAllByTestId("vfy-text-status")[0].textContent
    ).toBe("testo norma assente");
  });

  it("i non verificabili mostrano il motivo leggibile e restano visibili", () => {
    render(<QualificationVerifyPanel result={full} />);
    const group = screen.getByTestId("vfy-group-unverifiable");
    const reasons = within(group).getAllByTestId("vfy-reason").map((el) => el.textContent);
    expect(reasons).toEqual([
      "Norma o edizione non coperta dalla libreria",
      "Dato di prova assente sul certificato",
    ]);
    expect(within(group).getAllByText("Non verificabile")).toHaveLength(2);
    const reads = within(group).getAllByTestId("vfy-read").map((el) => el.textContent);
    expect(reads).toEqual(["EN ISO 9606-5", "\u2014"]);
    expect(within(group).getAllByTestId("vfy-expected").map((el) => el.textContent)).toEqual([
      "\u2014",
      "\u2014",
    ]);
  });

  it("mostra sempre la nota che il salvataggio non \u00e8 bloccato", () => {
    render(<QualificationVerifyPanel result={full} />);
    expect(screen.getByTestId("vfy-note").textContent).toBe(VERIFY_NOTE);
    expect(VERIFY_NOTE).toContain("non impediscono il salvataggio");
    expect(VERIFY_NOTE).toContain("validit\u00e0 del certificato resta quello letto");
  });

  it("senza avvisi verificabili mostra solo i non verificabili senza gruppo avvisi", () => {
    render(<QualificationVerifyPanel result={resultOf([datoMancante])} />);
    expect(screen.queryByTestId("vfy-group-warn")).toBeNull();
    expect(screen.queryByTestId("vfy-group-info")).toBeNull();
    expect(screen.getByTestId("vfy-group-unverifiable")).toBeTruthy();
  });
});

describe("QualificationVerifyPanel - stati", () => {
  it("vuoto: Nessun avviso di verifica + nota", () => {
    render(<QualificationVerifyPanel result={resultOf([])} />);
    expect(screen.getByTestId("vfy-empty").textContent).toBe("Nessun avviso di verifica");
    expect(screen.getByTestId("vfy-note").textContent).toBe(VERIFY_NOTE);
    expect(screen.queryByTestId("vfy-retry")).toBeNull();
  });

  it("senza result (ready) \u00e8 vuoto, non genera errori", () => {
    render(<QualificationVerifyPanel />);
    expect(screen.getByTestId("vfy-empty")).toBeTruthy();
  });

  it("loading: aria-busy, Riprova visibile ma disabilitato con title", () => {
    const onRetry = vi.fn();
    render(<QualificationVerifyPanel status="loading" onRetry={onRetry} />);
    expect(screen.getByTestId("vfy-panel").getAttribute("aria-busy")).toBe("true");
    expect(screen.getByTestId("vfy-loading")).toBeTruthy();
    const retry = screen.getByTestId("vfy-retry");
    expect(retry.disabled).toBe(true);
    expect(retry.getAttribute("title")).toBe("Verifica in corso");
    fireEvent.click(retry);
    expect(onRetry).not.toHaveBeenCalled();
    expect(screen.getByTestId("vfy-note").textContent).toBe(VERIFY_NOTE);
  });

  it("errore: role=alert con messaggio e Riprova richiama onRetry", () => {
    const onRetry = vi.fn();
    render(<QualificationVerifyPanel status="error" errorMessage="Servizio non raggiungibile" onRetry={onRetry} />);
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toBe("Servizio non raggiungibile");
    const retry = screen.getByRole("button", { name: "Riprova" });
    expect(retry.disabled).toBe(false);
    fireEvent.click(retry);
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("vfy-panel").getAttribute("aria-busy")).toBe("false");
  });

  it("errore senza messaggio usa il testo di default; senza onRetry il pulsante resta visibile e disabilitato", () => {
    render(<QualificationVerifyPanel status="error" />);
    expect(screen.getByRole("alert").textContent).toBe("Errore durante la verifica");
    const retry = screen.getByTestId("vfy-retry");
    expect(retry.disabled).toBe(true);
    expect(retry.getAttribute("title")).toBeTruthy();
  });

  it("offline: messaggio dedicato, nessun blocco del salvataggio", () => {
    render(<QualificationVerifyPanel status="offline" />);
    expect(screen.getByTestId("vfy-offline").textContent).toContain(
      "Verifica non disponibile offline: il salvataggio non dipende da essa"
    );
    expect(screen.getByTestId("vfy-note").textContent).toBe(VERIFY_NOTE);
  });

  it("non espone callback di blocco e non ha pulsanti di salvataggio", () => {
    render(<QualificationVerifyPanel result={resultOf([overClaim])} onRetry={() => {}} />);
    expect(screen.queryByRole("button", { name: /salva|conferma/i })).toBeNull();
    expect(QualificationVerifyPanel.length).toBe(1);
  });
});

describe("helper", () => {
  it("formatVerifyValue", () => {
    expect(formatVerifyValue(null)).toBe("\u2014");
    expect(formatVerifyValue(undefined)).toBe("\u2014");
    expect(formatVerifyValue("")).toBe("\u2014");
    expect(formatVerifyValue(0)).toBe("0");
    expect(formatVerifyValue(["PA", "PF"])).toBe("PA, PF");
    expect(formatVerifyValue([])).toBe("\u2014");
    expect(formatVerifyValue(true)).toBe("S\u00ec");
    expect(formatVerifyValue({ min: 3, max: null })).toBe("3 \u2013 \u2014");
    expect(formatVerifyValue({ a: 1 })).toBe('{"a":1}');
  });

  it("groupVerifyFindings tollera input non valido", () => {
    expect(groupVerifyFindings(undefined)).toEqual({ warn: [], info: [], unverifiable: [] });
  });
});

describe("apiService.verifyQualification", () => {
  it("POST /qualifications/verify con payload { fields, qualification_type }", async () => {
    const spy = vi.spyOn(apiService, "post").mockResolvedValue({ verification: resultOf([]) });
    const fields = { welding_process: "141", thickness_s_test_mm: 6 };
    const data = await apiService.verifyQualification(fields, { qualificationType: "welder_9606" });
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith("/qualifications/verify", {
      fields,
      qualification_type: "welder_9606",
    });
    expect(data.verification.findings).toEqual([]);
    spy.mockRestore();
  });

  it("sul filo: metodo POST, URL /qualifications/verify e body JSON", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => "application/json" },
      json: async () => ({ verification: resultOf([]) }),
      text: async () => "",
    });
    vi.stubGlobal("fetch", fetchMock);
    try {
      await apiService.verifyQualification({ welding_process: "141" }, { qualificationType: "welder_9606" });
    } finally {
      vi.unstubAllGlobals();
    }
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, opts] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/\/qualifications\/verify$/);
    expect(opts.method).toBe("POST");
    expect(JSON.parse(opts.body)).toEqual({
      fields: { welding_process: "141" },
      qualification_type: "welder_9606",
    });
  });

  it("senza opzioni non lancia", async () => {
    const spy = vi.spyOn(apiService, "post").mockResolvedValue({ verification: null });
    await apiService.verifyQualification({ a: 1 });
    expect(spy).toHaveBeenCalledWith("/qualifications/verify", { fields: { a: 1 }, qualification_type: undefined });
    spy.mockRestore();
  });
});
