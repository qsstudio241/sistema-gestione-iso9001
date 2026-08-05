# ADR-023 - Material Knowledge Base

## Stato

PROPOSTO

## Data

2026-08-05

## Contesto

Norme, requisiti clienti e regole aziendali cambiano nel tempo.

Tale conoscenza non deve essere codificata all'interno del software.

## Decisione

La conoscenza sarà mantenuta mediante documenti Markdown versionati.

## Struttura

knowledge/material-compliance/

├── standards/

├── customers/

├── tecnove/

├── dictionary/

└── lessons/

## Standards

- EN10204
- EN10025-2
- EN10025-4
- EN10149-2
- EN10210
- EN10219

## Customers

- FASSI
- CLAAS
- CNH
- VOLVO
- altri clienti

## Tecnove

- criteri accettazione
- deroghe
- requisiti speciali

## Data Dictionary

Definizione univoca dei campi:

- colata
- materiale
- certificato
- ReH
- Rm
- KV
- composizione chimica

## Principio fondamentale

Le regole devono essere aggiornabili senza modificare il codice sorgente.

## Conseguenze

Aggiornamento norma:

nessun deploy software richiesto