# DEPUTYTASK — NG-3: rafforzare skill gap-analysis (mapping + quando chiedere PDF)

**Stato:** APERTO  
**Aperto:** 25/08/2026  
**Piano:** [`PLAN_NORM_FIDELITY_SLICES.md`](PLAN_NORM_FIDELITY_SLICES.md)  
**Dipende da:** NG-0 + NG-1 **CHIUSI** (stessa PR / main)  
**Rischio:** Basso — solo skill docs; niente app/backend.  
**Parallelo a:** CND-2 su [`DEPUTYTASK1.md`](DEPUTYTASK1.md) — **non** toccare `NdtReportsPage` / controller NDT.

## Perché

NG-0/1 hanno policy + backlog. La skill `gap-analysis-normativa` deve rendere esplicito il percorso «manca MD → backlog → richiesta HITL» e tenere il mapping moduli aggiornato senza creare nuovi agenti GitHub.

## DoD

1. In `.cursor/skills/gap-analysis-normativa/SKILL.md`: sezione breve «Quando chiedere PDF» (link backlog + HANDOFF template).
2. Completare eventuali buchi di mapping in `reference.md` ancora segnati `?` solo se deducibili da roadmap/codice senza inventare; altrimenti lasciare e citare backlog.
3. Spuntare NG-3 nel PLAN; brief CHIUSO — TEST OK (docs).
4. UTF-8 check sui file toccati.

## File previsti

- `.cursor/skills/gap-analysis-normativa/SKILL.md`
- `.cursor/skills/gap-analysis-normativa/reference.md` (solo se serve)
- `docs/agent-tasks/PLAN_NORM_FIDELITY_SLICES.md`
- `docs/agent-tasks/DEPUTYTASK.md` (chiusura)

## Cosa NON toccare

- `app/**`, `backend/**`, CND, Second Brain runtime
- `DEPUTYTASK1.md` (CND-2)
- Installazione skill GitHub esterne
- NG-4/NG-5

## Verifica

- [ ] Sezione «Quando chiedere PDF» presente
- [ ] PLAN NG-3 spuntato; brief CHIUSO
- [ ] Nessun codice app
