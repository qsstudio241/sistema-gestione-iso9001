# ISO 10474:2013 — Documenti di controllo (acciaio)

> **Uso**: equivalente ISO di EN 10204, citata da ISO 404.  
> **Fonte**: `docs/Normative/Normative NORMA_00023_ ISO 10474_2013 Rev. 0.md`.  
> **Dizionario tipi**: [EN 10204](EN-10204-documenti-controllo.md) — **stessi codici** 2.1 / 2.2 / 3.1 / 3.2.

## Rapporto con EN 10204

| | EN 10204:2004 | ISO 10474:2013 |
|--|---------------|----------------|
| Campo | Prodotti **metallici** (e altri se richiesto) | **Acciaio** e prodotti siderurgici (nota: applicabile anche ad altri) |
| Tipi | 2.1, 2.2, 3.1, 3.2 | identici |
| 3.1 storico | 3.1.B | nota: in alcuni Paesi si accetta ancora «3.1B» finché la specifica di prodotto non è aggiornata |
| 2.3 storico | — | ISO 10474:1991 tipo 2.3: usabile solo dove ancora citato, fino a revisione della specifica |

In capitolati UE scrivere **EN 10204**. In capitolati ISO/export può comparire **ISO 10474**. Per il software: un solo enum `inspection_document_type`.

## Intermediario (centro servizi / stockist) — §6

- Consegnare originale o copia del documento del **fabbricante**. Copia (scan/fotocopia) ok se c’è rintracciabilità e l’originale è disponibile a richiesta.
- **Vietato** modificare o aggiungere sul documento originale.
- Se l’intermediario cambia identificazione, dimensioni o quantità: **documento aggiuntivo** + rintracciabilità (ISO 404).
- **Vietato** cambiare la designazione dell’acciaio, anche dopo nuove prove.
- Chi altera lo stato metallurgico diventa **fabbricante**.

Per ISO-3: se il capitolato vieta centri servizi o chiede «solo originale acciaieria», estrarre `intermediary_allowed` / `original_mill_cert_required`.

## Validazione (§7)

Nome e funzione di chi valida. **Firma non richiesta**. Conservazione: carta o elettronica.
