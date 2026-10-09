/**
 * WpqrTestRunsEditor (WV-6a) — tabella passate della seconda pagina della WPQR.
 * Controllato e presentazionale: nessun fetch, nessuna persistenza (le rotte nascono in WV-4/WV-5c).
 * `onChange(nextRuns)` parte a ogni modifica confermata (blur / selezione unità / aggiungi / rimuovi);
 * la validazione formale non blocca mai `onChange`. Non è montato in nessuna pagina (WV-6b).
 * Contratto colonne: docs/agent-tasks/PLAN_VERIFICA_WPQR_SLICES.md § 2.2.
 * DNA: schema `sq-cov-*` di CoverageVerifyPanel (nessun look nuovo).
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import "./CoverageVerifyPanel.css";
import "./WpqrTestRunsEditor.css";

export const TEST_RUNS_NOTE =
  "Valori di prova letti dalla seconda pagina della WPQR. Le righe contrassegnate con * nel modulo sono facoltative.";
export const TEST_RUNS_EMPTY = "Nessuna passata archiviata";

export const TRAVEL_SPEED_UNITS = ["mm/min", "mm/s", "cm/min"];
export const HEAT_INPUT_UNITS = ["kJ/mm", "J/mm", "kJ/cm"];
export const WIRE_FEED_UNITS = ["m/min", "mm/s"];

const UNIT_PAIRS = {
  travel_speed: { unitField: "travel_speed_unit", units: TRAVEL_SPEED_UNITS, label: "Avanzamento" },
  heat_input_value: { unitField: "heat_input_unit", units: HEAT_INPUT_UNITS, label: "Apporto termico" },
  wire_feed_speed: { unitField: "wire_feed_unit", units: WIRE_FEED_UNITS, label: "Velocità filo" },
};

const ARC_NUMERIC = ["filler_diameter_mm", "current_a", "voltage_v"];
const ARC_TEXT = ["run_label", "welding_process", "current_polarity", "metal_transfer", "remarks"];
const STUD_NUMERIC = [
  "current_a", "weld_time_ms", "protrusion_mm", "lift_mm",
  "capacitance_mf", "charging_voltage_v", "gap_lift_mm", "spring_force_n",
];
const STUD_TEXT = ["run_label", "remarks"];
const CAPACITIVE_FIELDS = ["capacitance_mf", "charging_voltage_v", "gap_lift_mm", "spring_force_n"];

const NUMERIC_RE = /^-?\d+(\.\d+)?$/;
const MSG_NUMBER = "Inserire un numero (virgola o punto).";
const MSG_UNIT = "Selezionare l'unità di misura.";
const TITLE_READONLY = "Sola lettura: le passate non sono modificabili";
const TITLE_DISABLED = "Modifica non disponibile al momento";

/** Colonne arco (15614-1/-2): `kind` guida il rendering della cella. */
const ARC_COLUMNS = [
  { field: "run_label", header: "Passata", kind: "text", width: "narrow" },
  { field: "welding_process", header: "Processo", kind: "text", width: "narrow" },
  { field: "filler_diameter_mm", header: "Ø filler (mm)", kind: "number" },
  { field: "current_a", header: "Corrente (A)", kind: "number" },
  { field: "voltage_v", header: "Tensione (V)", kind: "number" },
  { field: "current_polarity", header: "Corrente/polarità", kind: "text", width: "narrow", placeholder: "Come in testata" },
  { field: "wire_feed_speed", header: "Velocità filo", kind: "unit", optional: "wire" },
  { field: "travel_speed", header: "Avanzamento", kind: "unit" },
  { field: "heat_input_value", header: "Apporto termico", kind: "unit" },
  { field: "metal_transfer", header: "Trasferimento", kind: "text", width: "narrow" },
  { field: "remarks", header: "Note", kind: "text", width: "wide" },
];

/** Colonne stud (14555 Annex C): 1–2 righe per WPQR; la seconda tabella solo per scarica capacitiva. */
const STUD_COLUMNS = [
  { field: "run_label", header: "Riga", kind: "text", width: "narrow" },
  { field: "current_a", header: "Corrente (A)", kind: "number" },
  { field: "weld_time_ms", header: "Tempo (ms)", kind: "number" },
  { field: "protrusion_mm", header: "Sporgenza (mm)", kind: "number" },
  { field: "lift_mm", header: "Alzata (mm)", kind: "number" },
  { field: "capacitance_mf", header: "Capacità (mF)", kind: "number", optional: "capacitive" },
  { field: "charging_voltage_v", header: "Tensione di carica (V)", kind: "number", optional: "capacitive" },
  { field: "gap_lift_mm", header: "Gap/lift (mm)", kind: "number", optional: "capacitive" },
  { field: "spring_force_n", header: "Forza molla (N)", kind: "number", optional: "capacitive" },
  { field: "remarks", header: "Note", kind: "text", width: "wide" },
];

function isBlank(v) {
  return v === null || v === undefined || String(v).trim() === "";
}

/** Valore numerico → testo con punto decimale; null/undefined → "". */
function toDraft(v) {
  return isBlank(v) ? "" : String(v);
}

/** Testo digitato → numero (virgola o punto) oppure null se vuoto/non numerico. */
export function parseDecimal(raw) {
  if (isBlank(raw)) return null;
  const normalized = String(raw).trim().replace(",", ".");
  if (!NUMERIC_RE.test(normalized)) return null;
  return Number(normalized);
}

/** `run_no` = primo intero dell'etichetta («2 +n» → 2, «3-4» → 3); nessun intero → null. */
export function runNoFromLabel(label) {
  const m = /\d+/.exec(String(label ?? ""));
  return m ? Number(m[0]) : null;
}

function fieldsFor(isStud) {
  return {
    numeric: isStud ? STUD_NUMERIC : ARC_NUMERIC,
    text: isStud ? STUD_TEXT : ARC_TEXT,
    pairs: isStud ? [] : Object.keys(UNIT_PAIRS),
  };
}

function draftFromRun(run, isStud) {
  const { numeric, text, pairs } = fieldsFor(isStud);
  const draft = {};
  numeric.forEach((f) => { draft[f] = toDraft(run[f]); });
  text.forEach((f) => { draft[f] = toDraft(run[f]); });
  pairs.forEach((f) => {
    draft[f] = toDraft(run[f]);
    draft[UNIT_PAIRS[f].unitField] = toDraft(run[UNIT_PAIRS[f].unitField]);
  });
  return draft;
}

/** Riga di payload: i campi non gestiti dalla vista (id, source, …) passano invariati. */
function payloadFromRow(row, isStud) {
  const { numeric, text, pairs } = fieldsFor(isStud);
  const out = { ...row.data };
  numeric.forEach((f) => { out[f] = parseDecimal(row.draft[f]); });
  text.forEach((f) => { out[f] = isBlank(row.draft[f]) ? null : String(row.draft[f]).trim(); });
  pairs.forEach((f) => {
    const { unitField } = UNIT_PAIRS[f];
    out[f] = parseDecimal(row.draft[f]);
    out[unitField] = isBlank(row.draft[unitField]) ? null : row.draft[unitField];
  });
  out.run_no = runNoFromLabel(out.run_label);
  return out;
}

/** Gruppo di validazione di un campo: le coppie valore+unità si validano insieme. */
function groupOf(field) {
  const pair = Object.entries(UNIT_PAIRS).find(([f, p]) => f === field || p.unitField === field);
  return pair ? pair[0] : field;
}

function validateGroup(draft, group) {
  const pair = UNIT_PAIRS[group];
  const raw = draft[group];
  if (!isBlank(raw) && parseDecimal(raw) === null) return MSG_NUMBER;
  if (pair && !isBlank(raw) && isBlank(draft[pair.unitField])) return MSG_UNIT;
  return null;
}

function hasWireData(runs) {
  return runs.some((r) => !isBlank(r?.wire_feed_speed) || !isBlank(r?.wire_feed_unit));
}

function hasCapacitiveData(runs) {
  return runs.some((r) => CAPACITIVE_FIELDS.some((f) => !isBlank(r?.[f])));
}

function UnitSelect({ value, units, label, disabled, onChange, onBlur }) {
  const options = value && !units.includes(value) ? [...units, value] : units;
  return (
    <select
      className="sq-select wtr-unit"
      aria-label={label}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
    >
      <option value="">Unità</option>
      {options.map((u) => <option key={u} value={u}>{u}</option>)}
    </select>
  );
}

/**
 * @param {object} props
 * @param {object[]} [props.value] passate (contratto § 2.2)
 * @param {(runs: object[]) => void} [props.onChange]
 * @param {boolean} [props.readOnly]
 * @param {boolean} [props.disabled]
 * @param {string} [props.standardFamily] '15614-1' | '15614-2' | '15613' | '14555'
 */
export default function WpqrTestRunsEditor({
  value = [],
  onChange,
  readOnly = false,
  standardFamily = "15614-1",
  disabled = false,
}) {
  const isStud = String(standardFamily) === "14555";
  const locked = readOnly || disabled;
  const lockTitle = disabled ? TITLE_DISABLED : TITLE_READONLY;

  const keySeq = useRef(0);
  const makeRow = (run) => ({
    key: `r${++keySeq.current}`,
    data: run && typeof run === "object" ? run : {},
    draft: draftFromRun(run || {}, isStud),
  });

  const [rows, setRows] = useState(() => (Array.isArray(value) ? value : []).map(makeRow));
  const rowsRef = useRef(rows);
  const [errors, setErrors] = useState({});
  const [showWire, setShowWire] = useState(() => hasWireData(Array.isArray(value) ? value : []));
  const [showCapacitive, setShowCapacitive] = useState(() => hasCapacitiveData(Array.isArray(value) ? value : []));

  const serializeRows = (list) => JSON.stringify(list.map((r) => payloadFromRow(r, isStud)));
  const lastSyncedRef = useRef(JSON.stringify(Array.isArray(value) ? value : []));
  const committedRef = useRef(serializeRows(rows));

  const applyRows = (next) => {
    rowsRef.current = next;
    setRows(next);
  };

  useEffect(() => {
    const incoming = Array.isArray(value) ? value : [];
    const serialized = JSON.stringify(incoming);
    if (serialized === lastSyncedRef.current) return;
    lastSyncedRef.current = serialized;
    const nextRows = incoming.map(makeRow);
    committedRef.current = serializeRows(nextRows);
    applyRows(nextRows);
    setErrors({});
    if (hasWireData(incoming)) setShowWire(true);
    if (hasCapacitiveData(incoming)) setShowCapacitive(true);
    // makeRow dipende solo da isStud e da un contatore di ref
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const columns = useMemo(() => {
    const base = isStud ? STUD_COLUMNS : ARC_COLUMNS;
    return base.filter((c) => {
      if (c.optional === "wire") return showWire;
      if (c.optional === "capacitive") return showCapacitive;
      return true;
    });
  }, [isStud, showWire, showCapacitive]);

  const commit = (nextRows) => {
    const payload = nextRows.map((r) => payloadFromRow(r, isStud));
    const serialized = JSON.stringify(payload);
    if (serialized === committedRef.current) return;
    committedRef.current = serialized;
    lastSyncedRef.current = serialized;
    if (onChange) onChange(payload);
  };

  const setDraft = (rowKey, field, text) => {
    applyRows(rowsRef.current.map((r) => (
      r.key === rowKey ? { ...r, draft: { ...r.draft, [field]: text } } : r
    )));
  };

  const validate = (rowKey, field) => {
    const row = rowsRef.current.find((r) => r.key === rowKey);
    if (!row) return;
    const group = groupOf(field);
    const message = validateGroup(row.draft, group);
    setErrors((prev) => {
      const rowErrors = { ...(prev[rowKey] || {}) };
      if (message) rowErrors[group] = message; else delete rowErrors[group];
      return { ...prev, [rowKey]: rowErrors };
    });
  };

  const handleBlur = (rowKey, field) => {
    if (locked) return;
    validate(rowKey, field);
    commit(rowsRef.current);
  };

  const handleUnitChange = (rowKey, field, text) => {
    setDraft(rowKey, field, text);
    validate(rowKey, field);
    commit(rowsRef.current);
  };

  const addRow = () => {
    if (locked) return;
    const row = makeRow({});
    row.draft.run_label = String(rowsRef.current.length + 1);
    const next = [...rowsRef.current, row];
    applyRows(next);
    commit(next);
  };

  const removeRow = (rowKey) => {
    if (locked) return;
    const next = rowsRef.current.filter((r) => r.key !== rowKey);
    applyRows(next);
    setErrors((prev) => {
      const { [rowKey]: _removed, ...rest } = prev;
      return rest;
    });
    commit(next);
  };

  const renderCell = (row, rowIdx, col) => {
    const label = `${col.header} — riga ${rowIdx + 1}`;
    const errorId = `${row.key}-${col.field}-err`;
    const error = errors[row.key]?.[col.field];
    const inputProps = {
      "aria-label": label,
      "aria-invalid": error ? "true" : undefined,
      "aria-describedby": error ? errorId : undefined,
      readOnly: locked,
    };

    if (col.kind === "text") {
      return (
        <input
          type="text"
          className={`sq-search wtr-input wtr-${col.width || "narrow"}`}
          value={row.draft[col.field]}
          placeholder={col.placeholder}
          {...inputProps}
          onChange={(e) => setDraft(row.key, col.field, e.target.value)}
          onBlur={() => handleBlur(row.key, col.field)}
        />
      );
    }

    if (col.kind === "number") {
      return (
        <>
          <input
            type="text"
            inputMode="decimal"
            className="sq-search wtr-input wtr-num"
            value={row.draft[col.field]}
            {...inputProps}
            onChange={(e) => setDraft(row.key, col.field, e.target.value)}
            onBlur={() => handleBlur(row.key, col.field)}
          />
          {error && <p id={errorId} role="alert" className="wtr-error">{error}</p>}
        </>
      );
    }

    const pair = UNIT_PAIRS[col.field];
    return (
      <>
        <div className="wtr-pair">
          <input
            type="text"
            inputMode="decimal"
            className="sq-search wtr-input wtr-num"
            value={row.draft[col.field]}
            {...inputProps}
            onChange={(e) => setDraft(row.key, col.field, e.target.value)}
            onBlur={() => handleBlur(row.key, col.field)}
          />
          <UnitSelect
            value={row.draft[pair.unitField]}
            units={pair.units}
            label={`${pair.label} unità — riga ${rowIdx + 1}`}
            disabled={locked}
            onChange={(text) => handleUnitChange(row.key, pair.unitField, text)}
            onBlur={() => handleBlur(row.key, pair.unitField)}
          />
        </div>
        {error && <p id={errorId} role="alert" className="wtr-error">{error}</p>}
      </>
    );
  };

  return (
    <div className="sq-cov-panel wtr-editor" data-testid="wtr-editor" data-variant={isStud ? "stud" : "arc"}>
      <p className="sq-cov-hint" data-testid="wtr-note">{TEST_RUNS_NOTE}</p>

      <div className="sq-cov-section-actions">
        <button
          type="button"
          className="sq-btn-new"
          data-testid="wtr-add"
          onClick={addRow}
          disabled={locked}
          title={locked ? lockTitle : "Aggiungi una passata in fondo alla tabella"}
        >
          Aggiungi passata
        </button>
        {isStud ? (
          <label className="wtr-toggle">
            <input
              type="checkbox"
              data-testid="wtr-toggle-capacitive"
              checked={showCapacitive}
              onChange={(e) => setShowCapacitive(e.target.checked)}
            />
            Mostra colonne scarica capacitiva
          </label>
        ) : (
          <label className="wtr-toggle">
            <input
              type="checkbox"
              data-testid="wtr-toggle-wire"
              checked={showWire}
              onChange={(e) => setShowWire(e.target.checked)}
            />
            Mostra velocità filo
          </label>
        )}
      </div>

      {rows.length === 0 ? (
        <p className="sq-cov-stub-msg" data-testid="wtr-empty">{TEST_RUNS_EMPTY}</p>
      ) : (
        <div className="wtr-scroll">
          <table className="sq-cov-table wtr-table" data-testid="wtr-table">
            <thead>
              <tr>
                {columns.map((c) => <th key={c.field} scope="col">{c.header}</th>)}
                <th scope="col"><span className="wtr-sr">Azioni</span></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIdx) => (
                <tr key={row.key} data-testid="wtr-row">
                  {columns.map((c) => <td key={c.field}>{renderCell(row, rowIdx, c)}</td>)}
                  <td>
                    <button
                      type="button"
                      className="wtr-btn-remove"
                      data-testid="wtr-remove"
                      aria-label={`Rimuovi passata — riga ${rowIdx + 1}`}
                      onClick={() => removeRow(row.key)}
                      disabled={locked}
                      title={locked ? lockTitle : "Rimuovi questa passata"}
                    >
                      Rimuovi
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
