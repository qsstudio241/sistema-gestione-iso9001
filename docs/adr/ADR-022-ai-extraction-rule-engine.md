# ADR-022 - AI Extraction And Rule Engine Separation

## Stato

PROPOSTO

## Data

2026-08-05

## Contesto

I modelli AI non sono deterministici.

La piattaforma deve garantire:

- auditabilità
- riproducibilità
- conformità ISO 9001
- conformità ISO 3834

## Decisione

L'AI non prende decisioni di conformità.

Le decisioni vengono delegate esclusivamente al Rule Engine.

## Responsabilità AI

- OCR assistito
- classificazione documenti
- estrazione campi
- riconoscimento sinonimi
- normalizzazione dati

## Responsabilità Rule Engine

- applicazione regole
- confronto limiti
- verifica conformità
- generazione esito

## Principio

AI propone.

Rule Engine valuta.

Operatore approva.

## Esempio

AI:

ReH = 395 MPa

Rule Engine:

requisito >= 400 MPa

Esito:

NON CONFORME

## Conseguenze

Ogni esito deve risultare:

- spiegabile
- ripetibile
- verificabile
`