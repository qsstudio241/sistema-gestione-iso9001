# Gestione perdita di connessione (desktop e mobile)

L’app è progettata per **continuare a funzionare** quando la connessione al server viene meno (Wi‑Fi instabile, tunnel, cellulare senza rete, server irraggiungibile). Le modifiche vengono salvate in locale e sincronizzate quando la connessione torna disponibile.

---

## 1. Cosa succede quando perdi la connessione

- **Rilevamento**: lo stato “offline” viene rilevato in due modi:
  - Eventi del browser `online` / `offline` (rete locale).
  - **Health check periodico** verso il **backend reale** (stesso URL delle API), ogni 30 secondi. Così si distingue “rete attiva” da “server effettivamente raggiungibile” (importante su mobile e quando frontend e API sono su domini diversi, es. Netlify + VPS).
- **Indicatore in UI**: in alto a destra compare il messaggio **Offline** (rosso) con testo tipo “Modifiche salvate localmente” o “N in attesa di sync” se ci sono operazioni in coda.
- **Dati**: tutto ciò che fai (nuovi audit, modifiche, risposte, allegati) viene salvato in **IndexedDB** e accodato per la sincronizzazione. Finché non fai **logout** (vedi §5) e non cancelli i dati del sito, il lavoro resta recuperabile in locale.

---

## 2. Cosa succede quando la connessione torna

- All’evento `online` e al primo health check positivo, il **SyncService**:
  - Considera di nuovo la connessione disponibile.
  - Esegue dopo circa 2 secondi un **processamento della coda** (sync verso il server).
- L’indicatore passa a **Online** (verde) e dopo qualche secondo si nasconde.
- Le operazioni in coda (audit, aggiornamenti, allegati) vengono inviate al server con **retry e backoff** in caso di errore temporaneo.

---

## 3. Comportamento da mobile

- **Timeout health check**: su schermi &lt; 768px il timeout del ping al backend è **8 secondi** invece di 5, per adattarsi a connessioni lente o instabili (4G, tunnel, ecc.).
- **Indicatore**: su mobile l’indicatore è compatto (testo ridotto) per non occupare troppo spazio.
- **Stesso flusso**: salvataggio in IndexedDB, coda di sync, ripristino automatico quando il server è di nuovo raggiungibile.

---

## 4. Componenti coinvolti

| Componente | Ruolo |
|------------|--------|
| **ConnectionStatus** | Mostra Online/Offline; usa l’URL del backend (come `apiService`) per l’health check; in offline mostra il numero di operazioni in attesa di sync. |
| **SyncService** | Coda in IndexedDB, `processQueue`, ascolto `online`/`offline`, auto-sync ogni 30 s, retry con backoff. |
| **apiService** | In caso di errore di rete rileva `navigator.onLine` e può restituire errore tipo OFFLINE. |
| **StorageContext** | Carica i dati da IndexedDB; in avvio se il server non è raggiungibile usa solo i dati locali e avvia comunque il polling di sync. |
| **Auth** | La sessione (token/user) resta in cache per permettere l’uso offline; il logout non cancella il token se la richiesta fallisce (es. offline). |

---

## 5. Logout vs disconnessione temporanea (open point)

- **Solo rete assente**: come sopra — dati in IndexedDB, coda sync, nessuna perdita **se non** si cancellano i dati del sito.
- **Logout esplicito o `sgq:userLoggedOut`**: l’app **svuota** la cache audit locale e gli store di sessione sync (sicurezza multi-tenant). Le bozze **non ancora sul server** possono andare perse se non sono state sincronizzate prima. **Non è lo stesso caso della perdita di connessione.**

**Tracciamento requisito “robustezza logout”** (gate, export, mirror PC): [ADR-007-logout-offline-backup-e-mirror-cartella-pc.md](adr/ADR-007-logout-offline-backup-e-mirror-cartella-pc.md) + tabella *Open points* in [PROJECT_ROADMAP.md](PROJECT_ROADMAP.md).

---

## 6. Configurazione tecnica

- **Health check**: `GET {baseUrl}/health` (stesso `baseUrl` usato per le API, da env `VITE_API_URL` o default).
- **Intervallo ping**: 30 secondi.
- **Sync queue**: tipi supportati `create_audit`, `update_audit`, `delete_audit`, `upload_attachment`, `save_responses`.
- **Retry**: fino a 5 tentativi con backoff (1 s → 60 s max); dopo 5 fallimenti consecutivi l’auto-sync si ferma e riparte al prossimo evento `online` o alla prossima azione che accoda una nuova operazione.

---

## 7. Cosa fare in caso di problemi

- **“Resto sempre Offline”**: verificare che il backend sia raggiungibile dall’ambiente in cui usi l’app (stesso URL configurato per le API). Da mobile, controllare che non ci siano blocchi (VPN, firewall, CORS).
- **“Le modifiche non si sincronizzano”**: aprire la console del browser e cercare messaggi `[SYNC]`; verificare che non ci siano errori 4xx/5xx dal server. Se la coda è piena, l’indicatore mostra “N in attesa di sync”; al ritorno online la coda viene processata.
- **Dati solo in locale**: finché il server non risponde, i dati restano in IndexedDB. Non cancellare i dati del sito per quel dominio altrimenti si perdono audit e modifiche non ancora sincronizzate.

---

*Riferimenti: ADR-002 (offline-first sync), ADR-007 (logout / backup PC — proposto), `ConnectionStatus.jsx`, `syncService.js`, `apiService.js`, `StorageContext.jsx`.*
