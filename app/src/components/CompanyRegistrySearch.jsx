/**
 * Cerca nel registro (OpenAPI IT-search / P.IVA) + proposte citate (CTX-3).
 * Human-in-the-loop: lista → scelta → conferma campi (URL fonte) → compila form.
 * Non salva da sola. Conflitti: checkbox off (no overwrite silenzioso).
 * Guscio dialog: classi did-* (DeadlineImportDialog).
 */

import React, { useMemo, useState } from "react";
import apiService from "../services/apiService";
import {
  buildCitedProposals,
  applySelectedProposals,
  formatCandidateAddress,
  toAnagraficaCompat,
} from "../data/aiContextEnrichment";
import "../pages/StudioSettingsPage.css";
import "./DeadlineImportDialog.css";

function formatAddress(row) {
  return formatCandidateAddress(row);
}

function toAnagrafica(row) {
  return toAnagraficaCompat(row);
}

function CompanyRegistrySearch({
  name = "",
  vatNumber = "",
  currentValues = null,
  onPick,
  disabled = false,
  auditorOrgId = null,
}) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState("pick"); // pick | review
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState(0);
  const [warning, setWarning] = useState(null);
  const [listSource, setListSource] = useState(null);
  const [review, setReview] = useState(null); // { proposals, source, source_url }
  const [checked, setChecked] = useState({});

  const canQuery = String(vatNumber || "").trim() || String(name || "").trim().length >= 3;

  const currentForm = useMemo(
    () => ({
      name: currentValues?.name ?? name ?? "",
      vat_number: currentValues?.vat_number ?? vatNumber ?? "",
      address: currentValues?.address ?? "",
      sector: currentValues?.sector ?? "",
    }),
    [currentValues, name, vatNumber]
  );

  const resetDialog = () => {
    setOpen(false);
    setStep("pick");
    setReview(null);
    setChecked({});
  };

  const handleSearch = async () => {
    if (disabled || loading) return;
    if (!canQuery) {
      setError("Inserisci la P.IVA oppure almeno 3 lettere del nome.");
      return;
    }
    setLoading(true);
    setError(null);
    setWarning(null);
    setResults([]);
    setSelected(0);
    setStep("pick");
    setReview(null);
    setChecked({});
    try {
      const params = auditorOrgId ? { auditor_org_id: auditorOrgId } : {};
      const res = await apiService.searchCompanyRegistry(
        { company_name: name, vat_number: vatNumber },
        params
      );
      const data = res?.data ?? res;
      const list = Array.isArray(data?.results) ? data.results : [];
      if (!list.length) {
        setError("Nessuna azienda trovata nel registro.");
        setOpen(true);
        return;
      }
      setResults(list);
      setWarning(data?.warning || null);
      setListSource(data?.source || null);
      setOpen(true);
    } catch (err) {
      setError(err.message || "Errore ricerca registro");
      setOpen(true);
    } finally {
      setLoading(false);
    }
  };

  const handlePickContinue = () => {
    const row = results[selected];
    if (!row) return;
    const built = buildCitedProposals(currentForm, row, {
      source: row.source || listSource || "registro",
      source_url: row.source_url,
    });
    if (!built.proposals.length) {
      setError("Nessuna differenza rispetto ai campi gi\u00e0 compilati.");
      return;
    }
    setError(null);
    const initial = {};
    for (const p of built.proposals) {
      initial[p.field] = !!p.defaultSelected;
    }
    setChecked(initial);
    setReview(built);
    setStep("review");
  };

  const handleConfirmSelected = () => {
    if (!review?.proposals?.length) return;
    const selectedFields = review.proposals
      .filter((p) => checked[p.field])
      .map((p) => p.field);
    if (!selectedFields.length) {
      setError("Seleziona almeno un campo da applicare.");
      return;
    }
    const patch = applySelectedProposals({}, review.proposals, selectedFields);
    onPick?.(patch);
    resetDialog();
  };

  const toggleField = (field) => {
    setChecked((prev) => ({ ...prev, [field]: !prev[field] }));
  };

  return (
    <div className="company-registry-search">
      <button
        type="button"
        className="btn-studio-secondary"
        onClick={handleSearch}
        disabled={disabled || loading}
      >
        {loading ? "Ricerca registro..." : "Cerca nel registro"}
      </button>
      <p className="studio-hint">
        {"Usa nome e/o P.IVA. Scegli un risultato, conferma i campi citati (URL fonte), poi premi Salva. I campi gi\u00e0 compilati restano invariati finch\u00e9 non li selezioni."}
      </p>
      {error && !open && <p className="studio-hint">{error}</p>}

      {open && (
        <div className="did-overlay" role="dialog" aria-modal="true" aria-labelledby="crs-title">
          <div className="did-modal">
            <div className="did-header">
              <h2 id="crs-title" className="did-header__title">
                {step === "review"
                  ? "Conferma proposte citate"
                  : "Scegli l'azienda dal registro"}
              </h2>
              <button
                className="did-close"
                onClick={resetDialog}
                aria-label="Chiudi"
                type="button"
              >
                {"\u00D7"}
              </button>
            </div>
            <div className="did-body">
              {warning && <p className="studio-hint">{warning}</p>}
              {error && <p className="studio-hint">{error}</p>}

              {step === "pick" && (
                results.length === 0 ? (
                  <p className="studio-hint">Nessun risultato da confermare.</p>
                ) : (
                  <div className="did-form" data-testid="crs-results">
                    {results.map((row, idx) => {
                      const label = [
                        row.legal_name,
                        row.vat_number && `P.IVA ${row.vat_number}`,
                        row.city,
                        row.sector,
                        row.status,
                      ].filter(Boolean).join(" \u00B7 ");
                      return (
                        <label className="did-field" key={row.registry_id || `${row.vat_number}-${idx}`}>
                          <input
                            type="radio"
                            name="crs-pick"
                            checked={selected === idx}
                            onChange={() => setSelected(idx)}
                          />
                          <span>{label}</span>
                        </label>
                      );
                    })}
                  </div>
                )
              )}

              {step === "review" && review && (
                <div className="did-form" data-testid="crs-proposals">
                  <p className="studio-hint">
                    Fonte: {review.source}
                    {review.source_url ? (
                      <>
                        {" \u00B7 "}
                        <a
                          href={review.source_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          data-testid="crs-source-url"
                        >
                          verifica URL
                        </a>
                      </>
                    ) : null}
                  </p>
                  {review.proposals.map((p) => (
                    <label className="did-field" key={p.field} data-testid={`crs-proposal-${p.field}`}>
                      <input
                        type="checkbox"
                        checked={!!checked[p.field]}
                        onChange={() => toggleField(p.field)}
                      />
                      <span>
                        <strong>{p.label}</strong>
                        {p.conflict ? " (gi\u00e0 compilato \u2014 conferma per sovrascrivere)" : ""}
                        <br />
                        {p.conflict && p.current ? (
                          <span className="did-optional">Attuale: {p.current}</span>
                        ) : null}
                        <span> Proposta: {p.proposed}</span>
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>
            <div className="did-footer">
              {step === "review" ? (
                <>
                  <button
                    className="did-btn did-btn--cancel"
                    onClick={() => {
                      setStep("pick");
                      setReview(null);
                      setError(null);
                    }}
                    type="button"
                  >
                    Indietro
                  </button>
                  <button
                    className="did-btn did-btn--confirm"
                    onClick={handleConfirmSelected}
                    type="button"
                    data-testid="crs-apply-selected"
                  >
                    Applica selezionati
                  </button>
                </>
              ) : (
                <>
                  <button className="did-btn did-btn--cancel" onClick={resetDialog} type="button">
                    Annulla
                  </button>
                  <button
                    className="did-btn did-btn--confirm"
                    onClick={handlePickContinue}
                    disabled={!results[selected]}
                    type="button"
                  >
                    Usa questa
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CompanyRegistrySearch;
export { formatAddress, toAnagrafica };
