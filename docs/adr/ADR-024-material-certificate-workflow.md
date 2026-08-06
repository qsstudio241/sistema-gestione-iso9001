# ADR-024 - Material Certificate Workflow

## Stato

PROPOSTO

## Data

2026-08-05

## Contesto

La verifica della materia prima deve seguire un flusso controllato e tracciabile.

## Workflow

Ricezione Documento

↓

Acquisizione PDF

↓

OCR

↓

Markdown

↓

Estrazione AI

↓

Normalizzazione Dati

↓

Rule Engine

↓

Revisione Operatore

↓

Conforme

oppure

Non Conforme

## Human In The Loop

Nessun certificato viene approvato automaticamente.

L'operatore qualità deve sempre poter:

- verificare i dati
- correggere i dati
- approvare
- respingere

## Audit Trail

Per ogni certificato devono essere conservati:

- PDF originale
- Output OCR
- Markdown generato
- JSON estratto
- Regole applicate
- Esito
- Utente approvatore
- Timestamp

## Lessons Learned

Le correzioni dell'operatore saranno archiviate per:

- miglioramento dei prompt
- miglioramento dell'estrazione
- eventuali future attività di fine-tuning

## Conseguenze

Ogni decisione deve poter essere ricostruita integralmente durante audit.