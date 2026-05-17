/**
 * ImportJobsPage - Sprint 9: job import PDF batch + revisione testo
 */

import React, { useState, useEffect, useCallback } from "react";
import apiService from "../services/apiService";
import { useAuth } from "../contexts/AuthContext";
import { DOC_TYPE_OPTIONS } from "../data/documentTypes";
import "./ImportJobsPage.css";

// Aggiunge l'opzione guida AI in cima alla lista tipi per il form di import
const DOC_TYPE_OPTIONS_IMPORT = [
  { value: "", label: "Tipo documento (opz., guida la AI)" },
  ...DOC_TYPE_OPTIONS,
];

function parseAiJson(val) {
  if (val == null) return null;
  if (typeof val === "object") return val;
  try {
    return JSON.parse(val);
  } catch {
    return null;
  }
}

export default function ImportJobsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "superadmin";
  const [jobs, setJobs] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [newTitle, setNewTitle] = useState("");
  const [docTypeHint, setDocTypeHint] = useState("");
  const [busy, setBusy] = useState(false);
  const [commitDialog, setCommitDialog] = useState(null); // { file, form }
  const [commitResult, setCommitResult] = useState(null); // { fileId, registryId }

  const loadList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiService.getImportJobs();
      setJobs(res.data || []);
    } catch (e) {
      setError(e.message || "Errore caricamento job");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDetail = useCallback(async (id) => {
    if (!id) {
      setDetail(null);
      return;
    }
    try {
      const res = await apiService.getImportJob(id);
      setDetail(res.data || null);
    } catch (e) {
      setError(e.message || "Errore dettaglio job");
    }
  }, []);

  useEffect(() => {
    loadList();
  }, [loadList]);

  useEffect(() => {
    loadDetail(selectedId);
  }, [selectedId, loadDetail]);

  async function handleCreate() {
    setBusy(true);
    setError(null);
    try {
      const res = await apiService.createImportJob({
        title: newTitle || undefined,
        document_type_hint: docTypeHint || undefined,
      });
      const id = res.data?.id;
      setNewTitle("");
      setDocTypeHint("");
      await loadList();
      if (id) setSelectedId(id);
    } catch (e) {
      setError(e.message || "Creazione job fallita");
    } finally {
      setBusy(false);
    }
  }

  async function handleFiles(e) {
    const files = e.target.files;
    if (!selectedId || !files?.length) return;
    setBusy(true);
    setError(null);
    try {
      await apiService.uploadImportJobFiles(selectedId, files);
      e.target.value = "";
      await loadList();
      await loadDetail(selectedId);
    } catch (e) {
      setError(e.message || "Upload fallito");
    } finally {
      setBusy(false);
    }
  }

  async function handleProcess() {
    if (!selectedId) return;
    setBusy(true);
    setError(null);
    try {
      await apiService.processImportJob(selectedId);
      await loadList();
      await loadDetail(selectedId);
    } catch (e) {
      setError(e.message || "Elaborazione fallita");
    } finally {
      setBusy(false);
    }
  }

  async function handleMarkReviewed(fileId) {
    if (!selectedId) return;
    setBusy(true);
    setError(null);
    try {
      await apiService.patchImportJobFile(selectedId, fileId, { status: "reviewed" });
      await loadList();
      await loadDetail(selectedId);
    } catch (e) {
      setError(e.message || "Aggiornamento fallito");
    } finally {
      setBusy(false);
    }
  }

  async function handleAiExtract(fileId) {
    if (!selectedId) return;
    setBusy(true);
    setError(null);
    try {
      await apiService.postImportJobFileAiExtract(selectedId, fileId);
      await loadDetail(selectedId);
    } catch (e) {
      const msg = e?.data?.error || e.message || "Analisi AI fallita";
      setError(msg);
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveText(fileId, text) {
    if (!selectedId) return;
    setBusy(true);
    setError(null);
    try {
      await apiService.patchImportJobFile(selectedId, fileId, { extracted_text: text });
      await loadDetail(selectedId);
    } catch (e) {
      setError(e.message || "Salvataggio testo fallito");
    } finally {
      setBusy(false);
    }
  }

  function handleOpenCommit(file) {
    const ai = parseAiJson(file.ai_extraction_json) || {};
    setCommitDialog({
      file,
      form: {
        title: ai.title || file.original_name || "",
        doc_type: ai.document_type || "",
        responsible: ai.person_name || ai.responsible || "",
        issue_date: ai.issue_date || "",
        expiry_date: ai.expiry_date || "",
        doc_code: ai.doc_code || ai.code || "",
        revision: ai.revision || "",
        notes: "",
      },
    });
    setCommitResult(null);
  }

  async function handleCommitConfirm() {
    if (!commitDialog || !selectedId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await apiService.commitImportJobFileToRegistry(
        selectedId,
        commitDialog.file.id,
        commitDialog.form
      );
      const regId = res.data?.registry_document_id;
      setCommitResult({ fileId: commitDialog.file.id, registryId: regId });
      setCommitDialog(null);
      await loadDetail(selectedId);
    } catch (e) {
      setError(e?.data?.error || e.message || "Commit fallito");
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteJob(id) {
    if (!window.confirm("Eliminare il job e tutti i file associati?")) return;
    setBusy(true);
    try {
      await apiService.deleteImportJob(id);
      if (selectedId === id) setSelectedId(null);
      await loadList();
    } catch (e) {
      setError(e.message || "Eliminazione fallita");
    } finally {
      setBusy(false);
    }
  }

  if (!isAdmin) {
    return (
      <div className="import-jobs-page">
        <p className="import-jobs-denied">Accesso riservato agli amministratori.</p>
      </div>
    );
  }

  return (
    <div className="import-jobs-page">
      <h1>Import batch PDF</h1>
      <p className="import-jobs-intro">
        Crea un job (opzionale: tipo documento per guidare l&apos;AI), carica PDF, estrai testo in locale, poi opzionalmente
        l&apos;<strong>analisi strutturata AI</strong> (OpenAI, richiede chiave sul server) per sintesi e campi chiave in JSON.
        Nessun dato sensibile inviato oltre il testo già visibile in revisione. OCR e agenti multi-step in roadmap.
      </p>
      {error && <p className="import-jobs-error">{error}</p>}

      <div className="import-jobs-grid">
        <section className="import-jobs-col">
          <h2>Job</h2>
          <div className="import-jobs-new">
            <input
              type="text"
              placeholder="Titolo (opzionale)"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
            />
            <select
              className="import-jobs-select"
              value={docTypeHint}
              onChange={(e) => setDocTypeHint(e.target.value)}
            >
              {DOC_TYPE_OPTIONS_IMPORT.map((o) => (
                <option key={o.value || "none"} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <button type="button" className="btn-primary" onClick={handleCreate} disabled={busy}>
              + Nuovo job
            </button>
          </div>
          {loading ? (
            <p>Caricamento…</p>
          ) : (
            <ul className="import-jobs-list">
              {jobs.map((j) => (
                <li key={j.id}>
                  <button
                    type="button"
                    className={selectedId === j.id ? "job-row active" : "job-row"}
                    onClick={() => setSelectedId(j.id)}
                  >
                    <span className="job-title">{j.title}</span>
                    <span className="job-meta">
                      #{j.id} - {j.status} - {j.file_count ?? 0} file
                    </span>
                  </button>
                  <button
                    type="button"
                    className="btn-del"
                    title="Elimina"
                    onClick={() => handleDeleteJob(j.id)}
                    disabled={busy}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="import-jobs-col import-jobs-detail">
          {!selectedId ? (
            <p>Seleziona un job o creane uno nuovo.</p>
          ) : !detail ? (
            <p>Caricamento dettaglio…</p>
          ) : (
            <>
              <h2>Job #{detail.job.id}</h2>
              <p className="job-detail-status">
                Stato: <strong>{detail.job.status}</strong>
                {detail.job.document_type_hint && (
                  <> - tipo suggerito: {detail.job.document_type_hint}</>
                )}
              </p>
              <div className="import-jobs-actions">
                <label className="btn-file">
                  Carica PDF
                  <input type="file" accept="application/pdf,.pdf" multiple onChange={handleFiles} disabled={busy} />
                </label>
                <button type="button" className="btn-secondary" onClick={handleProcess} disabled={busy}>
                  Estrai testo da PDF
                </button>
              </div>
              <h3>File ({(detail.files || []).length})</h3>
              <ul className="import-files-list">
                {(detail.files || []).map((f) => (
                  <li key={f.id} className="import-file-card">
                    <div className="file-head">
                      <strong>{f.original_name}</strong>
                      <span className="file-status">{f.status}</span>
                      {f.confidence_score != null && (
                        <span className="file-conf">Attendibilità: {f.confidence_score}%</span>
                      )}
                    </div>
                    {f.error_message && (
                      <p className="file-err">{f.error_message}</p>
                    )}
                    {(f.status === "extracted" || f.status === "reviewed") && (
                      <textarea
                        key={`${f.id}-${f.status}-${(f.extracted_text || "").length}`}
                        className="file-text"
                        rows={8}
                        defaultValue={f.extracted_text || ""}
                        id={`txt-${f.id}`}
                      />
                    )}
                    <div className="file-actions">
                      {(f.status === "extracted" || f.status === "uploaded") && f.status !== "reviewed" && (
                        <>
                          <button
                            type="button"
                            className="btn-small"
                            disabled={busy}
                            onClick={() => {
                              const el = document.getElementById(`txt-${f.id}`);
                              const val = el ? el.value : f.extracted_text;
                              handleSaveText(f.id, val);
                            }}
                          >
                            Salva testo
                          </button>
                          {f.status === "extracted" && (
                            <button
                              type="button"
                              className="btn-small primary"
                              disabled={busy}
                              onClick={() => handleMarkReviewed(f.id)}
                            >
                              Segna revisionato
                            </button>
                          )}
                        </>
                      )}
                      {(f.status === "extracted" || f.status === "reviewed") && (
                        <button
                          type="button"
                          className="btn-small btn-ai"
                          disabled={busy}
                          title="Richiede OPENAI_API_KEY sul backend"
                          onClick={() => handleAiExtract(f.id)}
                        >
                          Analisi AI strutturata
                        </button>
                      )}
                      {(f.status === "reviewed" || (f.status === "extracted" && parseAiJson(f.ai_extraction_json))) && (
                        <button
                          type="button"
                          className="btn-small btn-commit"
                          disabled={busy}
                          title="Crea un record nel registro documenti da questo file"
                          onClick={() => handleOpenCommit(f)}
                        >
                          Commit al Registry
                        </button>
                      )}
                      {f.status === "committed" && (
                        <span className="file-committed-badge">
                          ✓ In Registry{commitResult?.fileId === f.id && commitResult.registryId
                            ? ` #${commitResult.registryId}` : ""}
                        </span>
                      )}
                    </div>
                    {f.ai_extraction_error && (
                      <p className="file-err ai-err">AI: {f.ai_extraction_error}</p>
                    )}
                    {parseAiJson(f.ai_extraction_json) && (
                      <div className="ai-extraction-panel">
                        <div className="ai-extraction-head">
                          Estrazione AI
                          {f.ai_model && <span className="ai-model">{f.ai_model}</span>}
                          {f.ai_extraction_at && (
                            <span className="ai-at">
                              {new Date(f.ai_extraction_at).toLocaleString("it-IT")}
                            </span>
                          )}
                        </div>
                        <pre className="ai-json">{JSON.stringify(parseAiJson(f.ai_extraction_json), null, 2)}</pre>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      </div>

      {/* Sprint 10 - Dialog commit al registry */}
      {commitDialog && (
        <div className="commit-dialog-overlay" onClick={() => setCommitDialog(null)}>
          <div className="commit-dialog" onClick={(e) => e.stopPropagation()}>
            <h3>Commit al Registry documenti</h3>
            <p className="commit-dialog-file">File: <strong>{commitDialog.file.original_name}</strong></p>
            <div className="commit-form">
              <label>Titolo *
                <input
                  type="text"
                  value={commitDialog.form.title}
                  onChange={(e) => setCommitDialog((d) => ({ ...d, form: { ...d.form, title: e.target.value } }))}
                />
              </label>
              <label>Tipo documento
                <select
                  value={commitDialog.form.doc_type}
                  onChange={(e) => setCommitDialog((d) => ({ ...d, form: { ...d.form, doc_type: e.target.value } }))}
                >
                  {DOC_TYPE_OPTIONS_IMPORT.map((o) => (
                    <option key={o.value || "none"} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </label>
              <label>Codice doc.
                <input
                  type="text"
                  value={commitDialog.form.doc_code}
                  onChange={(e) => setCommitDialog((d) => ({ ...d, form: { ...d.form, doc_code: e.target.value } }))}
                />
              </label>
              <label>Revisione
                <input
                  type="text"
                  value={commitDialog.form.revision}
                  onChange={(e) => setCommitDialog((d) => ({ ...d, form: { ...d.form, revision: e.target.value } }))}
                />
              </label>
              <label>Responsabile
                <input
                  type="text"
                  value={commitDialog.form.responsible}
                  onChange={(e) => setCommitDialog((d) => ({ ...d, form: { ...d.form, responsible: e.target.value } }))}
                />
              </label>
              <label>Data emissione
                <input
                  type="date"
                  value={commitDialog.form.issue_date}
                  onChange={(e) => setCommitDialog((d) => ({ ...d, form: { ...d.form, issue_date: e.target.value } }))}
                />
              </label>
              <label>Scadenza
                <input
                  type="date"
                  value={commitDialog.form.expiry_date}
                  onChange={(e) => setCommitDialog((d) => ({ ...d, form: { ...d.form, expiry_date: e.target.value } }))}
                />
              </label>
              <label>Note
                <textarea
                  rows={3}
                  value={commitDialog.form.notes}
                  onChange={(e) => setCommitDialog((d) => ({ ...d, form: { ...d.form, notes: e.target.value } }))}
                />
              </label>
            </div>
            <p className="commit-dialog-hint">
              Il documento verrà creato come bozza AI (<em>ai_draft</em>) nel Registro Documenti.
              Potrai validarlo dalla pagina Documenti.
            </p>
            <div className="commit-dialog-actions">
              <button type="button" className="btn-secondary" onClick={() => setCommitDialog(null)} disabled={busy}>
                Annulla
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={handleCommitConfirm}
                disabled={busy || !commitDialog.form.title.trim()}
              >
                {busy ? "Salvataggio…" : "Conferma e salva nel Registry"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
