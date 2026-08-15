/**
 * Cerca nel registro (OpenAPI IT-search / P.IVA).
 * Human-in-the-loop: lista → scelta → compila i campi. Non salva da sola.
 * Guscio dialog: classi did-* (DeadlineImportDialog).
 */

import React, { useState } from "react";
import apiService from "../services/apiService";
import "../pages/StudioSettingsPage.css";
import "./DeadlineImportDialog.css";

function formatAddress(row) {
  if (!row) return "";
  const cityLine = [row.cap, row.city].filter(Boolean).join(" ");
  return [row.street, cityLine, row.province].filter(Boolean).join(", ");
}

function toAnagrafica(row) {
  return {
    name: row.legal_name || "",
    vat_number: row.vat_number || "",
    address: formatAddress(row),
  };
}

function CompanyRegistrySearch({
  name = "",
  vatNumber = "",
  onPick,
  disabled = false,
  auditorOrgId = null,
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState(0);
  const [warning, setWarning] = useState(null);

  const canQuery = String(vatNumber || "").trim() || String(name || "").trim().length >= 3;

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
      setOpen(true);
    } catch (err) {
      setError(err.message || "Errore ricerca registro");
      setOpen(true);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = () => {
    const row = results[selected];
    if (!row) return;
    onPick?.(toAnagrafica(row));
    setOpen(false);
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
        Usa nome e/o P.IVA. Scegli un risultato: i campi si compilano, poi premi Salva. Non crea l&apos;azienda da sola.
      </p>
      {error && !open && <p className="studio-hint">{error}</p>}

      {open && (
        <div className="did-overlay" role="dialog" aria-modal="true" aria-labelledby="crs-title">
          <div className="did-modal">
            <div className="did-header">
              <h2 id="crs-title" className="did-header__title">Scegli l&apos;azienda dal registro</h2>
              <button
                className="did-close"
                onClick={() => setOpen(false)}
                aria-label="Chiudi"
                type="button"
              >
                {"\u00D7"}
              </button>
            </div>
            <div className="did-body">
              {warning && <p className="studio-hint">{warning}</p>}
              {error && <p className="studio-hint">{error}</p>}
              {results.length === 0 ? (
                <p className="studio-hint">Nessun risultato da confermare.</p>
              ) : (
                <div className="did-form" data-testid="crs-results">
                  {results.map((row, idx) => {
                    const label = [
                      row.legal_name,
                      row.vat_number && `P.IVA ${row.vat_number}`,
                      row.city,
                      row.status,
                    ].filter(Boolean).join(" · ");
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
              )}
            </div>
            <div className="did-footer">
              <button className="did-btn did-btn--cancel" onClick={() => setOpen(false)} type="button">
                Annulla
              </button>
              <button
                className="did-btn did-btn--confirm"
                onClick={handleConfirm}
                disabled={!results[selected]}
                type="button"
              >
                Usa questa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CompanyRegistrySearch;
export { formatAddress, toAnagrafica };
