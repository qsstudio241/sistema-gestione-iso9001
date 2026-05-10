/**
 * AutoTextarea — textarea che si espande automaticamente al contenuto
 * + pulsante dettatura vocale (Web Speech API, it-IT) su browser compatibili.
 *
 * Riusabile ovunque serva una textarea libera: conclusioni, note checklist, ecc.
 */
import { useEffect, useRef, useState } from "react";
import "./AutoTextarea.css";

function AutoTextarea({ id, value, onChange, placeholder, disabled, rows = 3 }) {
  const ref = useRef(null);
  const recognitionRef = useRef(null);
  const [isListening, setIsListening] = useState(false);

  const SpeechRecognition =
    typeof window !== "undefined" &&
    (window.SpeechRecognition || window.webkitSpeechRecognition);

  // Adatta l'altezza ogni volta che il valore cambia
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  }, [value]);

  const handleChange = (e) => {
    onChange(e);
  };

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
      const syntheticEvent = {
        target: { value: value ? value + " " + transcript : transcript },
      };
      onChange(syntheticEvent);
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
        className="outcome-textarea"
        rows={rows}
        value={value}
        onChange={handleChange}
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
          {isListening ? "?" : "??"}
        </button>
      )}
    </div>
  );
}

export default AutoTextarea;
