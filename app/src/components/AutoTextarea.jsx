/**
 * AutoTextarea - textarea che si espande automaticamente al contenuto
 * + pulsante dettatura vocale (Web Speech API, it-IT) su browser compatibili.
 *
 * Note compatibilità:
 * - Android Chrome: non supporta `continuous:true`. Il riconoscimento termina
 *   dopo ogni pausa; il componente lo riavvia automaticamente dopo 150ms.
 * - PWA Android (shortcut o WebAPK): il permesso microfono viene richiesto
 *   esplicitamente via getUserMedia() prima di avviare SpeechRecognition.
 *   Senza questa chiamata Chrome non mostra il dialog di consenso nativo e
 *   rigetta silenziosamente la sessione.
 */
import { useEffect, useRef, useState } from "react";
import "./AutoTextarea.css";

const RESTART_DELAY_MS = 150;
const MIC_DEBUG_BUILD = "v5"; // incrementa ad ogni modifica debug — visibile sul pulsante

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
  const [debugLines, setDebugLines] = useState([]);

  const SpeechRecognition =
    typeof window !== "undefined" &&
    (window.SpeechRecognition || window.webkitSpeechRecognition);

  const dbg = (msg) => {
    console.log("[MIC-DIAG]", msg);
    setDebugLines((prev) => [...prev.slice(-19), `${new Date().toLocaleTimeString()} ${msg}`]);
  };

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

      dbg(`5. recognition creata lang=${recognition.lang}`);

      recognition.onstart = () => dbg("6. onstart — ascolto attivo");

      recognition.onresult = (e) => {
        const transcript = Array.from(e.results).map((r) => r[0].transcript).join(" ");
        dbg(`7. onresult: "${transcript}"`);
        if (transcript) {
          const current = valueRef.current;
          onChange({ target: { value: current ? current + " " + transcript : transcript } });
        }
      };

      recognition.onerror = (e) => {
        dbg(`8. onerror: ${e.error} — ${e.message || ""}`);
        const transient = ["no-speech", "aborted"];
        if (transient.includes(e.error)) return;
        isListeningRef.current = false;
        clearTimeout(restartTimerRef.current);
        setIsListening(false);
        setVoiceError(e.error);
      };

      recognition.onend = () => {
        dbg(`9. onend — isListening=${isListeningRef.current}`);
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
      dbg(`startRecognition ECCEZIONE: ${err.name} ${err.message}`);
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

    dbg(`1. click — SpeechRec=${!!SpeechRecognition} mediaDevices=${!!navigator.mediaDevices} permissions=${!!navigator.permissions}`);

    if (navigator.permissions?.query) {
      try {
        const perm = await navigator.permissions.query({ name: "microphone" });
        dbg(`2. permissions.query stato: ${perm.state}`);
        if (perm.state === "denied") {
          dbg("? permesso già negato");
          setVoiceError("not-allowed");
          return;
        }
      } catch (err) {
        dbg(`2. permissions.query N/A: ${err.message}`);
      }
    }

    if (navigator.mediaDevices?.getUserMedia) {
      try {
        dbg("3. getUserMedia richiesto...");
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        dbg(`3. getUserMedia OK — tracce: ${stream.getTracks().length}`);
        stream.getTracks().forEach((t) => t.stop());
      } catch (err) {
        dbg(`3. getUserMedia ERRORE: ${err.name} ${err.message}`);
        setVoiceError("not-allowed");
        return;
      }
    } else {
      dbg("3. getUserMedia non disponibile");
    }

    dbg("4. avvio SpeechRecognition...");
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
            title={`[${MIC_DEBUG_BUILD}] ${voiceError ? "Errore — tocca per riprovare" : isListening ? "Ferma dettatura" : "Dettatura vocale (it-IT)"}`}
            aria-label={voiceError ? "Errore microfono" : isListening ? "Ferma dettatura" : "Avvia dettatura vocale"}
          />
          {errorMessage && <p className="voice-perm-error">{errorMessage}</p>}
          {debugLines.length > 0 && (
            <div style={{
              marginTop: 6, padding: "6px 8px", background: "#1e1e1e", borderRadius: 6,
              fontFamily: "monospace", fontSize: 11, color: "#d4d4d4", maxHeight: 180,
              overflowY: "auto", lineHeight: 1.5,
            }}>
              <div style={{ color: "#888", marginBottom: 4 }}>
                ?? Mic debug {MIC_DEBUG_BUILD} — tocca per copiare
              </div>
              {debugLines.map((line, i) => (
                <div key={i} style={{ color: line.includes("ERRORE") || line.includes("negato") ? "#f48771" : "#d4d4d4" }}>
                  {line}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default AutoTextarea;
