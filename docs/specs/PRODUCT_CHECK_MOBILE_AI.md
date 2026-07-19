# Check di prodotto — Mobile (campo) + Assistente AI affidabile

> **Stato**: Decisione di prodotto (19/07/2026)  
> **Destinatario**: Lead / Product owner / Deputy  
> **Vincoli**: ADR-004 (auth mobile), ADR-008 (sync), ADR-010 (AI agentica)  
> **Formula valore**: `valore campo = (cattura veloce + sync affidabile) × (AI con fonti verificabili)`

---

## 1. Regola operativa

| Contesto | Cosa fa l'app | Cosa non fa |
|----------|---------------|-------------|
| **Telefono (PWA)** | Cattura evidenze, checklist, NC, consulta scadenze/qualifiche, chiede all'AI normativa + dati azienda | Editing griglie, riesami, report Word, import batch |
| **Tablet** | Come mobile + più spazio checklist e foto | Configurazione tenant |
| **Desktop** | Analisi, SAL completo, riesame, gap, impostazioni | — |

---

## 2. Stato reale moduli mobile — cosa c'è e cosa manca

Questa tabella è basata sul codice attuale (`AppLayout.jsx`, `ChecklistModule.jsx`, `NCPage.jsx`, `AiAssistantPage.jsx`).

| Modulo | Stato mobile oggi | Gap concreto |
|--------|-------------------|--------------|
| **Audit / Checklist** | Layout responsivo OK; bottom nav slot 2 fisso | Manca pulsante «Chiedi all'AI su questa clausola» — il focus clausola viene salvato in sessionStorage (`saveChecklistFocus`) ma non c'è nessun link che porta a `/ai-assistant` |
| **Non conformità** | Drawer full-width su mobile (CSS `@media ≤768px`: `width:100%!important`); filtri impilati su `≤640px` | Nessun AI su NC: `useAiAssist` è usato solo in `AiConclusionsModal`; in `NcDetailPanel` non c'è «Suggerisci causa/azione (AI)» |
| **Documenti / Scadenze** | Navigabile (slot 4 se CND non attivo) | Nessun gap urgente — sola lettura OK su mobile |
| **Qualifiche** | Pagina carica, non ottimizzata per mobile | Nessun AI: nessun endpoint né hook per rispondere a «Il saldatore X è idoneo per WPS Y?» |
| **CND** | Slot 4 se licenza attiva; verbali accessibili | Nessun gap urgente su layout mobile |
| **Assistente AI** | Pagina `/ai-assistant` ha responsive CSS (`@media ≤768px`); il contesto audit (azienda + norma + clausola) viene già iniettato automaticamente da `currentAudit` via `resolveAutoCompanyFromAudit` + `resolveAutoStandardFromAudit` + `loadChecklistFocus` | **Non compare mai nella bottom nav** — slot 5 hardcoded: se CND attivo → Documenti; se admin → Impostazioni; altrimenti → Aziende. L'AI (`ai_chat`) non ha nessun punto di accesso rapido su telefono |
| **SAL** | Griglia densa non usabile su telefono | Il dialog AI (5-A/5-B) esiste e funziona, ma si raggiunge solo attraverso la griglia completa; nessuna view compatta per aggiornare una riga da mobile |
| **Home / Alert** | Badge scadenze, NC aperte, audit in corso | Nessun gap urgente |

---

## 3. Gap AI — stato attuale vs. atteso

### Gap 1 — AI non raggiungibile dalla bottom nav (blocca tutto il resto)

**File**: `app/src/layouts/AppLayout.jsx` — funzione `buildMobileNavItems()`

**Comportamento attuale**: slot 5 è hardcoded:
```
se CND attivo   → Documenti
altrimenti admin → Impostazioni
altrimenti       → Aziende
```
L'AI (`/ai-assistant`, licenza `ai_chat`) non compare mai, anche se attiva.

**Comportamento atteso**: quando la licenza `ai_chat` è attiva, slot 5 → «AI» (o «Assistente»). Quando non attiva, slot 5 resta come oggi.

**Impatto**: senza questo fix, tutti i casi d'uso AI in campo sono irraggiungibili con una mano sola.

---

### Gap 2 — Nessun pulsante «Chiedi all'AI» nella checklist

**File**: `app/src/components/ChecklistModule.jsx` (o `QuestionCard.jsx`)

**Comportamento attuale**: quando l'utente cambia esito/note su una domanda, `saveChecklistFocus` salva in sessionStorage la clausola e la domanda corrente. Quando l'utente apre manualmente `/ai-assistant`, il contesto viene riletto e pre-impostato. **Ma l'utente non sa che il contesto è pronto** e deve navigare a mano.

**Comportamento atteso**: icona/link «Chiedi all'AI» accanto alla domanda (visibile solo se `ai_chat` attivo) → naviga a `/ai-assistant` con il focus già caricato (norma + clausola già visibili nel chip).

**Nessun lavoro backend**: il contesto è già gestito; serve solo il link di navigazione nel JSX.

---

### Gap 3 — Prompt suggeriti generici, non contestuali

**File**: `app/src/pages/AiAssistantPage.jsx` — costante `SUGGESTIONS`

**Comportamento attuale**:
```js
const SUGGESTIONS = [
  "Quante NC aperte ci sono?",
  "Quali documenti sono in scadenza?",
  "Riassumi le conclusioni degli ultimi audit",
  "Quali rischi hanno score più alto?",
  "Stato delle qualifiche in scadenza",
];
```
Questi prompt sono statici e uguali per tutti i contesti.

**Comportamento atteso**: quando c'è un audit attivo con clausola in focus, mostrare anche:
- «Cosa chiede §[clausola] della [norma] e cosa ho già registrato?»
- «Questa clausola è già coperta da un documento del registro?»
- «Cosa manca per chiudere l'audit?» (pending issues)

I dati per costruire queste stringhe sono già in `currentAudit` e nel contesto auto-iniettato.

---

### Gap 4 — Nessuna AI nel modulo NC

**File**: `app/src/components/NcDetailPanel.jsx` (sezione Cause / Azioni correttive)

**Comportamento attuale**: `useAiAssist` hook esiste (`app/src/hooks/useAiAssist.js`) ed è usato solo in `AiConclusionsModal` (conclusioni audit). Nel drawer NC non c'è nessun AI.

**Comportamento atteso**: pulsante «Suggerisci causa (AI)» nella sezione «Cause» del drawer, e «Suggerisci azione (AI)» nella sezione «Azioni». L'hook chiama `apiService.aiSuggest('nc_cause', { description, clauseRef, auditRef })`. L'AI **propone**, l'operatore Accetta/Modifica/Rifiuta — nessuna scrittura automatica.

**Licenza gate**: `ai_assist` (già presente in backend).

---

### Gap 5 — Nessuna AI su Qualifiche/WPS

**Stato**: nessun hook, nessun endpoint, nessuna integrazione. La funzionalità «il saldatore X è idoneo per WPS Y?» deve essere implementata ex-novo (endpoint backend + prompt + citazioni qualifica/WPS).

**Priorità**: media — utile per Mason, non blocca Camellini.

---

### Gap 6 — SAL non mobile-friendly

**Comportamento attuale**: `SALModule.jsx` carica l'intera griglia clausole (numerose righe). Il dialog AI (5-A/5-B) esiste e funziona ma si raggiunge solo cliccando sulla riga nella griglia.

**Comportamento atteso**: su viewport `≤768px`, mostrare una view compatta (accordion o lista) invece della griglia completa; ogni riga ha accesso diretto al dialog AI.

**Priorità**: bassa — prioritaria su desktop per il flusso principale.

---

## 4. AI affidabile — contratto (invariato per ogni feature)

| Regola | Implementazione esistente | Note |
|--------|--------------------------|------|
| Citazioni cliccabili | `AiAssistantCitations` + `getCitationPath` | Obbligatorio in ogni nuova feature AI |
| Scope tenant/azienda | `organization_id` + `company_id` (PR #91) | Già verificato in RAG |
| Anti-allucinazione normativa | Parse `clauseRef` / articoli solo da NormBroker | Pattern già in SAL 5-B |
| Human-in-the-loop | `AiDisclaimer` + Accetta/Modifica/Rifiuta | Nessuna scrittura silenziosa (ISO §7.5) |
| Audit trail | `logAiInteraction` → `ai_interactions` | Obbligatorio su ogni route AI |
| Graceful degradation | `aiAvailable: false` (200, no crash) | Già in SAL 5-A |

---

## 5. Sequenza slice (ordine ROI — dal gap più bloccante)

| Slice | Titolo | File chiave | Dipendenze | Effort indicativo |
|-------|--------|-------------|------------|-------------------|
| **M-AI-1** | AI slot bottom nav | `AppLayout.jsx` — `buildMobileNavItems()` | `ai_chat` | 1 file, 10 righe |
| **M-AI-2** | Link «Chiedi all'AI» in checklist | `ChecklistModule.jsx` o `QuestionCard.jsx` | M-AI-1 + `saveChecklistFocus` già OK | 1 file, pulsante + navigate |
| **M-AI-3** | Prompt contestuali da audit corrente | `AiAssistantPage.jsx` — `SUGGESTIONS` | `currentAudit` + clausola focus già in state | 1 file, logica condizionale |
| **M-AI-4** | AI causa/azione su NC drawer | `NcDetailPanel.jsx` + `useAiAssist` | `ai_assist` gate; no backend nuovo | 1-2 file |
| **M-AI-5** | Qualifiche Q&A | Backend endpoint + FE chat contesto | Modulo qualifiche + WPS | Più invasivo |
| **M-AI-6** | SAL view mobile compatta | `SALModule.jsx` CSS + accordion | SAL 5-A/5-B esistenti | CSS + JSX |

---

## 6. Metriche semplici per misurare il successo

| Metrica | Segnale positivo |
|---------|-----------------|
| % sessioni mobile con ≥1 salvataggio audit/NC | Uso reale in campo |
| % risposte AI con ≥1 citazione valida | Affidabilità percepita |
| % suggerimenti AI accettati (non solo aperti) | Utilità reale |
| Ticket «l'AI ha inventato la clausola» | Deve tendere a zero |

---

## 7. Decisioni già assunte (non riaprire)

1. Telefono = **cattura e verifica**; PC = **analisi e report**.
2. AI **non** scrive record senza conferma umana (ISO §7.5).
3. Vantaggio competitivo = **specificità** (norme studio + dati azienda + citazioni), non creatività generica.
4. Conformità legislativa SAL → capability su `ai_norms`, seam già pronto per scorporo futuro.

---

## Riferimenti

- [ADR-010 — Architettura AI](../adr/ADR-010-ai-agentic-architecture.md)
- [ADR-004 — Auth mobile](../adr/ADR-004-mobile-auth-localstorage.md)
- [ADR-008 — Sync event-sourced](../adr/ADR-008-event-sourcing-sync.md)
- [MODULO_SAL_SCOPO_E_ROADMAP.md](MODULO_SAL_SCOPO_E_ROADMAP.md)
- [PROJECT_ROADMAP.md](../PROJECT_ROADMAP.md) — Strategia Mobile / Desktop
- [GUIDA_CONSOLIDATA.md](../GUIDA_CONSOLIDATA.md) — lezioni AI / licenze / encoding
