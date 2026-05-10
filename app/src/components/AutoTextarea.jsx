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

const MicIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
    <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
    <line x1="12" y1="19" x2="12" y2="23"/>
    <line x1="8" y1="23" x2="16" y2="23"/>
  </svg>
);

const StopIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <rect x="4" y="4" width="16" height="16" rx="2"/>
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
