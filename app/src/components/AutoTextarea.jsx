/**
 * AutoTextarea - textarea che si espande automaticamente al contenuto
 * + pulsante dettatura vocale (Web Speech API, it-IT) su browser compatibili.
 *
 * Note compatibilità:
 * - Android Chrome: non supporta `continuous:true`. Il riconoscimento termina
 *   dopo ogni pausa; il componente lo riavvia automaticamente dopo 150ms
 *   (delay necessario per Chrome: se si chiama start() subito in onend,
 *   la sessione non parte e il pulsante torna inattivo silenziosamente).
 * - PWA Android (shortcut o WebAPK): il permesso microfono viene richiesto
 *   esplicitamente via getUserMedia() prima di avviare SpeechRecognition.
 *   Senza questa chiamata Chrome non mostra il dialog di consenso nativo e
 *   rigetta silenziosamente la sessione. Se bloccato, il messaggio di errore
 *   guida l'utente a Chrome ? Impostazioni sito ? Microfono.
 */
import { useEffect, useRef, useState } from "react";
import "./AutoTextarea.css";

const RESTART_DELAY_MS = 150; // Chrome richiede un breve gap tra onend e il prossimo start()

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
  const [voiceError, setVoiceError] = useState(null); // null | "not-allowed" | "unavailable"

  const SpeechRecognition =
    typeof window !== "undefined" &&
    (window.SpeechRecognition || window.webkitSpeechRecognition);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  }, [value]);

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  // Pulizia timer al dismiss del componente
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
      recognition.continuous = false;   // Android Chrome non supporta true
      recognition.interimResults = false;

      console.log("[MIC-DIAG] 5. recognition creata, lang:", recognition.lang);

      recognition.onstart = () => {
        console.log("[MIC-DIAG] 6. onstart — ascolto attivo");
      };

      recognition.onresult = (e) => {
        const transcript = Array.from(e.results)
          .map((r) => r[0].transcript)
          .join(" ");
        console.log("[MIC-DIAG] 7. onresult transcript:", transcript);
        if (transcript) {
          const current = valueRef.current;
          onChange({ target: { value: current ? current + " " + transcript : transcript } });
        }
      };

      recognition.onerror = (e) => {
        console.log("[MIC-DIAG] 8. onerror — error:", e.error, "message:", e.message);
        const transient = ["no-speech", "aborted"];
        if (transient.includes(e.error)) return;
        isListeningRef.current = false;
        clearTimeout(restartTimerRef.current);
        setIsListening(false);
        setVoiceError(e.error);
      };

      recognition.onend = () => {
        console.log("[MIC-DIAG] 9. onend — isListeningRef:", isListeningRef.current);
        if (isListeningRef.current) {
          restartTimerRef.current = setTimeout(() => {
            if (isListeningRef.current) {
              startRecognition();
            }
          }, RESTART_DELAY_MS);
        } else {
          setIsListening(false);
        }
      };

      recognition.start();
      recognitionRef.current = recognition;
    } catch (err) {
      console.log("[MIC-DIAG] startRecognition ECCEZIONE:", err.name, err.message);
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

    console.log("[MIC-DIAG] 1. toggleListening avviato");
    console.log("[MIC-DIAG] SpeechRecognition disponibile:", !!SpeechRecognition);
    console.log("[MIC-DIAG] navigator.mediaDevices:", !!navigator.mediaDevices);
    console.log("[MIC-DIAG] navigator.permissions:", !!navigator.permissions);

    if (navigator.permissions?.query) {
      try {
        const perm = await navigator.permissions.query({ name: "microphone" });
        console.log("[MIC-DIAG] 2. permissions.query stato:", perm.state);
        if (perm.state === "denied") {
          console.log("[MIC-DIAG] ? permesso già negato, esco");
          setVoiceError("not-allowed");
          return;
        }
      } catch (err) {
        console.log("[MIC-DIAG] 2. permissions.query non disponibile:", err.message);
      }
    }

    if (navigator.mediaDevices?.getUserMedia) {
      try {
        console.log("[MIC-DIAG] 3. getUserMedia richiesto...");
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        console.log("[MIC-DIAG] 3. getUserMedia OK, tracce:", stream.getTracks().length);
        stream.getTracks().forEach((t) => t.stop());
      } catch (err) {
        console.log("[MIC-DIAG] 3. getUserMedia ERRORE:", err.name, err.message);
        setVoiceError("not-allowed");
        return;
      }
    } else {
      console.log("[MIC-DIAG] 3. getUserMedia non disponibile");
    }

    console.log("[MIC-DIAG] 4. Avvio SpeechRecognition...");
    isListeningRef.current = true;
    setIsListening(true);
    startRecognition();
  };

  const ERROR_MESSAGES = {
    "not-allowed":
      "Microfono bloccato. Vai in Impostazioni Android \u2192 App \u2192 Chrome \u2192 Autorizzazioni \u2192 Microfono \u2192 Consenti. Poi riprova.",
    "service-not-allowed":
      "Servizio vocale non disponibile. Verifica che l'app Google abbia il permesso microfono: Impostazioni Android \u2192 App \u2192 Google \u2192 Autorizzazioni \u2192 Microfono \u2192 Consenti.",
    "audio-capture":
      "Microfono non accessibile. Un'altra app potrebbe averlo occupato. Chiudi altre app e riprova.",
    "network":
      "Connessione assente. La dettatura richiede internet (audio inviato ai server Google). Riprova con connessione attiva.",
    "language-not-supported":
      "Lingua it-IT non supportata su questo dispositivo.",
    "unavailable":
      "Dettatura non disponibile su questo browser. Usa Chrome o Edge.",
  };

  const errorMessage = voiceError
    ? (ERROR_MESSAGES[voiceError] ?? `Errore dettatura: ${voiceError}. Riprova o usa Edge.`)
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
            title={
              voiceError
                ? "Errore microfono — tocca per riprovare"
                : isListening
                ? "Ferma dettatura"
                : "Dettatura vocale (it-IT)"
            }
            aria-label={
              voiceError
                ? "Errore microfono"
                : isListening
                ? "Ferma dettatura"
                : "Avvia dettatura vocale"
            }
          />
          {errorMessage && (
            <p className="voice-perm-error">{errorMessage}</p>
          )}
        </>
      )}
    </div>
  );
}

export default AutoTextarea;
