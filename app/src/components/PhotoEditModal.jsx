/**
 * PhotoEditModal.jsx
 *
 * Modal di editing foto prima dell'upload.
 * Permette di ruotare e ritagliare ogni foto selezionata prima del caricamento.
 *
 * Flusso:
 *   1. AttachmentSection pasa files[] (File objects)
 *   2. Il modal mostra ogni foto in sequenza (indice/totale)
 *   3. L'utente può: ruotare ±90°, impostare aspect ratio, ritagliare via drag/pinch
 *   4. "Conferma" → applica rotazione+crop via Canvas → restituisce File JPEG
 *   5. "Salta" → usa la foto originale senza modifiche
 *   6. "Annulla tutto" → chiude senza caricare nulla
 *   7. Dopo l'ultima foto → callback onConfirmAll(editedFiles[])
 *
 * Props:
 *   files         {File[]}           - Lista file immagine da editare
 *   onConfirmAll  {(File[]) => void} - Chiamata con tutti i file (editati o originali)
 *   onCancel      {() => void}       - Chiamata se l'utente annulla tutto
 */

import React, { useState, useCallback, useEffect } from 'react';
import Cropper from 'react-easy-crop';
import './PhotoEditModal.css';

// ─── Helper: produce File JPEG con rotazione + crop applicati via Canvas ───────
/**
 * Crea un elemento Image da un URL oggetto.
 */
function loadImage(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
    });
}

/**
 * Applica rotazione e crop a un'immagine e restituisce un File JPEG.
 * Algoritmo "safe area": ruota su canvas grande, poi ritaglia l'area richiesta.
 *
 * @param {string} objectUrl  - URL.createObjectURL del file originale
 * @param {{ x, y, width, height }} pixelCrop - area in px da ritagliare (coordinate originali)
 * @param {number} rotation   - gradi di rotazione (multipli di 90)
 * @param {File}   origFile   - file originale (per nome e fallback)
 * @returns {Promise<File>}
 */
async function buildCroppedFile(objectUrl, pixelCrop, rotation, origFile) {
    let image;
    try {
        image = await loadImage(objectUrl);
    } catch {
        return origFile;
    }

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    // Safe area: quadrato che contiene l'immagine ruotata senza ritagliare angoli
    const maxSide = Math.max(image.naturalWidth, image.naturalHeight);
    const safeArea = Math.ceil(2 * ((maxSide / 2) * Math.sqrt(2)));

    canvas.width  = safeArea;
    canvas.height = safeArea;

    // Centra e ruota
    ctx.translate(safeArea / 2, safeArea / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.translate(-safeArea / 2, -safeArea / 2);

    // Disegna l'immagine centrata nella safe area
    ctx.drawImage(
        image,
        safeArea / 2 - image.naturalWidth  / 2,
        safeArea / 2 - image.naturalHeight / 2
    );

    // Estrai la regione di crop
    const imageData = ctx.getImageData(0, 0, safeArea, safeArea);
    canvas.width  = pixelCrop.width;
    canvas.height = pixelCrop.height;

    ctx.putImageData(
        imageData,
        // Offset: riposiziona il crop rispetto al centro safe area
        Math.round(0 - safeArea / 2 + image.naturalWidth  / 2 - pixelCrop.x),
        Math.round(0 - safeArea / 2 + image.naturalHeight / 2 - pixelCrop.y)
    );

    return new Promise((resolve) => {
        canvas.toBlob(
            (blob) => {
                if (!blob) { resolve(origFile); return; }
                const name = origFile.name.replace(/\.[^.]+$/, '') + '_edited.jpg';
                resolve(new File([blob], name, { type: 'image/jpeg', lastModified: Date.now() }));
            },
            'image/jpeg',
            0.92 // alta qualità pre-compressione (addAttachments applicherà 0.82 dopo)
        );
    });
}

// ─── Opzioni aspect ratio ─────────────────────────────────────────────────────
const ASPECT_OPTIONS = [
    { label: 'Libero', value: null },
    { label: '1:1', value: 1 },
    { label: '4:3', value: 4 / 3 },
    { label: '16:9', value: 16 / 9 },
    { label: '3:4', value: 3 / 4 },
];

// ─── Componente principale ────────────────────────────────────────────────────
function PhotoEditModal({ files, onConfirmAll, onCancel }) {
    const [index, setIndex]               = useState(0);
    const [editedFiles, setEditedFiles]   = useState([]);
    const [objectUrl, setObjectUrl]       = useState(null);

    // Stato Cropper
    const [crop, setCrop]                 = useState({ x: 0, y: 0 });
    const [zoom, setZoom]                 = useState(1);
    const [rotation, setRotation]         = useState(0);
    const [aspectIdx, setAspectIdx]       = useState(0); // indice in ASPECT_OPTIONS
    const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);

    const [isProcessing, setIsProcessing] = useState(false);

    const currentFile = files[index];

    // Genera URL oggetto per il file corrente
    useEffect(() => {
        if (!currentFile) return;
        const url = URL.createObjectURL(currentFile);
        setObjectUrl(url);
        // Reset stato crop per ogni nuova foto
        setCrop({ x: 0, y: 0 });
        setZoom(1);
        setRotation(0);
        setAspectIdx(0);
        setCroppedAreaPixels(null);
        return () => URL.revokeObjectURL(url);
    }, [currentFile]);

    const onCropComplete = useCallback((_, pixels) => {
        setCroppedAreaPixels(pixels);
    }, []);

    const handleRotate = (deg) => {
        setRotation((r) => (r + deg + 360) % 360);
    };

    // Conferma: applica crop+rotazione e avanza
    const handleConfirm = async () => {
        setIsProcessing(true);
        let editedFile = currentFile;

        // Applica crop+rotazione solo se c'è un'area valida e l'utente ha effettivamente modificato
        const hasRotation = rotation !== 0;
        const hasCrop = croppedAreaPixels &&
            (croppedAreaPixels.width > 0) &&
            (croppedAreaPixels.height > 0);

        if ((hasRotation || hasCrop) && objectUrl && croppedAreaPixels) {
            editedFile = await buildCroppedFile(objectUrl, croppedAreaPixels, rotation, currentFile);
        }

        const newEdited = [...editedFiles, editedFile];

        if (index + 1 < files.length) {
            setEditedFiles(newEdited);
            setIndex(index + 1);
        } else {
            onConfirmAll(newEdited);
        }
        setIsProcessing(false);
    };

    // Salta: usa foto originale senza modifiche
    const handleSkip = () => {
        const newEdited = [...editedFiles, currentFile];
        if (index + 1 < files.length) {
            setEditedFiles(newEdited);
            setIndex(index + 1);
        } else {
            onConfirmAll(newEdited);
        }
    };

    const aspectValue = ASPECT_OPTIONS[aspectIdx].value;

    return (
        <div className="photo-edit-overlay" onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
            <div className="photo-edit-modal" role="dialog" aria-modal="true" aria-label="Modifica foto prima del caricamento">

                {/* ── Intestazione ──────────────────────────────────────── */}
                <div className="pem-header">
                    <span className="pem-title">Modifica foto</span>
                    <span className="pem-counter">{index + 1} / {files.length}</span>
                    <button
                        type="button"
                        className="pem-btn-close"
                        onClick={onCancel}
                        title="Annulla tutto (nessun file verrà caricato)"
                    >
                        ✕
                    </button>
                </div>

                {/* ── Area Cropper ──────────────────────────────────────── */}
                <div className="pem-crop-area">
                    {objectUrl && (
                        <Cropper
                            image={objectUrl}
                            crop={crop}
                            zoom={zoom}
                            rotation={rotation}
                            aspect={aspectValue ?? undefined}
                            onCropChange={setCrop}
                            onZoomChange={setZoom}
                            onCropComplete={onCropComplete}
                            style={{
                                containerStyle: { background: '#111' },
                                mediaStyle:     {},
                                cropAreaStyle:  { borderColor: '#3b82f6', borderWidth: 2 },
                            }}
                        />
                    )}
                </div>

                {/* ── Barra controlli ───────────────────────────────────── */}
                <div className="pem-controls">

                    {/* Rotazione */}
                    <div className="pem-control-group">
                        <span className="pem-control-label">Ruota</span>
                        <div className="pem-btn-row">
                            <button type="button" className="pem-btn" onClick={() => handleRotate(-90)} title="Ruota a sinistra 90°">
                                ↶ SX
                            </button>
                            <button type="button" className="pem-btn" onClick={() => handleRotate(90)} title="Ruota a destra 90°">
                                ↷ DX
                            </button>
                            {rotation !== 0 && (
                                <span className="pem-rotation-badge">{rotation}°</span>
                            )}
                        </div>
                    </div>

                    {/* Aspect ratio */}
                    <div className="pem-control-group">
                        <span className="pem-control-label">Proporzioni</span>
                        <div className="pem-btn-row pem-aspect-row">
                            {ASPECT_OPTIONS.map((opt, i) => (
                                <button
                                    key={opt.label}
                                    type="button"
                                    className={`pem-btn pem-btn-aspect ${aspectIdx === i ? 'active' : ''}`}
                                    onClick={() => setAspectIdx(i)}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Zoom slider */}
                    <div className="pem-control-group pem-zoom-group">
                        <span className="pem-control-label">Zoom {zoom.toFixed(1)}×</span>
                        <input
                            type="range"
                            className="pem-zoom-slider"
                            min={1}
                            max={3}
                            step={0.05}
                            value={zoom}
                            onChange={(e) => setZoom(Number(e.target.value))}
                        />
                    </div>
                </div>

                {/* ── Footer azioni ─────────────────────────────────────── */}
                <div className="pem-footer">
                    <button
                        type="button"
                        className="pem-btn-footer pem-btn-cancel"
                        onClick={onCancel}
                        disabled={isProcessing}
                    >
                        ✕ Annulla tutto
                    </button>

                    <div className="pem-footer-right">
                        <button
                            type="button"
                            className="pem-btn-footer pem-btn-skip"
                            onClick={handleSkip}
                            disabled={isProcessing}
                            title="Usa la foto originale senza modifiche"
                        >
                            Salta
                        </button>
                        <button
                            type="button"
                            className="pem-btn-footer pem-btn-confirm"
                            onClick={handleConfirm}
                            disabled={isProcessing}
                        >
                            {isProcessing ? '⏳ Elaborazione…' : (
                                index + 1 < files.length
                                    ? `Conferma → (${index + 2}/${files.length})`
                                    : '✅ Conferma e carica'
                            )}
                        </button>
                    </div>
                </div>

                {/* Nome file corrente */}
                <div className="pem-filename" title={currentFile?.name}>
                    {currentFile?.name}
                </div>
            </div>
        </div>
    );
}

export default PhotoEditModal;
