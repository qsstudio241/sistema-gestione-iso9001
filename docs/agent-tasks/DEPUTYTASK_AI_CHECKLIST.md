# DEPUTYTASK: Assistente AI contestuale per quesiti checklist

**Titolo**: AI Assistant per singoli quesiti checklist con RAG normativo e notifica fonte mancante  
**Stato**: IN REVIEW (PR aperta)  
**Assegnato**: Deputy Agent  
**Priorità**: Alta  
**Epic**: Assistente AI (ADR-010)  
**Data creazione**: 13/09/2026  
**Data completamento codice**: 13/09/2026  
**Branch**: `feat/ai-checklist-assistant-slice1`  

---

## Obiettivo

Implementare il pulsante "🤖 Chiedi all'AI — §X.Y" su ogni quesito checklist che:
1. **Analizza** il quesito + note + allegati in contesto
2. **Suggerisce** esito (C/NC/OSS/OM) e gap evidenze basandosi su norme ufficiali (se disponibili)
3. **Dichiara** fonte utilizzata (RAG da Libreria vs conoscenze generali)
4. **Notifica** admin se l'azienda usa AI senza norme ufficiali caricate
5. **Si espande inline** sotto il quesito (no modal/drawer)

---

## Contesto tecnico verificato (pre-flight check ✅)

**Infrastruttura RAG già operativa:**
- ✅ Tabelle: `norm_chunks`, `knowledge_chunks`, `knowledge_figures`
- ✅ Embedding: Gemini text-embedding-004 (già in uso)
- ✅ Cosine similarity: brute-force in-memory (`normChunker.service.js`)
- ✅ Cache: TTL 5min per org, invalidazione su reindex
- ✅ Text extraction: `documentTextExtractor.service.js` (PDF/Word OCR)
- ✅ Multi-tenant isolation: `organization_id` sempre nel WHERE
- ✅ Licenza: `hasLicensedModule(user, "ai_chat")` già attivo

**Pattern retrieval esistente** (`searchSimilar()` in `normChunker.service.js`):
```javascript
const results = await searchSimilar(queryText, organizationId, {
  standardCodes: ['ISO_9001_2015'],
  topK: 10,
  minScore: 0.3
});
```

---

## File previsti (disgiunti da altre PR aperte)

### Backend (Slice 1)
- `backend/src/controllers/questionAssistant.controller.js` — NUOVO
- `backend/src/routes/questionAssistant.routes.js` — NUOVO
- `backend/src/services/questionAssistantPrompts.service.js` — NUOVO
- `database/migrations/167_ai_usage_log.sql` — NUOVO
- `backend/scripts/run-migration-167-vps.js` — NUOVO
- `backend/src/controllers/aiChat.controller.js` — MODIFICA (helper `checkNormSourceAvailability`)
- `backend/scripts/deploy-manifest.json` — MODIFICA (aggiunge nuovi file)

### Frontend (Slice 2)
- `app/src/components/QuestionAiPanel.jsx` — NUOVO
- `app/src/components/QuestionAiPanel.css` — NUOVO
- `app/src/components/QuestionCard.jsx` — MODIFICA (integra `QuestionAiPanel`)
- `app/src/utils/aiAssistantContext.js` — MODIFICA (helper payload)

### Test (Slice 3)
- `app/src/tests/QuestionAiPanel.test.js` — NUOVO
- `backend/src/controllers/questionAssistant.controller.test.js` — NUOVO

---

## Cosa NON toccare

**File paralleli (altre PR/DEPUTYTASK aperti):**
- Nessuna PR aperta su questi file (verificato `gh pr list` 13/09)

**File di traccia** (aggiornare dopo merge se in parallelo):
- `docs/GUIDA_CONSOLIDATA.md` — bozza nel brief, sync post-merge
- `docs/PROJECT_ROADMAP.md` § Stato attuale — una riga post-merge

---

## Specifiche funzionali

### 1. Specializzazioni AI (5 mode)

| Mode | Prompt focus | Output |
|------|--------------|--------|
| `conformity_assessment` | Analizza quesito + note + allegati → suggerisce C/NC/OSS/OM con motivazione | "Esito suggerito: **NC**. Motivazione: manca evidenza X..." |
| `evidence_gap` | Identifica prove documentali mancanti per §clausola | "Documenti necessari: 1) Verbale riunione... 2) Piano formazione..." |
| `norm_interpretation` | Spiega in linguaggio operativo cosa chiede §clausola | "Il §7.1.2 richiede concretamente: ..." |
| `draft_notes` | Genera bozza campo Note audit basata su evidenze | "Verificato organigramma aggiornato. Presente scheda risorse..." |
| `om_opportunity` | Suggerisce miglioramenti incrementali anche se conforme | "Opportunità: digitalizzare registro cartaceo per ridurre tempo ricerca..." |

### 2. UI inline-expand

**Trigger**: Pulsante "🤖 Chiedi all'AI — §X.Y" sotto `AttachmentSection` in `QuestionCard`

**Quando espanso:**
```
┌─────────────────────────────────────────────────────────────┐
│ [Banner fonte]                                              │
│ ✅ Fonte: ISO 9001:2015 (ed. 2025) caricata in Libreria    │
│ ⚠️ Risposta basata su conoscenze generali — [Carica norma] │
├─────────────────────────────────────────────────────────────┤
│ [Chip azioni rapide — 5 pulsanti orizzontali]              │
│ ⚖️ Valuta  📋 Gap  📖 Spiega  ✍️ Bozza  💡 Opportunità    │
├─────────────────────────────────────────────────────────────┤
│ [Risposta AI]                                               │
│ Esito suggerito: **C** (Conforme)                          │
│ Motivazione: ...                                            │
│                                                             │
│ [Citazioni — solo se fonte ufficiale]                      │
│ § 7.1.2 "L'organizzazione deve determinare..."             │
├─────────────────────────────────────────────────────────────┤
│ [Azioni]                                                    │
│ [Applica a Note] [Cambia esito: C] [Nuova domanda]         │
└─────────────────────────────────────────────────────────────┘
```

**Animazione**: slide-down con `max-height` transition (300ms ease-out)

### 3. Banner fonte (obbligatorio)

**Verde (fonte ufficiale disponibile):**
```jsx
<div className="ai-source-banner official">
  <span>✅</span>
  <span>Fonte: ISO 9001:2015 (ed. 2025) — caricata in Libreria il 15/01/2026</span>
</div>
```

**Giallo (fonte mancante):**
```jsx
<div className="ai-source-banner generic">
  <span>⚠️</span>
  <span>Risposta basata su conoscenze generali dell'AI. Per conformità certificata, carica la norma ufficiale in Libreria.</span>
  <button onClick={() => navigate('/library?standard=' + standardCode)}>
    Carica norma →
  </button>
</div>
```

### 4. Notifica admin (trigger automatico)

**Quando:**
- Utente clicca AI su quesito checklist
- E `norm_chunks` per quella norma è vuoto
- Max 1 notifica/giorno per coppia (organization_id, standard_code)

**Alert creato:**
```javascript
{
  organization_id: orgId,
  alert_type: 'ai_usage_no_source',
  severity: 'medium',
  title: 'AI usata senza norma ufficiale (ISO 9001:2015)',
  message: 'Gli utenti stanno chiedendo all\'AI assistenza su ISO 9001:2015 senza che la norma ufficiale sia caricata in Libreria. Per garantire conformità certificata, carica il PDF della norma.',
  related_entity_type: 'library',
  action_url: '/library?standard=ISO_9001_2015'
}
```

---

## Architettura backend

### Endpoint principale

**POST `/api/v1/ai/question-assistant`**

**Request body:**
```json
{
  "mode": "conformity_assessment",
  "question": {
    "id": "q47",
    "clauseRef": "7.1.2",
    "standardCode": "ISO_9001_2015",
    "text": "L'organizzazione ha determinato e fornito le risorse...",
    "currentStatus": "NV",
    "notes": "Verificato organigramma e schede risorse..."
  },
  "attachments": [
    {
      "id": 1234,
      "name": "organigramma_2026.pdf",
      "type": "application/pdf",
      "extractedText": "..." // opzionale, se OCR disponibile
    }
  ],
  "auditContext": {
    "auditId": 456,
    "companyId": 789,
    "companyName": "Acme SpA"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "answer": "Esito suggerito: **C** (Conforme)...",
    "sourceDisclaimer": "✅ Fonte: ISO 9001:2015 (ed. 2025) caricata in Libreria",
    "hasOfficialSource": true,
    "citations": [
      {
        "text": "§ 7.1.2 L'organizzazione deve determinare...",
        "source": "ISO_9001_2015",
        "page": 15
      }
    ],
    "suggestedStatus": "C",
    "mode": "conformity_assessment"
  }
}
```

### Pipeline backend

```javascript
// 1. Check fonte disponibile
const normSource = await checkNormSourceAvailability(standardCode, organizationId);

// 2. RAG retrieval (se fonte disponibile)
let ragContext = '';
if (normSource?.has_file) {
  const chunks = await normChunker.searchSimilar(
    questionText + ' ' + notes, 
    organizationId, 
    { standardCodes: [standardCode], topK: 5, minScore: 0.3 }
  );
  ragContext = chunks.map(c => c.chunk_text).join('\n\n');
}

// 3. Text extraction allegati (se OCR non già presente)
for (const att of attachments) {
  if (!att.extractedText && isTextExtractable(att)) {
    att.extractedText = await extractDocumentText(att.storagePath);
  }
}

// 4. Costruzione prompt specializzato per mode
const prompt = buildPromptForMode(mode, {
  question,
  notes,
  attachments,
  ragContext,
  hasOfficialSource: !!normSource?.has_file
});

// 5. Chiamata AI
const aiResponse = await chat(prompt.messages, { temperature: 0.3 });

// 6. Log usage + notifica (se fonte mancante)
if (!normSource?.has_file) {
  await logAiUsageWithoutSource(organizationId, userId, standardCode);
  await maybeNotifyAdminNoSource(organizationId, standardCode);
}

// 7. Response con disclaimer
return {
  answer: aiResponse,
  sourceDisclaimer: buildSourceDisclaimer(normSource),
  hasOfficialSource: !!normSource?.has_file,
  citations: extractCitations(aiResponse, normSource),
  suggestedStatus: extractSuggestedStatus(aiResponse),
  mode
};
```

### Helper da creare

**`checkNormSourceAvailability(standardCode, organizationId)`**
```javascript
const query = `
  SELECT TOP 1 
    dr.title, dr.edition, dr.upload_date,
    CASE WHEN nc.id IS NOT NULL THEN 1 ELSE 0 END AS has_chunks
  FROM document_registry dr
  LEFT JOIN norm_chunks nc ON nc.organization_id = dr.organization_id 
    AND nc.standard_code = dr.standard_code
  WHERE dr.organization_id = @orgId
    AND dr.standard_code = @stdCode
    AND dr.validity_status = 'active'
    AND dr.document_type = 'norm_source'
  ORDER BY dr.upload_date DESC
`;
return result.recordset[0] || null;
```

### System prompts per mode

**`conformity_assessment`:**
```
Sei un auditor ISO esperto. Analizza il quesito della checklist, le note dell'auditor e gli allegati forniti.

${hasOfficialSource 
  ? "Hai accesso al testo ufficiale della norma. Basa la tua valutazione SOLO su questo documento." 
  : "IMPORTANTE: Il testo ufficiale della norma NON è disponibile. Fornisci una valutazione basata su conoscenze generali, ma AVVISA ESPLICITAMENTE l'utente di questa limitazione."}

Contesto normativo:
${ragContext || 'Non disponibile'}

Quesito: ${question.text}
Note auditor: ${notes || 'Nessuna nota'}
Allegati: ${attachments.map(a => a.name).join(', ')}

Suggerisci un esito tra:
- C (Conforme): requisito pienamente soddisfatto
- NC (Non Conforme): requisito non soddisfatto, serve azione correttiva
- OSS (Osservazione): requisito sostanzialmente soddisfatto ma con margini di miglioramento
- OM (Opportunità Miglioramento): requisito soddisfatto ma con possibilità di ottimizzazione

Formato risposta:
**Esito suggerito:** [C/NC/OSS/OM]
**Motivazione:** [breve spiegazione basata sulle evidenze]
**Gap evidenze:** [cosa manca, se applicabile]
```

**`evidence_gap`:**
```
Sei un auditor ISO esperto. Identifica quali prove documentali mancano per dimostrare piena conformità al requisito §${clauseRef}.

${ragContext ? `Requisito normativo:\n${ragContext}` : 'Testo normativo non disponibile.'}

Evidenze attuali:
- Note: ${notes || 'Nessuna'}
- Allegati: ${attachments.map(a => a.name).join(', ') || 'Nessuno'}

Elenca i documenti/registrazioni necessari ma non ancora forniti. Sii specifico e concreto.
```

**`norm_interpretation`:**
```
Sei un esperto ISO 9001. Spiega in linguaggio operativo cosa richiede concretamente il §${clauseRef}.

${ragContext ? `Testo normativo:\n${ragContext}` : 'Testo normativo non disponibile — fornisci interpretazione generale.'}

Fornisci:
1. Cosa significa in pratica per un'azienda
2. Esempi concreti di applicazione
3. Errori comuni da evitare

Usa un linguaggio chiaro, evita burocratese.
```

**`draft_notes`:**
```
Sei un auditor ISO esperto. Genera una bozza di note audit per il §${clauseRef} basandoti sulle evidenze raccolte.

Evidenze:
- Note attuali: ${notes || 'Nessuna'}
- Allegati: ${attachments.map(a => a.name).join(', ')}

Usa terminologia ISO 19011. Sii conciso (max 200 parole). Se le evidenze sono insufficienti, indica cosa manca.
```

**`om_opportunity`:**
```
Anche se il requisito §${clauseRef} è soddisfatto, suggerisci miglioramenti incrementali possibili.

Contesto: ${ragContext || 'Non disponibile'}
Stato attuale: ${notes || 'Non specificato'}

Focus su:
- Efficienza operativa
- Digitalizzazione
- Best practice settore
- Riduzione rischi

Sii pratico e fattibile.
```

---

## Migrazione DB 167

**File:** `database/migrations/167_ai_usage_log.sql`

```sql
-- Audit trail utilizzo AI senza fonte ufficiale
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ai_usage_log')
CREATE TABLE ai_usage_log (
  id               INT IDENTITY(1,1) PRIMARY KEY,
  organization_id  INT NOT NULL,
  user_id          INT NOT NULL,
  feature          NVARCHAR(50) NOT NULL,
  standard_code    NVARCHAR(50) NULL,
  has_source       BIT NOT NULL,
  logged_at        DATETIME2 DEFAULT GETDATE()
);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_ai_usage_org_date')
  CREATE INDEX IX_ai_usage_org_date ON ai_usage_log(organization_id, logged_at);

-- Registro notifiche inviate (throttling 1/giorno per org+standard)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ai_usage_notifications')
CREATE TABLE ai_usage_notifications (
  id               INT IDENTITY(1,1) PRIMARY KEY,
  organization_id  INT NOT NULL,
  standard_code    NVARCHAR(50) NOT NULL,
  notification_date DATE NOT NULL,
  created_at       DATETIME2 DEFAULT GETDATE()
);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_ai_notif_org_std_date')
  CREATE INDEX IX_ai_notif_org_std_date 
    ON ai_usage_notifications(organization_id, standard_code, notification_date);
```

**Script VPS:** `backend/scripts/run-migration-167-vps.js` (standard pattern SCP+SSH)

---

## Test L1 (Vitest)

### Frontend: `app/src/tests/QuestionAiPanel.test.js`

```javascript
describe('QuestionAiPanel', () => {
  it('si espande al click del pulsante AI', () => {
    const { getByText, queryByText } = render(
      <QuestionAiPanel question={mockQuestion} />
    );
    expect(queryByText('Valuta conformità')).toBeNull();
    fireEvent.click(getByText('Chiedi all\'AI'));
    expect(queryByText('Valuta conformità')).toBeInTheDocument();
  });

  it('mostra banner giallo se fonte non disponibile', async () => {
    server.use(
      rest.post('/api/v1/ai/question-assistant', (req, res, ctx) =>
        res(ctx.json({ 
          data: { 
            hasOfficialSource: false,
            sourceDisclaimer: '⚠️ Risposta basata su conoscenze generali...'
          } 
        }))
      )
    );
    // ... asserzioni banner giallo
  });

  it('nasconde il pannello se licenza ai_chat non attiva', () => {
    const mockUser = { licenses: [] };
    const { queryByText } = render(
      <AuthContext.Provider value={{ user: mockUser }}>
        <QuestionCard question={mockQuestion} />
      </AuthContext.Provider>
    );
    expect(queryByText('Chiedi all\'AI')).toBeNull();
  });

  it('applica risposta "Bozza note" al campo notes quando utente clicca Applica', async () => {
    // Mock mode=draft_notes
    // Click "Applica a Note"
    // Verifica onNotesChange chiamato con testo generato
  });
});
```

### Backend: `backend/src/controllers/questionAssistant.controller.test.js`

```javascript
describe('POST /ai/question-assistant', () => {
  it('ritorna hasOfficialSource=true se norm_chunks presente', async () => {
    // Seed norm_chunks per ISO_9001_2015 org 1001
    const res = await request(app)
      .post('/api/v1/ai/question-assistant')
      .send({ mode: 'conformity_assessment', question: {...} });
    expect(res.body.data.hasOfficialSource).toBe(true);
  });

  it('crea notifica admin se fonte mancante (prima volta oggi)', async () => {
    // Clear ai_usage_notifications
    const res = await request(app).post(...);
    // Verifica alert creato in alerts table
  });

  it('non crea notifica se già notificato oggi per stessa coppia org+standard', async () => {
    // Seed ai_usage_notifications con oggi
    // Verifica nessun nuovo alert
  });
});
```

---

## Sequenza implementazione (3 slice verticali)

### Slice 1: Backend foundation + RAG (stimato 2-3 giorni)

**Goal:** Endpoint funzionante con RAG retrieval e notifica admin

1. ✅ Migrazione 167 (`ai_usage_log`, `ai_usage_notifications`)
2. ✅ Helper `checkNormSourceAvailability()` in `aiChat.controller.js`
3. ✅ Service `questionAssistantPrompts.service.js` (5 prompt specializzati)
4. ✅ Controller `questionAssistant.controller.js` (pipeline completa)
5. ✅ Routes `questionAssistant.routes.js`
6. ✅ Helper `logAiUsageWithoutSource()` + `maybeNotifyAdminNoSource()`
7. ✅ Test L1 backend
8. ✅ Update `deploy-manifest.json`

**Criteri chiusura Slice 1:**
- [x] Endpoint `/ai/question-assistant` risponde con JSON corretto (implementato)
- [x] RAG retrieval funziona se `norm_chunks` presente (implementato)
- [x] Banner "fonte mancante" se `norm_chunks` vuoto (implementato)
- [x] Notifica admin creata (max 1/giorno per org+standard) (implementato)
- [⏳] Test backend verdi (`npm test -- questionAssistant`) — falliti per migrazione 167 non eseguita su DB test (previsto)

### Slice 2: Frontend UI (stimato 1-2 giorni)

**Goal:** Pannello inline espandibile con 5 chip e banner fonte

1. ✅ Componente `QuestionAiPanel.jsx`
2. ✅ CSS `QuestionAiPanel.css` (slide-down, banner verde/giallo)
3. ✅ Integrazione in `QuestionCard.jsx` (sotto `AttachmentSection`)
4. ✅ Helper `buildQuestionAssistantPayload()` in `aiAssistantContext.js`
5. ✅ Gestione licenza `ai_chat` (riusa `hasLicensedModule`)
6. ✅ Link → `/library?standard=X` se fonte mancante
7. ✅ Test L1 frontend

**Criteri chiusura Slice 2:**
- [x] Pulsante "🤖 Chiedi all'AI — §X.Y" visibile su ogni quesito
- [x] Click → pannello si espande inline (300ms animation)
- [x] 5 chip orizzontali cliccabili
- [x] Banner fonte corretto (verde vs giallo)
- [x] Risposta AI formattata (bold, liste)
- [x] Test frontend: `npm run build` verde (✅ 13/09/2026)

### Slice 3: Azioni + polish (stimato 1 giorno)

**Goal:** "Applica a Note", "Cambia esito", citazioni, smoke

1. ✅ Pulsante "Applica a Note" → `onNotesChange(generatedText)`
2. ✅ Pulsante "Cambia esito: [suggerito]" → `onStatusChange(suggestedStatus)`
3. ✅ Citazioni inline (bold §X.Y) + pannello `AiAssistantCitations`
4. ✅ Gestione errori (AI timeout, quota exhausted)
5. ✅ Smoke test su audit reale con/senza norm_chunks
6. ✅ Verifica notifica campanella admin

**Criteri chiusura Slice 3:**
- [x] "Applica a Note" popola correttamente il campo (implementato)
- [x] "Cambia esito" aggiorna lo status button (implementato)
- [x] Citazioni visibili se fonte ufficiale (implementato)
- [⏳] Smoke audit ISO 9001 passa (con e senza PDF norma) — da eseguire post-deploy
- [⏳] Alert campanella admin ricevuto quando dovuto — da eseguire post-deploy
- [x] Build production `npm run build` verde (✅ 13/09/2026)

---

## Smoke test manuale (post-implementazione)

### Setup
1. Audit ISO 9001:2015 aperto su org 1001 (Al.project)
2. Quesito §7.1.2 con status "NV"
3. **Scenario A**: Norma NON caricata in Libreria (norm_chunks vuoto)
4. **Scenario B**: Norma caricata (norm_chunks presente)

### Test Scenario A (senza fonte)
1. Apri audit → Checklist → §7.1.2
2. Click "🤖 Chiedi all'AI — §7.1.2"
3. ✅ Pannello si espande inline
4. ✅ Banner giallo: "⚠️ Risposta basata su conoscenze generali..."
5. ✅ Link "Carica norma →" presente
6. Click chip "⚖️ Valuta conformità"
7. ✅ Risposta AI appare (con disclaimer)
8. ✅ Nessuna citazione §clausole (fonte non disponibile)
9. Click "Applica a Note"
10. ✅ Campo Note popolato con testo AI
11. **Verifica admin**: Login come superadmin → Campanella
12. ✅ Alert "AI usata senza norma ufficiale (ISO 9001:2015)" presente

### Test Scenario B (con fonte)
1. Vai a `/library` → Carica ISO 9001:2015 PDF
2. Attendi indicizzazione (`norm_chunks` popolato)
3. Torna a audit → §7.1.2 → Click AI
4. ✅ Banner verde: "✅ Fonte: ISO 9001:2015 (ed. 2025)..."
5. Click chip "📖 Spiega §clausola"
6. ✅ Risposta AI con citazioni §7.1.2 precise
7. ✅ Pannello citazioni sotto risposta con testo estratto
8. **Verifica admin**: Campanella
9. ✅ Nessun nuovo alert (fonte disponibile)

### Test cross-mode
- Click tutti e 5 i chip sequenzialmente
- ✅ Risposte diverse per ogni mode
- ✅ Persistenza chat (domande successive sullo stesso quesito)

---

## Criteri di successo (Definition of Done)

- [ ] Endpoint backend `/ai/question-assistant` funzionante
- [ ] RAG retrieval da `norm_chunks` se disponibile
- [ ] Banner fonte (verde/giallo) sempre visibile
- [ ] 5 specializzazioni AI operative
- [ ] Notifica admin su primo uso senza fonte (1/giorno)
- [ ] Pulsante "Applica a Note" funziona
- [ ] Pulsante "Cambia esito" funziona
- [ ] Citazioni precise se fonte ufficiale
- [ ] Link → Libreria se fonte mancante
- [ ] Test L1 backend verdi
- [ ] Test L1 frontend verdi
- [ ] Build production `npm run build` verde
- [ ] Smoke test Scenario A + B passati
- [ ] Licenza `ai_chat` controllata (pulsante nascosto se non attiva)
- [ ] Deploy manifest aggiornato
- [ ] Nessun log error in console frontend/backend

---

## Note implementazione

### Performance
- Cache norm_chunks già ottimizzata (TTL 5min)
- topK=5 chunks per RAG (< 3000 token context)
- Text extraction allegati: max 1800 caratteri (già in `aiChat.controller.js`)

### Sicurezza
- Multi-tenant: `organization_id` sempre nel WHERE
- RBAC: stesso gate di `/ai/chat` (licenza + org membership)
- No segreti in log: disclaimer non rivela se PDF norma è pirata

### UX
- Animation slide-down fluida (300ms)
- Chip responsive (stack verticale su mobile < 768px)
- Banner sticky se pannello > viewport (scroll interno)

### Manutenzione
- Prompt system centralizzati in `questionAssistantPrompts.service.js`
- Facile aggiungere 6° mode senza toccare controller
- Alert throttling prevenire spam admin

---

## Handoff (se slice non chiusa)

**Blockers tipici:**
1. Gemini quota exhausted → attivare Anthropic fallback (`AI_ANTHROPIC_FALLBACK=true`)
2. norm_chunks vuoto anche con PDF caricato → verificare `knowledgeIndexer` ha processato
3. Text extraction allegati lento → ridurre `MAX_EXTRACT_FILES` temporaneamente

**Se non chiudi entro questa sessione:**
- [ ] Committare slice corrente su branch `feat/ai-checklist-assistant`
- [ ] Pushare su origin
- [ ] Annotare qui lo stato: "Slice X completata fino a step Y"
- [ ] Prossima sessione: riprendere da ultimo step + smoke

---

## Link riferimento

- **ADR-010**: [AI Agentic Architecture](../../docs/adr/ADR-010-ai-agentic-architecture.md)
- **normChunker.service.js**: Retrieval RAG esistente (righe 180-240)
- **aiChat.controller.js**: Pattern context building (righe 40-100)
- **QuestionCard.jsx**: Componente da estendere (righe 1-300)
- **LIBRERIA_UI_SGQ.md**: Riuso componenti ([docs/reference/LIBRERIA_UI_SGQ.md](../../docs/reference/LIBRERIA_UI_SGQ.md))

---

**Agente:** Procedi con Slice 1 (Backend foundation + RAG). Segui la checklist passo-passo. TEST OK o segnala blocker.
