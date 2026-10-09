/**
 * @vitest-environment jsdom
 */
import React, { useState } from "react";
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, fireEvent, within, cleanup } from "@testing-library/react";
import WpqrTestRunsEditor, {
  TEST_RUNS_NOTE,
  TEST_RUNS_EMPTY,
  parseDecimal,
  runNoFromLabel,
} from "../components/WpqrTestRunsEditor";
import apiService from "../services/apiService";

afterEach(() => cleanup());

const ARC_RUN = {
  id: 11,
  run_no: 1,
  run_label: "1",
  welding_process: "135",
  filler_diameter_mm: 1.2,
  current_a: 220,
  voltage_v: 24.5,
  current_polarity: "DC-EP",
  travel_speed: 4.5,
  travel_speed_unit: "mm/s",
  heat_input_value: 0.9,
  heat_input_unit: "kJ/mm",
  source: "ai",
};

function setValue(el, text) {
  fireEvent.change(el, { target: { value: text } });
}

function Harness({ initial = [], onChangeSpy, ...props }) {
  const [runs, setRuns] = useState(initial);
  return (
    <WpqrTestRunsEditor
      value={runs}
      onChange={(next) => { onChangeSpy?.(next); setRuns(next); }}
      {...props}
    />
  );
}

describe("WpqrTestRunsEditor — render e righe", () => {
  it("value vuoto: testo fisso, stato vuoto, pulsante Aggiungi visibile", () => {
    render(<WpqrTestRunsEditor value={[]} onChange={vi.fn()} />);
    expect(screen.getByTestId("wtr-note")).toHaveTextContent(TEST_RUNS_NOTE);
    expect(screen.getByTestId("wtr-empty")).toHaveTextContent(TEST_RUNS_EMPTY);
    expect(screen.queryByTestId("wtr-table")).toBeNull();
    expect(screen.getByTestId("wtr-add")).toBeEnabled();
  });

  it("value popolato: mostra le colonne arco con valori, unità e senza velocità filo", () => {
    render(<WpqrTestRunsEditor value={[ARC_RUN]} onChange={vi.fn()} />);
    expect(screen.getByTestId("wtr-editor")).toHaveAttribute("data-variant", "arc");
    const headers = screen.getAllByRole("columnheader").map((h) => h.textContent);
    expect(headers).toEqual(expect.arrayContaining([
      "Passata", "Processo", "Ø filler (mm)", "Corrente (A)", "Tensione (V)",
      "Corrente/polarità", "Avanzamento", "Apporto termico", "Trasferimento", "Note",
    ]));
    expect(headers).not.toContain("Velocità filo");
    expect(screen.getByLabelText("Corrente (A) — riga 1")).toHaveValue("220");
    expect(screen.getByLabelText("Avanzamento unità — riga 1")).toHaveValue("mm/s");
    expect(screen.getByLabelText("Apporto termico unità — riga 1")).toHaveValue("kJ/mm");
  });

  it("aggiunge una passata (etichetta proposta) e la rimuove", () => {
    const spy = vi.fn();
    render(<Harness initial={[ARC_RUN]} onChangeSpy={spy} />);
    fireEvent.click(screen.getByTestId("wtr-add"));
    expect(screen.getAllByTestId("wtr-row")).toHaveLength(2);
    expect(spy).toHaveBeenCalledTimes(1);
    const added = spy.mock.calls[0][0];
    expect(added).toHaveLength(2);
    expect(added[1]).toEqual(expect.objectContaining({ run_label: "2", run_no: 2, current_a: null }));

    const rows = screen.getAllByTestId("wtr-row");
    fireEvent.click(within(rows[0]).getByTestId("wtr-remove"));
    expect(screen.getAllByTestId("wtr-row")).toHaveLength(1);
    const afterRemove = spy.mock.calls[1][0];
    expect(afterRemove).toHaveLength(1);
    expect(afterRemove[0].run_label).toBe("2");
  });

  it("sync da props: un nuovo value dal parent ricostruisce le righe", () => {
    const { rerender } = render(<WpqrTestRunsEditor value={[]} onChange={vi.fn()} />);
    expect(screen.getByTestId("wtr-empty")).toBeInTheDocument();
    rerender(<WpqrTestRunsEditor value={[ARC_RUN]} onChange={vi.fn()} />);
    expect(screen.getAllByTestId("wtr-row")).toHaveLength(1);
  });
});

describe("WpqrTestRunsEditor — onChange al blur", () => {
  it("non emette durante la digitazione; emette al blur con payload atteso", () => {
    const spy = vi.fn();
    render(<Harness initial={[ARC_RUN]} onChangeSpy={spy} />);
    const current = screen.getByLabelText("Corrente (A) — riga 1");
    setValue(current, "235");
    expect(spy).not.toHaveBeenCalled();
    expect(current).toHaveValue("235");
    fireEvent.blur(current);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0][0]).toEqual({ ...ARC_RUN, current_a: 235, run_no: 1, run_label: "1",
      current_polarity: "DC-EP", metal_transfer: null, remarks: null,
      wire_feed_speed: null, wire_feed_unit: null });
  });

  it("blur senza modifiche non emette", () => {
    const spy = vi.fn();
    render(<Harness initial={[ARC_RUN]} onChangeSpy={spy} />);
    fireEvent.blur(screen.getByLabelText("Corrente (A) — riga 1"));
    expect(spy).not.toHaveBeenCalled();
  });

  it("separatore decimale: virgola e punto; valore vuoto → null", () => {
    const spy = vi.fn();
    render(<Harness initial={[ARC_RUN]} onChangeSpy={spy} />);
    const voltage = screen.getByLabelText("Tensione (V) — riga 1");
    setValue(voltage, "25,5");
    fireEvent.blur(voltage);
    expect(spy.mock.calls[0][0][0].voltage_v).toBe(25.5);

    const filler = screen.getByLabelText("Ø filler (mm) — riga 1");
    setValue(filler, "1.6");
    fireEvent.blur(filler);
    expect(spy.mock.calls[1][0][0].filler_diameter_mm).toBe(1.6);

    setValue(voltage, "");
    fireEvent.blur(voltage);
    expect(spy.mock.calls[2][0][0].voltage_v).toBeNull();
  });

  it("etichetta non intera conservata come testo; run_no = primo intero", () => {
    const spy = vi.fn();
    render(<Harness initial={[ARC_RUN]} onChangeSpy={spy} />);
    const label = screen.getByLabelText("Passata — riga 1");
    setValue(label, "2 +n");
    fireEvent.blur(label);
    expect(spy.mock.calls[0][0][0]).toEqual(expect.objectContaining({ run_label: "2 +n", run_no: 2 }));
    expect(screen.getByLabelText("Passata — riga 1")).toHaveValue("2 +n");
    setValue(label, "3-4");
    fireEvent.blur(label);
    expect(spy.mock.calls[1][0][0]).toEqual(expect.objectContaining({ run_label: "3-4", run_no: 3 }));
    setValue(label, "n");
    fireEvent.blur(label);
    expect(spy.mock.calls[2][0][0]).toEqual(expect.objectContaining({ run_label: "n", run_no: null }));
  });

  it("i campi non gestiti dalla vista (id, source) passano invariati", () => {
    const spy = vi.fn();
    render(<Harness initial={[{ ...ARC_RUN, filler_designation: "G3Si1" }]} onChangeSpy={spy} />);
    const proc = screen.getByLabelText("Processo — riga 1");
    setValue(proc, "121");
    fireEvent.blur(proc);
    expect(spy.mock.calls[0][0][0]).toEqual(expect.objectContaining({
      id: 11, source: "ai", filler_designation: "G3Si1", welding_process: "121",
    }));
  });

  it("nessuna conversione automatica delle unità", () => {
    const spy = vi.fn();
    render(<Harness initial={[ARC_RUN]} onChangeSpy={spy} />);
    setValue(screen.getByLabelText("Apporto termico unità — riga 1"), "kJ/cm");
    const out = spy.mock.calls[0][0][0];
    expect(out.heat_input_unit).toBe("kJ/cm");
    expect(out.heat_input_value).toBe(0.9);
  });
});

describe("WpqrTestRunsEditor — validazione formale (non bloccante)", () => {
  it("unità mancante con valore presente: avviso role=alert, onChange comunque emesso", () => {
    const spy = vi.fn();
    render(<Harness initial={[{ ...ARC_RUN, travel_speed_unit: null }]} onChangeSpy={spy} />);
    const speed = screen.getByLabelText("Avanzamento — riga 1");
    setValue(speed, "5");
    fireEvent.blur(speed);
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Selezionare l'unità di misura.");
    expect(speed).toHaveAttribute("aria-invalid", "true");
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0][0]).toEqual(expect.objectContaining({ travel_speed: 5, travel_speed_unit: null }));

    setValue(screen.getByLabelText("Avanzamento unità — riga 1"), "mm/s");
    expect(screen.queryByRole("alert")).toBeNull();
    expect(spy.mock.calls[1][0][0].travel_speed_unit).toBe("mm/s");
  });

  it("apporto termico senza unità segnalato; valore non numerico segnalato", () => {
    render(<Harness initial={[{ ...ARC_RUN, heat_input_unit: null }]} />);
    const heat = screen.getByLabelText("Apporto termico — riga 1");
    fireEvent.blur(heat);
    expect(screen.getByRole("alert")).toHaveTextContent("Selezionare l'unità di misura.");

    const current = screen.getByLabelText("Corrente (A) — riga 1");
    setValue(current, "abc");
    fireEvent.blur(current);
    expect(screen.getAllByRole("alert").map((a) => a.textContent)).toContain("Inserire un numero (virgola o punto).");
  });

  it("corrente e tensione sono valori singoli: nessun controllo min ≤ max", () => {
    render(<Harness initial={[ARC_RUN]} />);
    const current = screen.getByLabelText("Corrente (A) — riga 1");
    setValue(current, "300");
    fireEvent.blur(current);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("valore vuoto con unità selezionata: nessun avviso", () => {
    render(<Harness initial={[{ ...ARC_RUN, heat_input_value: null }]} />);
    fireEvent.blur(screen.getByLabelText("Apporto termico — riga 1"));
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("WpqrTestRunsEditor — velocità filo opzionale", () => {
  it("assente dalla vista di default; attivabile con il controllo sempre visibile", () => {
    const spy = vi.fn();
    render(<Harness initial={[ARC_RUN]} onChangeSpy={spy} />);
    expect(screen.queryByLabelText("Velocità filo — riga 1")).toBeNull();
    fireEvent.click(screen.getByTestId("wtr-toggle-wire"));
    const wire = screen.getByLabelText("Velocità filo — riga 1");
    setValue(wire, "8,5");
    fireEvent.blur(wire);
    expect(screen.getByRole("alert")).toHaveTextContent("Selezionare l'unità di misura.");
    setValue(screen.getByLabelText("Velocità filo unità — riga 1"), "m/min");
    const out = spy.mock.calls.at(-1)[0][0];
    expect(out).toEqual(expect.objectContaining({ wire_feed_speed: 8.5, wire_feed_unit: "m/min" }));
  });

  it("se il dato esiste già la colonna è mostrata", () => {
    render(<WpqrTestRunsEditor value={[{ ...ARC_RUN, wire_feed_speed: 7, wire_feed_unit: "m/min" }]} onChange={vi.fn()} />);
    expect(screen.getByLabelText("Velocità filo — riga 1")).toHaveValue("7");
  });
});

describe("WpqrTestRunsEditor — variante stud 14555", () => {
  const STUD_RUN = { run_label: "1", current_a: 1200, weld_time_ms: 25, protrusion_mm: 3, lift_mm: 1.5 };

  it("mostra le colonne stud e non quelle ad arco", () => {
    render(<WpqrTestRunsEditor value={[STUD_RUN]} onChange={vi.fn()} standardFamily="14555" />);
    expect(screen.getByTestId("wtr-editor")).toHaveAttribute("data-variant", "stud");
    const headers = screen.getAllByRole("columnheader").map((h) => h.textContent);
    expect(headers).toEqual(expect.arrayContaining([
      "Riga", "Corrente (A)", "Tempo (ms)", "Sporgenza (mm)", "Alzata (mm)", "Note",
    ]));
    ["Processo", "Tensione (V)", "Avanzamento", "Apporto termico", "Ø filler (mm)"].forEach((h) => {
      expect(headers).not.toContain(h);
    });
    expect(headers).not.toContain("Capacità (mF)");
    expect(screen.queryByTestId("wtr-toggle-wire")).toBeNull();
  });

  it("scarica capacitiva: colonne attivabili e payload numerico", () => {
    const spy = vi.fn();
    render(<Harness initial={[STUD_RUN]} onChangeSpy={spy} standardFamily="14555" />);
    fireEvent.click(screen.getByTestId("wtr-toggle-capacitive"));
    const headers = screen.getAllByRole("columnheader").map((h) => h.textContent);
    expect(headers).toEqual(expect.arrayContaining([
      "Capacità (mF)", "Tensione di carica (V)", "Gap/lift (mm)", "Forza molla (N)",
    ]));
    const cap = screen.getByLabelText("Capacità (mF) — riga 1");
    setValue(cap, "4,7");
    fireEvent.blur(cap);
    expect(spy.mock.calls[0][0][0]).toEqual(expect.objectContaining({
      capacitance_mf: 4.7, current_a: 1200, weld_time_ms: 25, protrusion_mm: 3, lift_mm: 1.5,
    }));
  });

  it("dati capacitivi già presenti: colonne mostrate", () => {
    render(<WpqrTestRunsEditor value={[{ ...STUD_RUN, capacitance_mf: 10 }]} onChange={vi.fn()} standardFamily="14555" />);
    expect(screen.getByLabelText("Capacità (mF) — riga 1")).toHaveValue("10");
  });
});

describe("WpqrTestRunsEditor — readOnly / disabled", () => {
  it("readOnly: pulsanti visibili e disabilitati con title; campi non modificabili", () => {
    const spy = vi.fn();
    render(<WpqrTestRunsEditor value={[ARC_RUN]} onChange={spy} readOnly />);
    const add = screen.getByTestId("wtr-add");
    const remove = screen.getByTestId("wtr-remove");
    [add, remove].forEach((b) => {
      expect(b).toBeVisible();
      expect(b).toBeDisabled();
      expect(b).toHaveAttribute("title", expect.stringContaining("Sola lettura"));
    });
    expect(screen.getByLabelText("Corrente (A) — riga 1")).toHaveAttribute("readonly");
    expect(screen.getByLabelText("Avanzamento unità — riga 1")).toBeDisabled();
    fireEvent.blur(screen.getByLabelText("Corrente (A) — riga 1"));
    expect(spy).not.toHaveBeenCalled();
  });

  it("disabled: pulsanti visibili e disabilitati con title dedicato", () => {
    render(<WpqrTestRunsEditor value={[ARC_RUN]} onChange={vi.fn()} disabled />);
    expect(screen.getByTestId("wtr-add")).toBeDisabled();
    expect(screen.getByTestId("wtr-add")).toHaveAttribute("title", expect.stringContaining("non disponibile"));
    expect(screen.getByTestId("wtr-remove")).toBeDisabled();
  });
});

describe("helper", () => {
  it("parseDecimal / runNoFromLabel", () => {
    expect(parseDecimal("1,25")).toBe(1.25);
    expect(parseDecimal(" 3.5 ")).toBe(3.5);
    expect(parseDecimal("")).toBeNull();
    expect(parseDecimal("1,2,3")).toBeNull();
    expect(runNoFromLabel("2 +n")).toBe(2);
    expect(runNoFromLabel("3-4")).toBe(3);
    expect(runNoFromLabel("")).toBeNull();
  });
});

describe("apiService — metodi WPQR (WV-6a, endpoint in WV-4a/WV-5c)", () => {
  beforeEach(() => { vi.restoreAllMocks(); });

  it("getWpqrTestRuns → GET /welding/wpqr/:id/test-runs", async () => {
    const spy = vi.spyOn(apiService, "get").mockResolvedValue({ runs: [] });
    const res = await apiService.getWpqrTestRuns(42);
    expect(spy).toHaveBeenCalledWith("/welding/wpqr/42/test-runs");
    expect(res).toEqual({ runs: [] });
  });

  it("saveWpqrTestRuns → PUT /welding/wpqr/:id/test-runs con { runs }", async () => {
    const spy = vi.spyOn(apiService, "put").mockResolvedValue({ runs: [ARC_RUN] });
    await apiService.saveWpqrTestRuns(42, [ARC_RUN]);
    expect(spy).toHaveBeenCalledWith("/welding/wpqr/42/test-runs", { runs: [ARC_RUN] });
  });

  it("verifyWpqr → POST /welding/wpqr/verify con { fields, runs, standard_reference }", async () => {
    const spy = vi.spyOn(apiService, "post").mockResolvedValue({ verification: {} });
    await apiService.verifyWpqr({ welding_process: "135" }, { runs: [ARC_RUN], standardReference: "ISO 15614-1:2017" });
    expect(spy).toHaveBeenCalledWith("/welding/wpqr/verify", {
      fields: { welding_process: "135" },
      runs: [ARC_RUN],
      standard_reference: "ISO 15614-1:2017",
    });
  });
});
