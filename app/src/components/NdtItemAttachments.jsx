/**
 * NdtItemAttachments — allegati (foto) per singola riga Elenco Marche VT
 *
 * Il picker si apre dal pulsante foto nella riga (ref.openFilePicker).
 * Mostra galleria miniature + feedback upload/errore; nessun secondo uploader.
 * CND-6: target touch, errori leggibili, read-only coerente.
 */

import React, { useState, useEffect, useRef, useImperativeHandle, forwardRef } from "react";
import apiService from "../services/apiService";
import { compressImageFile } from "../hooks/useAttachmentManager";
import "./NdtItemAttachments.css";

const ACCEPTED_TYPES = "image/jpeg,image/png,image/heic,image/heif,image/webp";
const ACCEPTED_MIME = new Set(
    ACCEPTED_TYPES.split(",").map((s) => s.trim().toLowerCase())
);
const MAX_SIZE_MB = 20;

function isAcceptedImage(file) {
    if (!file) return false;
    const mime = (file.type || "").toLowerCase();
    if (mime && ACCEPTED_MIME.has(mime)) return true;
    // HEIC/HEIF su alcuni browser arriva senza MIME affidabile
    const name = (file.name || "").toLowerCase();
    return /\.(jpe?g|png|heic|heif|webp)$/.test(name);
}

const NdtItemAttachments = forwardRef(function NdtItemAttachments(
    { itemId, readOnly = false, onStateChange },
    ref
) {
    const [attachments, setAttachments] = useState([]);
    const [uploading, setUploading] = useState(false);
    const [uploadLabel, setUploadLabel] = useState("");
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
            if (readOnly) return;
            if (uploading) return;
            inputRef.current?.click();
        },
    }), [readOnly, uploading]);

    const handleFileSelect = async (e) => {
        const files = Array.from(e.target.files || []);
        if (!files.length) return;
        if (readOnly) {
            if (inputRef.current) inputRef.current.value = "";
            return;
        }
        setError(null);
        setUploading(true);

        for (let i = 0; i < files.length; i += 1) {
            const file = files[i];
            setUploadLabel(`Caricamento ${i + 1}/${files.length}\u2026`);
            try {
                if (!isAcceptedImage(file)) {
                    setError(`Formato non supportato: ${file.name}. Usa JPG, PNG, HEIC o WebP.`);
                    continue;
                }
                if (file.size > MAX_SIZE_MB * 1024 * 1024) {
                    setError(`File troppo grande (max ${MAX_SIZE_MB} MB): ${file.name}`);
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
                    const msg = err.error || err.message || `Upload fallito (${resp.status})`;
                    throw new Error(msg);
                }

                await resp.json();
                const listResp = await apiService.get(`/attachments?ndt_report_item_id=${itemId}`);
                setAttachments(listResp?.data || listResp?.attachments || []);
            } catch (err) {
                const raw = err?.message || "errore sconosciuto";
                const offline = typeof navigator !== "undefined" && navigator.onLine === false;
                setError(
                    offline
                        ? "Niente rete: la foto non \u00e8 stata caricata. Riprova quando sei online."
                        : `Upload fallito: ${raw}`
                );
            }
        }

        setUploading(false);
        setUploadLabel("");
        if (inputRef.current) inputRef.current.value = "";
    };

    const handleDelete = async (attachmentId) => {
        if (readOnly) return;
        if (!window.confirm("Eliminare questa foto?")) return;
        try {
            await apiService.delete(`/attachments/${attachmentId}`);
            setAttachments(prev => prev.filter(a => a.attachment_id !== attachmentId));
            setError(null);
        } catch {
            setError("Eliminazione non riuscita. Riprova.");
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
        <div
            className={`ndt-att-root${hasContent ? "" : " ndt-att-root-hidden"}${readOnly ? " ndt-att-root-readonly" : ""}`}
            data-testid="ndt-item-attachments"
        >
            <input
                ref={inputRef}
                type="file"
                accept={ACCEPTED_TYPES}
                multiple
                capture="environment"
                className="ndt-att-file-input"
                onChange={handleFileSelect}
                disabled={readOnly || uploading}
                aria-hidden="true"
                tabIndex={-1}
            />

            {uploading && (
                <div className="ndt-att-status" role="status" aria-live="polite">
                    <span className="ndt-att-status-dot" aria-hidden="true" />
                    {uploadLabel || "Caricamento foto\u2026"}
                </div>
            )}

            {readOnly && attachments.length > 0 && (
                <div className="ndt-att-readonly-hint">Solo lettura — le foto non si possono modificare.</div>
            )}

            {attachments.length > 0 && (
                <div className="ndt-att-gallery" role="list" aria-label="Foto allegata alla marca">
                    {attachments.map(att => (
                        <div key={att.attachment_id} className="ndt-att-thumb" role="listitem">
                            <img
                                src={getPreviewUrl(att)}
                                alt={att.file_name || "Foto marca"}
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
                                    aria-label={`Elimina foto ${att.file_name || ""}`.trim()}
                                >
                                    &times;
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {error && (
                <div className="ndt-att-error" role="alert">
                    <span className="ndt-att-error-text">{error}</span>
                    <button
                        type="button"
                        className="ndt-att-error-dismiss"
                        onClick={() => setError(null)}
                        aria-label="Chiudi messaggio di errore"
                    >
                        Chiudi
                    </button>
                </div>
            )}
        </div>
    );
});

export default NdtItemAttachments;
export { isAcceptedImage, MAX_SIZE_MB, ACCEPTED_TYPES };
