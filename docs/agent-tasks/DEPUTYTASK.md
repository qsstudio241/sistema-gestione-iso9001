# DEPUTYTASK — Ripresa lavori 11 maggio 2026

> Questo file viene **sovrascritto** ad ogni nuovo task. Lo legge l'agente AI quando il committente riapre la sessione.

## Stato consegnato (10 maggio 2026 sera)

Ultimo lavoro: **integrazione audit → modulo NC con licenza modulo + undo 10s**.

| Componente | Stato | Riferimento |
|---|---|---|
| Migration 052 (pending_issues.nc_id + non_conformities.source_*) | ✅ Applicata in produzione | `database/migrations/052_nc_audit_integration.sql` |
| Backend `nc.controller.js` (push bulk + undo) | ✅ Deployato (PID 71141) | `backend/src/controllers/nc.controller.js` |
| Backend `audit.controller.js` (getPendingIssues esteso con join NC) | ✅ Deployato | `backend/src/controllers/audit.controller.js` |
| Frontend `AuditClosePanel` (sezione push + countdown 10s) | ✅ Build pulita | `app/src/components/AuditClosePanel.jsx` |
| Frontend `PendingIssuesCascade` (badge stato NC dal modulo) | ✅ Build pulita | `app/src/components/PendingIssuesCascade.jsx` |
| Fix bug `hasLicensedModule` come funzione | ✅ Corretto | `app/src/components/NonConformitiesManager.jsx` |
| Test L1 | ✅ 153/156 PASS (3 fail pre-esistenti `wordExport.*`) | — |
| Commit | ✅ `732f45e` su `cursor/adr009-fase1-registro-standard-52c5` | — |

## Cosa deve fare il committente prima di riprendere

**Smoke L3 in produzione (Netlify deploya da main automaticamente, quindi prima va merge della PR #40):**

1. Aprire un audit di test con licenza modulo NC attiva.
2. Inserire almeno 1 NC e 1 OSS nella checklist.
3. Andare a **🔒 Chiusura Audit** → verificare che appaia la sezione **"📋 Trasferimento al modulo Non Conformità"**.
4. Cliccare **"📤 Trasferisci NC e OSS al modulo NC"** → verificare toast con countdown da 10 a 0 secondi e pulsante **"↩ Annulla trasferimento"**.
5. **Test undo**: cliccare Annulla entro 10s → verificare che le NC scompaiano da `/nc`.
6. **Test finalizzazione**: ripetere il push, attendere 10s → verificare che le NC siano in `/nc` con `nc_number` `NC-{audit_number}-001`, severity corretta, source_type `audit_nc`/`audit_oss`.
7. **Test idempotenza**: cliccare di nuovo il pulsante → verificare che le NC esistenti vengano saltate (skipped_count ≥ 0, created_count = 0).
8. **Test re-audit**: chiudere l'audit, creare un nuovo audit per lo stesso cliente, andare a **1.3 Rilievi Pendenti** → verificare che ogni rilievo mostri il badge **"📋 Gestita nel modulo NC come NC-… — stato attuale: …"** con eventuale azione correttiva.
9. **Test senza licenza**: in un'org dove il modulo `nc` non è licenziato (rimuovere temporaneamente da `licensed_modules`) → verificare che la sezione push **NON sia visibile** ma compaia invece la nota informativa "Le NC saranno presentate come rilievi pendenti nel prossimo audit".

## Possibili evoluzioni successive (in ordine di valore)

### A. Auto-push alla chiusura (opzionale, da decidere col committente)
Oggi il push è manuale (utente clicca dopo aver visto le metriche). Possibile alternativa: **auto-push alla pressione di "🔒 Chiudi Audit"** se la licenza è attiva, con la stessa finestra undo 10s. Più snello ma toglie controllo all'utente.

### B. Filtri per standard nella `NCPage`
Oggi `/nc` mostra tutte le NC senza filtro per standard. Da multi-standard ADR-009: aggiungere selettore standard nella barra filtri.

### C. Link bidirezionale UI: da NCPage all'audit di origine
Oggi non c'è un pulsante "Vai all'audit che ha generato questa NC" in `NCPage`. Aggiungerlo accanto al numero NC.

### D. Escalation OSS → NC al re-audit
Oggi se un'OSS persiste al re-audit, l'auditor può marcarla come "persiste" ma rimane OSS nel modulo. Logica normativa: dopo N audit consecutivi non risolta, dovrebbe diventare NC. Implementabile con `source_type='reaudit_persists'` (già previsto in migration 052) e severity-bump automatica.

### E. Fase 2 ADR-009 (parallela)
Sezione 11 per-norma + flag SGI integrato + chiusura per norma. Già architettato e abilitato dalla Fase 1.

## Attenzioni operative per la prossima sessione

- **Branch corrente**: `cursor/adr009-fase1-registro-standard-52c5` — **non ancora mergiato** in main. La PR #40 raccoglie ADR-009 Fase 1 + integrazione NC. Decidere se chiuderla in unico merge o splittare.
- **Bug latente dichiarato in apiService.js**: `getNonConformity`, `updateNonConformity`, `deleteNonConformity` puntano a `/nc/...` ma il backend espone `/non-conformities/...`. Non emerge perché chi li chiama oggi è solo il modulo audit (che usa `createNonConformity` con path corretto). Da correggere quando si tocca quel file.
- **Pattern migrazioni Cloud Agent consolidato**: vedi sezione 10/05 sera in `GUIDA_CONSOLIDATA.md`. NON usare `split(/^GO$/)` per parsing SQL — array di statement esplicito è l'unica via affidabile.

## Comando da incollare in Cursor per ripartire

```
Riprendo i lavori sul progetto SGQ ISO 9001.
Leggi PROJECT_CONTEXT.md, docs/PROJECT_ROADMAP.md (sezione "Prossimo Step"), docs/GUIDA_CONSOLIDATA.md (sessione 10 maggio sera).
Verifica con me l'esito dello smoke L3 sull'integrazione audit → modulo NC (8 punti elencati in DEPUTYTASK.md).
Se OK: decidiamo se mergiare la PR #40 + procedere con Fase 2 ADR-009 oppure con consolidamento UX modulo NC.
```
