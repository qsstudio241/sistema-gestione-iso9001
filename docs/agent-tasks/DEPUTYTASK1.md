# DEPUTYTASK1 — ISO-2: Riesame §5.3 — traccia data/utente + Word (niente blocco)

**Stato:** APERTO  
**Aperto:** 16/08/2026 (dopo merge ISO-1d [PR #442](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/442))  
**Piano:** [`PLAN_3834_SLICES.md`](PLAN_3834_SLICES.md)  
**Rischio:** Medio (backend additivo + UI commesse, non auth/sync) — PR + gate Bugbot; **non** push su `main`

> **Allineamento Git (autonomo)**: `git fetch origin main` e `git pull origin main` prima di leggere questo brief.

---

## Slice unica: ISO-2

**Obiettivo**: sulla commessa si vede **chi e quando** ha completato il riesame tecnico §5.3, e si può **scaricare un Word** della checklist. La commessa si apre comunque se la checklist è incompleta (HITL 16/08). Il banner di avviso resta.

### Contesto

- Checklist 17 punti già in `projects.technical_review_checklist` (mig. 128). Nessun blocco oggi — non aggiungerne.
- Traccia nel JSON (`_completion`), **niente nuova colonna** (niente migrazione VPS).
- Word programmatico (pattern SAL/WPS), non un template Mason (quello è ISO-4 RDP).

### DoD

1. Completando tutti i 17 punti, al salvataggio resta data + utente (primo completamento)
2. Se si toglie una spunta, il timbro sparisce
3. Pulsante Word della checklist (visibile anche se incompleta)
4. Banner «Da completare» invariato se stato Aperta e checklist incompleta
5. Test L1 FE (util + Word blob) e BE (stamp)
6. PR + Bugbot

### File previsti

- `app/src/data/technicalReviewItems.js`
- `app/src/utils/technicalReviewChecklist.js`
- `app/src/utils/wordExportTechnicalReview.js`
- `app/src/pages/ProjectsPage.jsx` (+ CSS minimo)
- `backend/src/utils/technicalReviewChecklist.js`
- `backend/src/controllers/projects.controller.js`

### Cosa NON toccare

- `DEPUTYTASK.md` (SAL S1a)
- Blocco apertura commessa
- Word RDP / template Mason (ISO-4)
- `auth.middleware.js`, sync, JWT
