/**
 * ImportJobsPage — Sprint 9: job import PDF batch + revisione testo
 */

import React, { useState, useEffect, useCallback } from "react";
import apiService from "../services/apiService";
import { useAuth } from "../contexts/AuthContext";
import "./ImportJobsPage.css";

export default function ImportJobsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "superadmin";
  const [jobs, setJobs] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [newTitle, setNewTitle] = useState("");
  const [busy, setBusy] = useState(false);

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
      const res = await apiService.createImportJob({ title: newTitle || undefined });
      const id = res.data?.id;
      setNewTitle("");
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
        Crea un job, carica uno o più PDF, avvia l&apos;estrazione testo (solo strato testo del PDF, senza OCR).
        Controlla il testo e segnala come revisionato. Estensioni OCR / classificazione in roadmap.
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
                      #{j.id} — {j.status} — {j.file_count ?? 0} file
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
                  <> — tipo suggerito: {detail.job.document_type_hint}</>
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
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
