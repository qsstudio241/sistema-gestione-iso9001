# Prompt di ripresa — prossima chat (dopo sessione 07/05/2026 pomeriggio)

## Leggi nell'ordine
`PROJECT_CONTEXT.md` → `docs/PROJECT_ROADMAP.md` → `docs/GUIDA_CONSOLIDATA.md`

---

## Stato a fine giornata 07/05/2026

### Tutto su `main` — repo e VPS allineati

| Attività | Esito |
|----------|-------|
| Merge PR #33 (14 fix audit, offline-first, SYNC-5, lock) | ✅ su main, Netlify deploy |
| Deploy VPS: 4 controller + routes (fix crash `promoteAuditNcToModule`) | ✅ backend healthy |
| Migration 049: ISO 14001:2015 checklist completa (53 domande, §4→§10) | ✅ produzione |
| nodemailer + node-schedule installati sul VPS | ✅ |
| SMTP placeholder nel `.env` VPS (`ALERT_ENABLED=false`) | ✅ — credenziali mancanti |

### Azioni manuali ancora pendenti (committente)
1. **Smoke Mason ISO 3834** (passi 6-7): test L3 su produzione — aprire audit ISO 3834 e verificare comportamento.
2. **Smoke Word export Camellini**: aprire un audit ISO 9001 reale e scaricare il report Word — verificare pending issues, allegati e template.
3. **SMTP Alert Engine**: nel file `/var/www/sgq-backend/.env` sul VPS compilare:
   ```
   ALERT_ENABLED=true
   SMTP_HOST=<host SMTP>
   SMTP_PORT=587
   SMTP_USER=<email mittente>
   SMTP_PASS=<app-password>
   SMTP_FROM=SGQ Studio <email mittente>
   ```
   Poi: `sudo systemctl restart sgq-backend.service`

---

## Prossime priorità tecniche (agent)

| # | Priorità | Task | Note |
|---|----------|------|------|
| 1 | 🔴 Media | **Sezione 11 — drill-down NC/OSS per clausola (G5)** | Solo frontend, non bloccante per produzione |
| 2 | 🔴 Media | **ISO 45001 checklist** | Norma disponibile in `docs/Normative/Normative NORMA_00002_ UNI ISO 45001_2018 Rev. 0.md` — stesso pattern migration 049 |
| 3 | 🟡 Bassa | **`norm_excerpt` nel report Word** | Aggiungere colonna `norm_excerpt` in `checklist_questions` + Word export |
| 4 | 🟡 Bassa | **Token monouso allegati Word (G7)** | Sicurezza, non urgente |
| 5 | 🟢 Backlog | **G8 — Registrazione Word in DocumentRegistry** | Stub link già presente in ExportPanel |

---

## Note tecniche

- **Deploy VPS pattern** per migrazioni: `DB_SERVER=localhost DB_PORT=11043 DB_DATABASE=SGQ_ISO9001 DB_USER=pascarella DB_PASSWORD='#Gestione2025@' NODE_ENV=production node /tmp/run-migration-XXX-vps.js` (cd /var/www/sgq-backend prima).
- **Bug route VPS**: verificare sempre che `audit.routes.js` sul VPS sia allineato al repo prima del restart — il file può divergere da sessioni precedenti.
- **ISO 14001 migration 049**: applicata, idempotente. Se si vuole aggiungere `clauseRef` per Word export ISO 14001, recuperare i `question_id` assegnati con la query di verifica in fondo al migration file.
- **Test L1**: sempre `cd app && NODE_ENV=test npm run test:run && npm run build` prima di ogni commit.

---

## Nessun DEPUTYTASK attivo

Non ci sono task delegabili a deputy al momento: tutte le priorità pendenti o richiedono decisione committente (smoke L3, SMTP) o sono feature che andrebbero avviate da questa chat con contesto completo.
