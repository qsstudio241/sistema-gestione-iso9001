/**
 * NdtItemAttachments — allegati (foto) per singola riga Elenco Marche VT
 *
 * Non usa useAttachmentManager (legato all'audit context).
 * Upload diretto via apiService + compressione foto lato client.
 * Nessun limite al numero di foto per riga.
 */

import React, { useState, useEffect, useRef } from "react";
import apiService from "../services/apiService";
import { compressImageFile } from "../hooks/useAttachmentManager";
import "./NdtItemAttachments.css";

const ACCEPTED_TYPES = "image/jpeg,image/png,image/heic,image/heif,image/webp";
const MAX_SIZE_MB = 20;

export default function NdtItemAttachments({ itemId, reportId, readOnly = false }) {
    const [attachments, setAttachments] = useState([]);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState(null);
    const inputRef = useRef(null);

    // Carica allegati esistenti
    useEffect(() => {
        if (!itemId) return;
        apiService.get(`/attachments?ndt_report_item_id=${itemId}`)
            .then(res => setAttachments(res?.data || res?.attachments || []))
            .catch(() => setAttachments([]));
    }, [itemId]);

    const handleFileSelect = async (e) => {
        const files = Array.from(e.target.files || []);
        if (!files.length) return;
        setError(null);
        setUploading(true);

        for (const file of files) {
            try {
                if (file.size > MAX_SIZE_MB * 1024 * 1024) {
                    setError(`File troppo grande (max ${MAX_SIZE_MB}MB): ${file.name}`);
                    continue;
                }

                // Compressione foto (riusa la funzione già in codebase)
                const fileToUpload = file.type.startsWith("image/")
                    ? await compressImageFile(file).catch(() => file)
                    : file;

                const formData = new FormData();
                formData.append("file", fileToUpload, fileToUpload.name || file.name);
                formData.append("ndt_report_item_id", String(itemId));
                formData.append("category", "photo");
                formData.append("description", "Foto componente VT");

                // Upload tramite fetch diretto (apiService non ha helper multipart per ndt)
                const token = apiService.getToken ? apiService.getToken() : null;
                const headers = {};
                if (token) headers["Authorization"] = `Bearer ${token}`;

                const resp = await fetch(`${apiService.baseUrl}/attachments/upload`, {
                    method: "POST",
                    headers,
                    credentials: "include",
                    body: formData,
                });

                if (!resp.ok) {
                    const err = await resp.json().catch(() => ({}));
                    throw new Error(err.error || `Upload fallito (${resp.status})`);
                }

                const result = await resp.json();
                // Ricarica lista allegati
                const listResp = await apiService.get(`/attachments?ndt_report_item_id=${itemId}`);
                setAttachments(listResp?.data || listResp?.attachments || []);

            } catch (err) {
                setError("Upload fallito: " + (err.message || "errore sconosciuto"));
            }
        }

        setUploading(false);
        if (inputRef.current) inputRef.current.value = "";
    };

    const handleDelete = async (attachmentId) => {
        if (!window.confirm("Eliminare questa foto?")) return;
        try {
            await apiService.delete(`/attachments/${attachmentId}`);
            setAttachments(prev => prev.filter(a => a.attachment_id !== attachmentId));
        } catch {
            setError("Errore eliminazione foto");
        }
    };

    const getPreviewUrl = (att) => {
        // Usa lo stesso pattern di AttachmentPreview.jsx
        const token = apiService.getToken ? apiService.getToken() : null;
        const base = `${apiService.baseUrl}/attachments/${att.attachment_id}/download`;
        return token ? `${base}?token=${encodeURIComponent(token)}` : base;
    };

    if (!itemId) return null;

    return (
        <div className="ndt-att-root">
            {/* Thumbnail gallery */}
            {attachments.length > 0 && (
                <div className="ndt-att-gallery">
                    {attachments.map(att => (
                        <div key={att.attachment_id} className="ndt-att-thumb">
                            <img
                                src={getPreviewUrl(att)}
                                alt={att.file_name}
                                className="ndt-att-img"
                                onClick={() => window.open(getPreviewUrl(att), "_blank")}
                                title={att.file_name}
                                onError={e => { e.target.style.display = "none"; }}
                            />
                            {!readOnly && (
                                <button
                                    type="button"
                                    className="ndt-att-delete"
                                    onClick={() => handleDelete(att.attachment_id)}
                                    title="Elimina foto"
                                >
                                    &times;
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Pulsante aggiungi foto */}
            {!readOnly && (
                <div className="ndt-att-actions">
                    <input
                        ref={inputRef}
                        type="file"
                        accept={ACCEPTED_TYPES}
                        multiple
                        capture="environment"
                        style={{ display: "none" }}
                        onChange={handleFileSelect}
                    />
                    <button
                        type="button"
                        className={`ndt-att-btn${uploading ? " ndt-att-uploading" : ""}`}
                        onClick={() => inputRef.current?.click()}
                        disabled={uploading}
                        title="Scatta o scegli foto"
                    >
                        {uploading
                            ? "\u23F3 Caricamento..."
                            : attachments.length === 0
                                ? "\uD83D\uDCF7 Aggiungi foto"
                                : `\uD83D\uDCF7 ${attachments.length} foto`}
                    </button>
                    {error && <span className="ndt-att-error">{error}</span>}
                </div>
            )}
        </div>
    );
}
