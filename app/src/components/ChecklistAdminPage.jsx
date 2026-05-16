/**
 * ChecklistAdminPage.jsx
 *
 * Pagina admin per gestire gli stralci normativi (norm_excerpt) delle domande
 * delle checklist. Accessibile solo a utenti con ruolo admin o superadmin.
 *
 * Funzionalità:
 * - Seleziona standard (ISO 14001, ISO 9001, …)
 * - Visualizza tutte le domande raggruppate per sezione
 * - Modifica norm_excerpt con textarea (incolla testo dalla norma o doc di riferimento)
 * - Salvataggio singolo per domanda
 *
 * Props:
 * - onBack: funzione per tornare alla vista principale
 */

import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "../contexts/AuthContext";
import apiService from "../services/apiService";
import "./ChecklistAdminPage.css";

// ── Legenda Markdown ───────────────────────────────────────────────────────

const MARKDOWN_LEGEND = [
  { symbol: "| col1 | col2 |",        desc: "riga di tabella" },
  { symbol: "|------|------|",         desc: "separatore header (opzionale)" },
  { symbol: "- testo",                 desc: "punto elenco" },
  { symbol: "**testo**",              desc: "grassetto" },
  { symbol: "testo normale",           desc: "paragrafo in corsivo" },
];

function MarkdownLegend() {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="md-legend">
      <button className="md-legend-toggle" onClick={() => setOpen(v => !v)}>
        {open ? "▲" : "▼"} Formattazione supportata nel testo
      </button>
      {open && (
        <div className="md-legend-body">
          <p className="md-legend-intro">
            Puoi usare questi simboli nel campo stralcio - verranno convertiti in formattazione Word:
          </p>
          <table className="md-legend-table">
            <thead><tr><th>Scrivi</th><th>Risultato nel Word</th></tr></thead>
            <tbody>
              {MARKDOWN_LEGEND.map((row, i) => (
                <tr key={i}>
                  <td><code>{row.symbol}</code></td>
                  <td>{row.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="md-legend-example">
            <strong>Esempio tabella:</strong><br />
            <code>| Carica | Frequenza |</code><br />
            <code>|--------|-----------|</code><br />
            <code>| &lt; 5 kg | Annuale |</code><br />
            <code>| ≥ 5 kg | Semestrale |</code>
          </p>
        </div>
      )}
    </div>
  );
}

// ── Costanti ───────────────────────────────────────────────────────────────

const STANDARDS = [
  { id: 2, code: "ISO 14001", name: "ISO 14001 - Gestione Ambientale" },
  { id: 1, code: "ISO 9001",  name: "ISO 9001 - Gestione Qualit\u00e0" },
  { id: 3, code: "ISO 3834",  name: "ISO 3834 - Requisiti Saldatura" },
  { id: 4, code: "ISO 45001", name: "ISO 45001 - Salute e Sicurezza" },
];

// ── Componente singola domanda ─────────────────────────────────────────────

function QuestionRow({ question, onSaved }) {
  const [excerpt, setExcerpt] = useState(question.norm_excerpt || "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);

  const isDirty = excerpt !== (question.norm_excerpt || "");

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await apiService.patch(`/checklist/questions/${question.question_id}`, {
        norm_excerpt: excerpt,
      });
      setSaved(true);
      onSaved(question.question_id, excerpt, question.question_text);
      setTimeout(() => setSaved(false), 3500);
    } catch (err) {
      setError(err.message || "Errore salvataggio");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`qa-row ${isDirty ? "dirty" : ""} ${saved ? "saved" : ""}`}>
      <div className="qa-header">
        <span className="qa-order">{question.question_order}.</span>
        <span className="qa-text">{question.question_text}</span>
        <div className="qa-actions">
          {error && <span className="qa-error">{error}</span>}
          {saved && <span className="qa-ok">✓ Salvato</span>}
          <button
            className="btn-save-excerpt"
            onClick={handleSave}
            disabled={saving || !isDirty}
            title={isDirty ? "Salva stralcio normativo" : "Nessuna modifica"}
          >
            {saving ? "..." : isDirty ? "Salva" : "✓"}
          </button>
        </div>
      </div>
      <textarea
        className="qa-excerpt"
        value={excerpt}
        onChange={(e) => setExcerpt(e.target.value)}
        placeholder="Incolla qui lo stralcio normativo di riferimento per questa domanda (comparirà sempre nel report Word)…"
        rows={4}
      />
    </div>
  );
}

// ── Componente principale ─────────────────────────────────────────────────

function ChecklistAdminPage({ onBack }) {
  const { user } = useAuth();
  const [selectedStandardId, setSelectedStandardId] = useState(2); // ISO 14001 default
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null); // { text, type }

  const showToast = useCallback((text, type = "success") => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  // Controllo accesso
  const isAdmin = user?.role === "admin" || user?.role === "superadmin";
  if (!isAdmin) {
    return (
      <div className="admin-access-denied">
        <p>Accesso riservato agli amministratori.</p>
        <button onClick={onBack}>← Torna indietro</button>
      </div>
    );
  }

  // Carica domande per lo standard selezionato
  const loadQuestions = useCallback(async (standardId) => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiService.get(`/checklist/questions/all?standard_id=${standardId}`);
      setQuestions(res.questions || []);
    } catch (err) {
      setError("Impossibile caricare le domande: " + err.message);
      setQuestions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadQuestions(selectedStandardId);
  }, [selectedStandardId, loadQuestions]);

  // Aggiorna excerpt nella lista locale dopo il salvataggio (evita re-fetch)
  const handleSaved = useCallback((questionId, newExcerpt, questionText) => {
    setQuestions((prev) =>
      prev.map((q) =>
        q.question_id === questionId ? { ...q, norm_excerpt: newExcerpt } : q
      )
    );
    showToast(`✓ Salvato: ${questionText}`);
  }, [showToast]);

  // Raggruppa domande per sezione
  const sections = [];
  let currentSection = null;
  for (const q of questions) {
    if (!currentSection || currentSection.code !== q.section_code) {
      currentSection = {
        code: q.section_code,
        title: q.section_title,
        questions: [],
      };
      sections.push(currentSection);
    }
    currentSection.questions.push(q);
  }

  // Conteggio stralci compilati
  const filled = questions.filter((q) => q.norm_excerpt?.trim()).length;
  const total  = questions.length;

  return (
    <div className="checklist-admin-page">
      {/* Toast notifica salvataggio */}
      {toast && (
        <div className={`ca-toast ca-toast-${toast.type}`}>
          {toast.text}
        </div>
      )}

      {/* Intestazione */}
      <div className="ca-header">
        <button className="ca-back-btn" onClick={onBack}>
          ← Lista Audit
        </button>
        <div className="ca-title-block">
          <h2>Gestione Checklist - Stralci Normativi</h2>
          <p className="ca-subtitle">
            Incolla il testo normativo di riferimento per ogni domanda. Comparirà
            automaticamente nel report Word sotto la tabella di ogni punto auditato.
          </p>
        </div>
      </div>

      {/* Selettore standard */}
      <div className="ca-toolbar">
        <label className="ca-std-label">Standard:</label>
        <div className="ca-std-tabs">
          {STANDARDS.map((s) => (
            <button
              key={s.id}
              className={`ca-std-tab ${selectedStandardId === s.id ? "active" : ""}`}
              onClick={() => setSelectedStandardId(s.id)}
            >
              {s.code}
            </button>
          ))}
        </div>
        {!loading && total > 0 && (
          <span className="ca-progress">
            {filled}/{total} stralci compilati
          </span>
        )}
      </div>

      {/* Stato */}
      {loading && (
        <div className="ca-loading">
          <div className="ca-spinner" />
          Caricamento domande...
        </div>
      )}
      {error && <div className="ca-error-banner">{error}</div>}

      {/* Lista sezioni e domande */}
      {!loading && !error && sections.length === 0 && (
        <div className="ca-empty">
          Nessuna domanda trovata per questo standard.
        </div>
      )}

      {/* Legenda formattazione Markdown */}
      {!loading && sections.length > 0 && <MarkdownLegend />}

      {!loading && sections.map((section) => (
        <div key={section.code} className="ca-section">
          <div className="ca-section-header">
            <h3>{section.title}</h3>
            <span className="ca-section-count">
              {section.questions.filter((q) => q.norm_excerpt?.trim()).length}/
              {section.questions.length} compilati
            </span>
          </div>
          <div className="ca-questions">
            {section.questions.map((q) => (
              <QuestionRow
                key={q.question_id}
                question={q}
                onSaved={handleSaved}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default ChecklistAdminPage;
