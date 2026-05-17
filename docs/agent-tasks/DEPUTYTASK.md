# DEPUTYTASK — Ripresa lavori 17/05/2026

> Prompt per riprendere i lavori dopo la maratona del 16/05/2026 sera.
> **Scope**: rifinire il modulo Office round-trip + lifecycle documenti.

---

## Stato attuale (cosa è già fatto e in produzione)

Vedi `docs/GUIDA_CONSOLIDATA.md` → sezione **"Sessione 16 maggio 2026 (sera) —
Office round-trip WebDAV + lifecycle documenti + viewer .docx browser"** per il
dettaglio completo. In sintesi:

- ✅ "Apri in Word" → Word desktop modifica + salva sul server (round-trip completo)
- ✅ "Visualizza" → viewer .docx in-browser via `docx-preview` (vera sola lettura)
- ✅ Lifecycle documenti: stato `rilasciato` ↔ `bozza`, pulsante "RILASCIA REVISIONE"
- ✅ DB migrato (41 doc rilasciati con `revision_number=0` e `released_at=created_at`)
- ✅ Pannello dettaglio carica i file via API
- ✅ Cartelle (`doc_type='folder'`) non vanno in bozza al salvataggio Word
- ✅ Filtro registry default mostra anche le bozze (non solo `rilasciato`)
- ✅ Backend WebDAV: token nel path URL (compatibile Microsoft-WebDAV-MiniRedir)
- ✅ Token mode `edit | read` con PUT 403 in modalità read

## Tutto in `main`, deployato

- **Frontend**: Netlify auto-deploy completato dopo gli ultimi push
- **Backend**: VPS `www.fr-busato.it:8443` aggiornato manualmente via scp+restart
- **DB**: SQL Server produzione con migrazione lifecycle applicata

---

## Task per la ripresa (in ordine di priorità)

### 1. Verifica L1: lanciare la suite Vitest del frontend

Non è stata lanciata dopo le modifiche di ieri. Dato che abbiamo toccato:
- `DocFileDialog.jsx` (alert, RILASCIA REVISIONE, viewer dispatch)
- `DocumentDetailPanel.jsx` (caricamento file via API)
- `DocumentRegistry.jsx` (filtro default, label rilasciato/bozza)
- `apiService.js` (releaseRevision, getDocFileBlob, mode edit|read)

Comando da terminale Cursor desktop (Windows):
```powershell
$node = "c:\Users\AI.Project\AppData\Local\Programs\cursor\resources\app\resources\helpers\node.exe"
$env:NODE_ENV = "test"; Set-Location "C:\ProgettoISO\app"
& $node "node_modules\vitest\vitest.mjs" run 2>&1 | Select-Object -Last 30
```

Se compaiono failures relativi ai componenti modificati: aggiornare i test (probabili
mock per `apiService.getDocFiles`, `releaseRevision`, `getDocFileBlob`).

---

### 2. Placeholder dinamici nei .docx (richiesta utente esplicita)

L'utente vuole che al rilascio di una revisione i placeholder nel documento Word
vengano sostituiti automaticamente con i valori del DB. Approccio proposto:

**Convenzione placeholder** (da inserire nel `.docx` come testo normale):
- `{{data_rilascio}}` → data odierna del rilascio (`released_at`)
- `{{numero_revisione}}` → `revision_number` (es. `2`)
- `{{revisione_label}}` → label completa (es. `Rev. 02`)
- `{{data_scadenza}}` → `expiry_date` se presente
- `{{titolo_documento}}` → `title`
- `{{codice_documento}}` → `doc_code`

**Implementazione** in `backend/src/controllers/document.controller.js`,
funzione `releaseRevision`:

```js
const Docxtemplater = require('docxtemplater');
const PizZip = require('pizzip');
const fs = require('fs');

// Dopo aver fatto UPDATE document_registry e PRIMA di rispondere:
// 1. Leggi attachment corrente (path su disco)
// 2. Apri come PizZip
// 3. Crea Docxtemplater con dati dinamici
// 4. Renderizza
// 5. Salva nuova versione attachment + UPDATE is_current_doc_version
// 6. Soft-fail: se il replace fallisce (file non template), logga warn e non
//    bloccare il rilascio (l'utente potrebbe usare doc senza placeholder)
```

**Test**: caricare un `.docx` con i placeholder, fare "Apri in Word" → modifica →
salva → "Rilascia revisione" → riaprire e verificare che i placeholder siano stati
sostituiti.

**Nota tecnica**: `docxtemplater` modifica il `.docx` preservando formattazione,
tabelle, immagini. Già nel `package.json` di backend (verificato).

---

### 3. Excel viewer browser-native

Attualmente "Visualizza" su `.xlsx` cade su Office Online Viewer di Microsoft, che
ha gli stessi limiti già visti (porte non standard, cache errori). Valutare:

- **Opzione A**: `sheetjs` (`xlsx` + `xlsx-preview` o renderer custom). Bundle più
  pesante (~500KB).
- **Opzione B**: server-side conversion `.xlsx → HTML` con LibreOffice headless
  sul VPS. Pro: layout fedele. Contro: serve LibreOffice installato.
- **Opzione C**: lasciare il fallback Office Online ma aggiungere messaggio
  "potrebbe non funzionare con tutti i file, in caso scarica".

Decisione utente richiesta prima di implementare.

---

### 4. Supporto `.doc` legacy (formato binario pre-2007)

`docx-preview` non supporta i `.doc` (Word 97-2003 binary). Da verificare cosa
succede oggi se l'utente ha un `.doc` in `attachments`:
- "Visualizza" → presumibilmente errore o crash
- "Apri in Word" → funziona (Word desktop apre .doc nativamente)

Soluzioni:
- Disabilitare il pulsante "Visualizza" per `.doc` con messaggio "Apri in Word
  per visualizzare i file Word legacy".
- Oppure server-side: `LibreOffice --convert-to docx file.doc` al volo (richiede
  LibreOffice sul VPS).

Per ora la prima opzione è la più semplice e l'allineamento con la realtà del
prodotto.

---

### 5. Tests E2E manuali post-fix

Spesso un fix invalida assunzioni in altre parti. Smoke test consigliati prima
di considerare il modulo chiuso:

| Scenario | Risultato atteso |
|---|---|
| Apri Word su doc rilasciato → alert → conferma → modifica → salva | Doc passa a `bozza`, file aggiornato sul server |
| Doc bozza → click "RILASCIA REVISIONE" | `revision_number+=1`, `released_at=now`, status `rilasciato` |
| Visualizza .docx → tenta modifica → salva | Word offre "Salva con nome" locale, server riceve 403 |
| Apri Word → utente chiude senza modificare | Doc resta `rilasciato` (no UPDATE) |
| Cartella con file allegato → Apri in Word → modifica → salva | Cartella resta `rilasciato`, file aggiornato |
| Doc con nome con caratteri italiani (à, é) | Filename URL sanitizzato, no errori HTTP |
| Filtro stato → seleziona "Bozza" | Solo bozze visibili |
| Albero documentale → click su cartella → pannello dettaglio | Lista file allegati visibile |
| `ms-word:ofe|u|...` con TTL token scaduto (>15 min) | Word mostra errore connessione, utente deve cliccare di nuovo "Apri in Word" |

---

### 6. Cleanup secret Cursor Cloud

`SGQ_APP_PASSWORD` non corrisponde più all'hash DB di `admin@sgq.local`. Aggiornarlo
nel dashboard Cursor (`cursor.com → Cloud Agents → Secrets`) per permettere ai
prossimi cloud agent di fare login automatico nei test UI.

---

## Comandi rapidi di riferimento

### Deploy backend (singolo file)
```bash
scp -i /tmp/sgq_key -P 1122 -o StrictHostKeyChecking=no \
  backend/src/controllers/<file>.controller.js \
  spascarella@www.fr-busato.it:/var/www/sgq-backend/src/controllers/

ssh -i /tmp/sgq_key -p 1122 -o StrictHostKeyChecking=no spascarella@www.fr-busato.it \
  "echo '$SGQ_SUDO_PASSWORD' | sudo -S systemctl restart sgq-backend.service && sleep 4 && sudo systemctl status sgq-backend | grep 'Active\|PID'"
```

### Smoke WebDAV produzione
```bash
# Health
curl -sk https://www.fr-busato.it:8443/api/v1/health

# OPTIONS WebDAV (deve avere DAV: 1, 2)
curl -sk -X OPTIONS "https://www.fr-busato.it:8443/webdav/dt/FAKE/1001/1009/test.docx" -D - -o /dev/null | grep -E "HTTP/|DAV:|Allow:"

# Log Nginx ultimi WebDAV
ssh -i /tmp/sgq_key -p 1122 -o StrictHostKeyChecking=no spascarella@www.fr-busato.it \
  "echo '$SGQ_SUDO_PASSWORD' | sudo -S grep '/webdav' /var/log/nginx/access.log | tail -20"
```

### Verifica DB lifecycle
```sql
-- Distribuzione status
SELECT status, doc_type, COUNT(*) AS n FROM document_registry GROUP BY status, doc_type;

-- Documenti in bozza (= modificati ma non rilasciati)
SELECT id, title, doc_type, revision_number, updated_at FROM document_registry
WHERE status='bozza' ORDER BY updated_at DESC;
```

---

## Stato file repository

- Branch attivo: `main`
- Ultimi commit principali (16/05/2026 sera):
  - `feat(viewer): zoom e fullscreen per visualizzatore .docx`
  - `feat(viewer): visualizzatore .docx browser-native (sola lettura)`
  - `feat(webdav): token mode (edit|read) per garantire vera sola lettura`
  - `fix(docs): cartelle non diventano bozza al salvataggio Word + filtro default mostra bozze`
  - `feat(docs): lifecycle documenti — rilasciato/bozza + RILASCIA REVISIONE`

Tutto pushato e deployato. La PR #51 (lifecycle) è stata mergiata in main.
PR #50 (WebDAV fix iniziali) è ancora aperta come draft — può essere chiusa o
mergiata se non già integrata.

---

## Apertura sessione consigliata

Quando riprendi i lavori, esegui in ordine:

1. `git pull origin main`
2. Leggi questo file (DEPUTYTASK.md)
3. Leggi sezione "16 maggio 2026 (sera)" in `docs/GUIDA_CONSOLIDATA.md`
4. Decidi quale punto aperto affrontare (ordine di priorità sopra)
5. Per task complessi (es. placeholder): crea branch dedicato `feat/docx-placeholders`
6. Test L1 prima di pushare modifiche frontend non triviali
