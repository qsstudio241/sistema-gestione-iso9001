import React, { useEffect, useState } from "react";
import apiService from "../services/apiService";
import FileDropzone from "./FileDropzone";
import "./WeldSketchPicker.css";

function SketchThumb({ sketch, selected, onSelect }) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    let revoked = false;
    let objectUrl = null;
    if (!sketch?.id) return undefined;
    Promise.resolve()
      .then(() => (typeof apiService.getWeldSketchBlob === "function"
        ? apiService.getWeldSketchBlob(sketch.id)
        : null))
      .then((blob) => {
        if (revoked || !blob) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => {
        if (!revoked) setUrl(null);
      });
    return () => {
      revoked = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [sketch?.id]);

  const label = sketch.score === 100
    ? "Schizzo della WPQR"
    : (sketch.source === "library" ? `Libreria (${sketch.score})` : sketch.slot);
  const statusNote = sketch.status === "da dividere"
    ? " \u2014 da dividere"
    : (sketch.status === "solo giunto"
      ? " \u2014 solo giunto, sequenza da caricare"
      : (sketch.status === "bozza" ? " \u2014 bozza, conferma in Rivedi" : ""));

  return (
    <button
      type="button"
      className={`wsk-thumb${selected ? " is-selected" : ""}`}
      onClick={() => onSelect(sketch)}
      data-testid={`wsk-thumb-${sketch.id}`}
      title={`${label}${statusNote}`}
    >
      {url
        ? <img src={url} alt={sketch.dimension_text || sketch.slot} />
        : <span className="wsk-thumb-fallback">PNG</span>}
      <span className="wsk-thumb-cap">
        {label}{statusNote}
        {sketch.dimension_text ? ` · ${sketch.dimension_text}` : ""}
      </span>
    </button>
  );
}

export default function WeldSketchPicker({
  suggestions = {},
  selectedJointId,
  selectedSequenceId,
  onChange,
  companyId,
  jointType,
  disabled = false,
}) {
  const combined = suggestions.combined || [];
  const joint = suggestions.joint_design || [];
  const sequence = suggestions.welding_sequence || [];
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState(null);

  async function handleFiles(files) {
    const file = files && files[0];
    if (!file) return;
    setUploading(true);
    setUploadErr(null);
    try {
      const res = await apiService.uploadWeldSketch(file, {
        company_id: companyId,
        slot: "combined",
        joint_type: jointType || "",
      });
      if (res?.sketch) {
        onChange({
          joint_sketch_id: res.sketch.id,
          sequence_sketch_id: null,
          combined: false,
        });
      }
    } catch (err) {
      setUploadErr(err.message || "Upload schizzo fallito");
    } finally {
      setUploading(false);
    }
  }

  function pick(sketch) {
    if (disabled) return;
    const leftoverCombined = selectedJointId != null
      && selectedSequenceId != null
      && Number(selectedJointId) === Number(selectedSequenceId);
    if (sketch.slot === "combined") {
      onChange({
        joint_sketch_id: sketch.id,
        sequence_sketch_id: null,
        combined: false,
      });
      return;
    }
    if (sketch.slot === "joint_design") {
      onChange({
        joint_sketch_id: sketch.id,
        sequence_sketch_id: leftoverCombined ? null : (selectedSequenceId || null),
        combined: false,
      });
      return;
    }
    onChange({
      joint_sketch_id: leftoverCombined ? null : (selectedJointId || null),
      sequence_sketch_id: sketch.id,
      combined: false,
    });
  }

  const hasAny = combined.length + joint.length + sequence.length > 0;

  return (
    <div className="wsk-picker" data-testid="wsk-picker">
      <div className="wp-form-section-title">Schizzi Annex A</div>
      <p className="wsk-hint">
        Joint design e Welding sequences restano due celle affiancate. Lo schizzo
        combinato va solo nel giunto; la sequenza resta vuota («Da dividere») finché
        non lo spezzi in Rivedi. Solo giunto: sequenza assente, da caricare a parte.
        Celle vuote nel Word: «Vedi allegato».
      </p>
      {!hasAny && (
        <p className="wsk-empty" data-testid="wsk-empty">Nessuno schizzo in libreria per questo giunto.</p>
      )}
      {combined.length > 0 && (
        <div className="wsk-row">
          <span className="wsk-row-label">Combinato (solo cella giunto, sequenza da dividere)</span>
          <div className="wsk-thumbs">
            {combined.map((s) => (
              <SketchThumb
                key={`c-${s.id}`}
                sketch={s}
                selected={Number(selectedJointId) === Number(s.id)
                  && (selectedSequenceId == null || Number(selectedSequenceId) === Number(s.id))}
                onSelect={pick}
              />
            ))}
          </div>
        </div>
      )}
      {joint.length > 0 && (
        <div className="wsk-row">
          <span className="wsk-row-label">Joint design</span>
          <div className="wsk-thumbs">
            {joint.map((s) => (
              <SketchThumb
                key={`j-${s.id}`}
                sketch={s}
                selected={selectedJointId === s.id}
                onSelect={pick}
              />
            ))}
          </div>
        </div>
      )}
      {sequence.length > 0 && (
        <div className="wsk-row">
          <span className="wsk-row-label">Welding sequences</span>
          <div className="wsk-thumbs">
            {sequence.map((s) => (
              <SketchThumb
                key={`s-${s.id}`}
                sketch={s}
                selected={selectedSequenceId === s.id}
                onSelect={pick}
              />
            ))}
          </div>
        </div>
      )}
      <FileDropzone
        accept="image/png,image/jpeg,.png,.jpg,.jpeg"
        disabled={disabled || uploading}
        onFiles={handleFiles}
        label={uploading ? "Caricamento…" : "Carica schizzo (PNG/JPG) — clicca per selezionare"}
        variant="compact"
        testId="wsk-upload"
      />
      {uploadErr && <p className="wsk-err">{uploadErr}</p>}
    </div>
  );
}

function needsHorizontalSplit(sketch) {
  return sketch
    && (sketch.status === "da dividere"
      || sketch.status === "solo giunto"
      || sketch.slot === "combined");
}

function SplitSketchControl({ sketch, busy, onSplit }) {
  const [url, setUrl] = useState(null);
  const [ratio, setRatio] = useState(0.5);

  useEffect(() => {
    let revoked = false;
    let objectUrl = null;
    if (!sketch?.id) return undefined;
    Promise.resolve()
      .then(() => (typeof apiService.getWeldSketchBlob === "function"
        ? apiService.getWeldSketchBlob(sketch.id)
        : null))
      .then((blob) => {
        if (revoked || !blob) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => {
        if (!revoked) setUrl(null);
      });
    return () => {
      revoked = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [sketch?.id]);

  return (
    <div className="wsk-split" data-testid={`wsk-split-${sketch.id}`}>
      <div className="wsk-split-preview">
        {url
          ? <img src={url} alt={sketch.dimension_text || "Schizzo combinato"} />
          : <span className="wsk-thumb-fallback">PNG</span>}
        <span className="wsk-split-line" style={{ top: `${Math.round(ratio * 100)}%` }} />
      </div>
      <label className="wsk-split-label">
        Linea di taglio (giunto sopra, sequenza sotto)
        <input
          type="range"
          min="10"
          max="90"
          step="1"
          value={Math.round(ratio * 100)}
          onChange={(e) => setRatio(Number(e.target.value) / 100)}
          data-testid={`wsk-split-slider-${sketch.id}`}
        />
      </label>
      <button
        type="button"
        className="wp-btn-save"
        disabled={busy}
        onClick={() => onSplit(sketch.id, ratio)}
        data-testid={`wsk-split-btn-${sketch.id}`}
      >
        {busy ? "Divisione\u2026" : "Dividi"}
      </button>
    </div>
  );
}

export function WpqrSketchReview({ wpqrId }) {
  const [sketches, setSketches] = useState([]);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState(null);

  const load = () => {
    if (!wpqrId || typeof apiService.getWpqrSketches !== "function") return;
    Promise.resolve(apiService.getWpqrSketches(wpqrId))
      .then((res) => setSketches((res && res.sketches) || []))
      .catch(() => setSketches([]));
  };

  useEffect(() => { load(); }, [wpqrId]);

  async function confirm(id) {
    setBusyId(id);
    setError(null);
    try {
      await apiService.confirmWeldSketch(id);
      load();
    } catch (err) {
      setError(err.message || "Conferma schizzo fallita");
    } finally {
      setBusyId(null);
    }
  }

  async function split(id, yRatio) {
    setBusyId(id);
    setError(null);
    try {
      await apiService.splitWeldSketch(id, { yRatio });
      load();
    } catch (err) {
      setError(err.message || "Divisione schizzo fallita");
    } finally {
      setBusyId(null);
    }
  }

  if (!wpqrId) return null;
  if (!sketches.length) return null;

  return (
    <div className="wsk-review" data-testid="wsk-review">
      <div className="wp-form-section-title">Schizzi estratti (Rivedi)</div>
      <p className="wsk-hint">
        Crop dal PDF in stato bozza. Se giunto e sequenza sono in un&apos;unica
        immagine, regola la linea e premi Dividi; poi conferma per la libreria.
        Solo giunto: lo schizzo è già la cella giunto; lo slider resta se vuoi
        dividere a mano.
      </p>
      {error && <p className="wsk-err">{error}</p>}
      <div className="wsk-thumbs">
        {sketches.map((s) => (
          <div key={s.id} className="wsk-review-item">
            {needsHorizontalSplit(s)
              ? (
                <SplitSketchControl
                  sketch={s}
                  busy={busyId === s.id}
                  onSplit={split}
                />
              )
              : (
                <SketchThumb sketch={s} selected={s.status === "confermato"} onSelect={() => {}} />
              )}
            {s.status !== "confermato" && (
              <button
                type="button"
                className="wp-btn-save"
                disabled={busyId === s.id}
                onClick={() => confirm(s.id)}
                data-testid={`wsk-confirm-${s.id}`}
              >
                {busyId === s.id ? "Conferma\u2026" : "Conferma"}
              </button>
            )}
            {s.status === "confermato" && <span className="wsk-ok">Confermato</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
