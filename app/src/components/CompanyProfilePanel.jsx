/**
 * Tab Profilo conformità (ADR-018 S2b).
 * Sezioni operative: Identità A · Sede A · Dimensione B · SSL B · Ambiente B.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import apiService from "../services/apiService";
import CompanyProfileImportDialog from "./CompanyProfileImportDialog";
import StatusBadge from "./StatusBadge";
import FileDropzone from "./FileDropzone";
import "../pages/CompanyDetailPage.css";
import "../pages/StudioSettingsPage.css";
import "../components/ChecklistModule.css";

const SECTIONS = [
  {
    id: "identita",
    title: "1. Identit\u00e0",
    hint: "Dati da visura o anagrafica. Nome e P.IVA possono arrivare gi\u00e0 precompilati.",
    defaultOpen: true,
    fields: [
      { key: "legal_name", label: "Ragione sociale" },
      { key: "vat_number", label: "Partita IVA" },
      { key: "fiscal_code", label: "Codice fiscale" },
      { key: "ateco_primary", label: "ATECO primario" },
      { key: "ateco_primary_desc", label: "Descrizione ATECO" },
      { key: "ateco_secondary", label: "ATECO secondari" },
      { key: "legal_form", label: "Forma giuridica" },
      { key: "rea_number", label: "N. REA" },
      { key: "cciaa", label: "CCIAA" },
      { key: "pec", label: "PEC" },
      { key: "legal_rep_name", label: "Legale rappresentante" },
      { key: "share_capital", label: "Capitale sociale" },
      { key: "company_status", label: "Stato impresa" },
      { key: "website", label: "Sito web" },
      { key: "phone", label: "Telefono" },
      { key: "email", label: "Email" },
    ],
  },
  {
    id: "sede",
    title: "2. Sede legale",
    hint: "Indirizzo strutturato (via, CAP, comune). L\u2019indirizzo libero dell\u2019anagrafica resta sotto.",
    defaultOpen: true,
    fields: [
      { key: "registered_street", label: "Via" },
      { key: "registered_cap", label: "CAP" },
      { key: "registered_city", label: "Comune" },
      { key: "registered_province", label: "Provincia" },
      { key: "registered_country", label: "Nazione" },
      { key: "local_units_summary", label: "Unit\u00e0 locali (sintesi)", type: "text" },
    ],
  },
  {
    id: "dimensione",
    title: "3. Dimensione",
    hint: "Solo inserimento studio (livello B).",
    defaultOpen: false,
    fields: [
      { key: "employees_count", label: "N. lavoratori", type: "int" },
      { key: "employees_note", label: "Nota organico" },
      { key: "sites_count", label: "N. sedi operative", type: "int" },
      { key: "sites_description", label: "Descrizione sedi", type: "text" },
      { key: "collective_agreement", label: "CCNL applicato" },
      { key: "has_construction_sites", label: "Opera in cantieri", type: "bit" },
      { key: "has_third_party_sites", label: "Lavora presso terzi", type: "bit" },
    ],
  },
  {
    id: "ssl",
    title: "4. SSL / sicurezza",
    hint: "D.Lgs. 81/2008 \u2014 45001.",
    defaultOpen: false,
    fields: [
      { key: "has_dvr", label: "DVR presente", type: "bit" },
      { key: "rspp_name", label: "RSPP" },
      { key: "competent_doctor", label: "Medico competente" },
      { key: "rls_name", label: "RLS" },
      { key: "inail_pat", label: "PAT INAIL" },
      { key: "main_hazards", label: "Pericoli principali", type: "text" },
      { key: "uses_hazardous_agents", label: "Agenti pericolosi", type: "bit" },
      { key: "has_work_at_height", label: "Lavoro in quota", type: "bit" },
      { key: "has_night_shifts", label: "Turni notturni", type: "bit" },
      { key: "equipment_summary", label: "Attrezzature rilevanti", type: "text" },
    ],
  },
  {
    id: "ambiente",
    title: "5. Ambiente",
    hint: "D.Lgs. 152/2006 \u2014 14001.",
    defaultOpen: false,
    fields: [
      { key: "produces_waste", label: "Produce rifiuti", type: "bit" },
      { key: "waste_cer_summary", label: "CER / tipologie rifiuti", type: "text" },
      { key: "waste_broker_or_self", label: "Gestione rifiuti" },
      { key: "has_water_discharge", label: "Scarichi idrici", type: "bit" },
      { key: "has_air_emissions", label: "Emissioni in atmosfera", type: "bit" },
      { key: "has_aua_or_aia", label: "Autorizzazione AUA/AIA", type: "bit" },
      { key: "authorization_refs", label: "Riferimenti autorizzazioni", type: "text" },
      { key: "uses_fuel_plants", label: "Impianti combustione", type: "bit" },
      { key: "energy_carriers", label: "Vettori energetici" },
      { key: "noise_external_relevant", label: "Rumore esterno rilevante", type: "bit" },
      { key: "hazardous_substances_env", label: "Sostanze pericolose (ambiente)", type: "text" },
      { key: "notes", label: "Note consulente", type: "text" },
      { key: "profile_version_label", label: "Etichetta revisione" },
    ],
  },
];

const ALL_KEYS = SECTIONS.flatMap((s) => s.fields.map((f) => f.key));
const FIELD_LABELS = Object.fromEntries(
  SECTIONS.flatMap((s) => s.fields.map((f) => [f.key, f.label]))
);

function emptyForm() {
  const form = {};
  ALL_KEYS.forEach((k) => {
    form[k] = "";
  });
  return form;
}

function profileToForm(data) {
  const form = emptyForm();
  if (!data) return form;
  ALL_KEYS.forEach((k) => {
    const v = data[k];
    if (v === null || v === undefined) form[k] = "";
    else if (v === true || v === 1) form[k] = "1";
    else if (v === false || v === 0) form[k] = "0";
    else form[k] = String(v);
  });
  return form;
}

function formToPayload(form) {
  const body = {};
  ALL_KEYS.forEach((k) => {
    const raw = form[k];
    if (raw === "" || raw === undefined) body[k] = null;
    else body[k] = raw;
  });
  return body;
}

function FieldInput({ field, value, onChange, disabled }) {
  if (field.type === "bit") {
    return (
      <select
        id={`cp-${field.key}`}
        value={value}
        onChange={(e) => onChange(field.key, e.target.value)}
        disabled={disabled}
      >
        <option value="">Non indicato</option>
        <option value="1">S\u00ec</option>
        <option value="0">No</option>
      </select>
    );
  }
  if (field.type === "int") {
    return (
      <input
        id={`cp-${field.key}`}
        type="number"
        min="0"
        value={value}
        onChange={(e) => onChange(field.key, e.target.value)}
        disabled={disabled}
      />
    );
  }
  if (field.type === "text") {
    return (
      <textarea
        id={`cp-${field.key}`}
        className="notes-textarea"
        rows={3}
        value={value}
        onChange={(e) => onChange(field.key, e.target.value)}
        disabled={disabled}
      />
    );
  }
  return (
    <input
      id={`cp-${field.key}`}
      type="text"
      value={value}
      onChange={(e) => onChange(field.key, e.target.value)}
      disabled={disabled}
    />
  );
}

const COMPLETENESS_BADGE = {
  pronto: { status: "active", label: "Pronto" },
  parziale: { status: "orphan", label: "Parziale" },
  incompleto: { status: "inactive", label: "Incompleto" },
};

function CompanyProfilePanel({ companyId, auditorOrgId, canEdit, onUnavailable, onAnagraficaSynced }) {
  const fileInputRef = useRef(null);
  const [detecting, setDetecting] = useState(false);
  const [lookingUp, setLookingUp] = useState(false);
  const [importing, setImporting] = useState(false);
  const [detection, setDetection] = useState(null);
  const [importSource, setImportSource] = useState("excel");
  const [form, setForm] = useState(emptyForm);
  const [savedSnapshot, setSavedSnapshot] = useState("");
  const [meta, setMeta] = useState({ seededFromAnagrafica: [], address_anagrafica: null, exists: false });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);
  const [syncAnagrafica, setSyncAnagrafica] = useState({
    name: false,
    vat_number: false,
    address: false,
  });

  const dirty = useMemo(() => JSON.stringify(form) !== savedSnapshot, [form, savedSnapshot]);
  const syncRequested = syncAnagrafica.name || syncAnagrafica.vat_number || syncAnagrafica.address;
  const canSave = dirty || syncRequested;

  const applyData = useCallback((data) => {
    const next = profileToForm(data);
    setForm(next);
    setSavedSnapshot(JSON.stringify(next));
    setMeta({
      seededFromAnagrafica: data?.seededFromAnagrafica || [],
      address_anagrafica: data?.address_anagrafica || null,
      exists: !!data?.exists,
      completeness: data?.profile_completeness ?? null,
      completenessLevel: data?.completeness_level || null,
    });
  }, []);

  useEffect(() => {
    if (!companyId) return undefined;
    let cancelled = false;
    setLoading(true);
    setError(null);
    const params = auditorOrgId ? { auditor_org_id: auditorOrgId } : {};
    apiService.getCompanyProfile(companyId, params)
      .then((res) => {
        if (cancelled) return;
        applyData(res?.data ?? res);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err.status === 403) {
          onUnavailable?.(err);
          return;
        }
        setError(err.message || "Errore caricamento profilo");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [companyId, auditorOrgId, applyData, onUnavailable]);

  useEffect(() => {
    setSyncAnagrafica({ name: false, vat_number: false, address: false });
  }, [companyId]);

  const setField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const handleDownloadTemplate = async () => {
    setError(null);
    try {
      await apiService.downloadCompanyProfileTemplate();
    } catch (err) {
      if (err.status === 403) {
        onUnavailable?.(err);
        return;
      }
      setError(err.message || "Errore download modello");
    }
  };

  const handlePickExcel = async (files) => {
    const file = files?.[0];
    if (!file || !companyId) return;
    setDetecting(true);
    setError(null);
    try {
      const params = auditorOrgId ? { auditor_org_id: auditorOrgId } : {};
      const res = await apiService.detectCompanyProfileImport(companyId, file, params);
      const data = res?.data ?? res;
      if (!data?.canImport) {
        setError(data?.error || "Nessun campo profilo riconosciuto nel file");
        return;
      }
      setImportSource("excel");
      setDetection({ ...data, fileName: data.fileName || file.name });
    } catch (err) {
      if (err.status === 403) {
        onUnavailable?.(err);
        return;
      }
      setError(err.message || "Errore analisi Excel");
    } finally {
      setDetecting(false);
    }
  };

  const handleConfirmImport = async (fields) => {
    if (!canEdit || !companyId) return;
    setImporting(true);
    setError(null);
    try {
      const params = auditorOrgId ? { auditor_org_id: auditorOrgId } : {};
      const res = await apiService.importCompanyProfile(
        companyId,
        {
          fields,
          fileName: detection?.fileName || "import.xlsx",
          source: importSource === "registry" ? "registry" : "excel",
        },
        params
      );
      applyData(res?.data ?? res);
      setDetection(null);
      setSaved(true);
    } catch (err) {
      if (err.status === 403) {
        onUnavailable?.(err);
        return;
      }
      setError(err.message || "Errore import profilo");
    } finally {
      setImporting(false);
    }
  };

  const handleLookup = async () => {
    if (!canEdit || !companyId) return;
    const vat = (form.vat_number || "").trim();
    if (!vat) {
      setError("Inserisci la Partita IVA (campo Identit\u00e0) prima di recuperare dal registro.");
      return;
    }
    setLookingUp(true);
    setError(null);
    setDetection(null);
    try {
      const params = auditorOrgId ? { auditor_org_id: auditorOrgId } : {};
      const res = await apiService.lookupCompanyProfile(companyId, { vat_number: vat }, params);
      const data = res?.data ?? res;
      if (!data?.canImport) {
        setError(data?.error || "Nessun dato trovato nel registro");
        return;
      }
      setImportSource("registry");
      setDetection({
        ...data,
        fileName: data.fileName || "registro",
      });
    } catch (err) {
      if (err.status === 403) {
        onUnavailable?.(err);
        return;
      }
      setError(err.message || "Errore lookup registro");
    } finally {
      setLookingUp(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canEdit || !companyId) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const params = auditorOrgId ? { auditor_org_id: auditorOrgId } : {};
      const res = await apiService.updateCompanyProfile(
        companyId,
        { ...formToPayload(form), sync_anagrafica: syncAnagrafica },
        params
      );
      const data = res?.data ?? res;
      applyData(data);
      setSaved(true);
      setSyncAnagrafica({ name: false, vat_number: false, address: false });
      if (data?.synced_anagrafica?.length) {
        onAnagraficaSynced?.(data.synced_anagrafica);
      }
    } catch (err) {
      if (err.status === 403) {
        onUnavailable?.(err);
        return;
      }
      setError(err.message || "Errore salvataggio profilo");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="studio-loading">
        <div className="loading-spinner-sm" />
        <span>Caricamento profilo...</span>
      </div>
    );
  }

  return (
    <div className="studio-tab-content company-detail-anagrafica company-profile-panel">
      {error && <div className="studio-warning-banner">{error}</div>}
      {meta.completeness != null && (
        <p className="studio-hint" data-testid="profile-completeness">
          <StatusBadge
            type="user"
            status={(COMPLETENESS_BADGE[meta.completenessLevel] || COMPLETENESS_BADGE.incompleto).status}
            label={`${meta.completeness}% \u2014 ${(COMPLETENESS_BADGE[meta.completenessLevel] || COMPLETENESS_BADGE.incompleto).label}`}
          />
          {" "}Completezza profilo (non blocca gli audit).
        </p>
      )}
      {meta.seededFromAnagrafica.length > 0 && (
        <p className="studio-hint">
          Nome e P.IVA sono stati copiati dall&apos;anagrafica esistente. Non sono ancora salvati nel profilo: premi Salva per confermare.
        </p>
      )}
      {canEdit && (
        <div className="studio-actions company-profile-import-actions">
          <button
            type="button"
            className="btn-studio-secondary"
            onClick={handleDownloadTemplate}
            disabled={detecting || importing || lookingUp}
          >
            Scarica modello Excel
          </button>
          <FileDropzone
            variant="compact"
            accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            disabled={detecting || importing || lookingUp}
            onFiles={handlePickExcel}
            label={detecting ? "Analisi file..." : "Importa modello Excel"}
            ariaLabel="Importa modello Excel"
            inputRef={fileInputRef}
            inputTestId="company-profile-excel-input"
          />
          <button
            type="button"
            className="btn-studio-secondary"
            onClick={handleLookup}
            disabled={detecting || importing || lookingUp}
          >
            {lookingUp ? "Interrogazione registro..." : "Recupera da registro"}
          </button>
          <p className="studio-hint">
            Excel: scarica il foglio, compilalo e reimportalo. Registro: usa la P.IVA del profilo (anteprima, poi conferma). Vale solo per questa azienda.
          </p>
        </div>
      )}
      {detection && (
        <CompanyProfileImportDialog
          detection={detection}
          fieldLabels={FIELD_LABELS}
          onConfirm={handleConfirmImport}
          onClose={() => { setDetection(null); setImportSource("excel"); }}
          loading={importing}
          title={importSource === "registry" ? "Dati dal registro imprese" : "Importa profilo da Excel"}
        />
      )}
      <form onSubmit={handleSubmit}>
        {SECTIONS.map((section) => (
          <details key={section.id} className="studio-card company-profile-section" open={section.defaultOpen}>
            <summary className="studio-card-title">{section.title}</summary>
            {section.hint && <p className="studio-card-desc">{section.hint}</p>}
            {section.id === "sede" && meta.address_anagrafica && (
              <p className="studio-hint">
                Indirizzo in anagrafica (testo libero, non modificato): {meta.address_anagrafica}
              </p>
            )}
            {section.fields.map((field) => (
              <div className="form-group" key={field.key}>
                <label htmlFor={`cp-${field.key}`}>{field.label}</label>
                <FieldInput
                  field={field}
                  value={form[field.key] ?? ""}
                  onChange={setField}
                  disabled={!canEdit}
                />
              </div>
            ))}
          </details>
        ))}
        {canEdit && (
          <div className="studio-card">
            <p className="studio-card-title">Aggiorna anche l&apos;anagrafica base</p>
            <p className="studio-card-desc">
              Spunta solo se vuoi copiare questi dati nella scheda Anagrafica (lista aziende). Di default non si tocca.
            </p>
            <label className="studio-hint">
              <input
                type="checkbox"
                checked={syncAnagrafica.name}
                onChange={(e) => setSyncAnagrafica((s) => ({ ...s, name: e.target.checked }))}
              />
              {" "}Nome / ragione sociale
            </label>
            <label className="studio-hint">
              <input
                type="checkbox"
                checked={syncAnagrafica.vat_number}
                onChange={(e) => setSyncAnagrafica((s) => ({ ...s, vat_number: e.target.checked }))}
              />
              {" "}Partita IVA
            </label>
            <label className="studio-hint">
              <input
                type="checkbox"
                checked={syncAnagrafica.address}
                onChange={(e) => setSyncAnagrafica((s) => ({ ...s, address: e.target.checked }))}
              />
              {" "}Indirizzo (via + CAP + comune)
            </label>
          </div>
        )}
        {canEdit && (
          <div className="studio-actions">
            <button type="submit" className="btn-studio-primary" disabled={saving || !canSave}>
              {saving ? "Salvataggio..." : "Salva profilo"}
            </button>
            {saved && !dirty && <span className="studio-hint">Profilo salvato.</span>}
          </div>
        )}
      </form>
    </div>
  );
}

export default CompanyProfilePanel;
export { SECTIONS, FIELD_LABELS, profileToForm, formToPayload };
