# Proposta — Elaborazione norme PDF sul VPS (riduzione esposizione testo copyright all'AI cloud)

> **Stato**: PROPOSTA — non implementata. Richiede decisione del committente/lead
> prima di procedere (nessuna infrastruttura di produzione modificata da questo
> documento). Verificato 30/07/2026.

## Il problema reale (non il PDF, il testo estratto)

Il tool locale `backend/scripts/pdf_to_json/` gira interamente su Python locale,
senza nessuna chiamata cloud/API per l'estrazione (confermato nel suo `README.md`).
Questo però risolve solo **metà** del problema: quando un agente Cursor (basato su un
modello Anthropic/altro in cloud) **legge** il `.md`/`.json` prodotto — per
verificarne la qualità, correggere un problema di font, citare un frammento per
diagnosticare un bug di estrazione — il **testo della norma** entra comunque nel
contesto della conversazione con il modello cloud. È un limite del workflow, distinto
dal fatto che l'estrazione in sé sia locale.

## Cosa significa "server nell'ambiente superadmin"

Il VPS di produzione (`sistemi.fr-busato.it`, accesso SSH via
`backend/scripts/run-on-vps.ps1`, vedi `docs/how-to/ACCESSO_DEPLOY_AGENTS.md`) ospita
già il backend Node.js e un meccanismo di storage documentale (`document_registry` +
`attachments`, cartelle `uploads/norms/{organization_id}/` — vedi
`backend/src/routes/normUpload.routes.js`, `backend/src/services/normIngest.service.js`,
`backend/src/services/documentRegistryNorm.service.js`). Questo è il "server" a cui il
committente si riferisce: un ambiente dove i file **non passano per la chat con
l'agente** perché arrivano via upload applicativo o SCP diretto.

**Verificato (30/07/2026, comando readonly via SSH)**:
- Python **3.12.3** è già installato sul VPS (`/usr/bin/python3`).
- `pip3` **non** è installato (mancano i pacchetti `pdfplumber`/`pymupdf`/ecc. —
  andrebbero installati con `apt install python3-pip` poi `pip install -r
  requirements.txt`). **Non eseguito** in questa sessione (richiede sudo, è
  un'installazione di sistema, non un readonly check).
- Spazio disco disponibile: 76 GB liberi su 98 GB — ampiamente sufficiente.

## Workflow alternativo proposto

```
1. Il committente carica il PDF via SCP diretto (pscp/scp) in una cartella dedicata
   sul VPS, fuori da qualunque cartella Git (es. /var/www/sgq-norme-pdf/, NON
   /var/www/sgq-backend/ per non mischiarla col deploy applicativo).
2. Un agente con accesso SSH (Cursor desktop via run-on-vps.ps1, o Cloud Agent via
   SGQ_SSH_KEY_B64) lancia lo script Python pdf_to_json DIRETTAMENTE sul VPS via SSH
   — stesso pattern già in uso per gli script Node (run-migration-*-vps.js).
   Il comando SSH stesso (nome file, opzioni CLI) non contiene testo della norma.
3. Solo l'output JSON/Markdown strutturato viene poi scaricato (scp) o letto
   dall'agente per gap analysis, sviluppo cataloghi, o gestione qualità.
```

## Cosa risolve davvero

- **Il PDF binario non transita mai nella chat**: oggi non ci transita comunque
  (il tool gira già in locale sul PC), quindi su questo punto specifico non cambia
  nulla rispetto ad oggi.
- **Punto di verità unico**: un solo posto (VPS) dove i PDF sorgente restano
  disponibili e riprocessabili, indipendente dal PC del committente — mitiga il
  rischio di "PDF perso dal PC" già osservato in sessioni precedenti.
- **Separazione tecnica pulita**: l'estrazione avviene in un ambiente server sempre
  disponibile (non dipende da quale PC Windows è acceso), coerente con
  l'infrastruttura di deploy già esistente.

## Cosa NON risolve (limite architetturale onesto)

**Il nodo centrale del problema del committente resta**: se un agente Cursor deve
verificare la qualità dell'estrazione (confrontare font corrotti, diagnosticare
colonne interfogliate, citare un frammento per capire un bug — come fatto più volte
in sessioni reali su ISO 9606-1, ISO 15614-1, ISO 14341), **deve leggere il testo
estratto**. Che quel testo sia stato prodotto da uno script Python lanciato sul PC
Windows o sullo stesso script lanciato via SSH sul VPS **non cambia il fatto che
l'agente lo debba leggere per fare la verifica** — e leggerlo significa che entra nel
contesto del modello cloud. Spostare l'esecuzione sul VPS **non elimina** questa
esposizione durante la fase di **sviluppo/debug del tool di estrazione**.

Quello che si può ridurre realisticamente è l'esposizione per l'**uso ricorrente**
su norme **già stabili e verificate**: una volta che un catalogo (es.
`docs/reference/ISO-14341-consumabili-filo.md`) è stato validato una volta, gli
utilizzi successivi (gap analysis, sviluppo di nuove funzionalità che leggono quel
catalogo) possono limitarsi a leggere il **JSON/Markdown già sintetizzato e ridotto**
(estratti tabellari, non il testo integrale pagina per pagina) — questo sì riduce il
volume di testo copyright che passa nel contesto rispetto a leggere l'intero `.md`
grezzo. Ma per le fasi di **prima digitalizzazione o debug di una norma nuova**, una
certa esposizione di frammenti di testo all'agente cloud è difficile da evitare al
100% con l'attuale workflow (Cursor + Claude/Anthropic in cloud).

## Pro / Contro

| | Pro | Contro |
|---|---|---|
| **Esecuzione su VPS** | Punto unico, sempre disponibile, indipendente dal PC | Richiede installare `pip` + librerie Python sul server di produzione (superficie aggiuntiva su una macchina che serve anche il backend applicativo) |
| **Upload via SCP invece che chat** | Il file binario non tocca mai la conversazione (ma già non lo tocca oggi) | Nessun reale guadagno su questo punto specifico |
| **Cartella dedicata fuori dal deploy backend** | Isolamento da `/var/www/sgq-backend` (niente rischio di interferire col deploy) | Un'altra cartella/permesso da gestire e documentare |
| **Lettura solo di JSON sintetizzato per uso ricorrente** | Riduce volume testo copyright nel contesto per norme già stabili | Non applicabile durante la fase di digitalizzazione/debug di una norma nuova |

## Passi implementativi stimati (se il committente vuole procedere)

1. Creare cartella dedicata sul VPS (es. `/var/www/sgq-norme-pdf/`), permessi utente
   `spascarella`, **fuori** da `/var/www/sgq-backend` (~15 min).
2. `sudo apt install python3-pip python3-venv` + virtualenv +
   `pip install -r backend/scripts/pdf_to_json/requirements.txt` (~20 min, richiede
   sudo — non eseguibile come comando "readonly", va approvato esplicitamente).
3. `scp` della cartella `backend/scripts/pdf_to_json/` sul VPS (il codice del tool,
   non le norme) — stesso pattern di `deploy-controllers-to-vps.ps1` (~10 min).
4. Aggiornare `docs/how-to/ACCESSO_DEPLOY_AGENTS.md` con il nuovo pattern
   "elaborazione norme via SSH" (comando tipo, cartella dedicata) (~15 min).
5. Test con un PDF reale già digitalizzato (confronto output VPS vs output locale
   già validato) per verificare che l'ambiente Linux produca lo stesso risultato
   di quello Windows (differenze possibili: font system, encoding) (~20 min).

**Totale stimato**: mezza giornata di lavoro tecnico, a basso rischio (non tocca
codice applicativo, servizio backend, o DB) ma richiede due decisioni non deducibili
automaticamente:
- **Installare pacchetti Python di sistema su un server di produzione** condiviso col
  backend (accettabile? Alternativa: un secondo VPS/VM più piccolo solo per questo,
  più costoso).
- **Accettare il limite onesto sopra descritto** (non elimina l'esposizione durante
  debug/prima digitalizzazione) come compromesso sufficiente, o cercare un'alternativa
  più radicale (es. un modello locale open-source per la sola fase di revisione
  qualità, mai testato in questo progetto, complessità e qualità di verifica inferiori
  a Claude).

## Conclusione

La proposta è **fattibile parzialmente**: risolve la dispersione dei PDF sorgente e
centralizza l'elaborazione, ma **non elimina** il limite architetturale di fondo
(l'agente cloud deve leggere testo estratto per verificarne la qualità). Non
implementata in questa sessione — in attesa di decisione del committente su: (a)
priorità reale rispetto ad altro lavoro in roadmap, (b) accettazione dei due punti
sopra.
