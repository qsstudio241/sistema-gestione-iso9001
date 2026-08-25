# DEPUTYTASK — NG-3: rafforzare skill gap-analysis (mapping + quando chiedere PDF)

**Stato:** CHIUSO  
**Aperto:** 25/08/2026  
**Chiuso:** 25/08/2026 — TEST OK (docs)  
**Piano:** [`PLAN_NORM_FIDELITY_SLICES.md`](PLAN_NORM_FIDELITY_SLICES.md)  
**Dipende da:** NG-0 + NG-1 **CHIUSI** (stessa PR / main)  
**Rischio:** Basso — solo skill docs; niente app/backend.  
**Parallelo a:** CND-2 su [`DEPUTYTASK1.md`](DEPUTYTASK1.md) — **non** toccato `NdtReportsPage` / controller NDT.

## Perché

NG-0/1 hanno policy + backlog. La skill `gap-analysis-normativa` deve rendere esplicito il percorso «manca MD → backlog → richiesta HITL» e tenere il mapping moduli aggiornato senza creare nuovi agenti GitHub.

## DoD

1. In `.cursor/skills/gap-analysis-normativa/SKILL.md`: sezione breve «Quando chiedere PDF» (link backlog + HANDOFF template).
2. Completare eventuali buchi di mapping in `reference.md` ancora segnati `?` solo se deducibili da roadmap/codice senza inventare; altrimenti lasciare e citare backlog.
3. Spuntare NG-3 nel PLAN; brief CHIUSO — TEST OK (docs).
4. UTF-8 check sui file toccati.

## File toccati

- `.cursor/skills/gap-analysis-normativa/SKILL.md`
- `.cursor/skills/gap-analysis-normativa/reference.md`
- `docs/agent-tasks/PLAN_NORM_FIDELITY_SLICES.md`
- `docs/agent-tasks/DEPUTYTASK.md` (chiusura)

## Cosa NON toccare (rispettato)

- `app/**`, `backend/**`, CND, Second Brain runtime
- `DEPUTYTASK1.md` (CND-2)
- Installazione skill GitHub esterne
- NG-4/NG-5
- GUIDA / roadmap § Stato attuale (CND-2 ancora APERTO — sync dopo merge)

## Verifica

- [x] Sezione «Quando chiedere PDF» presente
- [x] PLAN NG-3 spuntato; brief CHIUSO
- [x] Nessun codice app

## Esito mapping `?`

- Checklist 9001/14001/45001: in produzione (conteggi da `checklistTemplates.js` + ADR-002). 45001 **non** è più backlog.
- SAL: live (`SALModule.jsx`, `wordExportSal.js`, motore gap) — non `audits.document_type` come motore.
- RDP + foto: live (PR #290). Word RDP: backlog **prodotto** (template Mason), non lacuna normativa.
- ISO 9712 testo integrale: lasciato al [`NORME_MANCANTI_BACKLOG.md`](../reference/NORME_MANCANTI_BACKLOG.md) (già tracciato).
