/**
 * WpqrTestRunsSection (WV-6b) — monta `WpqrTestRunsEditor` nel dettaglio WPQR.
 * Carica le passate da `GET /welding/wpqr/:id/test-runs` e salva ogni modifica confermata
 * (blur) con `PUT` replace-set. Salvataggi in coda: un solo PUT alla volta, vince l'ultimo stato.
 * Archivio non disponibile (migrazione 173 non applicata) → editor in sola lettura con avviso.
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import apiService from "../services/apiService";
import WpqrTestRunsEditor from "./WpqrTestRunsEditor";
import { isIso14555 } from "../data/weldingQualificationRules14555";

export const MSG_NEEDS_SAVE = "Inserire il codice WPQR: la WPQR viene salvata e poi si possono registrare le passate.";
export const MSG_UNAVAILABLE = "Archivio passate non ancora disponibile su questo ambiente: i valori non possono essere salvati.";
export const MSG_LOAD_ERROR = "Impossibile caricare le passate.";
export const MSG_SAVE_ERROR = "Passate non salvate. Riprovare.";

/** Famiglia norma per l'editor da `standard_reference` (default 15614-1). */
export function standardFamilyFrom(standardReference) {
  const ref = String(standardReference || "");
  if (isIso14555(ref)) return "14555";
  if (/15614[-\s]?2/.test(ref)) return "15614-2";
  if (/15613/.test(ref)) return "15613";
  return "15614-1";
}

function describeValidation(err) {
  const details = err?.data?.details;
  if (!Array.isArray(details) || details.length === 0) return err?.message || MSG_SAVE_ERROR;
  const lines = details.slice(0, 5).map((d) => `riga ${d.row}: ${d.message}`);
  return `Passate non valide — ${lines.join("; ")}`;
}

/**
 * @param {object} props
 * @param {number|string|null} [props.wpqrId] assente = WPQR non ancora salvata
 * @param {string} [props.standardReference]
 * @param {boolean} [props.readOnly]
 */
export default function WpqrTestRunsSection({ wpqrId = null, standardReference = "", readOnly = false }) {
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [available, setAvailable] = useState(true);
  const [status, setStatus] = useState(null);
  const [message, setMessage] = useState(null);

  const mounted = useRef(true);
  const inFlight = useRef(false);
  const pending = useRef(null);
  const idRef = useRef(wpqrId);
  idRef.current = wpqrId;

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    if (!wpqrId) {
      setRuns([]);
      setAvailable(true);
      setStatus(null);
      setMessage(null);
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    setMessage(null);
    setStatus(null);
    apiService.getWpqrTestRuns(wpqrId)
      .then((res) => {
        if (cancelled) return;
        setRuns(Array.isArray(res?.runs) ? res.runs : []);
        setAvailable(res?.available !== false);
      })
      .catch(() => {
        if (cancelled) return;
        setMessage(MSG_LOAD_ERROR);
        setStatus("error");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [wpqrId]);

  const flush = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    while (pending.current) {
      const { id, payload } = pending.current;
      pending.current = null;
      if (mounted.current) { setStatus("saving"); setMessage(null); }
      try {
        // eslint-disable-next-line no-await-in-loop
        await apiService.saveWpqrTestRuns(id, payload);
        if (mounted.current && !pending.current) setStatus("saved");
      } catch (err) {
        if (!mounted.current) break;
        setStatus("error");
        if (err?.code === "WPQR_TEST_RUNS_UNAVAILABLE" || err?.status === 503) {
          setAvailable(false);
          setMessage(MSG_UNAVAILABLE);
        } else if (err?.status === 400) {
          setMessage(describeValidation(err));
        } else {
          setMessage(err?.message || MSG_SAVE_ERROR);
        }
      }
    }
    inFlight.current = false;
  }, []);

  const handleChange = useCallback((next) => {
    setRuns(next);
    if (!idRef.current) return;
    pending.current = { id: idRef.current, payload: next };
    flush();
  }, [flush]);

  return (
    <div data-testid="wtrs-section">
      {!wpqrId && <p className="sq-cov-hint" data-testid="wtrs-needs-save">{MSG_NEEDS_SAVE}</p>}
      {loading && <p className="sq-cov-hint" data-testid="wtrs-loading">{"Caricamento passate\u2026"}</p>}
      {!available && <div className="wp-error" role="alert" data-testid="wtrs-unavailable">{MSG_UNAVAILABLE}</div>}
      {message && available && <div className="wp-error" role="alert" data-testid="wtrs-error">{message}</div>}
      {status === "saving" && <span className="autosave-status saving" data-testid="wtrs-status">{"Salvataggio\u2026"}</span>}
      {status === "saved" && <span className="autosave-status saved" data-testid="wtrs-status">{"\u2713 Salvato"}</span>}
      {!loading && (
        <WpqrTestRunsEditor
          key={`${wpqrId || "new"}-${standardFamilyFrom(standardReference)}`}
          value={runs}
          onChange={handleChange}
          standardFamily={standardFamilyFrom(standardReference)}
          readOnly={readOnly}
          disabled={!wpqrId || !available}
        />
      )}
    </div>
  );
}
