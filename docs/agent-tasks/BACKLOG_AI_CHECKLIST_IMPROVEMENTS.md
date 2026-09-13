# Backlog miglioramenti AI Assistant quesiti checklist

**Creato**: 13/09/2026  
**Stato baseline**: PR #678 merged (funzionalità core operativa)  
**Review programmata**: Dopo 2-4 settimane uso reale in campo

---

## Strategia di sviluppo

**Principio guida:** Non implementare miglioramenti "perché figo". Implementare quando **metriche/feedback** dimostrano valore > effort.

**Gate decisionale:**
1. Raccogliere feedback uso reale (2-4 settimane)
2. Analizzare metriche quantitative (vedi sotto)
3. Identificare pain point reali
4. Prioritizzare secondo impatto/effort
5. Implementare solo se ROI dimostrabile

---

## 1. History conversazione (PRIORITÀ 1)

### Descrizione
Memorizzare le domande/risposte precedenti sullo stesso quesito per permettere follow-up senza ripetere contesto.

### Valore atteso
- Auditor: "Valuta conformità" → "Ok, ma cosa manca esattamente?" → "Genera bozza note" senza ripetere il contesto
- Riduzione click: stimato 5-10 click/audit risparmiati

### Metriche da osservare (prima di implementare)
- **% user che ri-clicca AI sullo stesso quesito**: Se > 30% → alta priorità
- **Tempo medio tra primo click e secondo click**: Se < 2 minuti → user sta facendo follow-up
- **Numero medio domande per quesito**: Se > 1.5 → history utile

### Implementazione tecnica
```javascript
// QuestionAiPanel.jsx
const [chatHistory, setChatHistory] = useState(() => 
  loadChatHistory(`q${questionId}_${auditId}`) || []
);

// Dopo ogni risposta
setChatHistory(prev => [...prev, 
  {role: 'user', mode, timestamp: Date.now()},
  {role: 'assistant', answer, citations, timestamp: Date.now()}
]);
saveChatHistory(`q${questionId}_${auditId}`, chatHistory);

// UI: thread sopra chip mode
<div className="chat-thread">
  {chatHistory.map((msg, i) => (
    <ChatMessage key={i} message={msg} />
  ))}
</div>
```

### Storage
- `localStorage`: `ai_chat_history_q${questionId}_${auditId}` (JSON array)
- Limite: ultimi 10 messaggi per quesito (evitare localStorage bloat)
- Clear: quando audit completato o quesito cambia status

### Effort stimato
- **2 giorni** (1 giorno dev + 1 giorno test + CSS thread)

---

## 2. Streaming response (PRIORITÀ 2)

### Descrizione
Mostrare la risposta AI progressivamente (char-by-char o word-by-word) invece di attendere risposta completa.

### Valore atteso
- Percezione latenza ridotta: user vede "sta pensando" invece di spinner statico
- UX standard AI moderna (ChatGPT, Claude)
- Riduce anxiety "è crashato?"

### Metriche da osservare
- **Latency p95 AI response**: Se > 15s → streaming prioritario
- **Feedback user**: "sembra bloccato" / "non capisco se sta lavorando"
- **Bounce rate AI panel**: User chiude pannello prima di ricevere risposta?

### Implementazione tecnica
```javascript
// Backend: aiProviderAdapter.js già supporta stream Gemini
async function chatStream(messages, options, onChunk) {
  const stream = await geminiAdapter.chatStream(messages, options);
  for await (const chunk of stream) {
    onChunk(chunk.text);
  }
}

// Frontend: QuestionAiPanel.jsx
const [streamingText, setStreamingText] = useState('');

// EventSource o fetch con ReadableStream
const response = await fetch('/ai/question-assistant', {
  method: 'POST',
  headers: {'Accept': 'text/event-stream'}
});
const reader = response.body.getReader();
while (true) {
  const {done, value} = await reader.read();
  if (done) break;
  setStreamingText(prev => prev + decoder.decode(value));
}
```

### Effort stimato
- **3-4 giorni** (2 giorni backend SSE + 1 giorno frontend + 1 giorno test)

---

## 3. Auto-apply esito suggerito (PRIORITÀ 3)

### Descrizione
Quando AI suggerisce esito diverso da quello corrente, evidenziare visivamente o pre-selezionare il pulsante status.

### Valore atteso
- Riduzione click: 1 click risparmiato se user concorda con AI
- Visual guidance: auditor vede subito quale status AI suggerisce

### ⚠️ Rischio UX
- **Auto-apply cieco pericoloso**: Auditor esperto vuole controllo, non automazione
- Preferire: **visual hint** (badge "🤖 AI suggerisce") invece di auto-selezione

### Metriche da osservare
- **% volte user cambia status dopo risposta AI**: Se > 50% → utile
- **% concordanza AI-user su esito**: Se < 70% → auto-apply rischioso
- **Feedback user**: "AI mi ha cambiato lo status senza che me ne accorgessi"

### Implementazione tecnica (SAFE VERSION)
```jsx
// QuestionCard.jsx
const aiSuggestedStatus = response?.suggestedStatus;

<div className="status-buttons">
  {['C', 'NC', 'OSS', 'OM', 'NA', 'NV'].map(s => (
    <button 
      className={`status-btn ${s.toLowerCase()} ${currentStatus === s ? 'active' : ''} ${aiSuggestedStatus === s ? 'ai-suggested' : ''}`}
      onClick={() => onStatusChange(s)}
    >
      {aiSuggestedStatus === s && <span className="ai-badge">🤖</span>}
      {s}
    </button>
  ))}
</div>

// CSS
.status-btn.ai-suggested {
  animation: pulse 2s infinite;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.3);
}
```

### Effort stimato
- **1-2 giorni** (1 giorno backend suggestedStatus extraction + 1 giorno CSS animation)

---

## 4. OCR real-time ibrido (PRIORITÀ 4)

### Descrizione
Estratto testo allegati al momento del click AI (real-time) invece che in batch post-upload, per file piccoli. File grandi restano batch background.

### Valore atteso
- UX migliore: upload PDF → click AI → risposta immediata (no "attendi indicizzazione")
- Mobile workflow: foto documento sul campo → analisi subito

### Metriche da osservare
- **% allegati > 5 MB**: Se < 10% → OCR real-time fattibile
- **Timeout AI request per OCR**: Se > 5% requests → problema latenza
- **Feedback user**: "devo tornare dopo per avere risposta"
- **% allegati con extractedText già in cache**: Se > 70% → OCR real-time inutile (cache hit)

### Implementazione tecnica (IBRIDA)
```javascript
// Backend: questionAssistant.controller.js
async function prepareAttachmentText(attachment) {
  // Cache hit: usa subito
  if (attachment.extractedText) {
    return attachment.extractedText;
  }
  
  // Small file: OCR real-time
  const size = await getFileSize(attachment.storagePath);
  if (size < 2 * 1024 * 1024) { // < 2 MB
    return await extractDocumentText(attachment.storagePath);
  }
  
  // Large file: schedule background + placeholder
  scheduleBackgroundOCR(attachment.id);
  return "[Documento in elaborazione. Riprova tra 2 minuti per includere il contenuto del file.]";
}
```

### ⚠️ Trade-off
| Pro | Contro |
|-----|--------|
| UX immediata per file piccoli | Latenza user-visible 5-15s |
| No "torna dopo" workflow | Timeout risk se file > atteso |
| Mobile-friendly | No caching (ogni click = nuovo OCR) |

### Effort stimato
- **2-3 giorni** (1 giorno size check + retry logic + 1 giorno test + 1 giorno tuning timeout)

---

## 5. pgvector / FAISS (PRIORITÀ 5)

### Descrizione
Sostituire cosine similarity brute-force in-memory con indicizzazione vettoriale ottimizzata (pgvector PostgreSQL o FAISS Python).

### Valore atteso
- Retrieval più veloce: da O(N) a O(log N)
- Scalabilità: supporta > 100k chunks senza degradazione

### Metriche da osservare
- **Numero totale chunks in norm_chunks**: Se > 10k → considerare
- **Latency p95 retrieval**: Se > 100ms → utenti percepiscono lag
- **Numero norme caricate per org**: Se > 20 norme complete → volume alto

### ⚠️ Quando NON serve
- PMI tipica: 2-3 norme (ISO 9001 + 14001 o 3834) = ~2k chunks
- Brute-force cosine: 5-10ms su 2k chunks (impercettibile)
- Cache 5min TTL: retrieval ammortizzato su query ripetute

### Implementazione tecnica (SE necessario)
```python
# Backend: nuovo servizio Python con FAISS
import faiss
import numpy as np

# Build index
embeddings = np.array([chunk['_vec'] for chunk in chunks])
index = faiss.IndexFlatIP(embeddings.shape[1])  # Inner Product = cosine se normalized
index.add(embeddings)

# Search
query_vec = embed(query_text)
D, I = index.search(np.array([query_vec]), topK)
return [chunks[i] for i in I[0]]
```

### Effort stimato
- **1-2 settimane** (nuovo microservizio Python + comunicazione Node↔Python + test + deploy)

---

## Metriche da raccogliere (dashboard post-deploy)

### Utilizzo
- **Click AI per quesito**: Media, mediana, p95
- **Mode più usati**: % per mode (conformity/gap/interpretation/draft/om)
- **% quesiti con AI usata**: Copertura funzionalità

### Performance
- **Latency AI response**: p50, p95, p99
- **Timeout rate**: % request > 90s
- **RAG retrieval time**: p50, p95 (solo quando norm_chunks presente)

### Qualità
- **% risposte con fonte ufficiale**: has_chunks=true vs false
- **% notifiche admin inviate**: Quante org usano AI senza norme
- **User satisfaction** (opzionale): Thumbs up/down su risposta AI

### Engagement
- **% user che applicano suggerimento AI**: Click "Applica a Note" / "Cambia esito"
- **Retention**: User torna a usare AI su altri quesiti?
- **Follow-up rate**: % click AI ripetuti sullo stesso quesito (→ history utile)

---

## Decisioni implementazione future

### Gate per ogni miglioramento

Prima di implementare un item dal backlog:

1. ✅ **Dati quantitativi**: Metriche sopra raccolte per ≥ 2 settimane
2. ✅ **Feedback qualitativo**: Interviste/survey auditor reali
3. ✅ **Pain point identificato**: Non "nice to have", ma "blocker workflow"
4. ✅ **ROI stimato**: Tempo risparmiato user > effort dev
5. ✅ **No alternative semplici**: Non esiste workaround UX/doc

### Review programmata

**Data**: 1 mese dopo deploy (metà ottobre 2026)  
**Partecipanti**: Lead dev + committente + 2-3 auditor beta user  
**Agenda**:
- Review metriche dashboard
- Identificare top 2 pain point
- Decidere priorità backlog

---

## Note implementazione

### Storage chat history
- `localStorage` OK per MVP (no sync cross-device)
- Se necessario sync: tabella `ai_chat_history` (audit_id, question_id, messages JSON)

### Streaming SSE
- Gemini già supporta stream nativo
- Anthropic: usare `stream: true` in API call
- Fallback: se provider non supporta, risposta completa (graceful degradation)

### OCR timeout
- Attuale `AI_REQUEST_TIMEOUT_MS=90000` (90s)
- Con OCR real-time: considerare timeout dinamico basato su file size
- Alternativa: mostrar progress bar OCR separata da AI thinking

### pgvector alternative
- Azure Cognitive Search (SaaS, $$)
- Elasticsearch vector search (self-hosted, heavy)
- Qdrant (specializzato vector, leggero)
- FAISS (in-memory, velocissimo, no persistence native)

---

## Link riferimenti

- **Issue tracker**: TODO (creare GitHub Issues per tracking)
- **ADR-010**: [AI Agentic Architecture](../adr/ADR-010-ai-agentic-architecture.md)
- **DEPUTYTASK baseline**: [DEPUTYTASK_AI_CHECKLIST.md](DEPUTYTASK_AI_CHECKLIST.md)
- **Metriche dashboard**: TODO (dopo setup telemetry)

---

**Regola d'oro finale**: Il sistema ora è production-ready. Meglio osservare uso reale 2-4 settimane prima di aggiungere complessità. Non implementare per "completezza", ma solo quando metriche/feedback dimostrano necessità reale.
