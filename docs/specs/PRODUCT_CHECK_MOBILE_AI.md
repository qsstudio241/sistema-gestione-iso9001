# Check di prodotto — Mobile (campo) + Assistente AI affidabile

> **Stato**: Decisione di prodotto (19/07/2026)  
> **Destinatario**: Lead / Product owner / Deputy  
> **Vincoli**: ADR-004 (auth mobile), ADR-008 (sync), ADR-010 (AI agentica), regola «cattura e verifica sul telefono / analisi sul PC»  
> **Obiettivo**: massimizzare il valore in mobilità **e** il vantaggio competitivo dell’AI *specifica* di questa app (norme + dati azienda + citazioni), non un chatbot generico.

---

## 1. Principio operativo (regola pratica)

| Contesto | Cosa deve fare l’app | Cosa non deve fare |
|----------|----------------------|--------------------|
| **Telefono (PWA)** | Catturare evidenze, rispondere a checklist, aprire/aggiornare NC, consultare scadenze/qualifiche, chiedere all’AI «cosa dice la norma / cosa manca qui» | Editing di griglie lunghe, riesami, admin, report Word, import batch |
| **Tablet** | Come mobile + più spazio per checklist e foto | Configurazione tenant |
| **Desktop** | Analisi, report, SAL completo, riesame, gap, impostazioni | — (tutto consentito) |

**Formula valore**: `Valore campo = (cattura veloce + sync affidabile) × (AI contestuale con fonti verificabili)`.

---

## 2. Matrice moduli × mobile × AI

Legenda priorità mobile: **P0** = indispensabile in campo · **P1** = alto valore · **P2** = utile light · **—** = desktop only.

| Modulo (chiave licenza) | Priorità mobile | Ruolo sul telefono | Ruolo AI (valore aggiunto) | DoD prodotto (check) |
|-------------------------|-----------------|--------------------|----------------------------|----------------------|
| **audit** | **P0** | Checklist C/NC/OSS, note, foto/allegati, offline | `ai_assist`: suggerisci esito/note da evidenza; citazione clausola da NormBroker | Offline OK; sync senza perdita; 1 domanda = 1 schermata; AI con Accetta/Modifica |
| **nc** | **P0** | Apri/aggiorna NC, foto, azione rapida | Bozza causa/azione correttiva da testo + foto; link a clausola | Drawer usabile a pollice; deep-link `/nc?select=`; AI non scrive senza conferma |
| **documents** + scadenze | **P0** (consultazione) | Lista scadenze, dettaglio doc, semaforo | «Questo doc copre §X?» con citazione registro + norma | Badge Home/alert; sola lettura ok su mobile; upload opzionale (foto) |
| **qualifiche** | **P0** (consultazione) | Validità patentino/certificato in reparto | «Saldatore X idoneo a WPS Y?» da dati qualifiche + WPS | Scope azienda obbligatorio; semaforo scadenze leggibile |
| **cnd** | **P0** se licenza attiva | Verbale VT/MT/PT/UT + foto | Bozza verbale da checklist metodo; check strumenti tarati | Bottom nav già prioritizza CND; foto obbligatorie dove previsto |
| **Home / alert** | **P0** | «Cosa fare oggi» | Sintesi giornaliera opzionale (P2) | NC aperte, scadenze, audit in corso |
| **reclami** | **P1** light | Stato / nota in visita | Classifica reclamo → NC suggerita | Form corto; niente griglie dense |
| **sal** | **P2** light | Aggiorna 1–2 stati dopo incontro; lettura avanzamento | Già: suggerisci stato + conformità legislativa (`ai_norms`) | Griglia completa = desktop; mobile = riga singola + dialog AI |
| **ai_chat** | **P1** | Assistente in campo (voce/testo) | Risposte **esaustive e citate** su norma + dati azienda | Vedi §3 (pilastro competitività) |
| **ai_assist** | **P1** | Inline su checklist/NC | Suggerimenti contestuali | Human-in-the-loop ISO §7.5 |
| **ai_norms** | **P1** (via chat/SAL) | Accesso norma on-demand | NormBroker cascata + anti-allucinazione `clauseRef` | Mai inventare articoli non in store |
| **rischi** / **riesame_direzione** | **—** | Solo deep-link lettura se serve | Generazione bozze = desktop | Form lunghi desktop-first |
| **ai_review** / gap-analysis | **—** | — | Riesame capitolato, gap documenti | Desktop |
| **saldatura** (WPS/WPQR/WB) | **P2** consultazione | Stato procedura / coverage | Domande coverage via chat | Editing schede = desktop |
| **ai_import** / admin / billing | **—** | — | — | Solo desktop |

---

## 3. Pilastro competitivo — AI specifica (non generica)

L’utente paga (e resta) se l’assistente **sa questa azienda e questa norma**, non se «parla bene di ISO».

### 3.1 Contratto di affidabilità (obbligatorio)

Ogni risposta AI in produzione deve rispettare:

| Regola | Comportamento atteso | Check |
|--------|----------------------|-------|
| **Fonti prima del testo** | Citazioni cliccabili (documento, NC, clausola, articolo di legge) | `AiAssistantCitations` + `getCitationPath` |
| **Scope tenant/azienda** | Studio sceglie azienda; cliente azienda bloccato sulla primaria | ADR-010 / PR #91 |
| **Niente allucinazioni normative** | Solo `clauseRef` / articoli presenti in NormBroker / `norm_requirements` | parse anti-allucinazione (pattern SAL 5-B) |
| **Human-in-the-loop** | L’AI propone; l’operatore Accetta / Modifica / Rifiuta | Disclaimer `AiDisclaimer`; nessuna scrittura silenziosa |
| **Audit trail** | Ogni chiamata in `ai_interactions` | licenza + log |
| **Graceful degradation** | Provider assente → messaggio chiaro, UI non crasha | `aiAvailable: false` |
| **Lingua** | Italiano corretto, termini SGQ coerenti (C/NC/OSS, CAPA, ecc.) | Encoding UTF-8 |

### 3.2 Casi d’uso AI ad alto ROI (ordine di implementazione/rafforzamento)

| ID | Scenario utente (campo o ufficio) | Capacità AI | Licenze | Stato oggi (orientativo) | Gap prodotto |
|----|-----------------------------------|-------------|---------|--------------------------|--------------|
| **AI-M1** | In audit: «Cosa chiede §8.5.1 e cosa ho già evidenziato?» | Chat + contesto audit + NormBroker | `ai_chat` + `ai_norms` | Chat + standard chip | Collegare audit corrente come contesto di default su mobile |
| **AI-M2** | In reparto: foto NC → bozza descrizione + azione | `ai_assist` su NC | `ai_assist` + `nc` | Parziale | Flusso mobile one-shot foto→bozza |
| **AI-M3** | «Questa procedura è scaduta / copre la clausola?» | RAG documenti + scadenze | `ai_chat` + `documents` | Citazioni documenti | Risposta strutturata: stato scadenza + gap |
| **AI-M4** | «Il saldatore X può saldare secondo WPS Y?» | Qualifiche + WPS | `ai_chat` + `qualifiche` (+ `saldatura`) | Dati in app | Prompt dedicato + citazioni record |
| **AI-M5** | SAL: suggerisci stato + obblighi di legge | Già 5-A/5-B | `sal` + `ai_norms` | ✅ | Mobile: aprire dialog da riga senza griglia intera |
| **AI-M6** | Fine giornata: «Cosa manca per chiudere l’audit?» | Sintesi pending issues | `ai_chat` + `audit` | Pending cascade | Prompt «closing brief» con elenco NC/OSS/NV |

### 3.3 Differenziatori da comunicare (vendita / demo)

1. **Risposte ancorate** a norme caricate nello studio e a documenti dell’azienda cliente (non Wikipedia ISO).  
2. **Multi-standard** (9001 / 14001 / 45001 / 3834) con stesso flusso.  
3. **Conformità legislativa** collegata alle clausole (D.Lgs. 81/2008, 152/2006) dove configurata.  
4. **Tracciabilità ISO §7.5**: proposta AI ≠ registrazione ufficiale finché non confermata.  
5. **Campo + offline**: l’auditor lavora senza rete; l’AI arricchisce appena torna online (o in cache locale per FAQ norma frequenti — backlog).

---

## 4. Check navigazione mobile (UI)

Allineato a `AppLayout` bottom nav (max 5 voci):

| Slot | Voce consigliata | Note |
|------|------------------|------|
| 1 | Home | Sempre |
| 2 | Audit | Sempre se licenza |
| 3 | NC | Se licenza `nc` |
| 4 | CND **oppure** Documenti | CND se modulo attivo (già implementato) |
| 5 | **Assistente AI** (se `ai_chat`) **oppure** Documenti/Aziende | **Proposta prodotto**: sostituire Impostazioni in 5° slot con AI quando licenziata — più valore in campo |

Check aggiuntivi:

- [ ] Voci non licenziate assenti dalla bottom nav (coerenza sidebar).  
- [ ] Entry point AI anche da checklist (icona «Chiedi all’AI» sulla domanda corrente).  
- [ ] Microfono: `Permissions-Policy` + flusso getUserMedia (playbook bug method).  
- [ ] Nessuna emoji decorative nuove oltre al design system esistente; label chiare.

---

## 5. Checklist DoD per slice (ripetibile)

Prima di dichiarare «mobile OK» o «AI OK» su un modulo:

### Mobile campo

- [ ] Uso a una mano / pollice (CTA principali in basso).  
- [ ] Funziona offline o degrada con messaggio chiaro (ADR-008).  
- [ ] Foto/allegati non obbligatori dove la golden rule lo vieta (solo NC/OSS note).  
- [ ] Test L1 + smoke autenticato su viewport mobile (o Playwright mobile).  
- [ ] Nessuna tabella densissima come unico percorso (alternativa «scheda»).

### AI affidabile

- [ ] Citazioni o messaggio esplicito «nessuna fonte in archivio».  
- [ ] Scope `organization_id` / `company_id` verificato.  
- [ ] Accetta/Modifica/Rifiuta se la feature scrive dati.  
- [ ] `AiDisclaimer` visibile.  
- [ ] Log `ai_interactions` + gate licenza corretta.  
- [ ] Anti-allucinazione su riferimenti normativi/legali.

---

## 6. Sequenza di rilascio consigliata (slice verticali)

Ordine pensato per ROI commerciale (demo auditor in azienda) senza mischiare DB/sync pesanti:

| Slice | Titolo | Perimetro tipico | Dipendenze |
|-------|--------|------------------|------------|
| **M-AI-1** | Bottom nav: slot AI + deep-link contesto | Solo FE `AppLayout` + route | `ai_chat` |
| **M-AI-2** | Chat: contesto «audit corrente» automatico su `/audit` | FE + piccolo backend context | Audit attivo |
| **M-AI-3** | Prompt pack campo (AI-M1, AI-M3, AI-M6) | Prompt + test citazioni | NormBroker |
| **M-AI-4** | NC: foto → bozza AI (AI-M2) | NC drawer + `ai_assist` | Offline queue |
| **M-AI-5** | Qualifiche/WPS Q&A (AI-M4) | Chat tools / retrieval | Modulo qualifiche |
| **M-AI-6** | SAL mobile light + dialog AI esistente | FE responsive | SAL 5-A/5-B |

Fuori sequenza (non bloccare): riesame, gap desktop, import PDF, billing.

---

## 7. Metriche di successo (semplici)

| Metrica | Segnale positivo |
|---------|------------------|
| % sessioni mobile con almeno 1 salvataggio audit/NC | Uso reale in campo |
| % risposte AI con ≥1 citazione valida | Affidabilità percepita |
| % suggerimenti AI accettati (non solo aperti) | Utilità |
| Tempo medio «apri NC → salva con foto» su telefono | Frizione UX |
| Ticket «l’AI ha inventato la clausola» | Deve tendere a zero |

---

## 8. Decisioni già assunte (non riaprire senza prodotto)

1. Telefono = **cattura e verifica**; PC = **analisi e report**.  
2. AI **non** scrive record ufficiali senza conferma umana (ISO §7.5).  
3. Vantaggio competitivo = **specificità** (norme studio + dati azienda + citazioni), non «più creatività».  
4. Conformità legislativa SAL resta capability su `ai_norms` (seam già pronto per scorporo futuro).

---

## Riferimenti

- [ADR-010 — Architettura AI](../adr/ADR-010-ai-agentic-architecture.md)  
- [ADR-004 — Auth mobile](../adr/ADR-004-mobile-auth-localstorage.md)  
- [ADR-008 — Sync event-sourced](../adr/ADR-008-event-sourcing-sync.md)  
- [MODULO_SAL_SCOPO_E_ROADMAP.md](MODULO_SAL_SCOPO_E_ROADMAP.md)  
- [PROJECT_ROADMAP.md](../PROJECT_ROADMAP.md) — Strategia Mobile / Desktop  
- [GUIDA_CONSOLIDATA.md](../GUIDA_CONSOLIDATA.md) — lezioni AI / licenze / encoding  
