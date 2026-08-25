/**
 * NdtReportsPage — Verbali CND (VT/MT/PT/UT)
 * Lista + form inline a sezioni collassabili.
 * Pattern: NCPage (lista) + ManagementReviewsPage (form sezioni).
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import apiService from "../services/apiService";
import { useCompanyScope } from "../contexts/CompanyScopeContext";
import { exportVtToWord } from "../utils/vtWordExport.js";
import { formatDate } from "../utils/dateHelpers";
import AutoTextarea from "../components/AutoTextarea.jsx";
import NcCreateModal from "../components/NcCreateModal.jsx";
import NdtItemAttachments from "../components/NdtItemAttachments.jsx";
import { useNdtAutoSave } from "../hooks/useNdtAutoSave.js";
import "./NdtReportsPage.css";
import "../components/ChecklistModule.css";

const REPORT_TYPES = [
    { value: "VT", label: "VT \u2014 Esame Visivo" },
    { value: "MT", label: "MT \u2014 Particelle Magnetiche" },
    { value: "PT", label: "PT \u2014 Liquidi Penetranti" },
    { value: "UT", label: "UT \u2014 Ultrasuoni" },
    { value: "RT", label: "RT \u2014 Radiografico" },
];

const REPORT_STATUSES = [
    { value: "draft",     label: "Bozza",     cls: "ndt-status-draft" },
    { value: "completed", label: "Completato", cls: "ndt-status-completed" },
    { value: "approved",  label: "Approvato",  cls: "ndt-status-approved" },
];

const SURFACE_CONDITIONS = [
    { value: "S",   label: "S \u2014 come saldato" },
    { value: "U",   label: "U \u2014 lavorato macchina" },
    { value: "G",   label: "G \u2014 superficie grezza" },
    { value: "M",   label: "M \u2014 molato" },
    { value: "M/S", label: "M/S" },
    { value: "L",   label: "L \u2014 laminato" },
];

const DEFECT_CODES = ["NESSUNO", "1 cricche", "2 ripiegature", "3 sfogliature", "4 ricalcature", "5 porosit\u00e0", "6 soffiature", "7 incisioni", "9 sfondamento", "10 altro"];

const EVALUATION_OPTIONS = [
    { value: "A", label: "A \u2014 Accettabile",  cls: "compliant" },
    { value: "R", label: "R \u2014 Da riparare",  cls: "partial" },
    { value: "S", label: "S \u2014 Scarto",       cls: "non-compliant" },
];

// Nota certificazione fissa
const CERTIFICATION_TEXT = "Si certifica che la prova \u00e8 stata eseguita secondo le norme di riferimento indicate e che i risultati sono quelli trascritti.";

const INSTRUMENT_ROLE_OPTIONS = [
    { value: "gauge",    label: "Calibro" },
    { value: "luxmeter", label: "Luxmetro" },
    { value: "lamp",     label: "Lampada" },
    { value: "other",    label: "Altro" },
];

/**
 * Ruolo Word/verbale (celle Calibro / Luxmetro / Lampada) dal nome o sottocategoria.
 * Esportata per i test L1: un Calibro non deve partire come "Altro".
 */
export function inferInstrumentRole(inst) {
    const blob = `${inst?.asset_subcategory || ""} ${inst?.name || ""}`.toLowerCase();
    if (/calibro|gauge/.test(blob)) return "gauge";
    if (/luxmetr|\blux\b|illumin/.test(blob)) return "luxmeter";
    if (/lampad|\blamp\b|\buv\b/.test(blob)) return "lamp";
    return "other";
}

export function resolveInstrumentRole(storedRole, inst) {
    if (storedRole && storedRole !== "other") return storedRole;
    return inferInstrumentRole(inst);
}

// ── Riga Elenco Marche ────────────────────────────────────────────────────────
const DEFECT_CODES_SELECT = [
    { value: "NESSUNO",     label: "NESSUNO" },
    { value: "1 cricche",   label: "1 \u2014 Cricche affioranti" },
    { value: "2 ripiegature", label: "2 \u2014 Ripiegature" },
    { value: "3 sfogliature", label: "3 \u2014 Sfogliature" },
    { value: "4 ricalcature", label: "4 \u2014 Ricalcature/sigillature" },
    { value: "5 porosit\u00e0", label: "5 \u2014 Porosit\u00e0/risucchi" },
    { value: "6 soffiature", label: "6 \u2014 Soffiature (gas)" },
    { value: "7 incisioni",  label: "7 \u2014 Incisioni marginali" },
    { value: "9 sfondamento", label: "9 \u2014 Sfondamento" },
    { value: "10 altro",     label: "10 \u2014 Altro" },
];

function MarkRow({ item, index, onChange, onRemove, reportId, onRegisterNc, judgmentLocked, judgmentTitle }) {
    const set = (k, v) => onChange(index, { ...item, [k]: v });
    const hasDefect = item.evaluation === "R" || item.evaluation === "S";
    const attRef = useRef(null);
    const [photoState, setPhotoState] = useState({ count: 0, uploading: false, error: null });
    const showPhotoPanel = photoState.count > 0 || photoState.uploading || !!photoState.error;

    const handlePhotoClick = () => {
        if (!item.id) {
            alert("Salva il verbale con 'Salva bozza' per abilitare le foto su questa riga.");
            return;
        }
        attRef.current?.openFilePicker();
    };

    return (
        <tbody className={`ndt-mark-card${hasDefect ? " ndt-mark-card--defect" : ""}`}>
        <tr className={`ndt-mark-row${hasDefect ? " ndt-mark-defect" : ""}`}>
            <td data-label="Marca" className="ndt-mark-index">{index + 1}</td>
            <td data-label="Pos. / Codice"><input type="text" value={item.position_code || ""} onChange={e => set("position_code", e.target.value)} placeholder="es. P01" className="ndt-mark-input ndt-input-sm" /></td>
            <td data-label={"Q.t\u00e0"}><input type="text" value={item.quantity || ""} onChange={e => set("quantity", e.target.value)} placeholder="1" className="ndt-mark-input ndt-input-xs" /></td>
            <td data-label="Descrizione"><input type="text" value={item.description || ""} onChange={e => set("description", e.target.value)} placeholder="Descrizione componente" className="ndt-mark-input ndt-input-lg" /></td>
            <td data-label="Parte esaminata"><input type="text" value={item.examined_part || "SALDATURA"} onChange={e => set("examined_part", e.target.value)} className="ndt-mark-input ndt-input-sm" /></td>
            <td data-label="Superficie">
                <select value={item.surface_condition || "M/S"} onChange={e => set("surface_condition", e.target.value)} className="ndt-mark-select">
                    {SURFACE_CONDITIONS.map(s => <option key={s.value} value={s.value}>{s.value}</option>)}
                </select>
            </td>
            <td data-label="% Ctrl"><input type="number" min="0" max="100" value={item.inspection_percentage ?? 100} onChange={e => set("inspection_percentage", e.target.value)} className="ndt-mark-input ndt-input-xs" /></td>
            <td data-label="Difetti">
                <select value={item.defects || "NESSUNO"} onChange={e => set("defects", e.target.value)} className="ndt-mark-select ndt-defect-select">
                    {DEFECT_CODES_SELECT.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                </select>
            </td>
            <td data-label="Giudizio">
                <div className="ndt-eval-btns" role="group" aria-label={"Giudizio A R S marca " + (index + 1)}>
                    {EVALUATION_OPTIONS.map(ev => (
                        <button key={ev.value} type="button"
                            className={`status-btn ${ev.cls}${item.evaluation === ev.value ? " active" : ""}`}
                            aria-pressed={item.evaluation === ev.value}
                            aria-label={ev.label}
                            disabled={judgmentLocked}
                            title={judgmentLocked ? (judgmentTitle || "Serve patentino ISO 9712 valido e idoneit\u00e0 visiva") : ev.label}
                            onClick={() => set("evaluation", ev.value)}>
                            {ev.value}
                        </button>
                    ))}
                </div>
            </td>
            <td className="ndt-actions-cell" data-label="Foto">
                <button
                    type="button"
                    className={`ndt-photo-row-btn${!item.id ? " ndt-photo-row-btn-disabled" : ""}${photoState.count > 0 ? " ndt-photo-row-btn-has-photos" : ""}`}
                    onClick={handlePhotoClick}
                    disabled={photoState.uploading}
                    title={item.id
                        ? (photoState.count > 0
                            ? `Aggiungi o scatta foto (${photoState.count} già caricate)`
                            : "Scatta o aggiungi foto")
                        : "Salva prima il verbale per aggiungere foto"}
                >
                    {"\uD83D\uDCF7"}
                    {photoState.count > 0 && (
                        <span className="ndt-photo-count">{photoState.count}</span>
                    )}
                </button>
                <button type="button" className="ndt-row-remove" onClick={() => onRemove(index)} title="Rimuovi riga">&times;</button>
            </td>
        </tr>
        {/* Galleria foto — visibile solo se ci sono foto, caricamento o errore */}
        {item.id && (
            <tr className={`ndt-mark-photos-row${showPhotoPanel ? "" : " ndt-mark-photos-row-collapsed"}`}>
                <td className="ndt-mark-skip-cell"></td>
                <td colSpan={9}>
                    <NdtItemAttachments
                        ref={attRef}
                        itemId={item.id}
                        reportId={reportId}
                        onStateChange={setPhotoState}
                    />
                </td>
            </tr>
        )}

        {/* Riga note difetto — visibile solo se R o S */}
        {hasDefect && (
            <tr className="ndt-mark-notes-row">
                <td className="ndt-mark-skip-cell"></td>
                <td colSpan={9}>
                    <div className="ndt-defect-notes-wrap">
                                        <span className="ndt-defect-notes-label">
                                            {item.evaluation === "R" ? "\u26A0\uFE0F Riparazione richiesta" : "\u274C Scarto"}
                                            {" \u2014 Descrizione difetto / localizzazione:"}
                                        </span>
                                        <AutoTextarea
                                            className="ndt-input-defect-note notes-textarea"
                                            value={item.notes || ""}
                                            onChange={v => set("notes", v)}
                                            rows={1}
                                            placeholder={"es. cricca all'attacco del cordone, lato A, 15mm dal bordo..."}
                                            draftScopeId={`ndt-item-${index}`}
                                            draftFieldId="defect-notes"
                                        />
                                        <button
                                            type="button"
                                            className="ndt-defect-nc-link"
                                            onClick={() => onRegisterNc(item, index)}
                                            title="Registra questa marca come Non Conformit\u00e0 nel Piano Azioni"
                                        >
                                            {"\u2192 Registra NC"}
                                        </button>
                                    </div>
                </td>
            </tr>
        )}
        </tbody>
    );
}

// ── Form verbale ─────────────────────────────────────────────────────────────
function NdtReportForm({ report, companies, availableInstruments, onSave, onCancel }) {
    const isEdit = !!report;

    // Nome utente loggato per auto-fill ispettore
    const currentUserName = useMemo(() => {
        const u = apiService.getStoredUser();
        return u ? (u.full_name || u.email || "") : "";
    }, []);

    const emptyForm = {
        company_id: "",
        report_type: "VT",
        client: "",
        supplier_name: "",
        job_order: "",
        project_id: "",
        wps_number: "",
        wps_id: "",
        base_material: "",
        material_standard: "UNI EN ISO 10025-2",
        joint_type: "SALDATURA AD ANGOLO MONO E MULTI PASSATA",
        quality_level: "UNI EN ISO 5817 Lev.C",
        method_params: { illuminance_min: 350, illuminance_max: 500, illuminance_measured: "", power_w: "", wavelength: "" },
        notes: "NULLA DA SEGNALARE, L\u2019ESITO \u00C8 DA RITENERSI SODDISFACENTE.",
        inspection_date: "",
        certificate_date: "",
        responsible: "",
        inspector: currentUserName,   // auto-fill nome utente loggato
        client_representative: "",
        status: "draft",
    };

    const [form, setForm] = useState(() => {
        if (!isEdit) return emptyForm;
        return {
            company_id:           report.company_id || "",
            report_type:          report.report_type || "VT",
            client:               report.client || "",
            supplier_name:        report.supplier_name || "",
            job_order:            report.job_order || "",
            project_id:           report.project_id != null ? String(report.project_id) : "",
            wps_number:           report.wps_number || "",
            wps_id:               report.wps_id || "",
            base_material:        report.base_material || "",
            material_standard:    report.material_standard || "UNI EN ISO 10025-2",
            joint_type:           report.joint_type || "SALDATURA AD ANGOLO MONO E MULTI PASSATA",
            quality_level:        report.quality_level || "UNI EN ISO 5817 Lev.C",
            method_params:        report.method_params ? (typeof report.method_params === "string" ? JSON.parse(report.method_params) : report.method_params) : emptyForm.method_params,
            notes:                report.notes || emptyForm.notes,
            inspection_date:      report.inspection_date ? report.inspection_date.substring(0, 10) : "",
            certificate_date:     report.certificate_date ? report.certificate_date.substring(0, 10) : "",
            responsible:          report.responsible || "",
            inspector:            report.inspector || "",
            client_representative: report.client_representative || "",
            status:               report.status || "draft",
        };
    });

    const EMPTY_ITEM = { position_code: "", quantity: "1", description: "", examined_part: "SALDATURA", surface_condition: "M/S", inspection_percentage: 100, defects: "NESSUNO", evaluation: "A", notes: "" };

    const [items, setItems] = useState(() =>
        isEdit && report.items ? report.items : [{ ...EMPTY_ITEM }]
    );

    // Riepilogo difetti calcolato dagli items correnti
    const defectSummary = useMemo(() => {
        const repairs = items.filter(i => i.evaluation === "R");
        const rejects = items.filter(i => i.evaluation === "S");
        return { repairs, rejects, hasDefects: repairs.length > 0 || rejects.length > 0 };
    }, [items]);

    // Ogni elemento: { asset_id, role: 'gauge'|'luxmeter'|'lamp'|'other' }
    const [selectedInstruments, setSelectedInstruments] = useState(() =>
        isEdit && report.instruments
            ? report.instruments.map(i => {
                const inst = availableInstruments.find(a => a.id === i.asset_id);
                return { asset_id: i.asset_id, role: resolveInstrumentRole(i.instrument_role, inst) };
            })
            : []
    );

    // Su mobile le sezioni partono chiuse (apre una alla volta) per non sopraffare lo schermo
    const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
    const [sections, setSections] = useState({
        general:     true,          // sempre aperta: dati essenziali
        instruments: !isMobile,     // chiusa su mobile
        marks:       !isMobile,     // chiusa su mobile
        notes:       !isMobile,
        signatures:  !isMobile,
    });
    const [saving, setSaving] = useState(false);
    const [exporting, setExporting] = useState(false);

    // Fornitori filtrati per il cliente selezionato (si ricaricano al cambio company_id)
    const [suppliers, setSuppliers] = useState([]);
    const [projects, setProjects] = useState([]);
    useEffect(() => {
        if (!form.company_id) { setSuppliers([]); return; }
        apiService.getSuppliers({ company_id: form.company_id, limit: 200 })
            .then(res => setSuppliers(res?.data || []))
            .catch(() => setSuppliers([]));
    }, [form.company_id]);

    useEffect(() => {
        if (!form.company_id) { setProjects([]); return; }
        let cancelled = false;
        apiService.getProjects({ company_id: form.company_id, limit: 100 })
            .then((res) => { if (!cancelled) setProjects(res?.data || []); })
            .catch(() => { if (!cancelled) setProjects([]); });
        return () => { cancelled = true; };
    }, [form.company_id]);

    // WPS filtrate per il cliente selezionato (si ricaricano al cambio company_id)
    const [wpsList, setWpsList] = useState([]);
    useEffect(() => {
        if (!form.company_id) { setWpsList([]); return; }
        apiService.getWPSList({ company_id: form.company_id, limit: 200 })
            .then(res => setWpsList(res?.data || []))
            .catch(() => setWpsList([]));
    }, [form.company_id]);
    const [error, setError] = useState(null);
    const [savedAt, setSavedAt] = useState(null);
    const [ncModalOpen, setNcModalOpen]   = useState(false);
    const [ncInitialDesc, setNcInitialDesc] = useState("");
    const [inspectorGate, setInspectorGate] = useState({
        loading: true,
        ok: false,
        reasons: [],
        candidates: [],
        qualification: null,
        vision: null,
        error: null,
    });
    const [eligibilityNonce, setEligibilityNonce] = useState(0);

    useEffect(() => {
        const onOnline = () => setEligibilityNonce((n) => n + 1);
        window.addEventListener("online", onOnline);
        return () => window.removeEventListener("online", onOnline);
    }, []);

    useEffect(() => {
        let cancelled = false;
        const timer = setTimeout(() => {
            setInspectorGate((g) => ({ ...g, loading: true, error: null }));
            apiService.getNdtInspectorEligibility({
                inspector: form.inspector || "",
                report_type: form.report_type,
                company_id: form.company_id || "",
            }).then((res) => {
                if (cancelled) return;
                const data = res?.data || {};
                setInspectorGate({
                    loading: false,
                    ok: !!data.ok,
                    reasons: data.reasons || [],
                    candidates: data.candidates || [],
                    qualification: data.qualification || null,
                    vision: data.vision || null,
                    error: null,
                });
            }).catch(() => {
                if (cancelled) return;
                setInspectorGate({
                    loading: false,
                    ok: false,
                    reasons: ["Impossibile verificare il patentino (rete). Salva bozza; completa quando sei online."],
                    candidates: [],
                    qualification: null,
                    vision: null,
                    error: "network",
                });
            });
        }, 300);
        return () => { cancelled = true; clearTimeout(timer); };
    }, [form.inspector, form.report_type, form.company_id, eligibilityNonce]);

    const gateReasonsText = (inspectorGate.reasons || []).filter(Boolean).join(" ");
    const canComplete = !inspectorGate.loading && inspectorGate.ok;
    const completeTitle = inspectorGate.loading
        ? "Verifica patentino ISO 9712 in corso\u2026"
        : (canComplete
            ? "Completa verbale"
            : (gateReasonsText || "Serve patentino ISO 9712 valido e idoneit\u00e0 visiva"));
    // Errore rete: si può compilare A/R/S in bozza; Completa resta bloccato finché il gate non è verificato.
    const judgmentLocked = !inspectorGate.loading && !inspectorGate.ok && inspectorGate.error !== "network";
    const judgmentTitle = gateReasonsText || "Serve patentino ISO 9712 valido e idoneit\u00e0 visiva";

    // Fix P0-2 (ISO 3834 §15) — bridge "Registra NC" da una singola marca R/S del verbale
    const openNcModalForItem = useCallback((item, index) => {
        const typeLabel = REPORT_TYPES.find(t => t.value === form.report_type)?.label || form.report_type;
        const evalLabel = EVALUATION_OPTIONS.find(e => e.value === item.evaluation)?.label || item.evaluation;
        const lines = [
            `Verbale ${typeLabel}${report?.report_number ? " " + report.report_number : ""} \u2014 ${form.client || "cliente"}`,
            `Marca: ${item.position_code || "riga " + (index + 1)}${item.description ? " \u2014 " + item.description : ""}`,
            `Esito: ${evalLabel}`,
            item.defects && item.defects !== "NESSUNO" ? `Codice difetto: ${item.defects}` : null,
            item.notes ? `Note: ${item.notes}` : null,
        ].filter(Boolean);
        setNcInitialDesc(lines.join("\n"));
        setNcModalOpen(true);
    }, [form.report_type, form.client, report?.report_number]);

    // Fix 3 — auto-save bozza in localStorage mentre si compila in campo
    const { clearDraft } = useNdtAutoSave(report?.id || null, form, items);

    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
    const setParam = (k, v) => setForm(f => ({ ...f, method_params: { ...f.method_params, [k]: v } }));
    const toggleSection = (k) => setSections(s => ({ ...s, [k]: !s[k] }));

    const addMarkRow = () => setItems(prev => [...prev, { ...EMPTY_ITEM }]);
    const updateMarkRow = (idx, data) => setItems(prev => prev.map((it, i) => i === idx ? data : it));
    const removeMarkRow = (idx) => setItems(prev => prev.filter((_, i) => i !== idx));

    const toggleInstrument = (inst) => setSelectedInstruments(prev => {
        const exists = prev.find(x => x.asset_id === inst.id);
        if (exists) return prev.filter(x => x.asset_id !== inst.id);
        return [...prev, { asset_id: inst.id, role: inferInstrumentRole(inst) }];
    });

    const setInstrumentRole = (id, role) => setSelectedInstruments(prev =>
        prev.map(x => x.asset_id === id ? { ...x, role } : x)
    );

    const handleSubmit = async (e, targetStatus) => {
        if (e) e.preventDefault();
        if (targetStatus === "completed" && !canComplete) {
            setError(completeTitle);
            return;
        }
        setSaving(true);
        setError(null);
        try {
            const payload = {
                ...form,
                company_id: form.company_id ? parseInt(form.company_id) : null,
                project_id: form.project_id ? parseInt(form.project_id, 10) : null,
                status: targetStatus || form.status,
                items,
                instrument_ids: selectedInstruments.map(i => ({ asset_id: i.asset_id, instrument_role: i.role })),
            };
            if (isEdit) {
                await apiService.updateNdtReport(report.id, payload);
            } else {
                await apiService.createNdtReport(payload);
            }
            setSavedAt(new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }));
            clearDraft(); // rimuove bozza locale dopo salvataggio riuscito
            onSave();
        } catch (err) {
            setError(err?.message || "Errore salvataggio verbale");
        } finally {
            setSaving(false);
        }
    };

    const handleExportWord = async () => {
        setExporting(true);
        setError(null);
        try {
            // Costruisce oggetto report completo con items e instruments correnti
            const reportForExport = {
                ...form,
                report_number: report?.report_number || null,
                report_year:   report?.report_year   || new Date().getFullYear(),
                items,
                instruments: selectedInstruments.map(sel => {
                    const inst = availableInstruments.find(i => i.id === sel.asset_id);
                    return inst
                        ? { asset_id: sel.asset_id, instrument_role: sel.role, asset_name: inst.name, model: inst.model, serial_number: inst.serial_number }
                        : { asset_id: sel.asset_id, instrument_role: sel.role };
                }),
            };
            await exportVtToWord(reportForExport);
        } catch (err) {
            setError("Errore export Word: " + (err.message || err));
        } finally {
            setExporting(false);
        }
    };

    const reportTypeLabel = REPORT_TYPES.find(t => t.value === form.report_type)?.label || form.report_type;
    const isVT = form.report_type === "VT";

    return (
        <div className="ndt-form-page">
            {/* Header */}
            <div className="ndt-form-header">
                <div>
                    <h2 className="ndt-form-title">
                        {isEdit ? `Verbale ${report.report_number || "—"}` : "Nuovo verbale CND"}
                    </h2>
                    <span className="ndt-form-subtitle">{reportTypeLabel}</span>
                </div>
                <div className="ndt-form-header-actions">
                    <button type="button" className="btn" onClick={onCancel}>Chiudi</button>
                    <button type="button" className="btn" onClick={handleExportWord} disabled={exporting || saving}>
                        {exporting ? "Generazione..." : "\uD83D\uDCC4 Genera Word"}
                    </button>
                    <button type="button" className="btn btn-primary" onClick={e => handleSubmit(e, "draft")} disabled={saving}>
                        {saving ? "Salvataggio..." : "Salva bozza"}
                    </button>
                    {form.status !== "approved" && (
                        <button
                            type="button"
                            className="btn btn-primary"
                            onClick={e => handleSubmit(e, "completed")}
                            disabled={saving || !canComplete}
                            title={completeTitle}
                        >
                            Completa verbale
                        </button>
                    )}
                </div>
            </div>

            {savedAt && <div className="ndt-saved-at">{"Salvato alle " + savedAt}</div>}
            {error && <div className="ndt-form-error">{error}</div>}
            {!inspectorGate.loading && !inspectorGate.ok && (
                <div className="ndt-form-error" role="alert">
                    {gateReasonsText || "Completa verbale richiede patentino ISO 9712 valido e idoneit\u00e0 visiva."}
                </div>
            )}
            {!inspectorGate.loading && inspectorGate.ok && inspectorGate.qualification && (
                <div className="ndt-gate-ok">
                    {`Patentino ISO 9712 ${inspectorGate.qualification.ndt_method || form.report_type}`
                        + (inspectorGate.qualification.ndt_level != null ? ` liv.${inspectorGate.qualification.ndt_level}` : "")
                        + " valido \u00b7 idoneit\u00e0 visiva ok"}
                </div>
            )}

            <div className="ndt-form-body">

                {/* ── Sezione 1: Dati Generali ──────────────────────────────── */}
                <div className="ndt-section">
                    <button type="button" className="ndt-section-toggle" onClick={() => toggleSection("general")}>
                        <span className="ndt-section-num">1</span>
                        <span className="ndt-section-title">Dati Generali</span>
                        <span className="ndt-section-chevron">{sections.general ? "\u25B2" : "\u25BC"}</span>
                    </button>
                    {sections.general && (
                        <div className="ndt-section-body">
                            <div className="ndt-form-row">
                                <div className="ndt-form-group">
                                    <label>Tipo metodo</label>
                                    <select
                                        value={form.report_type}
                                        onChange={e => set("report_type", e.target.value)}
                                        disabled={isEdit}
                                        title={isEdit ? "Il metodo \u00e8 fissato alla creazione (numero verbale)." : undefined}
                                    >
                                        {REPORT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                                    </select>
                                </div>
                                <div className="ndt-form-group ndt-grow">
                                    <label>{"Azienda committente (Cliente sul certificato)"}</label>
                                    <select value={form.company_id} onChange={e => {
                                        const cid = e.target.value;
                                        const company = companies.find(c => String(c.id) === String(cid));
                                        setForm(f => ({
                                            ...f,
                                            company_id: cid,
                                            client: company ? company.name : "",
                                            project_id: "",
                                        }));
                                    }}>
                                        <option value="">{"— seleziona azienda —"}</option>
                                        {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                    {/* Override nome sul certificato — solo se serve un nome diverso */}
                                    {form.company_id && (
                                        <div className="ndt-client-override">
                                            <label className="ndt-override-label">
                                                <input
                                                    type="checkbox"
                                                    checked={!!form.client && form.client !== companies.find(c => String(c.id) === String(form.company_id))?.name}
                                                    onChange={e => {
                                                        if (!e.target.checked) {
                                                            const company = companies.find(c => String(c.id) === String(form.company_id));
                                                            set("client", company ? company.name : "");
                                                        }
                                                    }}
                                                />
                                                {"Nome diverso sul certificato Word"}
                                            </label>
                                            {form.client !== companies.find(c => String(c.id) === String(form.company_id))?.name && (
                                                <input
                                                    type="text"
                                                    className="ndt-client-input"
                                                    value={form.client}
                                                    onChange={e => set("client", e.target.value)}
                                                    placeholder="Nome da stampare sul verbale..."
                                                />
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                            {/* Nota scenario multi-soggetto */}
                            <div className="ndt-scenario-hint">
                                <span className="ndt-scenario-icon">{"ℹ\uFE0F"}</span>
                                <span>
                                    {"Cliente = chi commissiona l'ispezione (appare nel Word). "}
                                    {"Fornitore ispezionato = chi produce i pezzi (dove si va fisicamente)."}
                                </span>
                            </div>
                            <div className="ndt-form-row">
                                <div className="ndt-form-group">
                                    <label htmlFor="ndt-project">Commessa (opzionale)</label>
                                    <select
                                        id="ndt-project"
                                        value={form.project_id}
                                        disabled={!form.company_id}
                                        title={form.company_id ? undefined : "Seleziona prima l'azienda"}
                                        onChange={e => {
                                            const pid = e.target.value;
                                            const p = projects.find((x) => String(x.id) === String(pid));
                                            setForm(f => ({
                                                ...f,
                                                project_id: pid,
                                                job_order: p?.project_code || f.job_order,
                                            }));
                                        }}
                                    >
                                        <option value="">
                                            {form.company_id ? "\u2014 Nessuna commessa \u2014" : "\u2014 Seleziona prima l'azienda \u2014"}
                                        </option>
                                        {form.project_id && !projects.some((p) => String(p.id) === String(form.project_id)) && (
                                            <option value={form.project_id}>
                                                {report?.project_code || `Commessa #${form.project_id}`}
                                            </option>
                                        )}
                                        {projects.map((p) => (
                                            <option key={p.id} value={p.id}>
                                                {p.project_code}{p.description ? ` \u2014 ${p.description}` : ""}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="ndt-form-group">
                                    <label>Commessa / Ordine</label>
                                    <input type="text" value={form.job_order} onChange={e => set("job_order", e.target.value)} placeholder="es. ORD-2026-001" />
                                </div>
                            </div>
                            <div className="ndt-form-row">
                                <div className="ndt-form-group ndt-grow">
                                    <label>{"Fornitore ispezionato"}<span className="eq-computed-label"> (stabilimento dove si va fisicamente)</span></label>
                                    {/* Select dall'anagrafica fornitori + testo libero per fornitori non censiti */}
                                    <select
                                        value={suppliers.find(s => s.name === form.supplier_name)?.id || "__custom__"}
                                        onChange={e => {
                                            if (e.target.value === "__custom__") { set("supplier_name", ""); return; }
                                            const s = suppliers.find(su => String(su.id) === e.target.value);
                                            if (s) set("supplier_name", s.name);
                                        }}
                                    >
                                        <option value="__custom__">
                                            {form.company_id
                                                ? (suppliers.length === 0 ? "— nessun fornitore per questo cliente —" : "— fornitore non in anagrafica —")
                                                : "— seleziona prima il cliente —"}
                                        </option>
                                        {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}{s.category ? " (" + s.category + ")" : ""}</option>)}
                                    </select>
                                    <input
                                        type="text"
                                        value={form.supplier_name}
                                        onChange={e => set("supplier_name", e.target.value)}
                                        placeholder="es. Fornitore1 S.r.l. — Via Industria 5, Brescia"
                                        style={{ marginTop: "4px" }}
                                    />
                                </div>
                            </div>
                            <div className="ndt-form-row">
                                <div className="ndt-form-group">
                                    <label>{"Specifica N. / WPS Nr"}</label>
                                    <select
                                        value={form.wps_id || "__custom__"}
                                        onChange={e => {
                                            if (e.target.value === "__custom__") {
                                                set("wps_id", ""); return;
                                            }
                                            const w = wpsList.find(wp => String(wp.id) === e.target.value);
                                            if (w) {
                                                set("wps_id", w.id);
                                                set("wps_number", w.wps_code);
                                            }
                                        }}
                                    >
                                        <option value="__custom__">
                                            {form.company_id
                                                ? (wpsList.length === 0 ? "— nessuna WPS per questo cliente —" : "— WPS non in anagrafica —")
                                                : "— seleziona prima il cliente —"}
                                        </option>
                                        {wpsList.map(w => (
                                            <option key={w.id} value={w.id}>
                                                {w.wps_code}{w.welding_process ? " (" + w.welding_process + ")" : ""}
                                                {w.base_material_group ? " — " + w.base_material_group : ""}
                                            </option>
                                        ))}
                                    </select>
                                    <input
                                        type="text"
                                        value={form.wps_number}
                                        onChange={e => { set("wps_number", e.target.value); set("wps_id", ""); }}
                                        placeholder="es. WPS-FOR1-001 o digita manualmente"
                                        style={{ marginTop: "4px" }}
                                    />
                                </div>
                                <div className="ndt-form-group">
                                    <label>Materiale Base</label>
                                    <input type="text" value={form.base_material} onChange={e => set("base_material", e.target.value)} placeholder="es. S355" />
                                </div>
                            </div>
                            <div className="ndt-form-row">
                                <div className="ndt-form-group">
                                    <label>Standard materiale</label>
                                    <select value={form.material_standard} onChange={e => set("material_standard", e.target.value)}>
                                        <option value="UNI EN ISO 10025-2">UNI EN ISO 10025-2</option>
                                        <option value="UNI EN ISO 10210 / EN 10219-1">UNI EN ISO 10210 / EN 10219-1</option>
                                        <option value="">Altro</option>
                                    </select>
                                </div>
                                <div className="ndt-form-group ndt-grow">
                                    <label>Tipo di giunto</label>
                                    <input type="text" value={form.joint_type} onChange={e => set("joint_type", e.target.value)} />
                                </div>
                                <div className="ndt-form-group">
                                    <label>{"Livello qualit\u00e0"}</label>
                                    <input type="text" value={form.quality_level} onChange={e => set("quality_level", e.target.value)} />
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* ── Sezione 2: Strumentazione ─────────────────────────────── */}
                <div className="ndt-section">
                    <button type="button" className="ndt-section-toggle" onClick={() => toggleSection("instruments")}>
                        <span className="ndt-section-num">2</span>
                        <span className="ndt-section-title">Strumentazione utilizzata</span>
                        <span className="ndt-section-chevron">{sections.instruments ? "\u25B2" : "\u25BC"}</span>
                    </button>
                    {sections.instruments && (
                        <div className="ndt-section-body">
                            {/* Selezione strumenti dall'anagrafica */}
                            {availableInstruments.length === 0 ? (
                                <div className="ndt-no-instruments">
                                    <span>{"Nessuno strumento con metodo " + form.report_type + " nell'anagrafica."}</span>
                                    <a href="/cnd/strumenti" target="_blank" rel="noopener noreferrer" className="ndt-no-instruments-link">
                                        {"\u2192 Aggiungi strumenti all'anagrafica"}
                                    </a>
                                </div>
                            ) : (
                                <div className="ndt-instruments-list">
                                    <label className="ndt-instruments-label">
                                        {"Strumenti disponibili per " + form.report_type + " \u2014 seleziona e assegna il ruolo (Calibro / Luxmetro / Lampada)"}
                                    </label>
                                    <div className="ndt-instruments-grid">
                                        {availableInstruments.map(inst => {
                                            const isExpired  = inst.calibration_status === "expired";
                                            const isExpiring = inst.calibration_status === "expiring";
                                            const selEntry   = selectedInstruments.find(x => x.asset_id === inst.id);
                                            const isSelected = !!selEntry;
                                            return (
                                                <div key={inst.id} className={`ndt-instrument-card${isSelected ? " ndt-inst-selected" : ""}${isExpired ? " ndt-inst-expired" : isExpiring ? " ndt-inst-expiring" : ""}`}>
                                                    <label className="ndt-inst-check-label">
                                                        <input type="checkbox" checked={isSelected} onChange={() => toggleInstrument(inst)} disabled={inst.status === "calibrating"} />
                                                        <div className="ndt-inst-info">
                                                            <span className="ndt-inst-name">{inst.name}</span>
                                                            <span className="ndt-inst-detail">{inst.model}{inst.serial_number ? " \u2014 S/N: " + inst.serial_number : ""}</span>
                                                            {isExpired  && <span className="ndt-cal-badge ndt-cal-expired">Taratura scaduta</span>}
                                                            {isExpiring && <span className="ndt-cal-badge ndt-cal-warn">{"Scade in " + inst.days_to_expiry + " gg"}</span>}
                                                            {inst.status === "calibrating" && <span className="ndt-cal-badge ndt-cal-warn">In taratura</span>}
                                                        </div>
                                                    </label>
                                                    {isSelected && (
                                                        <label className="ndt-inst-role-wrap">
                                                            <span className="ndt-inst-role-label">Ruolo nel verbale</span>
                                                            <select
                                                                className="ndt-inst-role-select"
                                                                value={selEntry.role}
                                                                onChange={e => setInstrumentRole(inst.id, e.target.value)}
                                                                aria-label={"Ruolo di " + inst.name}
                                                            >
                                                                {INSTRUMENT_ROLE_OPTIONS.map(opt => (
                                                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                                                ))}
                                                            </select>
                                                        </label>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Parametri specifici VT */}
                            {isVT && (
                                <div className="ndt-params-grid">
                                    <div className="ndt-form-group">
                                        <label>Illuminamento min (lux)</label>
                                        <input type="number" value={form.method_params.illuminance_min || 350} onChange={e => setParam("illuminance_min", e.target.value)} />
                                    </div>
                                    <div className="ndt-form-group">
                                        <label>Illuminamento max (lux)</label>
                                        <input type="number" value={form.method_params.illuminance_max || 500} onChange={e => setParam("illuminance_max", e.target.value)} />
                                    </div>
                                    <div className="ndt-form-group">
                                        <label>Illuminamento misurato (lux)</label>
                                        <input type="number" value={form.method_params.illuminance_measured || ""} onChange={e => setParam("illuminance_measured", e.target.value)} placeholder="valore reale" />
                                    </div>
                                    <div className="ndt-form-group">
                                        <label>Potenza (W)</label>
                                        <input type="text" value={form.method_params.power_w || ""} onChange={e => setParam("power_w", e.target.value)} />
                                    </div>
                                    <div className="ndt-form-group">
                                        <label>{"Lunghezza d\u2019onda (\u00B0A)"}</label>
                                        <input type="text" value={form.method_params.wavelength || ""} onChange={e => setParam("wavelength", e.target.value)} />
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* ── Sezione 3: Elenco Marche ──────────────────────────────── */}
                <div className="ndt-section">
                    <button type="button" className="ndt-section-toggle" onClick={() => toggleSection("marks")}>
                        <span className="ndt-section-num">3</span>
                        <span className="ndt-section-title">
                            {"Elenco Marche (" + items.length + " righe)"}
                            {defectSummary.hasDefects && (
                                <span className="ndt-defect-badge">
                                    {defectSummary.repairs.length > 0 && (" R:" + defectSummary.repairs.length)}
                                    {defectSummary.rejects.length > 0 && (" S:" + defectSummary.rejects.length)}
                                </span>
                            )}
                        </span>
                        <span className="ndt-section-chevron">{sections.marks ? "\u25B2" : "\u25BC"}</span>
                    </button>
                    {sections.marks && (
                        <div className="ndt-section-body">
                            <div className="ndt-marks-table-wrap">
                                <table className="ndt-marks-table">
                                    <thead>
                                        <tr>
                                            <th>#</th>
                                            <th>Pos. / Codice</th>
                                            <th>{"Q.t\u00e0"}</th>
                                            <th>Descrizione</th>
                                            <th>Parte esaminata</th>
                                            <th>Superficie</th>
                                            <th>% Ctrl</th>
                                            <th>Difetti</th>
                                            <th>Giudizio</th>
                                            <th></th>
                                        </tr>
                                    </thead>
                                        {items.map((item, idx) => (
                                            <MarkRow key={item.id || idx} item={item} index={idx} onChange={updateMarkRow} onRemove={removeMarkRow} reportId={report?.id} onRegisterNc={openNcModalForItem} judgmentLocked={judgmentLocked} judgmentTitle={judgmentTitle} />
                                        ))}
                                </table>
                            </div>
                            <button type="button" className="btn ndt-add-row-btn" onClick={addMarkRow}>+ Aggiungi riga</button>
                        </div>
                    )}
                </div>

                {/* ── Sezione 4: Note e Certificazione ─────────────────────── */}
                <div className="ndt-section">
                    <button type="button" className="ndt-section-toggle" onClick={() => toggleSection("notes")}>
                        <span className="ndt-section-num">4</span>
                        <span className="ndt-section-title">Note e Certificazione</span>
                        <span className="ndt-section-chevron">{sections.notes ? "\u25B2" : "\u25BC"}</span>
                    </button>
                    {sections.notes && (
                        <div className="ndt-section-body">

                            {/* Riepilogo difetti — visibile solo se R o S presenti */}
                            {defectSummary.hasDefects && (
                                <div className="ndt-defect-summary">
                                    <div className="ndt-defect-summary-title">
                                        {"\u26A0\uFE0F Difetti riscontrati nell'ispezione"}
                                    </div>
                                    {defectSummary.repairs.length > 0 && (
                                        <div className="ndt-defect-group ndt-defect-repair">
                                            <strong>{"Da riparare (R) — " + defectSummary.repairs.length + " componenti:"}</strong>
                                            <ul>
                                                {defectSummary.repairs.map((it, idx) => (
                                                    <li key={idx}>
                                                        {it.position_code || ("Riga " + (items.indexOf(it) + 1))}
                                                        {it.description ? " \u2014 " + it.description : ""}
                                                        {it.defects && it.defects !== "NESSUNO" ? " (" + it.defects + ")" : ""}
                                                        {it.notes ? ": " + it.notes : ""}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                    {defectSummary.rejects.length > 0 && (
                                        <div className="ndt-defect-group ndt-defect-scrap">
                                            <strong>{"Scarto (S) — " + defectSummary.rejects.length + " componenti:"}</strong>
                                            <ul>
                                                {defectSummary.rejects.map((it, idx) => (
                                                    <li key={idx}>
                                                        {it.position_code || ("Riga " + (items.indexOf(it) + 1))}
                                                        {it.description ? " \u2014 " + it.description : ""}
                                                        {it.defects && it.defects !== "NESSUNO" ? " (" + it.defects + ")" : ""}
                                                        {it.notes ? ": " + it.notes : ""}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                    <div className="ndt-defect-nc-hint">
                                        <span>{"Registrare i difetti come Non Conformit\u00e0?"}</span>
                                        <button
                                            type="button"
                                            className="ndt-defect-nc-link"
                                            onClick={() => {
                                                // Costruisce descrizione pre-compilata dai difetti R e S
                                                const lines = [
                                                    ...defectSummary.repairs.map(i =>
                                                        `[R] ${i.position_code || "?"} ${i.description ? "\u2014 " + i.description : ""}${i.defects && i.defects !== "NESSUNO" ? " (" + i.defects + ")" : ""}${i.notes ? ": " + i.notes : ""}`
                                                    ),
                                                    ...defectSummary.rejects.map(i =>
                                                        `[S] ${i.position_code || "?"} ${i.description ? "\u2014 " + i.description : ""}${i.defects && i.defects !== "NESSUNO" ? " (" + i.defects + ")" : ""}${i.notes ? ": " + i.notes : ""}`
                                                    ),
                                                ];
                                                const desc = `Verbale VT${report?.report_number ? " " + report.report_number : ""} \u2014 ${form.client || "cliente"}\nDifetti riscontrati:\n` + lines.join("\n");
                                                setNcInitialDesc(desc);
                                                setNcModalOpen(true);
                                            }}
                                        >
                                            {"\u2192 Crea Non Conformit\u00e0"}
                                        </button>
                                    </div>
                                </div>
                            )}

                            <div className="ndt-form-group">
                                <label>Note del verbale</label>
                                <textarea
                                    className="notes-textarea"
                                    value={form.notes}
                                    onChange={e => set("notes", e.target.value)}
                                    rows={3}
                                    placeholder={defectSummary.hasDefects
                                        ? "Descrivi i difetti riscontrati e le azioni raccomandate..."
                                        : "Nulla da segnalare, l'esito \u00e8 da ritenersi soddisfacente."}
                                />
                                {defectSummary.hasDefects && form.notes.toLowerCase().includes("nulla da segnalare") && (
                                    <div className="ndt-notes-warning">
                                        {"\u26A0\uFE0F Sono presenti difetti ma le note dicono 'nulla da segnalare' \u2014 aggiorna il testo."}
                                        <button type="button" className="ndt-notes-fix-btn" onClick={() => {
                                            const repairList = defectSummary.repairs.map(i => (i.position_code || "?") + (i.defects !== "NESSUNO" ? " (" + i.defects + ")" : "")).join(", ");
                                            const scrapList  = defectSummary.rejects.map(i => (i.position_code || "?") + (i.defects !== "NESSUNO" ? " (" + i.defects + ")" : "")).join(", ");
                                            const parts = [];
                                            if (repairList) parts.push("Da riparare: " + repairList);
                                            if (scrapList)  parts.push("Scarto: " + scrapList);
                                            set("notes", "DIFETTI RISCONTRATI — " + parts.join(" | ") + ". Vedere Elenco Marche allegato.");
                                        }}>
                                            {"Aggiorna automaticamente"}
                                        </button>
                                    </div>
                                )}
                            </div>
                            <div className="ndt-certification-text">{CERTIFICATION_TEXT}</div>
                        </div>
                    )}
                </div>

                {/* ── Sezione 5: Ufficializzazione ─────────────────────────── */}
                <div className="ndt-section">
                    <button type="button" className="ndt-section-toggle" onClick={() => toggleSection("signatures")}>
                        <span className="ndt-section-num">5</span>
                        <span className="ndt-section-title">Ufficializzazione e Firme</span>
                        <span className="ndt-section-chevron">{sections.signatures ? "\u25B2" : "\u25BC"}</span>
                    </button>
                    {sections.signatures && (
                        <div className="ndt-section-body">
                            <div className="ndt-form-row">
                                <div className="ndt-form-group">
                                    <label>Data controllo</label>
                                    <input type="date" value={form.inspection_date} onChange={e => set("inspection_date", e.target.value)} />
                                </div>
                                <div className="ndt-form-group">
                                    <label>Data emissione certificato</label>
                                    <input type="date" value={form.certificate_date} onChange={e => set("certificate_date", e.target.value)} />
                                </div>
                            </div>
                            <div className="ndt-form-row">
                                <div className="ndt-form-group">
                                    <label>Il Responsabile</label>
                                    <input type="text" value={form.responsible} onChange={e => set("responsible", e.target.value)} placeholder="Nome responsabile" />
                                </div>
                                <div className="ndt-form-group">
                                    <label>
                                        {"L\u2019Ispettore"}
                                        {form.inspector === currentUserName && currentUserName && (
                                            <span className="eq-computed-label"> (utente corrente)</span>
                                        )}
                                    </label>
                                    <input
                                        type="text"
                                        list="ndt-inspector-candidates"
                                        value={form.inspector}
                                        onChange={e => set("inspector", e.target.value)}
                                        placeholder="Nome ispettore (patentino 9712)"
                                    />
                                    <datalist id="ndt-inspector-candidates">
                                        {(inspectorGate.candidates || []).map((c) => (
                                            <option key={c.person_name} value={c.person_name}>
                                                {c.ndt_method ? `${c.ndt_method}${c.ndt_level != null ? ` liv.${c.ndt_level}` : ""}` : ""}
                                            </option>
                                        ))}
                                    </datalist>
                                    {judgmentLocked && (
                                        <div className="ndt-notes-warning">
                                            {gateReasonsText || "Scegli un ispettore con patentino ISO 9712 valido e visita medica visiva in corso."}
                                        </div>
                                    )}
                                </div>
                                <div className="ndt-form-group">
                                    <label>Il Cliente (rappresentante)</label>
                                    <input type="text" value={form.client_representative} onChange={e => set("client_representative", e.target.value)} placeholder="Nome rappresentante cliente" />
                                </div>
                            </div>
                        </div>
                    )}
                </div>

            </div>{/* end ndt-form-body */}

            {/* Fix 2 — Modal NC con dati difetti pre-compilati */}
            <NcCreateModal
                open={ncModalOpen}
                onClose={() => setNcModalOpen(false)}
                onCreated={() => { setNcModalOpen(false); }}
                defaultCategory="operational"
                initialDescription={ncInitialDesc}
            />
        </div>
    );
}

// ── Componente principale ─────────────────────────────────────────────────────
export default function NdtReportsPage() {
    const { companyId: filterCompany, companies } = useCompanyScope();
    const [reports, setReports] = useState([]);
    const [stats, setStats] = useState(null);
    const [availableInstruments, setAvailableInstruments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const [filterType, setFilterType] = useState("");
    const [filterStatus, setFilterStatus] = useState("");
    const [searchText, setSearchText] = useState("");

    const [view, setView] = useState("list"); // "list" | "form"
    const [editingReport, setEditingReport] = useState(null);

    const loadData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const params = {};
            if (filterType)    params.report_type = filterType;
            if (filterStatus)  params.status = filterStatus;
            if (filterCompany) params.company_id = filterCompany;
            if (searchText)    params.search = searchText;

            const [listResp, statsResp] = await Promise.all([
                apiService.getNdtReportList(params),
                apiService.getNdtReportStats(filterCompany ? { company_id: filterCompany } : {}),
            ]);

            setReports(listResp.data || []);
            setStats(statsResp.data || null);
        } catch (err) {
            setError("Errore caricamento verbali CND");
        } finally {
            setLoading(false);
        }
    }, [filterType, filterStatus, filterCompany, searchText]);

    useEffect(() => { loadData(); }, [loadData]);

    const openNew = async () => {
        // Carica strumenti VT per default
        try {
            const instResp = await apiService.getEquipmentForReport("VT");
            setAvailableInstruments(instResp.data || []);
        } catch { setAvailableInstruments([]); }
        setEditingReport(null);
        setView("form");
    };

    const openEdit = async (report) => {
        try {
            const [reportResp, instResp] = await Promise.all([
                apiService.getNdtReport(report.id),
                apiService.getEquipmentForReport(report.report_type),
            ]);
            setEditingReport(reportResp.data);
            setAvailableInstruments(instResp.data || []);
        } catch {
            setEditingReport(report);
            setAvailableInstruments([]);
        }
        setView("form");
    };

    const handleSaved = () => { setView("list"); setEditingReport(null); loadData(); };
    const handleCancel = () => { setView("list"); setEditingReport(null); };

    const handleDelete = async (report) => {
        if (!window.confirm(`Eliminare il verbale "${report.report_number || "bozza"}"?`)) return;
        try {
            await apiService.deleteNdtReport(report.id);
            loadData();
        } catch { alert("Errore eliminazione verbale"); }
    };

    if (view === "form") {
        return (
            <NdtReportForm
                report={editingReport}
                companies={companies}
                availableInstruments={availableInstruments}
                onSave={handleSaved}
                onCancel={handleCancel}
            />
        );
    }

    return (
        <div className="ndt-page">
            <div className="ndt-header">
                <div>
                    <h1 className="ndt-title">Verbali CND</h1>
                    <p className="ndt-subtitle">Esame Visivo (VT), Particelle Magnetiche (MT), Liquidi Penetranti (PT), Ultrasuoni (UT)</p>
                </div>
                <button className="btn btn-primary" onClick={openNew}>+ Nuovo verbale</button>
            </div>

            {/* Stats */}
            {stats && (
                <div className="ndt-stats-bar">
                    <div className="ndt-stat"><span className="ndt-stat-n">{stats.total}</span><span>Totali</span></div>
                    <div className="ndt-stat"><span className="ndt-stat-n">{stats.draft}</span><span>Bozze</span></div>
                    <div className="ndt-stat ndt-stat-ok"><span className="ndt-stat-n">{stats.approved}</span><span>Approvati</span></div>
                    <div className="ndt-stat"><span className="ndt-stat-n">{stats.vt_count}</span><span>VT</span></div>
                    <div className="ndt-stat"><span className="ndt-stat-n">{stats.mt_count}</span><span>MT</span></div>
                    <div className="ndt-stat"><span className="ndt-stat-n">{stats.pt_count}</span><span>PT</span></div>
                    <div className="ndt-stat"><span className="ndt-stat-n">{stats.ut_count}</span><span>UT</span></div>
                </div>
            )}

            {/* Filtri */}
            <div className="ndt-filters">
                <input type="text" className="ndt-search" placeholder="Cerca cliente, commessa, n. verbale..." value={searchText} onChange={e => setSearchText(e.target.value)} />
                <select value={filterType} onChange={e => setFilterType(e.target.value)}>
                    <option value="">Tutti i metodi</option>
                    {REPORT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
                <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                    <option value="">Tutti gli stati</option>
                    {REPORT_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
            </div>

            {loading && <div className="ndt-loading">Caricamento...</div>}
            {error && <div className="ndt-error">{error}</div>}
            {!loading && !error && (
                <div className="ndt-table-wrap">
                    <table className="ndt-table">
                        <thead>
                            <tr>
                                <th>N. Verbale</th>
                                <th>Tipo</th>
                                <th>Cliente</th>
                                <th>Commessa</th>
                                <th>Ispettore</th>
                                <th>Data controllo</th>
                                <th>Marche</th>
                                <th>Stato</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {reports.length === 0 && (
                                <tr><td colSpan={9} className="ndt-empty">Nessun verbale trovato</td></tr>
                            )}
                            {reports.map(r => {
                                const st = REPORT_STATUSES.find(s => s.value === r.status) || REPORT_STATUSES[0];
                                return (
                                    <tr key={r.id} className="ndt-row" onClick={() => openEdit(r)}>
                                        <td className="ndt-mono">{r.report_number || <em>bozza</em>}</td>
                                        <td><span className="ndt-type-tag">{r.report_type}</span></td>
                                        <td>{r.client || "—"}</td>
                                        <td>{r.project_code || r.job_order || "—"}</td>
                                        <td>{r.inspector || "—"}</td>
                                        <td>{r.inspection_date ? formatDate(r.inspection_date) : "—"}</td>
                                        <td className="ndt-center">{r.items_count}</td>
                                        <td><span className={`ndt-status ${st.cls}`}>{st.label}</span></td>
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
