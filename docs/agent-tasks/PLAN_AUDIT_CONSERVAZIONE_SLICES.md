# Piano slice — Conservazione dati audit (offline / caduta server)

> **Destinazione**: il lavoro di una giornata di audit **non si perde** per interruzione di rete, caduta del server, chiusura app o nuovo login sullo stesso telefono. Resta sul dispositivo finché il server non ha **confermato** la ricezione. Allineamento da un secondo dispositivo (PC) non cancella il lavoro non ancora inviato.
> **Spec / ADR**: [ADR-008](../adr/ADR-008-event-sourcing-sync.md) (event store = target lungo; questa epic **non** riscrive il motore) · [ADR-007](../adr/ADR-007-logout-offline-backup-e-mirror-cartella-pc.md) (gate logout già in produzione; export recupero = CONS-6) · [ADR-002](../adr/ADR-002-offline-first-sync.md) · [ADR-004](../adr/ADR-004-mobile-auth-localstorage.md)
> **Brief attivi CONS:** nessuno. CONS-1…6 **tutte su `origin/main`**. Slot [`DEPUTYTASK.md`](DEPUTYTASK.md) = **PONTE-1 CHIUSO** (altra epic). Brief CONS CHIUSI: `DEPUTYTASK1`…`5`.
> **Autorizzazione committente**: 02/09/2026 — colmare subito il gap di conservazione; avviso mobile «non aprire lo stesso audit dal PC finché la sync non è fatta».
> **Chiusura sessione (03/09/2026):** epic CONS-1…6 chiusa. SOP operativa [sotto](#come-operare-senza-copertura-sop): login + aprire l’audit **prima** di lasciare la copertura; in campo si lavora offline; al ritorno della rete la coda parte. Starlink non richiesto. GUIDA + roadmap § Stato aggiornati nella stessa PR di questa nota.

**Garanzia operativa (non 100% matematico):** telefono non formattato, dati sito non cancellati dall’utente, disco non pieno. Quello che **si deve** poter dire al cliente: *non lo perdiamo più per sync, login o apertura da PC.*

## Come operare senza copertura (SOP)

Nota di chiusura sessione 03/09/2026 (committente). Non è un requisito di satellite: è **preparare il telefono mentre c’è rete**.

| Momento | Cosa fare |
|---------|-----------|
| **Prima di lasciare la copertura** | Sul telefono: aprire l’app → accedere → **aprire l’audit** da compilare. Sessione e checklist restano sul dispositivo. |
| **In campo (niente rete)** | Compilare C/NC/OSS, note, foto checklist. Non serve internet. **Non** aprire lo stesso audit dal PC. **Non** cancellare i dati del sito. |
| **Quando torna la rete** | Riaprire l’app: la coda parte da sola. Solo dopo si guarda lo stesso audit dal PC. |

**Già in zona morta non si può:** primo login / password; aprire un audit **mai** aperto su quel telefono; foto verbali CND in coda. Se la sessione è **già scaduta** in zona morta, non si rientra senza rete (CONS-7, auth Alto — non aperto).

Dettaglio in GUIDA: [Audit in campo — SOP copertura](../GUIDA_CONSOLIDATA.md#audit-in-campo--sop-copertura).

## Perché questa mappa (e non un unico fix)

Due magazzini sul telefono, tre momenti di perdita (chiusi da CONS-1…6):

| Magazzino | Cosa tiene | Buco (prima delle slice) |
|-----------|------------|--------------------------|
| `SGQ_ISO9001_Storage` / store `audits` | Audit completo (domande, note, esiti) | Autosave **debounce 2s**; all’unmount il timer **si cancella senza scrivere** (`useAutoSave.js`) |
| `SGQ_ISO9001_DB` / `syncQueue` + `attachments_offline` | Coda verso il server + foto | Accorpamento ok; `update_audit` saltato senza lock; al login la coda create/update può essere pulita |
| Server | Fonte dopo sync | All’apertura **server-wins**; login faceva `processQueue` → **svuota IndexedDB** → riscarica |

Logout: `LogoutSyncGuard` avvisa già se la coda non è vuota (ADR-007 Fase A). Non basta: il login e l’hydrate possono cancellare senza conferma.

## Fuori scope

- Riscrivere il sync in event-sourcing puro (ADR-008 T* restanti): si **riusa** coda + store esistenti
- App nativa Android/iOS
- CRDT / editing collaborativo real-time
- Cambiare la policy server-wins **in generale** (solo quando c’è coda/locale più ricco)
- Stessa garanzia su NC, CND, Qualifiche, SAL (nebbia / epic successive)
- Mirror su cartella PC (ADR-007 Fase B) — solo desktop
- JWT / `auth.middleware` / refresh token (CONS-7 resta nebbia: tocca auth = Alto)
- Nuovo database, nuova PWA store, skill GitHub di sync
- Deploy backend (CONS-1 e CONS-2 sono solo frontend)

## Non ancora specificato

- Schermata login offline se il token è scaduto/assente (ADR-004): si può rientrare senza password? Tocca auth — CONS-7 nebbia
- Eviction storage Chrome/Android (il browser cancella IndexedDB): mitigabile con export CONS-6, non eliminabile in PWA
- Foto/allegati: quota disco; CONS-6 può includerle; non aprire un motore blob nuovo
- Estendere flush/banner a verbali CND (`useNdtAutoSave`) — dopo CONS-1 se il pattern è stabile

## Decisioni già prese (02/09/2026, committente)

- Obiettivo = salvaguardare il **lavoro della giornata di audit**, non «eventualmente visibile sul PC»
- Avviso sul mobile (offline e/o coda pendente): **non aprire lo stesso audit dal PC** finché la sync non è confermata
- Non chiedere altro HITL di prodotto per CONS-1…CONS-6; le slice Alto (CONS-3…5) restano **seriali** (stessi file core) e vanno in PR, non su `main` diretto
- 100% assoluto (telefono rotto / «cancella dati») **non** è in scope; la garanzia è **operativa** come sopra

## Mappa slice

| Slice | Tema | Perimetro (file/layer) | Dipende da | Tipo |
|-------|------|------------------------|------------|------|
| CONS-1 | Persistenza su disco prima della perdita | `useAutoSave.js` + test flush; **niente** `syncService` / login / hydrate | — | AFK · Medio |
| CONS-2 | Avviso offline / coda: non aprire da PC | `AuditLockBanner.jsx` + messaggio lock `offline` in `StorageContext.jsx` (solo testo mode offline) + test banner | CONS-1 consigliata, non bloccante | AFK · Basso |
| CONS-3 | Login non svuota l’archivio locale | `StorageContext.jsx` handler `auth:login`: coda → **merge** (locale più ricco) → persist; **vietato** `clearAuditsStore` prima della conferma | CONS-1 | AFK · **Alto** |
| CONS-4 | Hydrate/reconcile non copre il locale se la coda di quell’audit è pendente | `fetchAndApplyServerResponses` + `resolveMergedChecklistForReconcile` / `applyServerResponsesPreservingLocalNotes`; `syncService.getQueue` solo **lettura** | CONS-1, CONS-3 | AFK · **Alto** |
| CONS-5 | `update_audit` non viene scartato senza lock / `clearQueueForServerAudits` | `syncService.js`: non skippare update ricchi; non rimuovere item mai inviati | CONS-3 | AFK · **Alto** |
| CONS-6 | Pacchetto di recupero dal telefono | Export JSON (audit + coda) da UI audit; riuso gate logout ADR-007; niente mirror cartella | CONS-1 | AFK · Medio |

**Tipo**: `AFK` = il deputy chiude da solo (test L1 + PR). CONS-3…5 = livello Alto: PR + gate doppio; Cloud Agent **non** mergia.

Ogni slice = un percorso stretto verificabile. **Una sessione = una slice.** Non aprire CONS-3 e CONS-4 in parallelo (stesso `StorageContext.jsx`).

### Stato PR su `origin/main` (03/09/2026, `gh pr view` + SHA `9aed1424`)

| Slice | PR | Stato | Codice atteso su `main` |
|-------|-----|-------|-------------------------|
| CONS-1 | [#632](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/632) | **MERGED** 02/09 | `useAutoSave.js` flush `pagehide` / hidden / unmount |
| CONS-2 | [#630](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/630) | **MERGED** 02/09 | `AuditLockBanner.jsx` `OFFLINE_PC_WARNING` |
| CONS-3 | [#634](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/634) | **MERGED** 03/09 | `StorageContext.jsx` `shouldClearAuditsStoreOnLogin` — stesso utente no wipe |
| CONS-4 | [#635](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/635) | **MERGED** 03/09 | `pendingAuditQueue.js` + `shouldSkipServerHydrate` |
| CONS-5 | [#636](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/636) | **MERGED** 03/09 15:36Z | `syncService.js`: niente skip lock; `update_audit` via `syncItem` senza token; `clearQueueForServerAudits` non toglie update non stalled |
| CONS-6 | [#631](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/631) | **MERGED** 02/09 | `auditRecoveryExport.js` |

**Epic CONS-1…6: CHIUSA** su `origin/main`.

---

## CONS-1 — Persistenza su disco (hello world)

**Buco:** `useAutoSave` aspetta 2s; il cleanup dell’effect **cancella il timer** all’unmount (`pagehide` / chiusura PWA) senza `saveAudit`. Le ultime risposte restano solo in RAM.

**Fare:** tenere il debounce (niente storm IndexedDB mentre si digita). Se c’è un salvataggio in attesa: **flush immediato** su `pagehide`, `visibilitychange` → `hidden`, e **unmount**. Test L1 che dimostra: unmount prima dei 2s → `saveAudit` chiamato.

**Non fare:** toccare coda, login, hydrate, banner PC.

**DoD:** test flush verde + `npm run build` in `app/`.

- [x] Unmount prima del delay → `saveAudit` (`app/src/tests/useAutoSave.flush.test.js`)
- [x] Dati identici → nessun save
- [x] `pagehide` / `visibilitychange` hidden con pending → `saveAudit`
- [x] Debounce 2s invariato (niente write a ogni tasto)
- [x] `npm run build` in `app/` (02/09/2026)
- [x] Su `main` — PR [#632](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/632)

---

## CONS-2 — Avviso «non aprire da PC»

Estendere il banner lock già usato in offline (`AuditLockBanner` + `auditLock.message` mode `offline`). Testo visibile, italiano accentato, **niente emoji grezze in JSX**. Non inventare un secondo sistema di alert.

**DoD / main (PR #630, 02/09/2026):**

- [x] `OFFLINE_PC_WARNING` in `AuditLockBanner.jsx` (mode `offline`)
- [x] Test L1 banner; brief [`DEPUTYTASK1.md`](DEPUTYTASK1.md) CHIUSO

---

## CONS-3 — Login senza wipe

Oggi: `processQueue` → `clearAuditsStore` → reconcile. Se la rete è ancora instabile, l’archivio locale sparisce e il server è vecchio.

Regola: **mai** `clearAuditsStore` al login dello **stesso** utente. Coda prima; poi merge (già `hasRichContent` / checklist più ricca); persist. Wipe solo al logout (altro utente / isolamento tenant), dopo `LogoutSyncGuard`.

**DoD (02/09/2026):**

- [x] Stesso utente: nessun `clearAuditsStore` pre-merge al `auth:login` (`storageContext.loginNoWipe.test.js`)
- [x] Server vuoto/vecchio: locale ricco resta (`resolveAuditsAfterLogin` / `runLoginAuditHydrate`)
- [x] Wipe resta su `sgq:userLoggedOut`
- [x] Su `main` — PR [#634](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/634)

---

## CONS-4 — Server-wins solo se non c’è lavoro locale in volo

All’apertura audit: se `syncQueue` ha `save_responses` / `update_audit` / eventi per quello UUID, **non** applicare gli esiti server sopra il locale. Dopo `processQueue` ok, hydrate.

**DoD / main (PR #635, 03/09/2026):**

- [x] `pendingAuditQueue.js` + skip hydrate in `StorageContext.jsx`
- [x] Test `pendingAuditQueue.test.js`; brief [`DEPUTYTASK4.md`](DEPUTYTASK4.md) CHIUSO

---

## CONS-5 — Coda intestazione audit

`update_audit` si saltava senza token di lock (client) e poteva essere rimosso da `clearQueueForServerAudits` anche se non era mai partito. Obiettivo / dati generali / conclusioni restavano solo locali.

**DoD / main (PR #636, 03/09/2026 15:36Z, SHA merge `823dfeb3`):**

- [x] Niente skip lock su `update_audit` in `processQueue` (`syncService.js`) — commento CONS-5 / ADR-008 T5; `syncItem` senza token
- [x] `clearQueueForServerAudits` non toglie `update_audit` mai inviato (solo stalled / lock)
- [x] Test `syncService.updateAuditQueue.test.js`
- [x] PR [#636](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/636) **MERGED**; brief [`DEPUTYTASK5.md`](DEPUTYTASK5.md) CHIUSO

---

## CONS-6 — Export di recupero

Un file scaricabile (audit corrente + item coda di quell’UUID). Serve se la rete non torna per giorni. Non sostituisce CONS-1…5.

**DoD / main (PR #631, 02/09/2026):**

- [x] `auditRecoveryExport.js` (JSON audit + coda, senza token)
- [x] Brief [`DEPUTYTASK2.md`](DEPUTYTASK2.md) CHIUSO

---

## Ordine di esecuzione

```
CONS-1 (disco) ──► CONS-2 (avviso, può slittare di una sessione)
       └──► CONS-3 (login) ──► CONS-4 (hydrate) ──► CONS-5 (coda update)
       └──► CONS-6 (export, dopo CONS-1, anche in parallelo a CONS-2 se file disgiunti)
```

Residuo **ora**: nessuno in questa epic. CONS-1…6 su `main`. Nebbia: CONS-7 (auth/login offline), mirror cartella PC, stessa garanzia su NC/CND/Qualifiche/SAL.

---

## Hub (applicato 03/09/2026, chiusura sessione)

Nessun `DEPUTYTASK*` APERTO. GUIDA (riga Sync + § SOP) e roadmap § Stato aggiornati nella stessa PR.

**Roadmap § Stato:** epic CONS-1…6 CHIUSA; priorità #1 = SOP campo + smoke prod (hard-refresh Netlify), non più «colmare gap codice». CONS-7 (login già in zona morta) resta nebbia.

**GUIDA:** riga Sync 03/09 + sezione [Audit in campo — SOP copertura](../GUIDA_CONSOLIDATA.md#audit-in-campo--sop-copertura).
