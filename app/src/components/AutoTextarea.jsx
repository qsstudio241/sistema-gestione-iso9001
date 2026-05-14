/**
 * AutoTextarea - textarea che si espande automaticamente al contenuto
 * + pulsante dettatura vocale (Web Speech API, it-IT) su browser compatibili.
 *
 * Note compatibilità:
 * - Android Chrome: non supporta `continuous:true`. Il riconoscimento termina
 *   dopo ogni pausa; il componente lo riavvia automaticamente dopo 150ms.
 * - PWA Android (shortcut o WebAPK): il permesso microfono viene richiesto
 *   esplicitamente via getUserMedia() prima di avviare SpeechRecognition.
 *   Senza questa chiamata Chrome non mostra il dialog di consenso nativo.
 * - L'header HTTP Permissions-Policy deve includere microphone=(self)
 *   nel netlify.toml (o equivalente) altrimenti il browser blocca tutto.
 */
import { useEffect, useRef, useState } from "react";
import "./AutoTextarea.css";

const RESTART_DELAY_MS = 150;

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
  const restartTimerRef = useRef(null);
  const [isListening, setIsListening] = useState(false);
  const [voiceError, setVoiceError] = useState(null);

  const SpeechRecognition =
    typeof window !== "undefined" &&
    (window.SpeechRecognition || window.webkitSpeechRecognition);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  }, [value]);

  useEffect(() => { valueRef.current = value; }, [value]);

  useEffect(() => {
    return () => {
      clearTimeout(restartTimerRef.current);
      isListeningRef.current = false;
      try { recognitionRef.current?.stop(); } catch { /* ignorato */ }
    };
  }, []);

  const stopListening = () => {
    isListeningRef.current = false;
    clearTimeout(restartTimerRef.current);
    setIsListening(false);
    try { recognitionRef.current?.stop(); } catch { /* ignorato */ }
  };

  const startRecognition = () => {
    try {
      const recognition = new SpeechRecognition();
      recognition.lang = "it-IT";
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onresult = (e) => {
        const transcript = Array.from(e.results).map((r) => r[0].transcript).join(" ");
        if (transcript) {
          const current = valueRef.current;
          onChange({ target: { value: current ? current + " " + transcript : transcript } });
        }
      };

      recognition.onerror = (e) => {
        const transient = ["no-speech", "aborted"];
        if (transient.includes(e.error)) return;
        isListeningRef.current = false;
        clearTimeout(restartTimerRef.current);
        setIsListening(false);
        setVoiceError(e.error);
      };

      recognition.onend = () => {
        if (isListeningRef.current) {
          restartTimerRef.current = setTimeout(() => {
            if (isListeningRef.current) startRecognition();
          }, RESTART_DELAY_MS);
        } else {
          setIsListening(false);
        }
      };

      recognition.start();
      recognitionRef.current = recognition;
    } catch (err) {
      isListeningRef.current = false;
      setIsListening(false);
      setVoiceError("unavailable");
    }
  };

  const toggleListening = async () => {
    setVoiceError(null);
    if (isListeningRef.current) {
      stopListening();
      return;
    }

    if (navigator.permissions?.query) {
      try {
        const perm = await navigator.permissions.query({ name: "microphone" });
        if (perm.state === "denied") {
          setVoiceError("not-allowed");
          return;
        }
      } catch {
        // permissions API non disponibile — prosegui
      }
    }

    if (navigator.mediaDevices?.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((t) => t.stop());
      } catch {
        setVoiceError("not-allowed");
        return;
      }
    }

    isListeningRef.current = true;
    setIsListening(true);
    startRecognition();
  };

  const ERROR_MESSAGES = {
    "not-allowed":
      "Microfono bloccato. Vai in Impostazioni Android \u2192 App \u2192 Chrome \u2192 Autorizzazioni \u2192 Microfono \u2192 Consenti. Poi riprova.",
    "service-not-allowed":
      "Servizio vocale non disponibile. Prova: Impostazioni Android \u2192 App \u2192 Google \u2192 Autorizzazioni \u2192 Microfono \u2192 Consenti.",
    "audio-capture":
      "Microfono non accessibile. Un'altra app potrebbe averlo occupato. Chiudi altre app e riprova.",
    "network":
      "Connessione assente. La dettatura richiede internet. Riprova con connessione attiva.",
    "language-not-supported":
      "Lingua it-IT non supportata su questo dispositivo.",
    "unavailable":
      "Dettatura non disponibile su questo browser. Usa Chrome o Edge.",
  };

  const errorMessage = voiceError
    ? (ERROR_MESSAGES[voiceError] ?? `Errore dettatura: ${voiceError}`)
    : null;

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
        <>
          <button
            type="button"
            className={`voice-btn${isListening ? " voice-btn--active" : ""}${voiceError ? " voice-btn--error" : ""}`}
            onClick={toggleListening}
            title={voiceError ? "Errore microfono — tocca per riprovare" : isListening ? "Ferma dettatura" : "Dettatura vocale (it-IT)"}
            aria-label={voiceError ? "Errore microfono" : isListening ? "Ferma dettatura" : "Avvia dettatura vocale"}
          />
          {errorMessage && <p className="voice-perm-error">{errorMessage}</p>}
        </>
      )}
    </div>
  );
}

export default AutoTextarea;
