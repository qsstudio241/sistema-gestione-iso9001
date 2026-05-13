/**
 * AutoTextarea - textarea che si espande automaticamente al contenuto
 * + pulsante dettatura vocale (Web Speech API, it-IT) su browser compatibili.
 *
 * Riusabile ovunque serva una textarea libera: conclusioni, note checklist, ecc.
 * Props:
 *   className  - classe CSS da applicare alla textarea (default: "outcome-textarea")
 *   onBlur     - handler opzionale onBlur (es. per auto-save)
 *
 * Nota Android: Chrome per Android non supporta `continuous: true`. Il riconoscimento
 * si interrompe dopo ogni pausa; viene riavviato automaticamente finche' l'utente non
 * tocca di nuovo il pulsante (simula la modalita' continua).
 */
import { useEffect, useRef, useState } from "react";
import "./AutoTextarea.css";


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
  const isListeningRef = useRef(false);
  const valueRef = useRef(value);
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

  // Mantiene valueRef aggiornato per evitare stale closures nelle callback
  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  const stopListening = () => {
    isListeningRef.current = false;
    setIsListening(false);
    try { recognitionRef.current?.stop(); } catch { /* ignorato */ }
  };

  const startRecognition = () => {
    const recognition = new SpeechRecognition();
    recognition.lang = "it-IT";
    recognition.continuous = false; // Android Chrome non supporta continuous: true
    recognition.interimResults = false;

    recognition.onresult = (e) => {
      const transcript = Array.from(e.results)
        .map((r) => r[0].transcript)
        .join(" ");
      if (transcript) {
        const current = valueRef.current;
        onChange({ target: { value: current ? current + " " + transcript : transcript } });
      }
    };

    recognition.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        // Permesso microfono negato: ferma definitivamente
        isListeningRef.current = false;
        setIsListening(false);
      }
      // Altri errori transitori: onend gestisce il restart
    };

    recognition.onend = () => {
      if (isListeningRef.current) {
        // Android: sessione terminata dopo pausa -> riavvio automatico
        try {
          startRecognition();
        } catch {
          isListeningRef.current = false;
          setIsListening(false);
        }
      } else {
        setIsListening(false);
      }
    };

    recognition.start();
    recognitionRef.current = recognition;
  };

  const toggleListening = () => {
    if (isListeningRef.current) {
      stopListening();
      return;
    }
    isListeningRef.current = true;
    setIsListening(true);
    startRecognition();
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
        />
      )}
    </div>
  );
}

export default AutoTextarea;
