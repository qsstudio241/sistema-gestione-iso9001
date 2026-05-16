# DEPUTYTASK — Fix caratteri non riconosciuti nella UX + regola preventiva

## Obiettivo
Scansionare **tutti i file frontend** (`app/src/**/*.jsx`, `app/src/**/*.css`) e i file backend che generano testo utente (`backend/src/controllers/*.js`, `backend/src/services/*.js`) per trovare caratteri "rotti" (es. `�`, sequenze `??`, encoding corrotti, emoji spezzate).

Determinare il carattere corretto per ogni occorrenza, correggere, e **creare una regola `.cursor/rules`** per evitare che vengano usati in futuro.

## Contesto
Alcuni file contengono caratteri non riconosciuti (probabilmente per problemi di encoding UTF-8/Latin1 durante salvataggi o copia-incolla). Questi appaiono nella UI come `�`, `??`, quadratini o spazi vuoti. Vanno trovati tutti e corretti.

## Step 1 — Scansione sistematica

Cercare nei file sorgente (NON in `app/dist/`, NON in `node_modules/`):

```bash
# Pattern da cercare:
# 1. Replacement character Unicode U+FFFD: �
# 2. Sequenze di ?? dove ci dovrebbe essere un carattere (es. "Qualit??" invece di "Qualità")
# 3. Caratteri Latin1 corrotti: Ã , Ã¨, Ã©, Ã², Ã¹ (UTF-8 letto come Latin1)
# 4. Emoji Unicode che potrebbero non renderizzare: \uD83E\uDD16, \uD83D\uDCA1, ecc.

# Usare ripgrep (rg) per cercare:
rg -l '�|Ã |Ã¨|Ã©|Ã²|Ã¹' app/src/ backend/src/
rg -n "Qualit..\b" app/src/ backend/src/  # per trovare "Qualità" corrotto
rg -n "entit..\b" app/src/ backend/src/   # per trovare "entità" corrotto  
rg -n "Gravit..\b" app/src/ backend/src/  # per trovare "Gravità" corrotto
```

## Step 2 — Catalogare le occorrenze

Per ogni file con problemi, creare una lista:
```
| File | Riga | Testo corrotto | Testo corretto |
|------|------|----------------|----------------|
| knowledgeIndexer.service.js | 38 | "Gravit:" | "Gravità:" |
| ... | ... | ... | ... |
```

## Step 3 — Correggere

Per ogni occorrenza:
1. Leggere il file
2. Sostituire il testo corrotto con quello corretto (usare StrReplace)
3. Verificare che il file sia salvato in UTF-8

**Attenzione**: i file JSX che contengono emoji tramite escape Unicode (`\uD83E\uDD16`) sono CORRETTI — non sono caratteri rotti. Quelli sono intenzionali. Correggere solo i testi in italiano con accenti mancanti o caratteri rotti.

## Step 4 — Creare regola preventiva

Creare il file `.cursor/rules/sgq-encoding-quality.mdc` con:

```markdown
---
description: Regola encoding e caratteri — prevenzione caratteri corrotti
alwaysApply: true
---

# Encoding e qualità testo

## Regola caratteri italiani
- Tutti i file sorgente DEVONO essere salvati in **UTF-8 senza BOM**
- I testi in italiano DEVONO usare le lettere accentate corrette: à, è, é, ì, ò, ù (NON sequenze corrotte come ??, Ã , ecc.)
- **Mai** usare apostrofo al posto dell'accento (es. "qualita'" → usare "qualità" nei testi UI visibili all'utente)

## Caratteri proibiti nei sorgenti
| Carattere | Problema | Sostituzione |
|-----------|----------|-------------|
| � (U+FFFD) | Replacement character | Determinare il carattere originale |
| Ã  / Ã¨ / Ã© | UTF-8 letto come Latin1 | à / è / é |
| ?? in mezzo a parola | Encoding perso | Lettera accentata corretta |

## Emoji nel codice
- Le emoji nella UI devono essere inserite come **escape Unicode** (`\uD83E\uDD16`) o come entità, NON come carattere diretto (evita problemi cross-platform)
- Le emoji vanno usate SOLO se esplicitamente richieste dal committente

## Lista caratteri accentati italiani di riferimento
à (U+00E0), è (U+00E8), é (U+00E9), ì (U+00EC), ò (U+00F2), ù (U+00F9)
À (U+00C0), È (U+00C8), É (U+00C9), Ì (U+00CC), Ò (U+00D2), Ù (U+00D9)
```

## Step 5 — Verifica

1. Build frontend: 
```powershell
$node = "c:\Users\AI.Project\AppData\Local\Programs\cursor\resources\app\resources\helpers\node.exe"
Set-Location "C:\ProgettoISO\app"; & $node "node_modules\vite\bin\vite.js" build 2>&1 | Select-Object -Last 30
```

2. Verificare che non ci siano più caratteri corrotti:
```bash
rg '�|Ã |Ã¨|Ã©' app/src/ backend/src/
```
Deve restituire 0 risultati.

## Step 6 — Commit e push

```bash
git add -A
git commit -m "fix(encoding): corregge caratteri non riconosciuti nella UX + regola preventiva encoding"
git push origin main
```

## Esito atteso
Riportare:
- Numero file corretti
- Tabella completa delle sostituzioni fatte
- Conferma creazione regola `.cursor/rules/sgq-encoding-quality.mdc`
- Esito build
- Commit hash

Chiudere con: **TEST OK** o **FIX NECESSARIO: [descrizione]**
