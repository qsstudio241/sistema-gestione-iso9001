# Prompt di ripresa — nuova chat (da sessione 07/05/2026)

## Contesto

Leggi nell'ordine solito: `PROJECT_CONTEXT.md` → `docs/PROJECT_ROADMAP.md` → `docs/GUIDA_CONSOLIDATA.md`.

## Stato al momento della pausa

### Branch aperto (PR #33)

`cursor/audit-module-gap-fixes-7b2a` — **PR #33** su GitHub, non ancora mergiato.

**14 fix completati in questa sessione** (tutti testati: 103/103 Vitest, build OK):

| Area | Fix |
|------|-----|
| Infra | Conflitti Git irrisolti rimossi (build bloccata) |
| Bug | Route NC `createNonConformity` corretta (`/nc` → `/non-conformities`) |
| S-A6-C | Pulsante "Registra nel modulo NC" in `NonConformitiesManager` |
| Metriche | `updateAuditMetrics` somma ISO+custom |
| UX | Emoji corrotte `AuditClosePanel`, ellissi NC, link documentale post-export |
| SYNC-5 | Upload allegati offline completo (customItemId fix, delete offline, badge ⏳, patch IDB post-upload) |
| Lock | Hydration server-wins per utente B; `isReadOnly` per foreign; auto-retry 30s; cleanup import morti |
| Offline-first | `save_responses`/`update_audit` accodati **anche offline**; hint ConnectionStatus preciso |

### Azione deploy necessaria

1. **Merge PR #33** → Netlify auto-deploy frontend (~2 min)
2. **Backend VPS** (solo cleanup — comportamento funzionale invariato):
   ```bash
   # SCP dei 4 controller con import morti rimossi
   scp -P 1122 -i $KEY backend/src/controllers/audit.controller.js \
     backend/src/controllers/attachment.controller.js \
     backend/src/controllers/customChecklist.controller.js \
     backend/src/controllers/response.controller.js \
     spascarella@www.fr-busato.it:/var/www/sgq-backend/src/controllers/
   # Restart
   ssh -i $KEY -p 1122 ... "echo '$SGQ_SUDO_PASSWORD' | sudo -S systemctl restart sgq-backend.service"
   ```
   Verifica: `curl -sk https://www.fr-busato.it:8443/api/v1/health`

## Prossime priorità (dalla roadmap)

| # | Priorità | Task | Note |
|---|----------|------|------|
| 1 | Alta | **Smoke Mason ISO 3834** — passi 6-7 | Smoke L3 umano su produzione |
| 2 | Alta | **Smoke Word export Camellini** audit reale | Verifica export con allegati e pending issues |
| 3 | Media | **ISO 14001 checklist completa** da norma PDF | Norma disponibile in `Normative/` |
| 4 | Media | **SMTP Alert Engine VPS** | Configurare variabili env `SMTP_*` sul VPS |
| 5 | Bassa | Sezione 11 drill-down NC/OSS (G5) | P2 backlog |
| 6 | Bassa | Token monouso allegati Word (G7) | P2 backlog |

## Gap residui backlog (P2)

- **G5**: Sezione 11 drill-down lista NC/OSS per clausola (solo visuale, non bloccante)
- **G7**: Token download monouso per allegati nel Word (sicurezza, non urgente)
- **G8**: Registrazione automatica Word in DocumentRegistry dopo export (stub link già presente)
- **T6**: Recovery UI + history API + compaction job notturno (compliance ISO 9001 §7.5)

## File chiave modificati in questa sessione

```
app/src/components/AuditAccordionLayout.jsx     ← lock foreign in isReadOnly
app/src/components/AuditClosePanel.jsx           ← emoji corrette
app/src/components/AttachmentSection.jsx/.css    ← badge ⏳ pendingSync
app/src/components/ConnectionStatus.jsx          ← hint offline, syncing state
app/src/components/ExportPanel.jsx/.css          ← link documentale
app/src/components/NonConformitiesManager.jsx/.css ← S-A6-C, ellissi
app/src/components/PendingIssuesCascade.jsx/.css ← conflitti Git risolti
app/src/contexts/StorageContext.jsx              ← lock FIX-LOCK-1/3, offline-first, SYNC-5-C
app/src/hooks/useAttachmentManager.js            ← SYNC-5-B (delete + auditUuid)
app/src/services/apiService.js                   ← route NC corretta
app/src/services/syncService.js                  ← SYNC-5-A (customItemId, delete_attachment)
app/src/utils/metricsCalculator.js               ← ISO+custom, NV esplicito
backend/src/controllers/audit.controller.js      ← import morti rimossi
backend/src/controllers/attachment.controller.js ← import morti rimossi
backend/src/controllers/customChecklist.controller.js ← import morti rimossi
backend/src/controllers/response.controller.js   ← import morti rimossi
docs/GUIDA_CONSOLIDATA.md                        ← sessione aggiornata
docs/PROJECT_ROADMAP.md                          ← stato aggiornato
docs/agent-tasks/AUDIT_MODULE_LEAD_BRIEF.md      ← S-A6 completata, stato gap
```

## Note operative

- **Produzione usa** `VITE_SYNC_MODE=legacy` (default) — la modalità `events` (T3/T4) è disponibile ma non attiva in prod.
- **Lock TTL**: 15 minuti (env `AUDIT_LOCK_TTL_MINUTES`). Auto-retry B: ogni 30s.
- **Commit message convention**: seguire i commit esistenti (`fix(area):`, `feat(area):`, `chore:`).
- **Test prima di ogni commit**: `cd app && NODE_ENV=test npm run test:run && npm run build`.
