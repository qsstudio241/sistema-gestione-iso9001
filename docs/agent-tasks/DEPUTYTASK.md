# DEPUTYTASK — Slice R1 (job validità sul registro)

**Stato:** pronto per esecuzione — **Gate 0 completato** (25/05/2026)

## Gate 0 — esito (lead)

| Step | Esito |
|------|--------|
| Fix CI `xlsx` + Vitest 371/371 | **OK** |
| Merge PR [#65](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/65) su `main` (`b0a5900`) | **OK** |
| Deploy VPS file norme + restart PID `259962` → `260569` | **OK** |
| Health API | **OK** |
| Smoke `POST /documents/norm-lookup` D.Lgs. 81/2008 → Normattiva `active` | **OK** |

**VPS npm (25/05 12:03):** `npm install` in `/var/www/sgq-backend` — log: `[AlertScheduler] Scheduler avviato` (alert 08:00, norme lun 03:00). Email settimanale norme superate abilitata se `ALERT_ENABLED=true`.

---

## Obiettivo slice R1

Estendere il job settimanale di validità norme a **tutto** `document_registry` (`doc_type=norma` con `standard_code` in JSON), non solo `norm_document_sources`.

**Brief completo:** [TASK_REGISTRY_NORM_R1_VALIDITY_JOB.md](./TASK_REGISTRY_NORM_R1_VALIDITY_JOB.md)  
**Piano:** [PLAN_REGISTRY_NORM_SOT_SLICES.md](./PLAN_REGISTRY_NORM_SOT_SLICES.md)

**Branch:** `cursor/registry-norm-sot-r1-b492` da `main` aggiornato.

---

## Comando deputy

```
Leggi docs/agent-tasks/TASK_REGISTRY_NORM_R1_VALIDITY_JOB.md ed eseguilo.
Chiudi con TEST OK o FIX NON APPLICABILI.
```

---

## Criteri chiusura

- [ ] Test Jest `normValidityChecker` (mock) verdi
- [ ] PR con CI verde
- [ ] Deploy VPS + log job con norme registro incluse
- [ ] Riga in `GUIDA_CONSOLIDATA.md` (job legge registro)
