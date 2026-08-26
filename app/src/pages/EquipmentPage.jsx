/**
 * EquipmentPage — Gestione Strumenti e Attrezzature CND/SGQ
 * Modulo trasversale: strumenti dello studio e delle aziende clienti.
 * Pattern: WeldingProceduresPage + NCPage.
 */

import React, { useState, useEffect, useCallback } from "react";
import apiService from "../services/apiService";
import { useCompanyScope } from "../contexts/CompanyScopeContext";
import { formatDate } from "../utils/dateHelpers";
import {
    NDT_INSTRUMENT_ROLE_OPTIONS,
    isKnownInstrumentRole,
    labelForInstrumentRole,
} from "../utils/ndtInstrumentRoles";
import "./EquipmentPage.css";

const ASSET_CATEGORIES = [
    { value: "measuring_instrument", label: "Strumento di misura" },
    { value: "welding_machine",      label: "Macchina saldatura" },
    { value: "safety_equipment",     label: "Attrezzatura sicurezza" },
    { value: "tool",                 label: "Attrezzo" },
    { value: "vehicle",              label: "Veicolo" },
    { value: "other",                label: "Altro" },
];

const ASSET_STATUSES = [
    { value: "active",      label: "Attivo" },
    { value: "calibrating", label: "In taratura" },
    { value: "retired",     label: "Dismesso" },
    { value: "lost",        label: "Perso" },
];

const NDT_METHODS = ["VT", "MT", "PT", "UT", "RT", "ET"];

// ── Badge semaforo taratura ───────────────────────────────────────────────────
function CalibrationBadge({ daysToExpiry, requiresCalibration, status }) {
    if (!requiresCalibration || status === "retired") return null;
    if (daysToExpiry === null || daysToExpiry === undefined) return <span className="eq-cal-badge eq-cal-unknown">? taratura</span>;
    if (daysToExpiry < 0)   return <span className="eq-cal-badge eq-cal-expired">Scaduta</span>;
    if (daysToExpiry <= 30) return <span className="eq-cal-badge eq-cal-warning">Scade {daysToExpiry}gg</span>;
    return <span className="eq-cal-badge eq-cal-ok">OK</span>;
}

function StatusBadge({ status }) {
    const map = {
        active:      { cls: "eq-status-active",      label: "Attivo" },
        calibrating: { cls: "eq-status-calibrating", label: "In taratura" },
        retired:     { cls: "eq-status-retired",      label: "Dismesso" },
        lost:        { cls: "eq-status-lost",          label: "Perso" },
    };
    const { cls, label } = map[status] || map.active;
    return <span className={`eq-status ${cls}`}>{label}</span>;
}

// ── Form modale crea/modifica strumento ───────────────────────────────────────
function EquipmentFormModal({ asset, companies = [], onSave, onClose }) {
    const isEdit = !!asset;
    const [form, setForm] = useState({
        company_id:                  asset?.company_id || "",
        asset_category:              asset?.asset_category || "measuring_instrument",
        asset_subcategory:           asset?.asset_subcategory || "",
        name:                        asset?.name || "",
        manufacturer:                asset?.manufacturer || "",
        model:                       asset?.model || "",
        serial_number:               asset?.serial_number || "",
        internal_code:               asset?.internal_code || "",
        location:                    asset?.location || "",
        status:                      asset?.status || "active",
        requires_calibration:        asset?.requires_calibration !== false,
        calibration_frequency_months: asset?.calibration_frequency_months || "",
        last_calibration_date:       asset?.last_calibration_date ? asset.last_calibration_date.substring(0, 10) : "",
        next_calibration_date:       asset?.next_calibration_date ? asset.next_calibration_date.substring(0, 10) : "",
        purchase_date:               asset?.purchase_date ? asset.purchase_date.substring(0, 10) : "",
        applicable_methods:          asset?.applicable_methods ? (typeof asset.applicable_methods === "string" ? JSON.parse(asset.applicable_methods) : asset.applicable_methods) : [],
        applicable_systems:          asset?.applicable_systems ? (typeof asset.applicable_systems === "string" ? JSON.parse(asset.applicable_systems) : asset.applicable_systems) : ["CND"],
        notes:                       asset?.notes || "",
    });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);

    // Auto-calcola next_calibration_date quando cambiano data o frequenza
    const computeNextDate = (lastDate, freqMonths) => {
        if (!lastDate || !freqMonths) return "";
        const d = new Date(lastDate);
        if (isNaN(d.getTime())) return "";
        d.setMonth(d.getMonth() + parseInt(freqMonths));
        return d.toISOString().substring(0, 10);
    };

    const set = (k, v) => setForm(f => {
        const updated = { ...f, [k]: v };
        // Ricalcola automaticamente la prossima taratura
        if (k === "last_calibration_date" || k === "calibration_frequency_months") {
            const dateVal  = k === "last_calibration_date"       ? v : f.last_calibration_date;
            const freqVal  = k === "calibration_frequency_months" ? v : f.calibration_frequency_months;
            const computed = computeNextDate(dateVal, freqVal);
            if (computed) updated.next_calibration_date = computed;
        }
        return updated;
    });

    const toggleMethod = (m) => {
        setForm(f => ({
            ...f,
            applicable_methods: f.applicable_methods.includes(m)
                ? f.applicable_methods.filter(x => x !== m)
                : [...f.applicable_methods, m],
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.name.trim()) { setError("Il nome \u00e8 obbligatorio"); return; }
        setSaving(true);
        setError(null);
        try {
            const payload = {
                ...form,
                company_id: form.company_id ? parseInt(form.company_id) : null,
                calibration_frequency_months: form.calibration_frequency_months ? parseInt(form.calibration_frequency_months) : null,
                last_calibration_date: form.last_calibration_date || null,
                next_calibration_date: form.next_calibration_date || null,
                purchase_date: form.purchase_date || null,
            };
            if (isEdit) {
                await apiService.updateEquipment(asset.id, payload);
            } else {
                await apiService.createEquipment(payload);
            }
            onSave();
        } catch (err) {
            setError(err?.message || "Errore salvataggio");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="eq-modal-overlay" onClick={onClose}>
            <div className="eq-modal" onClick={e => e.stopPropagation()}>
                <div className="eq-modal-header">
                    <h2>{isEdit ? "Modifica strumento" : "Nuovo strumento"}</h2>
                    <button type="button" className="eq-modal-close" onClick={onClose}>&times;</button>
                </div>
                <form onSubmit={handleSubmit} className="eq-modal-body">

                    {/* Sezione 1 - Dati identificativi */}
                    <fieldset className="eq-fieldset">
                        <legend>Dati identificativi</legend>
                        <div className="eq-form-row">
                            <div className="eq-form-group eq-grow">
                                <label>Nome / Descrizione *</label>
                                <input type="text" value={form.name} onChange={e => set("name", e.target.value)} placeholder="es. Calibro VT" required />
                            </div>
                            <div className="eq-form-group">
                                <label>Categoria</label>
                                <select value={form.asset_category} onChange={e => set("asset_category", e.target.value)}>
                                    {ASSET_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                                </select>
                            </div>
                        </div>
                        <div className="eq-form-row">
                            <div className="eq-form-group">
                                <label>Ruolo strumento</label>
                                <select
                                    value={form.asset_subcategory || ""}
                                    onChange={e => set("asset_subcategory", e.target.value)}
                                    aria-label="Ruolo strumento"
                                >
                                    <option value="">— Seleziona —</option>
                                    {NDT_INSTRUMENT_ROLE_OPTIONS.map(r => (
                                        <option key={r.value} value={r.value}>{r.label}</option>
                                    ))}
                                    {/* Valori legacy free-text non in elenco: non perdere il dato in edit */}
                                    {form.asset_subcategory
                                        && !isKnownInstrumentRole(form.asset_subcategory)
                                        && (
                                            <option value={form.asset_subcategory}>
                                                {form.asset_subcategory} (personalizzato)
                                            </option>
                                        )}
                                </select>
                            </div>
                            <div className="eq-form-group">
                                <label>Produttore</label>
                                <input type="text" value={form.manufacturer} onChange={e => set("manufacturer", e.target.value)} placeholder="es. TWI LIMITED" />
                            </div>
                            <div className="eq-form-group">
                                <label>Modello</label>
                                <input type="text" value={form.model} onChange={e => set("model", e.target.value)} />
                            </div>
                        </div>
                        <div className="eq-form-row">
                            <div className="eq-form-group">
                                <label>Matricola / S/N</label>
                                <input type="text" value={form.serial_number} onChange={e => set("serial_number", e.target.value)} />
                            </div>
                            <div className="eq-form-group">
                                <label>Codice interno</label>
                                <input type="text" value={form.internal_code} onChange={e => set("internal_code", e.target.value)} />
                            </div>
                            <div className="eq-form-group">
                                <label>Ubicazione</label>
                                <input type="text" value={form.location} onChange={e => set("location", e.target.value)} placeholder="es. Laboratorio A" />
                            </div>
                        </div>
                        <div className="eq-form-row">
                            <div className="eq-form-group">
                                <label>{"Propriet\u00e0"}</label>
                                <select value={form.company_id} onChange={e => set("company_id", e.target.value)}>
                                    <option value="">Studio (condiviso con tutte le aziende)</option>
                                    {(companies || []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>
                            <div className="eq-form-group">
                                <label>Stato</label>
                                <select value={form.status} onChange={e => set("status", e.target.value)}>
                                    {ASSET_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                                </select>
                            </div>
                        </div>
                    </fieldset>

                    {/* Sezione 2 - Applicabilit\u00e0 */}
                    <fieldset className="eq-fieldset">
                        <legend>{"Applicabilit\u00e0 CND"}</legend>
                        <div className="eq-methods-group">
                            <label>Metodi CND applicabili</label>
                            <div className="eq-methods-checkboxes">
                                {NDT_METHODS.map(m => (
                                    <label key={m} className="eq-method-check">
                                        <input type="checkbox" checked={form.applicable_methods.includes(m)} onChange={() => toggleMethod(m)} />
                                        {m}
                                    </label>
                                ))}
                            </div>
                        </div>
                    </fieldset>

                    {/* Sezione 3 - Taratura */}
                    <fieldset className="eq-fieldset">
                        <legend>Taratura</legend>
                        <div className="eq-form-row">
                            <div className="eq-form-group">
                                <label className="eq-checkbox-label">
                                    <input type="checkbox" checked={form.requires_calibration} onChange={e => set("requires_calibration", e.target.checked)} />
                                    Richiede taratura periodica
                                </label>
                            </div>
                            {form.requires_calibration && (
                                <div className="eq-form-group">
                                    <label>Frequenza (mesi)</label>
                                    <input type="number" min="1" max="120" value={form.calibration_frequency_months} onChange={e => set("calibration_frequency_months", e.target.value)} placeholder="es. 12" />
                                </div>
                            )}
                        </div>
                        {form.requires_calibration && (
                            <div className="eq-form-row">
                                <div className="eq-form-group">
                                    <label>Ultima taratura</label>
                                    <input type="date" value={form.last_calibration_date} onChange={e => set("last_calibration_date", e.target.value)} />
                                </div>
                                <div className="eq-form-group">
                                    <label>
                                        Prossima taratura
                                        {form.calibration_frequency_months && form.last_calibration_date && (
                                            <span className="eq-computed-label"> (calcolata)</span>
                                        )}
                                    </label>
                                    <input type="date" value={form.next_calibration_date} onChange={e => set("next_calibration_date", e.target.value)} />
                                </div>
                            </div>
                        )}
                    </fieldset>

                    {/* Note */}
                    <fieldset className="eq-fieldset">
                        <legend>Note</legend>
                        <textarea className="notes-textarea" value={form.notes} onChange={e => set("notes", e.target.value)} rows={3} placeholder="Note aggiuntive..." />
                    </fieldset>

                    {error && <div className="eq-form-error">{error}</div>}

                    <div className="eq-modal-actions">
                        <button type="button" className="btn" onClick={onClose} disabled={saving}>Annulla</button>
                        <button type="submit" className="btn btn-primary" disabled={saving}>
                            {saving ? "Salvataggio..." : isEdit ? "Salva modifiche" : "Crea strumento"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// ── Componente principale ─────────────────────────────────────────────────────
export default function EquipmentPage() {
    const { companyId: filterCompany, companies } = useCompanyScope();
    const [assets, setAssets] = useState([]);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const [filterCategory, setFilterCategory] = useState("");
    const [filterStatus, setFilterStatus] = useState("");
    const [filterExpiring, setFilterExpiring] = useState(false);
    const [searchText, setSearchText] = useState("");

    const [showModal, setShowModal] = useState(false);
    const [editingAsset, setEditingAsset] = useState(null);

    const loadData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const params = {};
            if (filterCategory) params.asset_category = filterCategory;
            if (filterStatus)   params.status = filterStatus;
            if (filterCompany)  params.company_id = filterCompany;
            if (filterExpiring) params.expiring_days = 30;
            if (searchText)     params.search = searchText;

            const [listResp, statsResp] = await Promise.all([
                apiService.getEquipmentList(params),
                apiService.getEquipmentStats(filterCompany ? { company_id: filterCompany } : {}),
            ]);

            setAssets(listResp.data || []);
            setStats(statsResp.data || null);
        } catch (err) {
            setError("Errore caricamento strumenti");
        } finally {
            setLoading(false);
        }
    }, [filterCategory, filterStatus, filterCompany, filterExpiring, searchText]);

    useEffect(() => { loadData(); }, [loadData]);

    const handleNew = () => { setEditingAsset(null); setShowModal(true); };
    const handleEdit = (asset) => { setEditingAsset(asset); setShowModal(true); };
    const handleSaved = () => { setShowModal(false); setEditingAsset(null); loadData(); };

    const handleDelete = async (asset) => {
        if (!window.confirm(`Eliminare "${asset.name}"?`)) return;
        try {
            await apiService.deleteEquipment(asset.id);
            loadData();
        } catch {
            alert("Errore eliminazione strumento");
        }
    };

    return (
        <div className="eq-page">
            <div className="eq-header">
                <div>
                    <h1 className="eq-title">Strumenti e Attrezzature</h1>
                    <p className="eq-subtitle">Anagrafica e scadenziario tarature CND/SGQ</p>
                </div>
                <button className="btn btn-primary" onClick={handleNew}>+ Nuovo strumento</button>
            </div>

            {/* Stats bar */}
            {stats && (
                <div className="eq-stats-bar">
                    <div className="eq-stat"><span className="eq-stat-n">{stats.total}</span><span>Totali</span></div>
                    <div className="eq-stat eq-stat-active"><span className="eq-stat-n">{stats.active}</span><span>Attivi</span></div>
                    <div className="eq-stat eq-stat-warn"><span className="eq-stat-n">{stats.expiring_30d}</span><span>In scadenza</span></div>
                    <div className="eq-stat eq-stat-danger"><span className="eq-stat-n">{stats.expired}</span><span>Scaduti</span></div>
                    <div className="eq-stat"><span className="eq-stat-n">{stats.calibrating}</span><span>In taratura</span></div>
                </div>
            )}

            {/* Filtri */}
            <div className="eq-filters">
                <input className="eq-search" type="text" placeholder="Cerca nome, modello, matricola..." value={searchText} onChange={e => setSearchText(e.target.value)} />
                <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
                    <option value="">Tutte le categorie</option>
                    {ASSET_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
                <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                    <option value="">Tutti gli stati</option>
                    {ASSET_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
                <label className="eq-filter-check">
                    <input type="checkbox" checked={filterExpiring} onChange={e => setFilterExpiring(e.target.checked)} />
                    In scadenza (30 gg)
                </label>
            </div>

            {/* Tabella */}
            {loading && <div className="eq-loading">Caricamento...</div>}
            {error && <div className="eq-error">{error}</div>}
            {!loading && !error && (
                <div className="eq-table-wrap">
                    <table className="eq-table">
                        <thead>
                            <tr>
                                <th>Nome / Modello</th>
                                <th>Tipo</th>
                                <th>Matricola</th>
                                <th>{"Propriet\u00e0"}</th>
                                <th>Metodi CND</th>
                                <th>Prossima taratura</th>
                                <th>Stato</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {assets.length === 0 && (
                                <tr><td colSpan={8} className="eq-empty">Nessuno strumento trovato</td></tr>
                            )}
                            {assets.map(a => {
                                const methods = a.applicable_methods
                                    ? (typeof a.applicable_methods === "string" ? JSON.parse(a.applicable_methods) : a.applicable_methods)
                                    : [];
                                return (
                                    <tr key={a.id} className="eq-row" onClick={() => handleEdit(a)}>
                                        <td>
                                            <div className="eq-name">{a.name}</div>
                                            {a.asset_subcategory && (
                                                <div className="eq-role-tag">{labelForInstrumentRole(a.asset_subcategory)}</div>
                                            )}
                                            {a.model && <div className="eq-model">{a.manufacturer} {a.model}</div>}
                                        </td>
                                        <td>{ASSET_CATEGORIES.find(c => c.value === a.asset_category)?.label || a.asset_category}</td>
                                        <td className="eq-mono">{a.serial_number || "—"}</td>
                                        <td>{a.company_name || <em>Studio</em>}</td>
                                        <td>
                                            <div className="eq-methods">
                                                {methods.map(m => <span key={m} className="eq-method-tag">{m}</span>)}
                                            </div>
                                        </td>
                                        <td>
                                            <div>{a.next_calibration_date ? formatDate(a.next_calibration_date) : "—"}</div>
                                            <CalibrationBadge daysToExpiry={a.days_to_expiry} requiresCalibration={a.requires_calibration} status={a.status} />
                                        </td>
                                        <td><StatusBadge status={a.status} /></td>
                                        <td onClick={e => e.stopPropagation()}>
                                            <button className="eq-btn-icon" title="Modifica" onClick={() => handleEdit(a)}>&#x270E;</button>
                                            <button className="eq-btn-icon eq-btn-danger" title="Elimina" onClick={() => handleDelete(a)}>&#x2715;</button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {showModal && (
                <EquipmentFormModal
                    asset={editingAsset}
                    companies={companies}
                    onSave={handleSaved}
                    onClose={() => { setShowModal(false); setEditingAsset(null); }}
                />
            )}
        </div>
    );
}
