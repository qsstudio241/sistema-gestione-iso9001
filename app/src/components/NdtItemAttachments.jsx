/**
 * NdtItemAttachments — allegati (foto) per singola riga Elenco Marche VT
 *
 * Il picker si apre dal pulsante 📷 nella riga (ref.openFilePicker).
 * Mostra galleria miniature + eventuali errori; nessun secondo pulsante upload.
 */

import React, { useState, useEffect, useRef, useImperativeHandle, forwardRef } from "react";
import apiService from "../services/apiService";
import { compressImageFile } from "../hooks/useAttachmentManager";
import "./NdtItemAttachments.css";

const ACCEPTED_TYPES = "image/jpeg,image/png,image/heic,image/heif,image/webp";
const MAX_SIZE_MB = 20;

const NdtItemAttachments = forwardRef(function NdtItemAttachments(
    { itemId, readOnly = false, onStateChange },
    ref
) {
    const [attachments, setAttachments] = useState([]);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState(null);
    const inputRef = useRef(null);

    useEffect(() => {
        if (!itemId) return;
        apiService.get(`/attachments?ndt_report_item_id=${itemId}`)
            .then(res => setAttachments(res?.data || res?.attachments || []))
            .catch(() => setAttachments([]));
    }, [itemId]);

    useEffect(() => {
        onStateChange?.({
            count: attachments.length,
            uploading,
            error,
        });
    }, [attachments.length, uploading, error, onStateChange]);

    useImperativeHandle(ref, () => ({
        openFilePicker() {
            if (!readOnly) inputRef.current?.click();
        },
    }), [readOnly]);

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

                const fileToUpload = file.type.startsWith("image/")
                    ? await compressImageFile(file).catch(() => file)
                    : file;

                const formData = new FormData();
                formData.append("file", fileToUpload, fileToUpload.name || file.name);
                formData.append("ndt_report_item_id", String(itemId));
                formData.append("category", "photo");
                formData.append("description", "Foto componente VT");

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

                await resp.json();
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
        const token = apiService.getToken ? apiService.getToken() : null;
        const base = `${apiService.baseUrl}/attachments/${att.attachment_id}/download`;
        return token ? `${base}?token=${encodeURIComponent(token)}` : base;
    };

    if (!itemId) return null;

    const hasContent = attachments.length > 0 || uploading || !!error;

    return (
        <div className={`ndt-att-root${hasContent ? "" : " ndt-att-root-hidden"}`}>
            <input
                ref={inputRef}
                type="file"
                accept={ACCEPTED_TYPES}
                multiple
                capture="environment"
                style={{ display: "none" }}
                onChange={handleFileSelect}
                disabled={readOnly || uploading}
            />

            {uploading && (
                <span className="ndt-att-status">{"\u23F3"} Caricamento foto...</span>
            )}

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

            {error && <span className="ndt-att-error">{error}</span>}
        </div>
    );
});

export default NdtItemAttachments;
