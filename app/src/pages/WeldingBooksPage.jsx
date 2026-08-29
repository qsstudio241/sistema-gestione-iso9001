/**
 * WeldingBooksPage — Welding Book ISO 3834 (IOF)
 * Fase 1: select WPS/WPQR/commessa/saldatori + precompilazione da anagrafica.
 */

import React, { useState, useEffect, useMemo, useCallback } from "react";
import apiService from "../services/apiService";
import { formatDate } from "../utils/dateHelpers";
import { useWeldingBookAutoSave } from "../hooks/useWeldingBookAutoSave.js";
import "./WeldingBooksPage.css";

const BOOK_STATUSES = [
    { value: "draft",    label: "Bozza" },
    { value: "released", label: "Rilasciato" },
];

const EMPTY_WELD_PARAMS = {
    current_a: "",
    voltage_v: "",
    travel_speed: "",
    passes: "",
    preheat_c: "",
    interpass_c: "",
    filler: "",
    gas: "",
};

const EMPTY_WELD = {
    sequence_no: "",
    joint_code: "",
    joint_description: "",
    welder_name: "",
    weld_date: "",
    weld_params: { ...EMPTY_WELD_PARAMS },
    notes: "",
};

const EMPTY_EQUIPMENT = {
    asset_id: "",
    equipment_role: "welding_source",
    notes: "",
};

function isWelderQualification(q) {
    const t = String(q.qualification_type || "").toLowerCase();
    return t.includes("9606") || t.includes("saldator");
}

function buildFormFromBook(book) {
    if (!book) {
        const u = apiService.getStoredUser();
        return {
            company_id: "",
            project_id: "",
            product_code: "",
            product_description: "",
            job_order: "",
            client_name: "",
            drawing_ref: "",
            drawing_revision: "",
            wps_id: "",
            wpqr_id: "",
            wps_code: "",
            wpqr_code: "",
            base_material: "",
            filler_material: "",
            welding_process: "",
            coordinator_name: u ? (u.full_name || u.email || "") : "",
            document_revision: "0",
            notes: "",
            status: "draft",
        };
    }
    return {
        company_id: book.company_id || "",
        project_id: book.project_id || "",
        product_code: book.product_code || "",
        product_description: book.product_description || "",
        job_order: book.job_order || "",
        client_name: book.client_name || "",
        drawing_ref: book.drawing_ref || "",
        drawing_revision: book.drawing_revision || "",
        wps_id: book.wps_id || "",
        wpqr_id: book.wpqr_id || "",
        wps_code: book.wps_code || "",
        wpqr_code: book.wpqr_code || "",
        base_material: book.base_material || "",
        filler_material: book.filler_material || "",
        welding_process: book.welding_process || "",
        coordinator_name: book.coordinator_name || "",
        document_revision: book.document_revision || "0",
        notes: book.notes || "",
        status: book.status || "draft",
    };
}

function WeldingBookForm({ book, onSave, onCancel }) {
    const isEdit = !!book;
    const [form, setForm] = useState(() => buildFormFromBook(book));
    const [equipment, setEquipment] = useState(
        () => (isEdit && book.equipment?.length ? book.equipment : [{ ...EMPTY_EQUIPMENT }])
    );
    const [welds, setWelds] = useState(() => {
        if (isEdit && book.welds?.length) {
            return book.welds.map((w) => ({
                ...w,
                weld_params: { ...EMPTY_WELD_PARAMS, ...(w.weld_params || {}) },
            }));
        }
        return [{ ...EMPTY_WELD, weld_params: { ...EMPTY_WELD_PARAMS } }];
    });

    const [companies, setCompanies] = useState([]);
    const [projects, setProjects] = useState([]);
    const [wpsList, setWpsList] = useState([]);
    const [wpqrList, setWpqrList] = useState([]);
    const [welders, setWelders] = useState([]);
    const [availableAssets, setAvailableAssets] = useState([]);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const [savedAt, setSavedAt] = useState(null);

    const organizationId = apiService.getStoredUser?.()?.organization_id ?? null;
    const { clearDraft } = useWeldingBookAutoSave(
        book?.id || null,
        form,
        equipment,
        welds,
        organizationId,
    );

    const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

    useEffect(() => {
        apiService.getCompanies({ limit: 200 })
            .then((res) => setCompanies(res?.companies || res?.data || []))
            .catch(() => setCompanies([]));
    }, []);

    useEffect(() => {
        if (!form.company_id) {
            setProjects([]);
            setWpsList([]);
            setWpqrList([]);
            setWelders([]);
            return;
        }
        const cid = form.company_id;
        Promise.all([
            apiService.getProjects({ company_id: cid, limit: 100 }),
            apiService.getWPSList({ company_id: cid, limit: 200 }),
            apiService.getQualifications({ company_id: cid, limit: 200 }),
        ]).then(([pr, wps, qual]) => {
            setProjects(pr?.data || []);
            setWpsList(wps?.data || []);
            setWelders((qual?.data || []).filter(isWelderQualification));
        }).catch(() => {
            setProjects([]);
            setWpsList([]);
            setWelders([]);
        });
    }, [form.company_id]);

    useEffect(() => {
        if (!form.company_id) {
            setWpqrList([]);
            return;
        }
        const params = { company_id: form.company_id, limit: 100 };
        if (form.wps_id) params.wps_id = form.wps_id;
        apiService.getWPQRList(params)
            .then((res) => setWpqrList(res?.data || []))
            .catch(() => setWpqrList([]));
    }, [form.company_id, form.wps_id]);

    useEffect(() => {
        const params = { limit: 200 };
        if (form.company_id) params.company_id = form.company_id;
        apiService.getEquipmentList(params)
            .then((res) => setAvailableAssets(res.data || []))
            .catch(() => setAvailableAssets([]));
    }, [form.company_id]);

    const applyWps = useCallback((w) => {
        if (!w) return;
        setForm((f) => ({
            ...f,
            wps_id: w.id,
            wps_code: w.wps_code || "",
            base_material: w.base_material_group || w.material_group || f.base_material,
            filler_material: w.filler_material || f.filler_material,
            welding_process: w.welding_process || f.welding_process,
            wpqr_id: "",
            wpqr_code: "",
        }));
        setWelds((prev) => prev.map((row) => ({
            ...row,
            weld_params: {
                ...row.weld_params,
                filler: row.weld_params?.filler || w.filler_material || "",
                gas: row.weld_params?.gas || w.shielding_gas || "",
                preheat_c: row.weld_params?.preheat_c || w.preheat_temp || "",
                interpass_c: row.weld_params?.interpass_c || w.interpass_temp || "",
            },
        })));
    }, []);

    const handleProjectChange = (projectId) => {
        if (!projectId) {
            set("project_id", "");
            return;
        }
        const p = projects.find((x) => String(x.id) === String(projectId));
        setForm((f) => ({
            ...f,
            project_id: projectId,
            job_order: p?.project_code || f.job_order,
            client_name: p?.client_name || f.client_name,
            product_description: p?.description || f.product_description,
        }));
    };

    const handleSave = async () => {
        if (!form.product_code?.trim() && !form.product_description?.trim()) {
            setError("Inserire almeno codice o descrizione prodotto.");
            return;
        }
        setSaving(true);
        setError(null);
        try {
            const payload = {
                ...form,
                company_id: form.company_id ? parseInt(form.company_id, 10) : null,
                project_id: form.project_id ? parseInt(form.project_id, 10) : null,
                wps_id: form.wps_id ? parseInt(form.wps_id, 10) : null,
                wpqr_id: form.wpqr_id ? parseInt(form.wpqr_id, 10) : null,
                equipment: equipment
                    .filter((e) => e.asset_id)
                    .map((e, i) => ({
                        asset_id: parseInt(e.asset_id, 10),
                        equipment_role: e.equipment_role || "other",
                        sort_order: i,
                        notes: e.notes || "",
                    })),
                welds: welds.map((w, i) => ({
                    ...w,
                    sort_order: i,
                    wps_id: w.wps_id || (form.wps_id ? parseInt(form.wps_id, 10) : null),
                })),
            };
            if (isEdit) {
                await apiService.updateWeldingBook(book.id, payload);
            } else {
                await apiService.createWeldingBook(payload);
            }
            clearDraft();
            setSavedAt(new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }));
            onSave();
        } catch (err) {
            setError(err.message || "Errore salvataggio");
        } finally {
            setSaving(false);
        }
    };

    const updateWeld = (idx, patch) => {
        setWelds((prev) => prev.map((w, i) => (i === idx ? { ...w, ...patch } : w)));
    };

    const updateWeldParam = (idx, key, value) => {
        setWelds((prev) => prev.map((w, i) => (
            i === idx ? { ...w, weld_params: { ...w.weld_params, [key]: value } } : w
        )));
    };

    const wpsOptions = useMemo(() => wpsList, [wpsList]);

    return (
        <div className="wb-form-panel">
            <div className="wb-form-header">
                <div>
                    <h2>{isEdit ? `Modifica ${book.book_number || "Welding Book"}` : "Nuovo Welding Book"}</h2>
                    {savedAt && <span className="wb-saved-at">Salvato alle {savedAt}</span>}
                </div>
                <div className="wb-form-actions">
                    <button type="button" className="btn-secondary" onClick={onCancel}>Annulla</button>
                    <button type="button" className="btn-primary" onClick={handleSave} disabled={saving}>
                        {saving ? "Salvataggio..." : "Salva bozza"}
                    </button>
                </div>
            </div>

            {error && <div className="wb-error">{error}</div>}

            <section className="wb-section">
                <h3>Prodotto e riferimenti</h3>
                <div className="wb-grid-2">
                    <label>
                        Azienda / cliente
                        <select value={form.company_id || ""} onChange={(e) => set("company_id", e.target.value)}>
                            <option value="">— Seleziona azienda —</option>
                            {companies.map((c) => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                    </label>
                    <label>
                        Commessa
                        <select
                            value={form.project_id || ""}
                            onChange={(e) => handleProjectChange(e.target.value)}
                            disabled={!form.company_id}
                        >
                            <option value="">{form.company_id ? "— Nessuna commessa —" : "— Seleziona prima l'azienda —"}</option>
                            {projects.map((p) => (
                                <option key={p.id} value={p.id}>{p.project_code}{p.description ? ` — ${p.description}` : ""}</option>
                            ))}
                        </select>
                    </label>
                    <label>Codice prodotto<input value={form.product_code} onChange={(e) => set("product_code", e.target.value)} /></label>
                    <label>Descrizione<input value={form.product_description} onChange={(e) => set("product_description", e.target.value)} /></label>
                    <label>Commessa / ordine<input value={form.job_order} onChange={(e) => set("job_order", e.target.value)} /></label>
                    <label>Cliente<input value={form.client_name} onChange={(e) => set("client_name", e.target.value)} /></label>
                    <label>Disegno<input value={form.drawing_ref} onChange={(e) => set("drawing_ref", e.target.value)} /></label>
                    <label>Rev. disegno<input value={form.drawing_revision} onChange={(e) => set("drawing_revision", e.target.value)} /></label>

                    <label>
                        WPS
                        <select
                            value={form.wps_id || "__custom__"}
                            disabled={!form.company_id}
                            onChange={(e) => {
                                if (e.target.value === "__custom__") {
                                    set("wps_id", "");
                                    return;
                                }
                                const w = wpsOptions.find((x) => String(x.id) === e.target.value);
                                if (w) applyWps(w);
                            }}
                        >
                            <option value="__custom__">
                                {form.company_id
                                    ? (wpsOptions.length === 0 ? "— nessuna WPS —" : "— WPS manuale —")
                                    : "— seleziona azienda —"}
                            </option>
                            {wpsOptions.map((w) => (
                                <option key={w.id} value={w.id}>
                                    {w.wps_code}{w.welding_process ? ` (${w.welding_process})` : ""}
                                </option>
                            ))}
                        </select>
                        <input
                            type="text"
                            value={form.wps_code}
                            onChange={(e) => { set("wps_code", e.target.value); set("wps_id", ""); }}
                            placeholder="Codice WPS"
                            style={{ marginTop: "4px" }}
                        />
                    </label>

                    <label>
                        WPQR
                        <select
                            value={form.wpqr_id || "__custom__"}
                            disabled={!form.company_id}
                            onChange={(e) => {
                                if (e.target.value === "__custom__") {
                                    set("wpqr_id", "");
                                    return;
                                }
                                const q = wpqrList.find((x) => String(x.id) === e.target.value);
                                if (q) {
                                    set("wpqr_id", q.id);
                                    set("wpqr_code", q.wpqr_code || q.reference_number || "");
                                }
                            }}
                        >
                            <option value="__custom__">
                                {form.company_id
                                    ? (wpqrList.length === 0 ? "— nessuna WPQR —" : "— WPQR manuale —")
                                    : "— seleziona azienda —"}
                            </option>
                            {wpqrList.map((q) => (
                                <option key={q.id} value={q.id}>
                                    {q.wpqr_code || q.reference_number || `WPQR #${q.id}`}
                                </option>
                            ))}
                        </select>
                        <input
                            type="text"
                            value={form.wpqr_code}
                            onChange={(e) => { set("wpqr_code", e.target.value); set("wpqr_id", ""); }}
                            placeholder="Riferimento WPQR"
                            style={{ marginTop: "4px" }}
                        />
                    </label>

                    <label>Materiale base<input value={form.base_material} onChange={(e) => set("base_material", e.target.value)} /></label>
                    <label>Apporto<input value={form.filler_material} onChange={(e) => set("filler_material", e.target.value)} /></label>
                    <label>Processo<input value={form.welding_process} onChange={(e) => set("welding_process", e.target.value)} placeholder="es. 135" /></label>
                    <label>Coordinatore<input value={form.coordinator_name} onChange={(e) => set("coordinator_name", e.target.value)} /></label>
                    <label>
                        Stato documento
                        <select value={form.status} onChange={(e) => set("status", e.target.value)}>
                            {BOOK_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                        </select>
                    </label>
                    <label>Rev. documento<input value={form.document_revision} onChange={(e) => set("document_revision", e.target.value)} /></label>
                </div>
                <label className="wb-notes-label">
                    Note generali
                    <textarea className="notes-textarea" rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
                </label>
            </section>

            <section className="wb-section">
                <h3>Attrezzature utilizzate</h3>
                <table className="wb-table">
                    <thead>
                        <tr>
                            <th>Attrezzatura</th>
                            <th>Ruolo</th>
                            <th>Note</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        {equipment.map((row, idx) => (
                            <tr key={idx}>
                                <td>
                                    <select
                                        value={row.asset_id || ""}
                                        onChange={(e) => {
                                            const next = [...equipment];
                                            next[idx] = { ...next[idx], asset_id: e.target.value };
                                            setEquipment(next);
                                        }}
                                    >
                                        <option value="">— Seleziona —</option>
                                        {availableAssets.map((a) => (
                                            <option key={a.id} value={a.id}>
                                                {[a.internal_code, a.name, a.serial_number].filter(Boolean).join(" — ")}
                                            </option>
                                        ))}
                                    </select>
                                </td>
                                <td>
                                    <select
                                        value={row.equipment_role || "welding_source"}
                                        onChange={(e) => {
                                            const next = [...equipment];
                                            next[idx] = { ...next[idx], equipment_role: e.target.value };
                                            setEquipment(next);
                                        }}
                                    >
                                        <option value="welding_source">Sorgente saldatura</option>
                                        <option value="wire_feed">Alimentazione filo</option>
                                        <option value="gas">Gas</option>
                                        <option value="parameter_recorder">Registrazione parametri</option>
                                        <option value="positioner">Posizionatore</option>
                                        <option value="other">Altro</option>
                                    </select>
                                </td>
                                <td>
                                    <input
                                        value={row.notes || ""}
                                        onChange={(e) => {
                                            const next = [...equipment];
                                            next[idx] = { ...next[idx], notes: e.target.value };
                                            setEquipment(next);
                                        }}
                                    />
                                </td>
                                <td>
                                    <button type="button" className="wb-row-remove" onClick={() => setEquipment(equipment.filter((_, i) => i !== idx))} title="Rimuovi">&times;</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                <button type="button" className="btn-secondary wb-add-row" onClick={() => setEquipment([...equipment, { ...EMPTY_EQUIPMENT }])}>
                    + Aggiungi attrezzatura
                </button>
            </section>

            <section className="wb-section">
                <h3>Sequenza saldature</h3>
                <div className="wb-table-scroll">
                    <table className="wb-table wb-table-welds">
                        <thead>
                            <tr>
                                <th>N°</th>
                                <th>Giunto</th>
                                <th>Descrizione</th>
                                <th>Saldatore</th>
                                <th>Data</th>
                                <th>I (A)</th>
                                <th>U (V)</th>
                                <th>Vel.</th>
                                <th>Pass.</th>
                                <th>T pre</th>
                                <th>T int</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {welds.map((row, idx) => (
                                <tr key={idx}>
                                    <td><input value={row.sequence_no || ""} onChange={(e) => updateWeld(idx, { sequence_no: e.target.value })} placeholder="S01" /></td>
                                    <td><input value={row.joint_code || ""} onChange={(e) => updateWeld(idx, { joint_code: e.target.value })} /></td>
                                    <td><input value={row.joint_description || ""} onChange={(e) => updateWeld(idx, { joint_description: e.target.value })} /></td>
                                    <td>
                                        <select value={row.welder_name || ""} onChange={(e) => updateWeld(idx, { welder_name: e.target.value })}>
                                            <option value="">—</option>
                                            {welders.map((q) => (
                                                <option key={q.id} value={q.person_name}>{q.person_name}</option>
                                            ))}
                                        </select>
                                    </td>
                                    <td><input type="date" value={row.weld_date ? row.weld_date.substring(0, 10) : ""} onChange={(e) => updateWeld(idx, { weld_date: e.target.value })} /></td>
                                    <td><input value={row.weld_params?.current_a || ""} onChange={(e) => updateWeldParam(idx, "current_a", e.target.value)} /></td>
                                    <td><input value={row.weld_params?.voltage_v || ""} onChange={(e) => updateWeldParam(idx, "voltage_v", e.target.value)} /></td>
                                    <td><input value={row.weld_params?.travel_speed || ""} onChange={(e) => updateWeldParam(idx, "travel_speed", e.target.value)} /></td>
                                    <td><input value={row.weld_params?.passes || ""} onChange={(e) => updateWeldParam(idx, "passes", e.target.value)} /></td>
                                    <td><input value={row.weld_params?.preheat_c || ""} onChange={(e) => updateWeldParam(idx, "preheat_c", e.target.value)} /></td>
                                    <td><input value={row.weld_params?.interpass_c || ""} onChange={(e) => updateWeldParam(idx, "interpass_c", e.target.value)} /></td>
                                    <td><button type="button" className="wb-row-remove" onClick={() => setWelds(welds.filter((_, i) => i !== idx))}>&times;</button></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <button type="button" className="btn-secondary wb-add-row" onClick={() => setWelds([...welds, { ...EMPTY_WELD, weld_params: { ...EMPTY_WELD_PARAMS, filler: form.filler_material || "", gas: "" } }])}>
                    + Aggiungi saldatura
                </button>
                <p className="wb-hint">Foto cordone e export Word: slice Fase 2–3 (ADR-016).</p>
            </section>
        </div>
    );
}

export default function WeldingBooksPage() {
    const [books, setBooks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [view, setView] = useState("list");
    const [selected, setSelected] = useState(null);
    const [error, setError] = useState(null);

    const loadBooks = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await apiService.getWeldingBookList({ limit: 100 });
            setBooks(res.data || []);
        } catch (err) {
            setError(err.message || "Errore caricamento");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadBooks(); }, [loadBooks]);

    const openEdit = async (id) => {
        try {
            const res = await apiService.getWeldingBook(id);
            setSelected(res.data);
            setView("form");
        } catch (err) {
            setError(err.message);
        }
    };

    if (view === "form") {
        return (
            <WeldingBookForm
                book={selected}
                onSave={() => { setView("list"); setSelected(null); loadBooks(); }}
                onCancel={() => { setView("list"); setSelected(null); }}
            />
        );
    }

    return (
        <div className="wb-page">
            <header className="wb-page-header">
                <div>
                    <h1>Welding Book</h1>
                    <p className="wb-subtitle">Istruzione operativa di fabbricatura ISO 3834</p>
                </div>
                <button type="button" className="btn-primary" onClick={() => { setSelected(null); setView("form"); }}>
                    + Nuovo Welding Book
                </button>
            </header>

            {error && <div className="wb-error">{error}</div>}
            {loading ? (
                <p>Caricamento...</p>
            ) : books.length === 0 ? (
                <div className="wb-empty">Nessun Welding Book. Crea il primo documento operativo.</div>
            ) : (
                <table className="wb-list-table">
                    <thead>
                        <tr>
                            <th>Numero</th>
                            <th>Prodotto</th>
                            <th>Commessa</th>
                            <th>WPS</th>
                            <th>Saldature</th>
                            <th>Stato</th>
                            <th>Aggiornato</th>
                        </tr>
                    </thead>
                    <tbody>
                        {books.map((b) => (
                            <tr key={b.id} className="wb-list-row" onClick={() => openEdit(b.id)}>
                                <td>{b.book_number || "—"}</td>
                                <td>{[b.product_code, b.product_description].filter(Boolean).join(" — ") || "—"}</td>
                                <td>{b.job_order || "—"}</td>
                                <td>{b.wps_code || "—"}</td>
                                <td>{b.welds_count ?? 0}</td>
                                <td><span className={`wb-status wb-status-${b.status}`}>{BOOK_STATUSES.find((s) => s.value === b.status)?.label || b.status}</span></td>
                                <td>{formatDate(b.updated_at)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>
    );
}
