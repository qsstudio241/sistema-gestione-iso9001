# ADR-007: Logout senza perdita del lavoro solo-locale + backup / mirror su cartella PC

**Data**: 2026-04-18  
**Stato**: **Proposto** (da validare in roadmap; non ancora implementazione completa)  
**Autori**: Team SGQ (evidenza da sessione split-tenant / offline)  
**Dipendenze**: [ADR-002-offline-first-sync](./ADR-002-offline-first-sync.md), [ADR-006-auto-reconcile-cache-sync](./ADR-006-auto-reconcile-cache-sync.md)  
**Correlato**: modifica attuale `StorageContext` + `syncService.clearSessionStoresOnLogout()` (pulizia a logout per sicurezza multi-tenant)  
**Memoria trasversale (indice sintesi)**: [PROJECT_ROADMAP.md](../PROJECT_ROADMAP.md) — sezione *Open points e memoria trasversale* (aggiornare la tabella quando cambia lo stato di questo ADR).

---

## Contesto e problema

1. **Logout con lavoro solo locale non ancora sul server**  
   Per evitare che un secondo utente sulla stessa postazione erediti audit, code sync e mapping uuid→`audit_id` del tenant precedente, al logout si **svuotano** IndexedDB (audit) e gli store di sessione sync.  
   **Conseguenza**: bozze **mai sincronizzate** (senza `audit_id` server o ancora in coda) possono **andare perse** al logout — accettabile per isolamento, **inaccettabile** per lavoro reale in corso su rete instabile.

2. **Cartella PC come backup del “bundle” audit**  
   Esiste `LocalFsProvider` (File System Access API), ma `createStorageProvider()` oggi usa **sempre IndexedDB** ([`app/src/services/storageAdapter.js`](../../app/src/services/storageAdapter.js), ADR-002). Non c’è **mirror automatico** su filesystem locale del bundle audit.

3. **Mobile**  
   Stesso rischio IndexedDB con superficie diversa; il perimetro funzionale mobile resta quello concordato (flusso audit), ma il **rischio di perdita** resta se si fa logout con coda pendente.

**Riferimenti ISO 9001:2015**

- **7.5** Informazioni documentate — disponibilità, protezione, conservazione  
- **6.1** Azioni per affrontare rischi (perdita dati al cambio sessione)

---

## Decisione (obiettivo architetturale)

Perseguire una soluzione **robusta** che:

- **Mantenga** la sicurezza multi-tenant: dopo logout il successivo login **non** deve vedere residui del precedente utente in cache applicativa.
- **Non perda** in modo silenzioso il lavoro solo-locale: l’utente deve essere **informato** e avere **percorso di recupero** (sync forzato, export, o entrambi).
- **Integri** opzionalmente un **backup su cartella PC** (desktop) come miglioramento del bundle audit, senza sostituire da soli il modello offline-first IndexedDB.

Implementazione prevista in **fasi** (ordine negoziabile in roadmap).

---

### Fase A — Gate al logout (minimo indispensabile)

Prima di eseguire la pulizia sessione:

1. Rilevare **lavoro pendente**:  
   - item in `syncQueue` non ancora processati con successo, **e/o**  
   - audit in IndexedDB **senza** `metadata.auditId` (o equivalente) ancora da creare sul server.
2. Se pendente > 0: **non** svuotare subito in modo silenzioso; mostrare **modale** con opzioni chiare, ad esempio:  
   - **“Sincronizza ora”** (tentativo `processQueue` + feedback esito; solo se online),  
   - **“Scarica pacchetto di recupero”** (export JSON/ZIP del subset pendente + metadati minimi per re-import o supporto),  
   - **“Esci comunque”** (conferma esplicita di perdita consapevole).  
3. Solo dopo scelta o sync riuscito → eseguire `clearAuditsStore` / `clearSessionStoresOnLogout` come oggi.

**Criterio di accettazione**: nessun logout “normale” che cancelli bozze senza almeno un avviso se la coda non è vuota.

---

### Fase B — Mirror / backup automatico su cartella PC (desktop)

- **Opt-in** guidato (una tantum o per sessione): utente sceglie directory (File System Access API).  
- **Contenuto**: snapshot periodico o su evento (es. dopo salvataggio audit, o ogni N minuti) del **bundle** necessario a ripristino (audit + allegati leggeri se inclusi nella strategia; vedi [ADR-005](./ADR-005-attachment-storage-strategy.md)).  
- **Conflitti**: policy chiara (es. “ultimo snapshot vince” o timestamp).  
- **Sicurezza**: dati sensibili su disco locale — avviso informativa; opzionale cifratura file con password utente (roadmap).

**Criterio di accettazione**: con mirror attivo e logout dopo Fase A, l’utente ha almeno **un file** recuperabile dalla cartella scelta se la sync server non è mai avvenuta.

---

### Fase C — Affinamenti (opzionali)

- Retry/backoff più espliciti in UI per code fallite.  
- Metrica “stato sync” persistente (badge “N modifiche non inviate”).  
- Mobile: stesso gate logout; mirror cartella **non** in scope salvo export esplicito (storage limitato).

---

## Alternative valutate

| Alternativa | Pro | Contro | Nota |
|-------------|-----|--------|------|
| Non svuotare mai la cache al logout | Zero perdita locale | Violazione isolamento multi-tenant | Scartata |
| Svuotare senza avviso (stato attuale dopo clear sessione) | Isolamento forte | Perdita silenziosa bozze | Da superare con Fase A |
| Solo server come unico storage | Coerenza assoluta | Richiede rete continua | Contraddice ADR-002 |

---

## Conseguenze

### Positive

- Allineamento a **ISO 7.5** (tracciabilità e protezione delle informazioni documentate generate in audit).  
- Riduzione rischio **reclami / NC** per perdita dati operativi.

### Negative / costi

- Complessità UI (modale logout) e test L1/L2 su offline/online.  
- Mirror PC: permessi browser, supporto solo Chromium moderni per directory picker.

---

## Rischi e mitigazioni

| Rischio | Probabilità | Impatto | Mitigazione |
|---------|-------------|---------|-------------|
| Utente ignora modale e perde dati | Media | Alto | Testo chiaro + seconda conferma solo su “Esci comunque” |
| Export contiene dati personali / tenant | Media | Medio | Nome file con timestamp + avviso GDPR interno |
| Sync parziale (server ok, client cancella prima) | Bassa | Alto | Ordine: sync → verifica → poi clear (Fase A) |

---

## Stato implementazione (checklist)

- [ ] Fase A: rilevamento pendenti + modale logout + tentativo sync / export / conferma perdita  
- [ ] Fase B: opt-in mirror cartella PC + formato snapshot definito  
- [ ] Test: logout con coda piena offline → nessuna perdita senza conferma  
- [ ] Documentazione operativa: `docs/GUIDA_CONSOLIDATA.md` (sezione utente finale)

---

## Collegamenti codice attuale (riferimento)

- `app/src/contexts/StorageContext.jsx` — listener `sgq:userLoggedOut`, `reconcileAuditsFromServer`, `filterLocalAuditsAfterServerFetch`  
- `app/src/services/syncService.js` — `clearSessionStoresOnLogout`, coda `syncQueue`  
- `app/src/services/storageAdapter.js` — scelta provider IndexedDB
