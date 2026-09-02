# Piano slice — Conservazione dati audit (offline / caduta server)

> **Destinazione**: il lavoro di una giornata di audit **non si perde** per interruzione di rete, caduta del server, chiusura app o nuovo login sullo stesso telefono. Resta sul dispositivo finché il server non ha **confermato** la ricezione. Allineamento da un secondo dispositivo (PC) non cancella il lavoro non ancora inviato.
> **Spec / ADR**: [ADR-008](../adr/ADR-008-event-sourcing-sync.md) (event store = target lungo; questa epic **non** riscrive il motore) · [ADR-007](../adr/ADR-007-logout-offline-backup-e-mirror-cartella-pc.md) (gate logout già in produzione; export recupero ancora aperto) · [ADR-002](../adr/ADR-002-offline-first-sync.md) · [ADR-004](../adr/ADR-004-mobile-auth-localstorage.md)
> **Brief attivo**: [`DEPUTYTASK.md`](DEPUTYTASK.md) — **CONS-1** APERTO
> **Autorizzazione committente**: 02/09/2026 — colmare subito il gap di conservazione; avviso mobile «non aprire lo stesso audit dal PC finché la sync non è fatta».

**Garanzia operativa (non 100% matematico):** telefono non formattato, dati sito non cancellati dall’utente, disco non pieno. Quello che **si deve** poter dire al cliente: *non lo perdiamo più per sync, login o apertura da PC.*

## Perché questa mappa (e non un unico fix)

Due magazzini sul telefono, tre momenti di perdita:

| Magazzino | Cosa tiene | Buco oggi |
|-----------|------------|-----------|
| `SGQ_ISO9001_Storage` / store `audits` | Audit completo (domande, note, esiti) | Autosave **debounce 2s**; all’unmount il timer **si cancella senza scrivere** (`useAutoSave.js`) |
| `SGQ_ISO9001_DB` / `syncQueue` + `attachments_offline` | Coda verso il server + foto | Accorpamento ok; `update_audit` saltato senza lock; al login la coda create/update può essere pulita |
| Server | Fonte dopo sync | All’apertura **server-wins**; login fa `processQueue` → **svuota IndexedDB** → riscarica |

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

- Schermata login offline se il token è scaduto/assente (ADR-004): si può rientrare senza password? Tocca auth — non spezzare prima di CONS-1…CONS-5
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

---

## CONS-2 — Avviso «non aprire da PC»

Estendere il banner lock già usato in offline (`AuditLockBanner` + `auditLock.message` mode `offline`). Testo visibile, italiano accentato, **niente emoji grezze in JSX**. Non inventare un secondo sistema di alert.

---

## CONS-3 — Login senza wipe

Oggi: `processQueue` → `clearAuditsStore` → reconcile. Se la rete è ancora instabile, l’archivio locale sparisce e il server è vecchio.

Regola: **mai** `clearAuditsStore` al login dello **stesso** utente. Coda prima; poi merge (già `hasRichContent` / checklist più ricca); persist. Wipe solo al logout (altro utente / isolamento tenant), dopo `LogoutSyncGuard`.

---

## CONS-4 — Server-wins solo se non c’è lavoro locale in volo

All’apertura audit: se `syncQueue` ha `save_responses` / `update_audit` / eventi per quello UUID, **non** applicare gli esiti server sopra il locale. Dopo `processQueue` ok, hydrate.

---

## CONS-5 — Coda intestazione audit

`update_audit` oggi si salta senza token di lock (client) e può essere rimosso da `clearQueueForServerAudits` anche se non è mai partito. Obiettivo / dati generali / conclusioni restano solo locali → persi al wipe CONS-3 se CONS-5 non è fatta. CONS-5 **dopo** CONS-3.

---

## CONS-6 — Export di recupero

Un file scaricabile (audit corrente + item coda di quell’UUID). Serve se la rete non torna per giorni. Non sostituisce CONS-1…5.

---

## Ordine di esecuzione

```
CONS-1 (disco) ──► CONS-2 (avviso, può slittare di una sessione)
       └──► CONS-3 (login) ──► CONS-4 (hydrate) ──► CONS-5 (coda update)
       └──► CONS-6 (export, dopo CONS-1, anche in parallelo a CONS-2 se file disgiunti)
```

Prima slice eseguibile **ora**: CONS-1.
