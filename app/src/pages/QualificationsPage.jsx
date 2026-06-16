/**
 * QualificationsPage v2 — Registro Qualifiche con tab per tipo
 * Tab: Tutti | Saldatori | NDT | Coordinatori | Operatori | Abilitazioni | Generiche
 */

import React, { useState, useEffect, useCallback, useMemo } from "react";
import apiService from "../services/apiService";
import { useAuth } from "../contexts/AuthContext";
import QualificationForm from "./QualificationForm";
import QualificationUploadButton from "../components/QualificationUploadButton";
import { formatDate } from "../utils/dateHelpers";
import {
    resolveInitialQualificationsCompanyScope,
    persistQualificationsCompanyScope,
} from "../utils/qualificationsCompanyScope";
import {
    QUALIFICATION_SITUAZIONI,
    STATS_TO_SITUAZIONE,
    toggleSituazione,
    situazioneLabel,
} from "../utils/qualificationsSituazione";
import "./QualificationsPage.css";

// ── Tab config ────────────────────────────────────────────────────────────────

const TABS = [
    { key: "tutti",         label: "Tutti",          qualification_type: "" },
    { key: "iso9606_1",     label: "Saldatori 9606-1", qualification_type: "iso9606_1" },
    { key: "iso9606_2",     label: "Saldatori 9606-2", qualification_type: "iso9606_2" },
    { key: "iso14732",      label: "Operatori 14732",  qualification_type: "iso14732" },
    { key: "ndt",           label: "NDT",              qualification_type: "ndt" },
    { key: "iso14731",      label: "Coordinatori",     qualification_type: "iso14731" },
    { key: "pes_pav",       label: "PES/PAV",          qualification_type: "pes_pav" },
    { key: "salute_mansione", label: "Salute mansione", qualification_type: "salute_mansione" },
    { key: "generico",      label: "Generiche",        qualification_type: "generico" },
];

// Colonne dinamiche per tab
const TAB_COLUMNS = {
    iso9606_1: ["Persona", "Certificato", "Processo", "Spessore", "Posizioni", "Scadenza", "Approvazione", "Azioni"],
    iso9606_2: ["Persona", "Certificato", "Processo", "Materiale", "Scadenza", "Approvazione", "Azioni"],
    iso14732:  ["Persona", "Certificato", "Processo", "Attrezzatura", "Scadenza", "Approvazione", "Azioni"],
    ndt:       ["Persona", "Certificato", "Metodo", "Livello", "Schema", "Scadenza", "Approvazione", "Azioni"],
    iso14731:  ["Persona", "Certificato", "Titolo (IWE/IWT/IWS)", "CPD fino a", "Approvazione", "Azioni"],
    pes_pav:   ["Persona", "Certificato", "Tipo", "Ente", "Scadenza", "Approvazione", "Azioni"],
    salute_mansione: ["Persona", "Documento", "Tipo", "Ente", "Scadenza", "Approvazione", "Azioni"],
    generico:  ["Persona", "Certificato", "Tipo qualifica", "Ore", "Ente esame", "Scadenza", "Approvazione", "Azioni"],
    tutti:     ["Stato", "Persona", "Tipo qualifica", "Certificato", "Scadenza", "Approvazione", "Azioni"],
};

// ── Semaforo ─────────────────────────────────────────────────────────────────

const SEMAFORO = {
    verde:    { label: "Valida",       cls: "sq-verde",     icon: "\uD83D\uDFE2" },
    giallo:   { label: "In scadenza",  cls: "sq-giallo",    icon: "\uD83D\uDFE1" },
    arancione:{ label: "Urgente",      cls: "sq-arancione", icon: "\uD83D\uDFE0" },
    rosso:    { label: "Scaduta",      cls: "sq-rosso",     icon: "\uD83D\uDD34" },
    grigio:   { label: "Non attiva",   cls: "sq-grigio",    icon: "\u26AA" },
};

const APPROVAL_BADGE = {
    bozza:       { label: "Bozza",        cls: "sq-appr-bozza" },
    in_revisione:{ label: "In revisione", cls: "sq-appr-revisione" },
    approvata:   { label: "Approvata",    cls: "sq-appr-approvata" },
    rifiutata:   { label: "Rifiutata",    cls: "sq-appr-rifiutata" },
};

function SemaforoTag({ value }) {
    const s = SEMAFORO[value] || SEMAFORO.grigio;
    return <span className={`sq-tag ${s.cls}`}>{s.icon} {s.label}</span>;
}

function ApprovalBadge({ value }) {
    const b = APPROVAL_BADGE[value] || APPROVAL_BADGE.bozza;
    return <span className={`sq-appr-badge ${b.cls}`}>{b.label}</span>;
}

// ── Stats bar ─────────────────────────────────────────────────────────────────

function StatsBar({ stats, activeSituazione, onStatClick }) {
    if (!stats) return null;

    const items = [
        { key: "total", cls: "", lbl: "Totale" },
        { key: "valide", cls: "sq-stat-verde", lbl: "Valide" },
        { key: "in_scadenza_60", cls: "sq-stat-giallo", lbl: "In scad. 60gg" },
        { key: "in_scadenza_30", cls: "sq-stat-arancione", lbl: "Urgenti 30gg" },
        { key: "scadute", cls: "sq-stat-rosso", lbl: "Scadute" },
    ];

    return (
        <div className="sq-stats-bar" role="group" aria-label="Filtri rapidi per situazione">
            {items.map(({ key, cls, lbl }) => {
                const mapped = STATS_TO_SITUAZIONE[key] ?? "";
                const isActive = mapped ? activeSituazione === mapped : !activeSituazione;
                return (
                    <button
                        key={key}
                        type="button"
                        className={`sq-stat sq-stat-clickable ${cls}${isActive ? " sq-stat-active" : ""}`}
                        onClick={() => onStatClick(key)}
                        title={mapped ? `Filtra: ${lbl}` : "Mostra tutte le situazioni"}
                        aria-pressed={isActive}
                    >
                        <span className="sq-stat-num">{stats[key]}</span>
                        <span className="sq-stat-lbl">{lbl}</span>
                    </button>
                );
            })}
            {stats.da_approvare > 0 && (
                <button
                    type="button"
                    className={`sq-stat sq-stat-clickable sq-stat-warning${activeSituazione === "da_approvare" ? " sq-stat-active" : ""}`}
                    onClick={() => onStatClick("da_approvare")}
                    title="Filtra: Da approvare"
                    aria-pressed={activeSituazione === "da_approvare"}
                >
                    <span className="sq-stat-num">{stats.da_approvare}</span>
                    <span className="sq-stat-lbl">Da approvare</span>
                </button>
            )}
        </div>
    );
}

// ── Riga tabella (rendering dinamico per tab) ─────────────────────────────────

function QualRow({ q, tabKey, onEdit, onDelete, onApprove, onReject, onRenew, onHistory, deleteId, setDeleteId, canApprove }) {
    const sem = SEMAFORO[q.semaforo] || SEMAFORO.grigio;

    const actionBtns = (
        <td className="sq-col-actions">
            {deleteId === q.id ? (
                <div className="sq-confirm">
                    <span>Revocare?</span>
                    <button className="sq-confirm-yes" onClick={() => onDelete(q.id)}>S\xec</button>
                    <button className="sq-confirm-no" onClick={() => setDeleteId(null)}>No</button>
                </div>
            ) : (
                <div className="sq-action-group">
                    <button className="sq-btn-icon" title="Modifica" onClick={() => onEdit(q)}>{"\u270F\uFE0F"}</button>
                    <button className="sq-btn-icon sq-btn-renew" title="Rinnova" onClick={() => onRenew(q)}>{"\u267B\uFE0F"}</button>
                    <button className="sq-btn-icon sq-btn-history" title="Storico rinnovi" onClick={() => onHistory(q)}>{"\uD83D\uDCC5"}</button>
                    {canApprove && q.approval_status !== "approvata" && (
                        <button className="sq-btn-icon sq-btn-approve" title="Approva" onClick={() => onApprove(q.id)}>{"\u2705"}</button>
                    )}
                    {canApprove && q.approval_status !== "rifiutata" && (
                        <button className="sq-btn-icon sq-btn-reject" title="Rifiuta" onClick={() => onReject(q)}>{"\u274C"}</button>
                    )}
                    {q.status !== "revocata" && (
                        <button className="sq-btn-icon sq-btn-del" title="Revoca" onClick={() => setDeleteId(q.id)}>{"\uD83D\uDEAB"}</button>
                    )}
                </div>
            )}
        </td>
    );

    const personCell = (
        <td className="sq-col-person">
            <div className="sq-person-name">{q.person_name}</div>
            {q.person_code && <div className="sq-person-code">{q.person_code}</div>}
            {q.company_name && <div className="sq-person-company">{q.company_name}</div>}
        </td>
    );

    const certCell = (
        <td className="sq-col-cert">
            {q.certificate_file_url
                ? <a href={q.certificate_file_url} target="_blank" rel="noopener noreferrer" className="sq-cert-link" title="Apri certificato">
                    {"\uD83D\uDCC4"} {q.certificate_number || "Certificato"}
                  </a>
                : (q.certificate_number || "\u2014")}
            {q.issuing_body && <div className="sq-issuer">{q.issuing_body}</div>}
        </td>
    );

    const expiryCell = (
        <td className="sq-col-expiry">
            {q.expiry_date
                ? <span className={`sq-expiry-date sq-expiry-${q.semaforo}`}>{formatDate(q.expiry_date)}</span>
                : <span className="sq-expiry-none">Nessuna</span>}
        </td>
    );

    const apprCell = (
        <td className="sq-col-approval">
            <ApprovalBadge value={q.approval_status || "bozza"} />
        </td>
    );

    if (tabKey === "iso9606_1" || tabKey === "iso9606_2") {
        return (
            <tr className={`sq-row sq-row-${q.semaforo}`}>
                {personCell}
                {certCell}
                <td>{q.welding_process || "\u2014"}</td>
                {tabKey === "iso9606_1" && <td>{q.thickness_range || "\u2014"}</td>}
                {tabKey === "iso9606_2" && <td>{q.material_group || "\u2014"}</td>}
                <td>{q.position_range || "\u2014"}</td>
                {expiryCell}
                {apprCell}
                {actionBtns}
            </tr>
        );
    }

    if (tabKey === "iso14732") {
        return (
            <tr className={`sq-row sq-row-${q.semaforo}`}>
                {personCell}
                {certCell}
                <td>{q.welding_process || "\u2014"}</td>
                <td>{q.equipment_type || "\u2014"}</td>
                {expiryCell}
                {apprCell}
                {actionBtns}
            </tr>
        );
    }

    if (tabKey === "ndt") {
        return (
            <tr className={`sq-row sq-row-${q.semaforo}`}>
                {personCell}
                {certCell}
                <td>{q.ndt_method || "\u2014"}</td>
                <td>{q.ndt_level != null ? `Livello ${q.ndt_level}` : "\u2014"}</td>
                <td>{q.certification_scheme || "\u2014"}</td>
                {expiryCell}
                {apprCell}
                {actionBtns}
            </tr>
        );
    }

    if (tabKey === "iso14731") {
        return (
            <tr className={`sq-row sq-row-${q.semaforo}`}>
                {personCell}
                {certCell}
                <td>{q.coordinator_title || "\u2014"}</td>
                <td>{q.cpd_valid_until ? formatDate(q.cpd_valid_until) : "\u2014"}</td>
                {apprCell}
                {actionBtns}
            </tr>
        );
    }

    if (tabKey === "pes_pav") {
        return (
            <tr className={`sq-row sq-row-${q.semaforo}`}>
                {personCell}
                {certCell}
                <td>{q.patent_type || "\u2014"}</td>
                <td>{q.training_body || "\u2014"}</td>
                {expiryCell}
                {apprCell}
                {actionBtns}
            </tr>
        );
    }

    if (tabKey === "salute_mansione" || tabKey === "generico") {
        return (
            <tr className={`sq-row sq-row-${q.semaforo}`}>
                {personCell}
                {certCell}
                <td>{q.qualification_type || "\u2014"}</td>
                <td>{tabKey === "generico" && q.training_hours != null ? `${q.training_hours}h` : (q.issuing_body || "\u2014")}</td>
                <td>{tabKey === "generico" ? (q.examiner_body || "\u2014") : (q.standard_ref || "\u2014")}</td>
                {expiryCell}
                {apprCell}
                {actionBtns}
            </tr>
        );
    }

    // Default: tutti
    return (
        <tr className={`sq-row sq-row-${q.semaforo}`}>
            <td className="sq-col-semaforo"><SemaforoTag value={q.semaforo} /></td>
            {personCell}
            <td className="sq-col-type">
                <div className="sq-qual-type">{q.qualification_type}</div>
                {q.standard_ref && <div className="sq-qual-std">{q.standard_ref}</div>}
                {q.welding_process && <div className="sq-qual-detail">Proc. {q.welding_process}</div>}
                {q.ndt_method && <div className="sq-qual-detail">{q.ndt_method} Lv.{q.ndt_level || "?"}</div>}
            </td>
            {certCell}
            {expiryCell}
            {apprCell}
            {actionBtns}
        </tr>
    );
}

// ── Componente principale ─────────────────────────────────────────────────────

function QualificationsPage() {
    const { user } = useAuth() || {};
    const canApprove = ["admin", "superadmin", "coordinatore"].includes(user?.role);

    const [activeTab,  setActiveTab]  = useState("tutti");
    const [quals,      setQuals]      = useState([]);
    const [stats,      setStats]      = useState(null);
    const [loading,    setLoading]    = useState(true);
    const [error,      setError]      = useState(null);
    const [total,      setTotal]      = useState(0);
    const [page,       setPage]       = useState(1);
    const [companies,  setCompanies]  = useState([]);
    const LIMIT = 30;

    const [companyScope, setCompanyScope] = useState(() => resolveInitialQualificationsCompanyScope());

    const [filters, setFiltersState] = useState({
        search: "", situazione: "",
    });

    const [formOpen,    setFormOpen]    = useState(false);
    const [editingQual, setEditingQual] = useState(null);
    const [deleteId,    setDeleteId]    = useState(null);
    const [rejectModal, setRejectModal] = useState(null); // { id, person_name }
    const [rejectReason, setRejectReason] = useState("");

    const setFilter = useCallback((key, val) => {
        setFiltersState(f => ({ ...f, [key]: val }));
        setPage(1);
    }, []);

    useEffect(() => {
        apiService.getCompanies?.().then(res => {
            const list = res?.data || res?.companies || res || [];
            setCompanies(Array.isArray(list) ? list : []);
        }).catch(() => {});
    }, []);

    useEffect(() => {
        const access = user?.company_access;
        if (Array.isArray(access) && access.length === 1 && !companyScope) {
            const onlyId = String(access[0].company_id);
            setCompanyScope(onlyId);
            persistQualificationsCompanyScope(onlyId);
        }
    }, [user, companyScope]);

    const scopeCompanyName = useMemo(() => {
        if (!companyScope) return "Tutto lo studio";
        const match = companies.find((c) => String(c.id) === String(companyScope));
        return match?.name || `Azienda #${companyScope}`;
    }, [companyScope, companies]);

    const handleCompanyScopeChange = useCallback((value) => {
        setCompanyScope(value);
        persistQualificationsCompanyScope(value);
        setPage(1);
    }, []);

    const handleStatClick = useCallback((statKey) => {
        const next = STATS_TO_SITUAZIONE[statKey] ?? "";
        setFiltersState((f) => ({ ...f, situazione: toggleSituazione(f.situazione, next) }));
        setPage(1);
    }, []);

    const currentTab = TABS.find(t => t.key === activeTab) || TABS[0];

    const loadData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const params = { page, limit: LIMIT };
            if (currentTab.qualification_type) params.qualification_type = currentTab.qualification_type;
            if (filters.search) params.search = filters.search;
            if (filters.situazione) params.situazione = filters.situazione;
            if (companyScope) params.company_id = companyScope;

            const statsParams = companyScope ? { company_id: companyScope } : {};

            const [res, statsRes] = await Promise.all([
                apiService.getQualifications(params),
                apiService.getQualificationsStats(statsParams),
            ]);
            const list = Array.isArray(res?.qualifications)
                ? res.qualifications
                : (Array.isArray(res?.data) ? res.data : []);
            setQuals(list);
            setTotal(res?.total ?? res?.pagination?.total ?? 0);
            setStats(statsRes);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [page, filters, currentTab, companyScope]);

    useEffect(() => { loadData(); }, [loadData]);

    function handleNew() {
        if (!companyScope) {
            setError("Seleziona l'ambito azienda prima di creare una nuova qualifica.");
            return;
        }
        setEditingQual(null);
        setFormOpen(true);
    }
    function handleEdit(q) { setEditingQual(q);    setFormOpen(true); }
    function handleSaved() { setFormOpen(false); setEditingQual(null); loadData(); }

    async function handleConfirmDelete(id) {
        try {
            await apiService.deleteQualification(id);
            setDeleteId(null);
            loadData();
        } catch (err) { setError(err.message); }
    }

    async function handleApprove(id) {
        try {
            await apiService.approveQualification(id);
            loadData();
        } catch (err) { setError(err.message); }
    }

    function handleRejectOpen(q) {
        setRejectModal({ id: q.id, person_name: q.person_name });
        setRejectReason("");
    }

    async function handleRejectConfirm() {
        if (!rejectReason.trim()) return;
        try {
            await apiService.rejectQualification(rejectModal.id, rejectReason);
            setRejectModal(null);
            loadData();
        } catch (err) { setError(err.message); }
    }

    function handleRenew(q) {
        setEditingQual({ ...q, _renew: true });
        setFormOpen(true);
    }

    const [historyModal, setHistoryModal] = useState(null);
    const [historyLoading, setHistoryLoading] = useState(false);

    async function handleOpenHistory(q) {
        setHistoryModal({ id: q.id, person_name: q.person_name, history: [] });
        setHistoryLoading(true);
        try {
            const res = await apiService.getQualificationHistory(q.id);
            setHistoryModal({ id: q.id, person_name: q.person_name, history: res?.history || [] });
        } catch (err) {
            setHistoryModal({ id: q.id, person_name: q.person_name, history: [], error: err.message });
        } finally {
            setHistoryLoading(false);
        }
    }

    const columns = TAB_COLUMNS[activeTab] || TAB_COLUMNS.tutti;
    const totalPages = Math.max(1, Math.ceil(total / LIMIT));

    return (
        <div className="sq-page">
            {/* Header */}
            <div className="sq-header">
                <div>
                    <h2 className="sq-title">{"\uD83C\uDF93"} Qualifiche Personale</h2>
                    <p className="sq-subtitle">Registro qualifiche con controllo automatico scadenze</p>
                </div>
                <div className="sq-header-actions">
                    {companies.length > 0 && (
                        <label className="sq-scope-label">
                            {"Ambito:"}
                            <select
                                className="sq-select sq-scope-select"
                                value={companyScope}
                                onChange={(e) => handleCompanyScopeChange(e.target.value)}
                                aria-label="Ambito qualifiche per azienda"
                            >
                                <option value="">{"Tutto lo studio"}</option>
                                {companies.map((c) => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                        </label>
                    )}
                    {companyScope ? (
                        <QualificationUploadButton
                            companyId={companyScope}
                            companyName={scopeCompanyName}
                            onUploadComplete={loadData}
                        />
                    ) : companies.length > 0 && (
                        <span className="sq-upload-no-scope">
                            Seleziona un&apos;azienda specifica per caricare i patentini
                        </span>
                    )}
                    <button
                        className="sq-btn-new"
                        onClick={handleNew}
                        disabled={!companyScope}
                        title={!companyScope ? "Seleziona un'azienda nell'ambito" : ""}
                    >
                        + Nuova qualifica
                    </button>
                </div>
            </div>
            {companyScope && (
                <p className="sq-scope-hint">{"Ambito attivo: "}{scopeCompanyName}</p>
            )}

            {/* Stats */}
            <StatsBar
                stats={stats}
                activeSituazione={filters.situazione}
                onStatClick={handleStatClick}
            />

            {/* Tab di tipo */}
            <div className="sq-tabs">
                {TABS.map(t => (
                    <button
                        key={t.key}
                        className={`sq-tab${activeTab === t.key ? " sq-tab-active" : ""}`}
                        onClick={() => { setActiveTab(t.key); setPage(1); }}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            {/* Filtri */}
            <div className="sq-toolbar">
                <input
                    className="sq-search"
                    type="text"
                    placeholder="Cerca persona, qualifica, certificato..."
                    value={filters.search}
                    onChange={e => setFilter("search", e.target.value)}
                />
                <select
                    className="sq-select sq-situazione-select"
                    value={filters.situazione}
                    onChange={e => setFilter("situazione", e.target.value)}
                    aria-label="Filtra per situazione"
                >
                    <option value="">Tutte le situazioni</option>
                    {QUALIFICATION_SITUAZIONI.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                </select>
                {(filters.search || filters.situazione) && (
                    <button
                        className="sq-btn-secondary"
                        onClick={() => { setFiltersState({ search: "", situazione: "" }); setPage(1); }}
                        title="Azzera filtri"
                    >
                        Azzera filtri
                    </button>
                )}
                <button className="sq-btn-reload" onClick={loadData} title="Aggiorna">{"\u21BB"}</button>
            </div>

            {filters.situazione && (
                <p className="sq-filter-hint">
                    {"Filtro attivo: "}
                    <strong>{situazioneLabel(filters.situazione)}</strong>
                    {" \u2014 clicca di nuovo la statistica o usa Azzera filtri."}
                </p>
            )}

            {error && (
                <div className="sq-error">
                    {"\u26A0\uFE0F"} {error}
                    <button onClick={() => setError(null)}>{"\u2715"}</button>
                </div>
            )}

            {/* Tabella */}
            <div className="sq-table-wrap">
                {loading ? (
                    <div className="sq-loading"><div className="sq-spinner" /><span>Caricamento...</span></div>
                ) : quals.length === 0 ? (
                    <div className="sq-empty">
                        <span className="sq-empty-icon">{"\uD83C\uDF93"}</span>
                        <p>Nessuna qualifica trovata.</p>
                        <button className="sq-btn-new-sm" onClick={handleNew}>Aggiungi la prima qualifica</button>
                    </div>
                ) : (
                    <table className="sq-table">
                        <thead>
                            <tr>{columns.map(col => <th key={col}>{col}</th>)}</tr>
                        </thead>
                        <tbody>
                            {quals.map(q => (
                                <QualRow
                                    key={q.id}
                                    q={q}
                                    tabKey={activeTab}
                                    onEdit={handleEdit}
                                    onDelete={handleConfirmDelete}
                                    onApprove={handleApprove}
                                    onReject={handleRejectOpen}
                                    onRenew={handleRenew}
                                    onHistory={handleOpenHistory}
                                    deleteId={deleteId}
                                    setDeleteId={setDeleteId}
                                    canApprove={canApprove}
                                />
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Paginazione */}
            {totalPages > 1 && (
                <div className="sq-pagination">
                    <button disabled={page === 1} onClick={() => setPage(p => p - 1)}>{"\u00AB"} Prec</button>
                    <span>Pag. {page} / {totalPages} &mdash; {total} qualifiche</span>
                    <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>Succ {"\u00BB"}</button>
                </div>
            )}

            {/* Form modale */}
            {formOpen && (
                <QualificationForm
                    qualification={editingQual}
                    defaultCompanyId={!editingQual && companyScope ? companyScope : undefined}
                    onSave={handleSaved}
                    onClose={() => { setFormOpen(false); setEditingQual(null); }}
                />
            )}

            {/* Modal storico rinnovi */}
            {historyModal && (
                <div className="sq-modal-overlay">
                    <div className="sq-modal">
                        <h3>Storico rinnovi — {historyModal.person_name}</h3>
                        {historyLoading ? (
                            <div className="sq-loading"><div className="sq-spinner" /><span>Caricamento...</span></div>
                        ) : historyModal.error ? (
                            <p style={{color:"#b91c1c"}}>{"\u26A0\uFE0F"} {historyModal.error}</p>
                        ) : historyModal.history.length === 0 ? (
                            <p>Nessun rinnovo precedente trovato.</p>
                        ) : (
                            <table style={{width:"100%", borderCollapse:"collapse", fontSize:13, marginTop:8}}>
                                <thead>
                                    <tr style={{borderBottom:"2px solid #e5e7eb"}}>
                                        <th style={{textAlign:"left", padding:"4px 8px"}}>ID</th>
                                        <th style={{textAlign:"left", padding:"4px 8px"}}>Emissione</th>
                                        <th style={{textAlign:"left", padding:"4px 8px"}}>Scadenza</th>
                                        <th style={{textAlign:"left", padding:"4px 8px"}}>Certificato</th>
                                        <th style={{textAlign:"left", padding:"4px 8px"}}>Stato</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {historyModal.history.map((h, i) => (
                                        <tr key={h.id} style={{background: i === 0 ? "#f0fdf4" : "transparent", borderBottom:"1px solid #f3f4f6"}}>
                                            <td style={{padding:"4px 8px"}}>#{h.id}{i === 0 ? " (attuale)" : ""}</td>
                                            <td style={{padding:"4px 8px"}}>{h.issue_date ? formatDate(h.issue_date) : "\u2014"}</td>
                                            <td style={{padding:"4px 8px"}}>{h.expiry_date ? formatDate(h.expiry_date) : "\u2014"}</td>
                                            <td style={{padding:"4px 8px"}}>{h.certificate_number || "\u2014"}</td>
                                            <td style={{padding:"4px 8px"}}><ApprovalBadge value={h.approval_status || "bozza"} /></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                        <div className="sq-modal-actions">
                            <button className="sq-btn-secondary" onClick={() => setHistoryModal(null)}>Chiudi</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal rifiuto */}
            {rejectModal && (
                <div className="sq-modal-overlay">
                    <div className="sq-modal">
                        <h3>Rifiuta qualifica</h3>
                        <p>Qualifica di <strong>{rejectModal.person_name}</strong></p>
                        <textarea
                            className="sq-reject-reason"
                            placeholder="Motivo del rifiuto (obbligatorio)..."
                            value={rejectReason}
                            onChange={e => setRejectReason(e.target.value)}
                            rows={3}
                        />
                        <div className="sq-modal-actions">
                            <button className="sq-btn-danger" onClick={handleRejectConfirm} disabled={!rejectReason.trim()}>
                                Conferma rifiuto
                            </button>
                            <button className="sq-btn-secondary" onClick={() => setRejectModal(null)}>Annulla</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default QualificationsPage;
