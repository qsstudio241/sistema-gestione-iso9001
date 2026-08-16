# ISO 404:2013+A1:2022 — Condizioni tecniche generali di fornitura (acciaio)

> **Uso**: cosa deve contenere **ordine / capitolato** (ISO-3) e cosa il fabbricante deve garantire.  
> **Fonte**: BS ISO 404:2013+A1:2022 in `docs/Normative/Normative NORMA_00025_ ISO 404_2013_A1_2022 Rev. 0.md`.  
> **Documenti di controllo**: rimanda a [ISO 10474](ISO-10474-documenti-controllo.md) (in UE: EN 10204).  
> **Forme prodotto**: [ISO 6929](ISO-6929-vocabolario-prodotti.md).

## Scopo

Requisiti generali di fornitura per i prodotti in acciaio coperti da ISO 6929, **esclusi** getti e prodotti da metallurgia delle polveri. Se ordine o specifica di prodotto dicono altro, **vincono ordine / specifica di prodotto**.

## Cosa deve stare nell’ordine (§4.1) — checklist ISO-3

L’acquirente deve indicare:

| Lettera | Contenuto | `field_key` suggerito (`req_type`) |
|---------|-----------|-------------------------------------|
| a | massa, lunghezza, area, n. pezzi | `quantity` (`delivery`) |
| b | forma del prodotto (o n. disegno) | `product_form` (`spec`) |
| c | dimensioni nominali | `dimensions` (`spec`) |
| d | tolleranze su a e c | `tolerances` (`spec`) |
| e | designazione acciaio | `steel_designation` (`spec`) |
| f | condizione di fornitura (TT, superficie, …) | `delivery_condition` (`spec`) |
| g | qualità superficiale e/o interna | `surface_internal_quality` (`spec`) |
| **h** | **tipo di documento di controllo** +, se manca in specifica, prove richieste | `inspection_document_type` (`spec`) |
| i | eventuale SGQ ISO 9001 | `qms_required` (`legal`) |
| j | marcatura, imballo, carico | `marking_packaging` (`delivery`) |
| k | requisiti opzionali della specifica di prodotto | `supplementary_requirements` (`spec`) |

Se manca **h** nel capitolato: gap `to_verify` (ISO 404: «When ordering, the purchaser shall state which type…»). Default operativo SGQ: chiedere 3.1 se il lavoro è saldatura strutturale / PED, non inventarlo in silenzio.

## Controllo specifico vs non specifico (§8)

- 2.1 / 2.2 → §8.2 (non specifico). Per il 2.2 l’acquirente indica **quali caratteristiche** riportare se la specifica di prodotto non lo fa.
- 3.1 / 3.2 → §8.3: tipo documento, frequenza prove, luogo, diritti dell’ispettore, rintracciabilità in prova.

## Intermediario (§6, allineato a ISO 10474)

Documento del fabbricante + identificazione prodotto. Nuove dimensioni → documento aggiuntivo. Chi cambia lo stato metallurgico = fabbricante.

## Processo di fabbricazione (§5)

Lasciato al fabbricante salvo accordo all’ordine o specifica di prodotto. Per ISO-3: estrarre solo se il capitolato **impone** un processo (es. vacuum degassed, fully killed).

## Cosa NON fare

- Usare ISO 404 come tabella di limiti ReH/chimica: non ce li ha.
- Ignorare l’ordine: in caso di conflitto, ordine/specifica di prodotto battono questa norma.
