/**
 * SemiannualConfirmationSection — Registro conferme semestrali
 * Visibile solo per qualifiche approvate ISO 9606-1 (saldatori) o ISO 14732 (operatori
 * saldatura automatica/meccanizzata) — entrambe le norme richiedono conferma ogni 6 mesi.
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import apiService from "../services/apiService";
import { formatDate } from "../utils/dateHelpers";
import { isOperator14732Type, requiresSemiannualConfirmation } from "../utils/weldingConfirmationRules";

function SemiannualConfirmationSection({
  qualificationId,
  qualificationType,
  approvalStatus,
  lastConfirmationDate,
  nextConfirmationDue,
  companyId,
  openByDefault = false,
  onDatesUpdated,
}) {
  const sectionRef = useRef(null);
  const [expanded, setExpanded] = useState(openByDefault);
  const [loading, setLoading] = useState(false);
  const [confirmations, setConfirmations] = useState([]);
  const [canConfirm, setCanConfirm] = useState(false);
  const [lastConf, setLastConf] = useState(lastConfirmationDate || "");
  const [nextDue, setNextDue] = useState(nextConfirmationDue || "");
  const [error, setError] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirmDate, setConfirmDate] = useState(new Date().toISOString().slice(0, 10));
  const [confirmNotes, setConfirmNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editDate, setEditDate] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  const visible = approvalStatus === "approvata" && requiresSemiannualConfirmation(qualificationType);
  const sectionLabel = isOperator14732Type(qualificationType)
    ? "Conferma semestrale (ISO 14732)"
    : "Conferma semestrale (ISO 9606-1)";

  const loadConfirmations = useCallback(async () => {
    if (!qualificationId || !visible) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiService.getQualificationConfirmations(qualificationId);
      setConfirmations(res?.confirmations || []);
      setCanConfirm(!!res?.can_confirm);
      if (res?.last_confirmation_date) setLastConf(String(res.last_confirmation_date).slice(0, 10));
      if (res?.next_confirmation_due) setNextDue(String(res.next_confirmation_due).slice(0, 10));
    } catch (err) {
      setError(err.message || "Errore caricamento conferme");
    } finally {
      setLoading(false);
    }
  }, [qualificationId, visible]);

  useEffect(() => {
    setLastConf(lastConfirmationDate ? String(lastConfirmationDate).slice(0, 10) : "");
    setNextDue(nextConfirmationDue ? String(nextConfirmationDue).slice(0, 10) : "");
  }, [lastConfirmationDate, nextConfirmationDue]);

  useEffect(() => {
    if (expanded && visible) loadConfirmations();
  }, [expanded, visible, loadConfirmations]);

  useEffect(() => {
    if (openByDefault) {
      setExpanded(true);
      requestAnimationFrame(() => {
        const el = sectionRef.current;
        if (el && typeof el.scrollIntoView === "function") {
          el.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      });
    }
  }, [openByDefault]);

  function startEdit(c) {
    setEditingId(c.id);
    setEditDate(c.confirmed_at ? String(c.confirmed_at).slice(0, 10) : "");
    setEditNotes(c.notes || "");
    setError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditDate("");
    setEditNotes("");
  }

  async function handleSaveEdit() {
    if (!editingId || !editDate) return;
    setEditSaving(true);
    setError(null);
    try {
      const res = await apiService.updateQualificationConfirmation(qualificationId, editingId, {
        confirmed_at: editDate,
        notes: editNotes.trim() || null,
      });
      if (res?.last_confirmation_date) setLastConf(String(res.last_confirmation_date).slice(0, 10));
      if (res?.next_confirmation_due) setNextDue(String(res.next_confirmation_due).slice(0, 10));
      onDatesUpdated?.({
        last_confirmation_date: res?.last_confirmation_date || editDate,
        next_confirmation_due: res?.next_confirmation_due || "",
      });
      cancelEdit();
      await loadConfirmations();
    } catch (err) {
      setError(err.message || "Errore salvataggio conferma");
    } finally {
      setEditSaving(false);
    }
  }

  async function handleConfirm() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await apiService.confirmQualificationSemiannual(qualificationId, {
        confirmed_at: confirmDate,
        notes: confirmNotes.trim() || undefined,
      });
      setLastConf(res?.last_confirmation_date || confirmDate);
      setNextDue(res?.next_confirmation_due || "");
      setDialogOpen(false);
      setConfirmNotes("");
      onDatesUpdated?.({
        last_confirmation_date: res?.last_confirmation_date || confirmDate,
        next_confirmation_due: res?.next_confirmation_due || "",
      });
      await loadConfirmations();
    } catch (err) {
      setError(err.message || "Errore registrazione conferma");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleExport() {
    setExporting(true);
    setError(null);
    try {
      await apiService.downloadQualificationConfirmationsExport({
        qualification_id: qualificationId,
        company_id: companyId || undefined,
      });
    } catch (err) {
      setError(err.message || "Errore export Excel");
    } finally {
      setExporting(false);
    }
  }

  if (!visible) return null;

  return (
    <div className="qf-semiannual-section" ref={sectionRef} id="conferma-semestrale">
      <button
        type="button"
        className="qf-section-toggle"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <span className="qf-section-title" style={{ margin: 0 }}>
          {sectionLabel}
        </span>
        <span className="qf-section-chevron">{expanded ? "\u25B2" : "\u25BC"}</span>
      </button>

      {expanded && (
        <div className="qf-semiannual-body">
          <div className="qf-row">
            <div className="qf-field">
              <label>Ultima conferma</label>
              <input type="text" readOnly tabIndex={-1} value={lastConf ? formatDate(lastConf) : "\u2014"}
                style={{ background: "#f3f4f6" }} />
            </div>
            <div className="qf-field">
              <label>Prossima conferma entro</label>
              <input type="text" readOnly tabIndex={-1} value={nextDue ? formatDate(nextDue) : "\u2014"}
                style={{ background: "#f3f4f6" }} />
            </div>
          </div>

          <div className="qf-semiannual-actions">
            {canConfirm && (
              <button type="button" className="qf-btn-save" onClick={() => setDialogOpen(true)}>
                Registra conferma semestrale
              </button>
            )}
            <button type="button" className="qf-btn-link" onClick={handleExport} disabled={exporting}>
              {exporting ? "Export..." : "Esporta Excel"}
            </button>
          </div>

          {!canConfirm && (
            <p className="qf-info" style={{ fontSize: 13, marginTop: 8 }}>
              Solo il coordinatore responsabile primario dell&apos;azienda può registrare o correggere le conferme.
            </p>
          )}

          {loading ? (
            <p className="qf-info" style={{ fontSize: 13 }}>Caricamento storico...</p>
          ) : confirmations.length > 0 ? (
            <table className="qf-confirm-table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Confermato da</th>
                  <th>Note</th>
                  {canConfirm && <th>Azioni</th>}
                </tr>
              </thead>
              <tbody>
                {confirmations.map((c) => (
                  <tr key={c.id}>
                    {editingId === c.id ? (
                      <>
                        <td>
                          <input
                            type="date"
                            value={editDate}
                            onChange={(e) => setEditDate(e.target.value)}
                            aria-label="Data conferma da correggere"
                          />
                        </td>
                        <td>
                          {c.confirmer_name || "\u2014"}
                          {c.confirmer_title ? ` (${c.confirmer_title})` : ""}
                        </td>
                        <td>
                          <textarea
                            className="notes-textarea"
                            rows={2}
                            value={editNotes}
                            onChange={(e) => setEditNotes(e.target.value)}
                            aria-label="Note conferma"
                          />
                        </td>
                        <td>
                          <div className="qf-confirm-edit-actions">
                            <button
                              type="button"
                              className="qf-btn-save"
                              onClick={handleSaveEdit}
                              disabled={editSaving || !editDate}
                            >
                              {editSaving ? "Salvataggio..." : "Salva"}
                            </button>
                            <button type="button" className="qf-btn-cancel" onClick={cancelEdit} disabled={editSaving}>
                              Annulla
                            </button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td>{c.confirmed_at ? formatDate(c.confirmed_at) : "\u2014"}</td>
                        <td>
                          {c.confirmer_name || "\u2014"}
                          {c.confirmer_title ? ` (${c.confirmer_title})` : ""}
                        </td>
                        <td>{c.notes || "\u2014"}</td>
                        {canConfirm && (
                          <td>
                            <button
                              type="button"
                              className="qf-btn-link"
                              onClick={() => startEdit(c)}
                            >
                              Modifica
                            </button>
                          </td>
                        )}
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="qf-info" style={{ fontSize: 13 }}>Nessuna conferma registrata.</p>
          )}

          {error && <div className="qf-error" style={{ marginTop: 8 }}>{"\u26A0\uFE0F "}{error}</div>}
        </div>
      )}

      {dialogOpen && (
        <div className="qf-confirm-dialog-overlay" onClick={(e) => e.target === e.currentTarget && setDialogOpen(false)}>
          <div className="qf-confirm-dialog">
            <h4>Registra conferma semestrale</h4>
            <p style={{ fontSize: 13, color: "#4b5563", margin: "0 0 12px" }}>
              Confermi che il saldatore ha svolto attività di saldatura qualificata nel semestre?
            </p>
            <div className="qf-field">
              <label>Data conferma</label>
              <input type="date" value={confirmDate} onChange={(e) => setConfirmDate(e.target.value)} />
            </div>
            <div className="qf-field" style={{ marginTop: 8 }}>
              <label>Note (opzionale)</label>
              <textarea
                className="notes-textarea"
                rows={3}
                value={confirmNotes}
                onChange={(e) => setConfirmNotes(e.target.value)}
                placeholder="Es. commessa XYZ, verifica visiva..."
              />
            </div>
            <div className="qf-footer" style={{ marginTop: 16, padding: 0, border: "none" }}>
              <button type="button" className="qf-btn-cancel" onClick={() => setDialogOpen(false)}>Annulla</button>
              <button type="button" className="qf-btn-save" onClick={handleConfirm} disabled={submitting}>
                {submitting ? "Registrazione..." : "Conferma"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default SemiannualConfirmationSection;
