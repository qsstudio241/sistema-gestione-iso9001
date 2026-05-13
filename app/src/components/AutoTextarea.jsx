/**
 * AutoTextarea  textarea che si espande automaticamente al contenuto
 * + pulsante dettatura vocale (Web Speech API, it-IT) su browser compatibili.
 *
 * Riusabile ovunque serva una textarea libera: conclusioni, note checklist, ecc.
 * Props:
 *   className   classe CSS da applicare alla textarea (default: "outcome-textarea")
 *   onBlur      handler opzionale onBlur (es. per auto-save)
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
        />
      )}
    </div>
  );
}

export default AutoTextarea;
