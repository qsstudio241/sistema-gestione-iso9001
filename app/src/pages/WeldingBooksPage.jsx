/**
 * WeldingBooksPage — Welding Book ISO 3834 (IOF)
 * Fase 0: lista + form bozza (testata, griglie placeholder).
 * Pattern: NdtReportsPage.
 */

import React, { useState, useEffect, useCallback } from "react";
import apiService from "../services/apiService";
import { formatDate } from "../utils/dateHelpers";
import "./WeldingBooksPage.css";

const BOOK_STATUSES = [
    { value: "draft",    label: "Bozza" },
    { value: "released", label: "Rilasciato" },
];

const EMPTY_WELD = {
    sequence_no: "",
    joint_code: "",
    joint_description: "",
    welder_name: "",
    weld_params: {
        current_a: "",
        voltage_v: "",
        travel_speed: "",
        passes: "",
        preheat_c: "",
        interpass_c: "",
        filler: "",
        gas: "",
    },
    notes: "",
};

const EMPTY_EQUIPMENT = {
    asset_id: "",
    equipment_role: "welding_source",
    notes: "",
};

function WeldingBookForm({ book, onSave, onCancel }) {
    const isEdit = !!book;
    const [form, setForm] = useState(() => ({
        company_id: book?.company_id || "",
        product_code: book?.product_code || "",
        product_description: book?.product_description || "",
        job_order: book?.job_order || "",
        client_name: book?.client_name || "",
        drawing_ref: book?.drawing_ref || "",
        drawing_revision: book?.drawing_revision || "",
        wps_code: book?.wps_code || "",
        wpqr_code: book?.wpqr_code || "",
        base_material: book?.base_material || "",
        filler_material: book?.filler_material || "",
        welding_process: book?.welding_process || "",
        coordinator_name: book?.coordinator_name || "",
        document_revision: book?.document_revision || "0",
        notes: book?.notes || "",
        status: book?.status || "draft",
    }));
    const [equipment, setEquipment] = useState(
        () => (isEdit && book.equipment?.length ? book.equipment : [{ ...EMPTY_EQUIPMENT }])
    );
    const [welds, setWelds] = useState(
        () => (isEdit && book.welds?.length ? book.welds : [{ ...EMPTY_WELD }])
    );
    const [availableAssets, setAvailableAssets] = useState([]);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        apiService.getEquipmentList({ asset_category: "welding_machine", limit: 200 })
            .then((res) => setAvailableAssets(res.data || []))
            .catch(() => setAvailableAssets([]));
    }, []);

    const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

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
                company_id: form.company_id || null,
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
                })),
            };
            if (isEdit) {
                await apiService.updateWeldingBook(book.id, payload);
            } else {
                await apiService.createWeldingBook(payload);
            }
            onSave();
        } catch (err) {
            setError(err.message || "Errore salvataggio");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="wb-form-panel">
            <div className="wb-form-header">
                <h2>{isEdit ? `Modifica ${book.book_number || "Welding Book"}` : "Nuovo Welding Book"}</h2>
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
                    <label>Codice prodotto<input value={form.product_code} onChange={(e) => set("product_code", e.target.value)} /></label>
                    <label>Descrizione<input value={form.product_description} onChange={(e) => set("product_description", e.target.value)} /></label>
                    <label>Commessa / ordine<input value={form.job_order} onChange={(e) => set("job_order", e.target.value)} /></label>
                    <label>Cliente<input value={form.client_name} onChange={(e) => set("client_name", e.target.value)} /></label>
                    <label>Disegno<input value={form.drawing_ref} onChange={(e) => set("drawing_ref", e.target.value)} /></label>
                    <label>Rev. disegno<input value={form.drawing_revision} onChange={(e) => set("drawing_revision", e.target.value)} /></label>
                    <label>WPS<input value={form.wps_code} onChange={(e) => set("wps_code", e.target.value)} /></label>
                    <label>WPQR<input value={form.wpqr_code} onChange={(e) => set("wpqr_code", e.target.value)} /></label>
                    <label>Materiale base<input value={form.base_material} onChange={(e) => set("base_material", e.target.value)} /></label>
                    <label>Apporto<input value={form.filler_material} onChange={(e) => set("filler_material", e.target.value)} /></label>
                    <label>Processo<input value={form.welding_process} onChange={(e) => set("welding_process", e.target.value)} placeholder="es. 135" /></label>
                    <label>Coordinatore<input value={form.coordinator_name} onChange={(e) => set("coordinator_name", e.target.value)} /></label>
                </div>
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
                <table className="wb-table wb-table-welds">
                    <thead>
                        <tr>
                            <th>N°</th>
                            <th>Giunto</th>
                            <th>Descrizione</th>
                            <th>Corrente (A)</th>
                            <th>Tensione (V)</th>
                            <th>Velocità</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        {welds.map((row, idx) => (
                            <tr key={idx}>
                                <td><input value={row.sequence_no || ""} onChange={(e) => { const n = [...welds]; n[idx] = { ...n[idx], sequence_no: e.target.value }; setWelds(n); }} placeholder="S01" /></td>
                                <td><input value={row.joint_code || ""} onChange={(e) => { const n = [...welds]; n[idx] = { ...n[idx], joint_code: e.target.value }; setWelds(n); }} /></td>
                                <td><input value={row.joint_description || ""} onChange={(e) => { const n = [...welds]; n[idx] = { ...n[idx], joint_description: e.target.value }; setWelds(n); }} /></td>
                                <td><input value={row.weld_params?.current_a || ""} onChange={(e) => { const n = [...welds]; n[idx] = { ...n[idx], weld_params: { ...n[idx].weld_params, current_a: e.target.value } }; setWelds(n); }} /></td>
                                <td><input value={row.weld_params?.voltage_v || ""} onChange={(e) => { const n = [...welds]; n[idx] = { ...n[idx], weld_params: { ...n[idx].weld_params, voltage_v: e.target.value } }; setWelds(n); }} /></td>
                                <td><input value={row.weld_params?.travel_speed || ""} onChange={(e) => { const n = [...welds]; n[idx] = { ...n[idx], weld_params: { ...n[idx].weld_params, travel_speed: e.target.value } }; setWelds(n); }} /></td>
                                <td><button type="button" className="wb-row-remove" onClick={() => setWelds(welds.filter((_, i) => i !== idx))}>&times;</button></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                <button type="button" className="btn-secondary wb-add-row" onClick={() => setWelds([...welds, { ...EMPTY_WELD, weld_params: { ...EMPTY_WELD.weld_params } }])}>
                    + Aggiungi saldatura
                </button>
                <p className="wb-hint">Foto cordone e export Word: prossima slice (ADR-016).</p>
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
