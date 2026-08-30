# DEPUTYTASK — LG-1: Gap fonti in risposta Gemini + Libreria + email superadmin

**Stato:** CHIUSO — TEST OK  
**Aperto:** 30/08/2026  
**Chiuso:** 30/08/2026  
**Piano:** [`PLAN_LIBRERIA_GAP_SLICES.md`](PLAN_LIBRERIA_GAP_SLICES.md)  
**Rischio:** Medio — BE additivo (`/ai/chat`, persistenza, email); migrazione 160 additive  
**Branch:** `cursor/lg1-libreria-gap-9166`  
**Esito:** TEST OK — Jest BE 22 · Vitest FE 11 · build OK

## Esito

- Prompt Gemini + blocco `<<<SGQ_SOURCE_GAPS>>>`; reply pulita + `sourceGaps` in JSON
- Tabella `library_source_requests` (mig. 160) + API GET/POST `/library/source-requests`
- Email superadmin via `alertMail` (solo `closurePath=platform`); dedupe 7gg
- FE: blocco gap in Assistente + link Libreria; Libreria elenca richieste server (fonte Assistente)
- Note = perché serve + dubbi qualità (non gergo STUD)
- **Niente** pdf-to-json automatico

## DoD

- [x] Gap in UI assistente (tenant richiedente)
- [x] Persistenza server + lista Libreria
- [x] Email superadmin (o skip log se SMTP assente)
- [x] Note qualità
- [x] Test + build
- [x] Brief CHIUSO

## Post-merge operativo

1. Deploy backend + `node /tmp/run-migration-160-vps.js` sul VPS  
2. Verificare SMTP env per email reali
