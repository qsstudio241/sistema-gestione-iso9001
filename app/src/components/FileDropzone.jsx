/**
 * FileDropzone — zona unica «trascina o clicca» per ogni caricamento file.
 * Variante zone: form/dialog. Variante compact: toolbar. Sempre anche il picker.
 */
import React, { useCallback, useRef, useState } from "react";
import "./FileDropzone.css";

const CLICK_MARK = "clicca per selezionare";

function renderLabel(text) {
  const idx = String(text).toLowerCase().indexOf(CLICK_MARK);
  if (idx < 0) return text;
  return (
    <>
      {text.slice(0, idx)}
      <strong>{text.slice(idx, idx + CLICK_MARK.length)}</strong>
      {text.slice(idx + CLICK_MARK.length)}
    </>
  );
}

export default function FileDropzone({
  accept,
  multiple = false,
  disabled = false,
  onFiles,
  hint,
  label,
  variant = "zone",
  inputRef,
  inputClassName,
  ariaLabel,
  title,
  testId,
  inputTestId,
  name,
  id,
  children,
}) {
  const localRef = useRef(null);
  const resolvedRef = inputRef || localRef;
  const [dragOver, setDragOver] = useState(false);

  const emit = useCallback((list) => {
    const files = Array.from(list || []);
    if (!files.length || disabled) return;
    onFiles?.(multiple ? files : files.slice(0, 1));
    if (resolvedRef.current) resolvedRef.current.value = "";
  }, [disabled, multiple, onFiles, resolvedRef]);

  const openPicker = () => {
    if (disabled) return;
    resolvedRef.current?.click();
  };

  const onKeyDown = (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openPicker();
    }
  };

  const text = label || (multiple
    ? "Trascina qui i file o clicca per selezionare"
    : "Trascina qui il file o clicca per selezionare");

  const className = [
    "file-dropzone",
    `file-dropzone--${variant}`,
    dragOver ? "file-dropzone--active" : "",
    disabled ? "file-dropzone--disabled" : "",
  ].filter(Boolean).join(" ");

  return (
    <div
      className={className}
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!disabled) setDragOver(true);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragOver(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragOver(false);
        emit(e.dataTransfer?.files);
      }}
      onClick={openPicker}
      onKeyDown={onKeyDown}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled || undefined}
      aria-label={ariaLabel || text}
      title={title}
      data-testid={testId}
    >
      {children || (
        <>
          {variant === "zone" && (
            <span className="file-dropzone-icon" aria-hidden="true">{"\uD83D\uDCC2"}</span>
          )}
          <span className="file-dropzone-text">{renderLabel(text)}</span>
          {hint ? <span className="file-dropzone-hint">{hint}</span> : null}
        </>
      )}
      <input
        ref={resolvedRef}
        type="file"
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        className={inputClassName || "file-dropzone-input"}
        onChange={(e) => emit(e.target.files)}
        onClick={(e) => e.stopPropagation()}
        name={name}
        id={id}
        data-testid={inputTestId}
        tabIndex={-1}
        aria-hidden="true"
      />
    </div>
  );
}
