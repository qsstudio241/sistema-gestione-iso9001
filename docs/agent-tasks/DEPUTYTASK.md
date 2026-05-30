# DEPUTYTASK — NC Fase 1 · Slice 5 (Creazione NC + allegati)

**Stato:** **PRONTO PER DEPUTY** (frontend — indipendente da Slice 4)

**Slice 1:** ✅ COMPLETATO (alias `getNonConformitiesStatistics` + test HomePage)

**Slice 4:** ✅ COMPLETATO (NcDetailPanel editabile + integrazione NCPage + test L1)

---

## Obiettivo Slice 5

Estendere il registro NC (`/nc`) con:

1. **Creazione NC manuale** da registro (`POST /non-conformities`, `source_type: manual`)
2. **Allegati NC** con `AttachmentSection` + hook `useAttachmentManager` (pattern checklist)
3. **Badge/link `source_complaint_id`** → reclamo origine (se presente)
4. Allineamento note verifica in `PendingIssuesCascade` con campo `verification_notes`

**Non** implementare in questa slice: push audit flow, modifiche backend oltre a quanto già esposto.

---

## Vincoli obbligatori

| Vincolo | Dettaglio |
|---------|-----------|
| **Push audit** | **NON** toccare `AuditClosePanel.jsx`, `pushAuditToNcRegister`, `undoPushAuditToNcRegister`, `PendingIssuesCascade` push flow (salvo allineamento `verification_notes` se esplicitamente in scope) |
| **Backend** | Usare endpoint esistenti; nuove migrazioni solo se assenti |
| **Riuso UI** | `QuestionCard`, `AttachmentSection`, `notes-textarea`, `ChecklistModule.css` |
| **Validazione UX** | Blur / submit, mai su ogni keystroke |
| **Encoding** | UTF-8, accenti italiani corretti |

---

## Baseline post-Slice 4

### Implementato

| File | Stato |
|------|-------|
| `app/src/components/NcDetailPanel.jsx` | ✅ 6 campi editabili, `notes-textarea`, readonly closed/verified |
| `app/src/pages/NCPage.jsx` | ✅ `<NcDetailPanel nc={nc} onSaved={loadNc} />` in card espansa |
| `app/src/pages/NCPage.css` | ✅ `.nc-detail-form`, legacy read-only |
| `app/src/tests/ncDetailPanel.test.js` | ✅ 6 test verdi |

### Verifica Slice 4 (30/05/2026)

```text
Vitest: 6/6 passed (ncDetailPanel.test.js)
Vite build: OK
```

---

## File da creare / modificare (Slice 5)

| File | Azione |
|------|--------|
| `app/src/pages/NCPage.jsx` | Pulsante «Nuova NC» + form/modal creazione |
| `app/src/components/NcDetailPanel.jsx` | Sezione allegati (opzionale qui o componente dedicato) |
| `app/src/services/apiService.js` | `createNonConformity` se assente |
| `app/src/tests/ncCreate.test.js` | Test L1 creazione manuale |
| `docs/GUIDA_CONSOLIDATA.md` | Nota operativa post-implementazione |

---

## Definition of Done (Slice 5)

- [ ] Creazione NC manuale funzionante (POST + refresh lista)
- [ ] Allegati NC upload/preview (pattern AttachmentSection)
- [ ] Link reclamo origine se `source_complaint_id`
- [ ] Test L1 verdi + build Vite OK
- [ ] Nessuna regressione NcDetailPanel / workflow stati
- [ ] Chiusura deputy: **TEST OK** o **FIX NON APPLICABILI**

---

## Comando deputy standard

```
Leggi docs/agent-tasks/DEPUTYTASK.md ed eseguilo. Chiudi con TEST OK o FIX NON APPLICABILI.
```

---

*Aggiornato 30/05/2026 — NC Fase 1 Slice 4 COMPLETATO → brief Slice 5*
