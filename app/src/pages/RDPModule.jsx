/**
 * RDPModule — Rapporto di Prova (RDP, Scenario 4 — cliente Mason)
 *
 * Riferimento: docs/PROJECT_ROADMAP.md sezione "Modulo RDP - Rapporto di Prova
 * (Scenario 4 - Mason)". Template cliente (non normativo, solo struttura):
 * Check List Audit/RDP_MSN-260127-01_REV_0.docx.
 *
 * Pattern: lista + form a sezioni collassabili (NdtReportsPage) con prove
 * tecniche raggruppate per area (es. "Gestione Qualita'", "Ispezione in campo").
 * Foto OBBLIGATORIE per prova — galleria abilitata dopo il primo salvataggio
 * (la prova deve avere un id reale prima di poter allegare foto, come in CND).
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import apiService from "../services/apiService";
import { useCompanyScope } from "../contexts/CompanyScopeContext";
import RdpTestAttachments from "../components/RdpTestAttachments.jsx";
import "../components/ChecklistModule.css";
import "./RDPModule.css";

const REPORT_STATUSES = [
    { value: "draft",     label: "Bozza",      cls: "rdp-status-draft" },
    { value: "completed", label: "Completato", cls: "rdp-status-completed" },
    { value: "approved",  label: "Approvato",  cls: "rdp-status-approved" },
];

const RESULT_OPTIONS = [
    { value: "C",   label: "C",   title: "Conforme",            cls: "compliant" },
    { value: "OSS", label: "OSS", title: "Osservazione",         cls: "partial" },
    { value: "NC",  label: "NC",  title: "Non conforme",         cls: "non-compliant" },
    { value: "OM",  label: "OM",  title: "Non applicabile motivata", cls: "om" },
    { value: "NA",  label: "NA",  title: "Non applicabile",      cls: "not-applicable" },
    { value: "NV",  label: "NV",  title: "Non verificato",       cls: "not-verified" },
];

const EMPTY_TEST = { reference_code: "", test_name: "", expected_value: "", measured_value: "", evidence_notes: "", score: "", result_code: "" };
const EMPTY_SECTION = { title: "", tests: [{ ...EMPTY_TEST }] };

// ── Card singola prova ────────────────────────────────────────────────────────
function TestCard({ test, sIndex, tIndex, onChange, onRemove, reportSaved }) {
    const set = (k, v) => onChange(sIndex, tIndex, { ...test, [k]: v });
    const attRef = useRef(null);
    const [photoState, setPhotoState] = useState({ count: 0, uploading: false, error: null });

    const handlePhotoClick = () => {
        if (!test.id) {
            alert("Salva il rapporto con 'Salva bozza' per abilitare le foto su questa prova.");
            return;
        }
        attRef.current?.openFilePicker();
    };

    const missingPhoto = reportSaved && test.id && photoState.count === 0;

    return (
        <div className={`rdp-test-card${missingPhoto ? " rdp-test-missing-photo" : ""}`}>
            <div className="rdp-test-card-header">
                <input
                    type="text"
                    className="rdp-test-ref-input"
                    placeholder="Rif. proc. (es. PQ 08.02)"
                    value={test.reference_code || ""}
                    onChange={e => set("reference_code", e.target.value)}
                />
                <button type="button" className="rdp-test-remove" onClick={() => onRemove(sIndex, tIndex)} title="Rimuovi prova">&times;</button>
            </div>
            <textarea
                className="rdp-test-question notes-textarea"
                placeholder="Quesito / prova tecnica da verificare..."
                value={test.test_name || ""}
                onChange={e => set("test_name", e.target.value)}
                rows={2}
            />
            <div className="rdp-test-row">
                <div className="rdp-test-field">
                    <label>Valore atteso</label>
                    <input type="text" value={test.expected_value || ""} onChange={e => set("expected_value", e.target.value)} placeholder="criterio/tolleranza..." />
                </div>
                <div className="rdp-test-field">
                    <label>Valore misurato</label>
                    <input type="text" value={test.measured_value || ""} onChange={e => set("measured_value", e.target.value)} placeholder="esito misurato..." />
                </div>
                <div className="rdp-test-field rdp-test-score-field">
                    <label>Punteggio (1-5)</label>
                    <input type="number" min="1" max="5" step="0.5" value={test.score ?? ""} onChange={e => set("score", e.target.value)} />
                </div>
            </div>
            <textarea
                className="rdp-test-evidence notes-textarea"
                placeholder="Valutazione / evidenze raccolte durante la visita..."
                value={test.evidence_notes || ""}
                onChange={e => set("evidence_notes", e.target.value)}
                rows={2}
            />
            <div className="rdp-test-footer">
                <div className="rdp-result-btns">
                    {RESULT_OPTIONS.map(opt => (
                        <button key={opt.value} type="button"
                            className={`status-btn ${opt.cls}${test.result_code === opt.value ? " active" : ""}`}
                            title={opt.title}
                            onClick={() => set("result_code", test.result_code === opt.value ? "" : opt.value)}>
                            {opt.label}
                        </button>
                    ))}
                </div>
                <button
                    type="button"
                    className={`rdp-photo-btn${!test.id ? " rdp-photo-btn-disabled" : ""}${photoState.count > 0 ? " rdp-photo-btn-has-photos" : ""}${missingPhoto ? " rdp-photo-btn-required" : ""}`}
                    onClick={handlePhotoClick}
                    disabled={photoState.uploading}
                    title={test.id ? "Scatta o aggiungi foto (obbligatoria)" : "Salva prima il rapporto per aggiungere foto"}
                >
                    {"\uD83D\uDCF7"} Foto{photoState.count > 0 ? ` (${photoState.count})` : ""}
                    {missingPhoto && <span className="rdp-photo-required-badge" title="Foto obbligatoria mancante">!</span>}
                </button>
            </div>
            {test.id && (
                <RdpTestAttachments ref={attRef} testId={test.id} onStateChange={setPhotoState} />
            )}
        </div>
    );
}

// ── Form rapporto ─────────────────────────────────────────────────────────────
function RdpReportForm({ report, companies, onSave, onCancel }) {
    const isEdit = !!report;
    const currentUserName = useMemo(() => {
        const u = apiService.getStoredUser();
        return u ? (u.full_name || u.email || "") : "";
    }, []);

    const emptyForm = {
        company_id: "",
        client: "",
        supplier_name: "",
        project_name: "",
        purpose: "",
        welded_element_type: "",
        drawing_reference: "",
        inspection_date: "",
        mason_inspector: currentUserName,
        client_inspector: "",
        notes: "",
        status: "draft",
    };

    const [form, setForm] = useState(() => {
        if (!isEdit) return emptyForm;
        return {
            company_id:          report.company_id || "",
            client:              report.client || "",
            supplier_name:       report.supplier_name || "",
            project_name:        report.project_name || "",
            purpose:             report.purpose || "",
            welded_element_type: report.welded_element_type || "",
            drawing_reference:   report.drawing_reference || "",
            inspection_date:     report.inspection_date ? report.inspection_date.substring(0, 10) : "",
            mason_inspector:     report.mason_inspector || currentUserName,
            client_inspector:    report.client_inspector || "",
            notes:               report.notes || "",
            status:              report.status || "draft",
        };
    });

    const [sections, setSections] = useState(() =>
        isEdit && report.sections && report.sections.length > 0
            ? report.sections
            : [{ ...EMPTY_SECTION, tests: [{ ...EMPTY_TEST }] }]
    );

    const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
    const [collapsed, setCollapsed] = useState({
        general: false,
        tests: !isMobile ? false : true,
        notes: !isMobile,
        signatures: !isMobile,
    });
    const toggle = (k) => setCollapsed(c => ({ ...c, [k]: !c[k] }));

    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const [savedAt, setSavedAt] = useState(null);
    const [currentReport, setCurrentReport] = useState(report || null);

    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

    const averageScore = useMemo(() => {
        const scores = [];
        for (const s of sections) {
            for (const t of s.tests || []) {
                const n = t.score !== "" && t.score !== null && t.score !== undefined ? parseFloat(String(t.score).replace(",", ".")) : NaN;
                if (!Number.isNaN(n)) scores.push(n);
            }
        }
        if (scores.length === 0) return null;
        return Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100;
    }, [sections]);

    const missingPhotosCount = useMemo(() => {
        // Conteggio best-effort — la verifica reale avviene lato server/galleria (fetch async per prova)
        return sections.reduce((acc, s) => acc + (s.tests || []).filter(t => !t.id).length, 0);
    }, [sections]);

    const updateTest = (sIdx, tIdx, data) => setSections(prev => prev.map((s, i) => i !== sIdx ? s : { ...s, tests: s.tests.map((t, j) => j === tIdx ? data : t) }));
    const removeTest = (sIdx, tIdx) => setSections(prev => prev.map((s, i) => i !== sIdx ? s : { ...s, tests: s.tests.filter((_, j) => j !== tIdx) }));
    const addTest = (sIdx) => setSections(prev => prev.map((s, i) => i !== sIdx ? s : { ...s, tests: [...s.tests, { ...EMPTY_TEST }] }));
    const setSectionTitle = (sIdx, title) => setSections(prev => prev.map((s, i) => i !== sIdx ? s : { ...s, title }));
    const addSection = () => setSections(prev => [...prev, { ...EMPTY_SECTION, tests: [{ ...EMPTY_TEST }] }]);
    const removeSection = (sIdx) => setSections(prev => prev.filter((_, i) => i !== sIdx));

    const handleSubmit = async (e, targetStatus) => {
        if (e) e.preventDefault();
        setSaving(true);
        setError(null);
        try {
            const payload = {
                ...form,
                company_id: form.company_id ? parseInt(form.company_id) : null,
                status: targetStatus || form.status,
                sections: sections.filter(s => (s.title || "").trim() || (s.tests || []).length > 0),
            };
            let saved;
            if (currentReport?.id) {
                saved = await apiService.updateRdpReport(currentReport.id, payload);
            } else {
                saved = await apiService.createRdpReport(payload);
            }
            const data = saved?.data || saved;
            setCurrentReport(data);
            setSections(data.sections && data.sections.length > 0 ? data.sections : sections);
            setSavedAt(new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }));
            onSave();
        } catch (err) {
            setError(err?.message || "Errore salvataggio rapporto RDP");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="rdp-form-page">
            <div className="rdp-form-header">
                <div>
                    <h2 className="rdp-form-title">
                        {currentReport ? `Rapporto ${currentReport.report_number || "\u2014"}` : "Nuovo Rapporto di Prova (RDP)"}
                    </h2>
                    <span className="rdp-form-subtitle">Scenario 4 \u2014 ISO 3834 (cliente Mason)</span>
                </div>
                <div className="rdp-form-header-actions">
                    <button type="button" className="btn" onClick={onCancel}>Chiudi</button>
                    <button type="button" className="btn btn-primary" onClick={e => handleSubmit(e, "draft")} disabled={saving}>
                        {saving ? "Salvataggio..." : "Salva bozza"}
                    </button>
                    {form.status !== "approved" && (
                        <button type="button" className="btn btn-primary" onClick={e => handleSubmit(e, "completed")} disabled={saving}>
                            Completa rapporto
                        </button>
                    )}
                </div>
            </div>

            {savedAt && <div className="rdp-saved-at">{"Salvato alle " + savedAt}</div>}
            {error && <div className="rdp-form-error">{error}</div>}
            {!currentReport && missingPhotosCount > 0 && (
                <div className="rdp-hint-box">
                    {"\u2139\uFE0F Le foto per ogni prova si potranno allegare dopo il primo salvataggio (\u201CSalva bozza\u201D)."}
                </div>
            )}

            <div className="rdp-form-body">
                {/* Sezione 1: Dati Generali */}
                <div className="rdp-section">
                    <button type="button" className="rdp-section-toggle" onClick={() => toggle("general")}>
                        <span className="rdp-section-num">1</span>
                        <span className="rdp-section-title">Dati Generali</span>
                        <span className="rdp-section-chevron">{collapsed.general ? "\u25BC" : "\u25B2"}</span>
                    </button>
                    {!collapsed.general && (
                        <div className="rdp-section-body">
                            <div className="rdp-form-row">
                                <div className="rdp-form-group rdp-grow">
                                    <label>Committente (chi commissiona la visita)</label>
                                    <select value={form.company_id} onChange={e => {
                                        const cid = e.target.value;
                                        const company = companies.find(c => String(c.id) === String(cid));
                                        set("company_id", cid);
                                        set("client", company ? company.name : "");
                                    }}>
                                        <option value="">{"\u2014 seleziona azienda \u2014"}</option>
                                        {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                </div>
                                <div className="rdp-form-group rdp-grow">
                                    <label>Fornitore ispezionato (sede visitata)</label>
                                    <input type="text" value={form.supplier_name} onChange={e => set("supplier_name", e.target.value)} placeholder="es. Fornitore S.r.l. \u2014 stabilimento..." />
                                </div>
                            </div>
                            <div className="rdp-form-row">
                                <div className="rdp-form-group rdp-grow">
                                    <label>Intervento / progetto</label>
                                    <input type="text" value={form.project_name} onChange={e => set("project_name", e.target.value)} placeholder="es. Audit progetto saldatura..." />
                                </div>
                                <div className="rdp-form-group">
                                    <label>Data visita ispettiva</label>
                                    <input type="date" value={form.inspection_date} onChange={e => set("inspection_date", e.target.value)} />
                                </div>
                            </div>
                            <div className="rdp-form-row">
                                <div className="rdp-form-group rdp-grow">
                                    <label>Scopo della visita ispettiva</label>
                                    <input type="text" value={form.purpose} onChange={e => set("purpose", e.target.value)} placeholder="obiettivo della visita..." />
                                </div>
                            </div>
                            <div className="rdp-form-row">
                                <div className="rdp-form-group">
                                    <label>Tipologia elemento saldato</label>
                                    <input type="text" value={form.welded_element_type} onChange={e => set("welded_element_type", e.target.value)} />
                                </div>
                                <div className="rdp-form-group rdp-grow">
                                    <label>Disegno/i di riferimento</label>
                                    <input type="text" value={form.drawing_reference} onChange={e => set("drawing_reference", e.target.value)} />
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Sezione 2: Prove tecniche */}
                <div className="rdp-section">
                    <button type="button" className="rdp-section-toggle" onClick={() => toggle("tests")}>
                        <span className="rdp-section-num">2</span>
                        <span className="rdp-section-title">
                            {"Prove tecniche"}
                            {averageScore !== null && <span className="rdp-avg-badge">{"Media: " + averageScore}</span>}
                        </span>
                        <span className="rdp-section-chevron">{collapsed.tests ? "\u25BC" : "\u25B2"}</span>
                    </button>
                    {!collapsed.tests && (
                        <div className="rdp-section-body">
                            {sections.map((section, sIdx) => (
                                <div key={section.id || sIdx} className="rdp-area">
                                    <div className="rdp-area-header">
                                        <input
                                            type="text"
                                            className="rdp-area-title-input"
                                            placeholder={"Area / gruppo prove (es. Gestione Qualit\u00e0, Ispezione in campo)"}
                                            value={section.title || ""}
                                            onChange={e => setSectionTitle(sIdx, e.target.value)}
                                        />
                                        {sections.length > 1 && (
                                            <button type="button" className="rdp-area-remove" onClick={() => removeSection(sIdx)} title="Rimuovi area">Rimuovi area</button>
                                        )}
                                    </div>
                                    <div className="rdp-tests-list">
                                        {(section.tests || []).map((test, tIdx) => (
                                            <TestCard
                                                key={test.id || `${sIdx}-${tIdx}`}
                                                test={test}
                                                sIndex={sIdx}
                                                tIndex={tIdx}
                                                onChange={updateTest}
                                                onRemove={removeTest}
                                                reportSaved={!!currentReport}
                                            />
                                        ))}
                                    </div>
                                    <button type="button" className="btn rdp-add-test-btn" onClick={() => addTest(sIdx)}>+ Aggiungi prova</button>
                                </div>
                            ))}
                            <button type="button" className="btn rdp-add-area-btn" onClick={addSection}>+ Aggiungi area</button>
                        </div>
                    )}
                </div>

                {/* Sezione 3: Note */}
                <div className="rdp-section">
                    <button type="button" className="rdp-section-toggle" onClick={() => toggle("notes")}>
                        <span className="rdp-section-num">3</span>
                        <span className="rdp-section-title">Note</span>
                        <span className="rdp-section-chevron">{collapsed.notes ? "\u25BC" : "\u25B2"}</span>
                    </button>
                    {!collapsed.notes && (
                        <div className="rdp-section-body">
                            <textarea
                                className="notes-textarea"
                                value={form.notes}
                                onChange={e => set("notes", e.target.value)}
                                rows={3}
                                placeholder="Note conclusive del rapporto..."
                            />
                        </div>
                    )}
                </div>

                {/* Sezione 4: Ufficializzazione */}
                <div className="rdp-section">
                    <button type="button" className="rdp-section-toggle" onClick={() => toggle("signatures")}>
                        <span className="rdp-section-num">4</span>
                        <span className="rdp-section-title">Ufficializzazione</span>
                        <span className="rdp-section-chevron">{collapsed.signatures ? "\u25BC" : "\u25B2"}</span>
                    </button>
                    {!collapsed.signatures && (
                        <div className="rdp-section-body">
                            <div className="rdp-form-row">
                                <div className="rdp-form-group">
                                    <label>Ispettore Mason</label>
                                    <input type="text" value={form.mason_inspector} onChange={e => set("mason_inspector", e.target.value)} />
                                </div>
                                <div className="rdp-form-group">
                                    <label>Ispettore committente</label>
                                    <input type="text" value={form.client_inspector} onChange={e => set("client_inspector", e.target.value)} />
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// ── Componente principale ─────────────────────────────────────────────────────
export default function RDPModule() {
    const { companyId: filterCompany, companies } = useCompanyScope();
    const [reports, setReports] = useState([]);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const [filterStatus, setFilterStatus] = useState("");
    const [searchText, setSearchText] = useState("");

    const [view, setView] = useState("list");
    const [editingReport, setEditingReport] = useState(null);

    const loadData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const params = {};
            if (filterStatus)  params.status = filterStatus;
            if (filterCompany) params.company_id = filterCompany;
            if (searchText)    params.search = searchText;

            const [listResp, statsResp] = await Promise.all([
                apiService.getRdpReportList(params),
                apiService.getRdpReportStats(filterCompany ? { company_id: filterCompany } : {}),
            ]);

            setReports(listResp.data || []);
            setStats(statsResp.data || null);
        } catch (err) {
            setError("Errore caricamento rapporti RDP");
        } finally {
            setLoading(false);
        }
    }, [filterStatus, filterCompany, searchText]);

    useEffect(() => { loadData(); }, [loadData]);

    const openNew = () => { setEditingReport(null); setView("form"); };

    const openEdit = async (report) => {
        try {
            const resp = await apiService.getRdpReport(report.id);
            setEditingReport(resp.data);
        } catch {
            setEditingReport(report);
        }
        setView("form");
    };

    const handleSaved = () => { setView("list"); setEditingReport(null); loadData(); };
    const handleCancel = () => { setView("list"); setEditingReport(null); };

    const handleDelete = async (report) => {
        if (!window.confirm(`Eliminare il rapporto "${report.report_number || "bozza"}"?`)) return;
        try {
            await apiService.deleteRdpReport(report.id);
            loadData();
        } catch { alert("Errore eliminazione rapporto"); }
    };

    if (view === "form") {
        return (
            <RdpReportForm
                report={editingReport}
                companies={companies}
                onSave={handleSaved}
                onCancel={handleCancel}
            />
        );
    }

    return (
        <div className="rdp-page">
            <div className="rdp-header">
                <div>
                    <h1 className="rdp-title">Rapporti di Prova (RDP)</h1>
                    <p className="rdp-subtitle">Scenario 4 \u2014 ISO 3834, foto obbligatorie per prova (cliente Mason)</p>
                </div>
                <button className="btn btn-primary" onClick={openNew}>+ Nuovo rapporto</button>
            </div>

            {stats && (
                <div className="rdp-stats-bar">
                    <div className="rdp-stat"><span className="rdp-stat-n">{stats.total}</span><span>Totali</span></div>
                    <div className="rdp-stat"><span className="rdp-stat-n">{stats.draft}</span><span>Bozze</span></div>
                    <div className="rdp-stat rdp-stat-ok"><span className="rdp-stat-n">{stats.approved}</span><span>Approvati</span></div>
                    <div className="rdp-stat"><span className="rdp-stat-n">{stats.avg_score_overall != null ? Number(stats.avg_score_overall).toFixed(2) : "\u2014"}</span><span>Media punteggi</span></div>
                </div>
            )}

            <div className="rdp-filters">
                <input type="text" className="rdp-search" placeholder="Cerca cliente, fornitore, n. rapporto..." value={searchText} onChange={e => setSearchText(e.target.value)} />
                <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                    <option value="">Tutti gli stati</option>
                    {REPORT_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
            </div>

            {loading && <div className="rdp-loading">Caricamento...</div>}
            {error && <div className="rdp-error">{error}</div>}
            {!loading && !error && (
                <div className="rdp-table-wrap">
                    <table className="rdp-table">
                        <thead>
                            <tr>
                                <th>N. Rapporto</th>
                                <th>Committente</th>
                                <th>Fornitore</th>
                                <th>Progetto</th>
                                <th>Data visita</th>
                                <th>Prove</th>
                                <th>Media</th>
                                <th>Stato</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {reports.length === 0 && (
                                <tr><td colSpan={9} className="rdp-empty">Nessun rapporto trovato</td></tr>
                            )}
                            {reports.map(r => {
                                const st = REPORT_STATUSES.find(s => s.value === r.status) || REPORT_STATUSES[0];
                                return (
                                    <tr key={r.id} className="rdp-row" onClick={() => openEdit(r)}>
                                        <td className="rdp-mono">{r.report_number || <em>bozza</em>}</td>
                                        <td>{r.client || r.company_name || "\u2014"}</td>
                                        <td>{r.supplier_name || "\u2014"}</td>
                                        <td>{r.project_name || "\u2014"}</td>
                                        <td>{r.inspection_date ? new Date(r.inspection_date).toLocaleDateString("it-IT") : "\u2014"}</td>
                                        <td className="rdp-center">{r.tests_count}</td>
                                        <td className="rdp-center">{r.average_score != null ? r.average_score : "\u2014"}</td>
                                        <td><span className={`rdp-status ${st.cls}`}>{st.label}</span></td>
                                        <td onClick={e => e.stopPropagation()}>
                                            <button className="eq-btn-icon" onClick={() => openEdit(r)} title="Modifica">&#x270E;</button>
                                            <button className="eq-btn-icon eq-btn-danger" onClick={() => handleDelete(r)} title="Elimina">&#x2715;</button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
