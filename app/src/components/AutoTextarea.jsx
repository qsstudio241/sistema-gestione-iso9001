/**
 * AutoTextarea — textarea che si espande automaticamente al contenuto
 * + pulsante dettatura vocale (Web Speech API, it-IT) su browser compatibili.
 *
 * Riusabile ovunque serva una textarea libera: conclusioni, note checklist, ecc.
 * Props:
 *   className  — classe CSS da applicare alla textarea (default: "outcome-textarea")
 *   onBlur     — handler opzionale onBlur (es. per auto-save)
 */
import { useEffect, useRef, useState } from "react";
import "./AutoTextarea.css";

/* Icona microfono filled (Material Design) — più affidabile cross-browser del stroked */
const MicIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="#374151" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
    <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
  </svg>
);

const StopIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="#dc2626" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M6 6h12v12H6z"/>
  </svg>
);

function AutoTextarea({
  id,
  value,
  onChange,
  onBlur,
  placeholder,
  disabled,
  rows = 3,
  className = "outcome-textarea",
}) {
  const ref = useRef(null);
  const recognitionRef = useRef(null);
  const [isListening, setIsListening] = useState(false);

  const SpeechRecognition =
    typeof window !== "undefined" &&
    (window.SpeechRecognition || window.webkitSpeechRecognition);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  }, [value]);

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = "it-IT";
    recognition.continuous = true;
    recognition.interimResults = false;

    recognition.onresult = (e) => {
      const transcript = Array.from(e.results)
        .map((r) => r[0].transcript)
        .join(" ");
      onChange({ target: { value: value ? value + " " + transcript : transcript } });
    };

    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);

    recognition.start();
    recognitionRef.current = recognition;
    setIsListening(true);
  };

  return (
    <div className="auto-textarea-wrapper">
      <textarea
        ref={ref}
        id={id}
        className={className}
        rows={rows}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        placeholder={placeholder}
        disabled={disabled}
      />
      {SpeechRecognition && !disabled && (
        <button
          type="button"
          className={`voice-btn${isListening ? " voice-btn--active" : ""}`}
          onClick={toggleListening}
          title={isListening ? "Ferma dettatura" : "Dettatura vocale (it-IT)"}
          aria-label={isListening ? "Ferma dettatura" : "Avvia dettatura vocale"}
        >
          {isListening ? <StopIcon /> : <MicIcon />}
        </button>
      )}
    </div>
  );
}

export default AutoTextarea;
