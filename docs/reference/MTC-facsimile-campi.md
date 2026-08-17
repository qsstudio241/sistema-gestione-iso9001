# Facsimile MTC (etichettato 3.1, contenuto 3.2)

> **Uso**: esempio di layout reale per l’estrattore AI. Non è una norma.  
> **Fonte**: `docs/Normative/MTC_Type_3.1_FAC_SIMILE.md`.  
> **Codici**: [EN 10168](EN-10168-layout-certificato.md).

## Avvertenza sul tipo

Il file si chiama **MTC Type 3.1**. Il testo stampato è:

`EN 10204:2004 3.2 – (ISO 10474:2013 3.2)`

e in calce comparono quattro validatori: Responsabile ispezione, Ente di collaudo, Ente d’ispezione, Cliente. Questo è un **3.2**, non un 3.1.

Regola: `inspection_document_type` dal **corpo del documento** (A02), mai dal nome file.

## Campi presenti (mappati)

| Zona facsimile | Codice 10168 | Chiave |
|----------------|--------------|--------|
| Logo / acciaieria | A01 | `manufacturer_works` |
| «CERTIFICATO PROVE MATERIALE» + Cert.N° | A02, A03 | tipo + `certificate_no` |
| Data | Z02 | `validated_at` |
| Customer / Consignee | A06 | `purchaser` |
| Customer order / Job n° | A07, A08 | ordine |
| Material specification | B03 | requisiti supplementari |
| Description / grade / heat / plate / weight | B01, B02, B07, B06, B13 | anagrafica griglia |
| Chemical analysis % + L/P | C71–C92 | L = ladle, P = check/product |
| Ceq % | (C99 nel facsimile) | `CEV` formula IIW in nota |
| Yield / Tensile / Elongation | C11, C12, C13 | 553 / 782 MPa, 35 % |
| Hardness HV10 | C30–C31 | 225 |
| Impact 10×10 mm, J, −46 °C | C40–C43 | KV |
| Heat treatment Q-920/540 | B04 / B05 | QT |
| UT saldatura longitudinale | D02 | NDT |
| Status: fine grained, vacuum degassed, fully killed | B03 | processo |
| Ceq formula | C99 | `C+(Mn/6)+(Cr+Mo+V)/5+(Ni+Cu)/15` |

## Qualità estrazione PDF

Una riga di testo del facsimile ha caratteri in ordine inverso (tabella meccanica). La **tabella markdown** sotto è leggibile (553, 782, 35.0, KV 139/139/140/135 a −46 °C). In ingest: se il testo lineare è spazzatura, usare celle tabella / OCR; non inventare i numeri.

## Cosa impara l’AI

- Codici A/B/C/D/Z possono stare accanto a etichette miste IT/EN.
- CEV e NDT stanno spesso in note, non in una colonna fissa.
- Un 3.2 ha più firme; un 3.1 ne ha una (ispettore fabbricante indipendente).
