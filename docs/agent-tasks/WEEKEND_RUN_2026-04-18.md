# Brief weekend — smoke post-deploy + export Word (Agents Window)

> **Creato**: 18 aprile 2026  
> **Allineamento**: `docs/PROJECT_ROADMAP.md` — blocco *Prossimo Step* (aggiornamento roadmap 12/04/2026).  
> **Uso**: sessione **Cursor Agents Window** con **Composer 2** (promo weekend = più margine per task multi-step).  
> **Fonte di verità operativa**: leggere anche `PROJECT_CONTEXT.md` e `docs/GUIDA_CONSOLIDATA.md` prima di toccare codice.

---

## Obiettivo della sessione

Chiudere in modo **tracciabile** (note in PR + eventuale aggiornamento guida) una tornata di **verifiche post-deploy** e **smoke export Word**, senza introdurre regressioni su sync/offline e multi-tenant.

Ordine consigliato (dalla roadmap):

| # | Area | Cosa verificare (alto livello) |
|---|------|--------------------------------|
| 0 | Lista audit | Stesso utente, **mobile e desktop**; dataset realistico (**>50 audit** se disponibile in ambiente di test). Scroll, filtri, apertura audit, nessun errore console bloccante. |
| 1 | Export Word | Campo **verificatore** corretto nei documenti generati; **titoli** senza **mojibake** (encoding UTF-8 / OOXML). |
| 2 | Export Word | Valori **NV** / **N.A.** coerenti con UI e template; segnaposto **`[LOGO]`** (o equivalente) risolto come da prodotto attuale. |
| 3 | Export Word | **Pending issues** + riga **AP** (allineamento a `ExportPanel` / `wordExport` / API `pending-issues` come da roadmap Fase 0.5). |
| 4 | Opzionale (stretch) | Solo se 0–3 sono **verdi** e documentati: bozza requisiti “**Flusso 2**” (SAL/Sopralluoghi) — **senza** implementazione massiva; preferire ADR o sezione roadmap + skeleton se esplicitamente richiesto dal committente. |

**Fuori scope implicito di questo brief** (non iniziare senza nuova delega): Sprint 10 staging tipizzato post-import completo; RAG; foto embedded Word (backlog tecnico noto).

---

## Vincoli (non negoziabili)

1. **Nessun segreto** in repository, PR, commit message o file di task (password DB, JWT, chiavi). Usare vault / variabili locali / `database.json` gitignored come da guida.
2. **Modifiche non banali**: branch dedicato + **PR** verso `main`; CI verde (`.github/workflows/ci-app-pr.yml` dove applicabile).
3. **Diff minimo**: correggere solo ciò che serve per bug evidenziati dagli smoke; niente refactor estetici o dipendenze npm nuove senza motivazione in PR.
4. **Deploy VPS / migrazioni DB**: se emergono come necessari, **documentare** i passi in PR e in `docs/GUIDA_CONSOLIDATA.md` / roadmap; non eseguire operazioni che richiedono credenziali solo umane dall’agente web senza piano.
5. Allineamento doc: aggiornare **`docs/GUIDA_CONSOLIDATA.md`** e/o **`docs/PROJECT_ROADMAP.md`** solo se cambia una procedura ripetibile o lo stato del “Prossimo Step” (come da regola progetto: niente nuovi `SESSION_NOTES_*`).

---

## Branch e naming

- Branch suggerito: `chore/weekend-smoke-2026-04-18` (o prefisso `fix/` se predominano correzioni bug).
- Commit atomici per area (es. `fix(word): titoli utf-8 …`) dove possibile.

---

## Definition of Done (DoD)

La sessione si considera **completata** quando:

- [ ] Punti **0–3** della tabella obiettivi sono stati **eseguiti** su ambiente indicato in PR (locale + staging o produzione — specificare quale).
- [ ] Per ogni punto: **esito** (OK / KO) e **evidenza** breve (screenshot oppure elenco passi + file Word campione **senza** dati sensibili, oppure note su audit di test anonimizzati).
- [ ] Se ci sono fix codice: **PR** aperta, **CI verde**, descrizione PR in italiano con cause ed effetto.
- [ ] Se solo verifica senza fix: **PR** di documentazione (es. aggiornamento guida “smoke eseguiti il …”) **oppure** commento strutturato in issue/PR collegata — comunque traccia su Git.
- [ ] Punto **4** marcato esplicitamente come *N/A*, *in corso in altro branch*, o *completato* (una sola verità).

---

## Prompt pronto (incollare in Agents Window)

Copiare il blocco seguente così com’è (adattare solo il branch se già esistente).

```text
Sei nel repository Sistema Gestione ISO 9001 (React + backend Node + SQL Server).

1) Leggi il brief operativo in `docs/agent-tasks/WEEKEND_RUN_2026-04-18.md` e applica vincoli e DoD scritti lì.
2) Allineamento progetto: `PROJECT_CONTEXT.md`, `docs/PROJECT_ROADMAP.md`, `docs/GUIDA_CONSOLIDATA.md` (sezioni deploy, Word export, smoke se presenti).
3) Crea il branch `chore/weekend-smoke-2026-04-18` da `main` aggiornato.
4) Esegui in ordine gli obiettivi 0–3 della tabella nel brief (lista audit mobile/desktop; export Word verificatore+titoli; NV/N.A./LOGO; pending issues + riga AP). Documenta esito per ogni punto.
5) Se trovi bug, correggi con diff minimo; aggiungi o aggiorna test automatici solo se già esiste il pattern nel modulo toccato.
6) Apri PR verso `main` con riepilogo in italiano, checklist DoD del brief, e note su ambiente usato per gli smoke. Non inserire segreti.

Opzionale solo se 0–3 sono chiusi e il committente vuole avanzare subito: punto 4 del brief (Flusso 2) come documentazione/struttura minima — non espandere oltre quanto richiesto dal brief.
```

---

## Note per il committente (Pascal / QS Studio)

- Questo file **non** sostituisce la roadmap: quando i passi 0–3 sono chiusi, aggiornare la riga **Prossimo Step** in `docs/PROJECT_ROADMAP.md` così la sessione successiva parte dal punto giusto.
- Se gli smoke richiedono solo tempo umano (login, device fisico), l’agente può preparare **script/checklist** e codice; la parte “tocco su telefono” resta vostra o va esplicitata in PR come manuale.
