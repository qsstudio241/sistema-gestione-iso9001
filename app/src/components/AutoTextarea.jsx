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
        console.warn("[Voice] SpeechRecognition error:", e.error);
        // Errori transitori: onend gestisce l'auto-restart
        const transient = ["no-speech", "aborted"];
        if (transient.includes(e.error)) return;
        // Tutti gli altri errori non sono recuperabili con un semplice restart
        isListeningRef.current = false;
        clearTimeout(restartTimerRef.current);
        setIsListening(false);
        setVoiceError(e.error);
      };

      recognition.onend = () => {
        if (isListeningRef.current) {
          // Delay 150ms: Chrome richiede un gap prima di poter chiamare start() di nuovo.
          // Senza questo delay il pulsante torna inattivo silenziosamente su Desktop e Android.
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
      console.warn("[Voice] Impossibile avviare SpeechRecognition:", err.message);
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

    // Controlla lo stato del permesso prima di fare qualsiasi cosa.
    // Se è già "denied", mostra subito il messaggio invece di chiamare getUserMedia
    // (che fallirebbe silenziosamente senza mostrare alcun dialog).
    if (navigator.permissions?.query) {
      try {
        const perm = await navigator.permissions.query({ name: "microphone" });
        if (perm.state === "denied") {
          setVoiceError("not-allowed");
          return;
        }
      } catch {
        // permissions API non disponibile su questo browser — prosegui
      }
    }

    // Richiede esplicitamente il permesso microfono via getUserMedia prima di avviare
    // SpeechRecognition. Su Android Chrome (PWA shortcut o WebAPK) questa è l'unica
    // chiamata che fa comparire il dialog nativo di consenso. Senza di essa, Chrome
    // rigetta SpeechRecognition silenziosamente con "not-allowed".
    if (navigator.mediaDevices?.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((t) => t.stop()); // stream non serve, libera subito
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
