/**
 * Cestino — elenco dei record soft-deleted e ripristino.
 * Stessa struttura dell'elenco Qualifiche (sq-page, tab, griglia). Solo admin e superadmin.
 */
import React, { useCallback, useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import apiService from "../services/apiService";
import SgqDataGrid from "../components/SgqDataGrid";
import "./QualificationsPage.css";

const TABS = [
    { key: "", label: "Tutti" },
    { key: "qualifications", label: "Qualifiche" },
    { key: "welding_procedures", label: "WPS" },
    { key: "wpqr_records", label: "WPQR" },
    { key: "wpqr_test_runs", label: "Passate" },
    { key: "projects", label: "Commesse" },
    { key: "attachments", label: "Allegati" },
    { key: "non_conformities", label: "NC" },
    { key: "nc_actions", label: "Azioni NC" },
];

function formatWhen(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleString("it-IT");
}

export default function TrashPage() {
    const { user } = useAuth();
    const isAdmin = user?.role === "admin" || user?.role === "superadmin";
    const [entity, setEntity] = useState("");
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [busyId, setBusyId] = useState(null);

    const load = useCallback(async () => {
        if (!isAdmin) return;
        setLoading(true);
        setError("");
        try {
            const res = await apiService.listTrash(entity || undefined);
            setRows(Array.isArray(res?.data) ? res.data : []);
        } catch (err) {
            setRows([]);
            setError(err?.message || "Impossibile leggere il cestino.");
        } finally {
            setLoading(false);
        }
    }, [entity, isAdmin]);

    useEffect(() => {
        load();
    }, [load]);

    async function restore(row) {
        setBusyId(`${row.entity}-${row.id}`);
        setError("");
        try {
            await apiService.restoreTrash(row.entity, row.id);
            await load();
        } catch (err) {
            setError(err?.message || "Ripristino non riuscito.");
        } finally {
            setBusyId(null);
        }
    }

    if (!isAdmin) {
        return (
            <div className="sq-page">
                <div className="sq-header">
                    <div>
                        <h2 className="sq-title">Cestino</h2>
                        <p className="sq-subtitle">Solo admin e superadmin della propria organizzazione.</p>
                    </div>
                </div>
            </div>
        );
    }

    const columns = [
        { id: "entity_label", label: "Tipo", sortable: true },
        { id: "title", label: "Record", sortable: true },
        { id: "code", label: "Codice", sortable: true },
        { id: "status", label: "Stato", sortable: true },
        { id: "deleted_at", label: "Nel cestino dal", sortable: true },
        { id: "actions", label: "Azioni" },
    ];

    return (
        <div className="sq-page">
            <div className="sq-header">
                <div>
                    <h2 className="sq-title">Cestino</h2>
                    <p className="sq-subtitle">Record spostati con Elimina. Il ripristino li rimette in elenco. Non c&apos;è una cancellazione definitiva.</p>
                </div>
            </div>
            <div className="sq-tabs" role="tablist">
                {TABS.map((tab) => (
                    <button
                        key={tab.key || "tutti"}
                        type="button"
                        role="tab"
                        className={entity === tab.key ? "sq-tab sq-tab-active" : "sq-tab"}
                        aria-selected={entity === tab.key}
                        onClick={() => setEntity(tab.key)}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>
            {error ? <p className="sq-subtitle">{error}</p> : null}
            <SgqDataGrid
                rows={rows}
                columns={columns}
                loading={loading}
                emptyMessage="Il cestino è vuoto."
                getRowKey={(row) => `${row.entity}-${row.id}`}
                renderCell={(row, col) => {
                    if (col.id === "deleted_at") return formatWhen(row.deleted_at);
                    if (col.id === "actions") {
                        const key = `${row.entity}-${row.id}`;
                        return (
                            <button
                                type="button"
                                className="sq-btn-new"
                                disabled={busyId === key}
                                onClick={() => restore(row)}
                            >
                                Ripristina
                            </button>
                        );
                    }
                    return row[col.id] || "";
                }}
            />
        </div>
    );
}
