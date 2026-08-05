# ADR-021 - Material Requirements Hierarchy

## Stato

PROPOSTO

## Data

2026-08-05

## Contesto

La conformità di una materia prima non è determinata da una singola norma.

Possono concorrere requisiti provenienti da:

- certificato
- normativa tecnica
- ordine cliente
- requisiti cliente
- requisiti interni

## Decisione

La piattaforma applicherà la seguente gerarchia di verifica.

EN 10204

↓

Norma Materiale

↓

Ordine di Acquisto

↓

Requisiti Cliente

↓

Requisiti Interni Aziendali

## Regola fondamentale

Prevale sempre il requisito più restrittivo.

## Esempio

Norma:

ReH >= 355 MPa

Cliente FASSI:

ReH >= 390 MPa

Requisito Tecnove:

ReH >= 400 MPa

Valore certificato:

395 MPa

Risultato:

Norma = Conforme

Cliente = Conforme

Tecnove = Non Conforme

Esito finale:

NON CONFORME

## Conseguenze

Ogni valutazione dovrà riportare:

- requisito verificato
- origine del requisito
- valore richiesto
- valore rilevato
- esito