# Open Points — Sistema Gestione ISO 9001

**Ultimo aggiornamento**: 2026-04-14  
**Owner**: Team SGQ ISO

---

## Fonte di verità per priorità e prossimi passi

Le priorità operative, gli sprint e la Definition of Done sono in:

- **[docs/PROJECT_ROADMAP.md](PROJECT_ROADMAP.md)** — roadmap, prossimo step, checklist licenze/auth (sessioni A–E), RBAC.
- **[docs/GUIDA_CONSOLIDATA.md](GUIDA_CONSOLIDATA.md)** — deploy, smoke, sync, Word, import, lezioni apprese.

Questo file (`open_points.md`) resta come **registro sintetico** di punti aperti tecnici non ancora riassunti altrove, più **storico** delle issue chiuse prima del 2026-04-14.

---

## Aperti tecnici (sintesi — verificare su roadmap)

| Area | Nota | Dove approfondire |
|------|------|-------------------|
| E2E browser / Netlify | Flussi completi su preview; non sostituisce Vitest CI | Roadmap, piramide L5 in GUIDA_CONSOLIDATA |
| Export Word / smoke post-deploy | Verificatore, mojibake, NV/N.A., logo, pending/AP | Roadmap “Prossimo Step (0)–(3)” |
| Android export Word | File System Access non disponibile; fallback | Sezioni storiche sotto in questo file (#003) |
| Quota IndexedDB Android | Rischio overflow foto | ADR-003, roadmap Fase 0.B |
| Rate limiting produzione | Allineare env / limiti | Sezione storica #002 sotto |
| Test `/response-options` in CI | Contratto dati sotto `app/src/tests/integration/response-options-api.test.js` (mock); smoke rete = backend reale | `app/src/tests/integration/` |

---

## Storico (pre 2026-04-14) — non usare come backlog attivo

Le sezioni seguenti documentano problemi e piani **già superati o datati** (es. P1/P2 marzo 2026, piano settimanale gennaio 2026). Si mantengono solo per **tracciabilità**; per lavorare oggi usare **PROJECT_ROADMAP** e **GUIDA_CONSOLIDATA**.

<details>
<summary><strong>Archivio: priorità marzo 2026 e risolti 9894ed5</strong></summary>

### P1 - TEST E2E (marzo 2026)

- Test Netlify multi-standard, accordion ISO 14001, sync `standard_id`, riapertura risposte.

### P2 - EXPORT WORD ISO 14001 (marzo 2026)

- Sezione ISO 14001 in export (la roadmap successiva marca export 14001 come evoluto in prodotto; verificare su branch/release).

### Risolti 2026-03-01 — commit `9894ed5`

- **#006–#009**: `selectedStandards`, tab ISO 14001, `auditConverter`, `syncService` / `standard_id` — dettaglio in commit e in `docs/archive/sessions/` se serve.

</details>

---

## Riferimenti rapidi

- **Issue dettagliate**: [ISSUE_TRACKER.md](ISSUE_TRACKER.md) (se aggiornato).
- **ADR mobile / PWA**: [adr/ADR-003-pwa-mobile-android-strategy.md](adr/ADR-003-pwa-mobile-android-strategy.md).
- **Migrazioni DB**: `database/migrations/`.

---

## Workflow (deprecato rispetto alla guida consolidata)

La regola storica *“se non è in open_points non è prioritario”* è **sostituita** da: priorità in **PROJECT_ROADMAP** + procedure in **GUIDA_CONSOLIDATA**; aggiornare quei file a fine lavoro significativo.

---

## Dettaglio storico (gennaio–marzo 2026)

Il contenuto originale esteso (sync risposte, export Android, rate limit, BP-001/002, statistiche, piano settimanale gennaio) è stato **compattato** il 2026-04-14 per evitare contraddizioni con la roadmap. Per il testo completo precedente usare `git show 0af5d57:docs/open_points.md` (o commit precedente al ripristino).
