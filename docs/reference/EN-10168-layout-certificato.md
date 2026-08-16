# EN 10168:2004 / UNI EN 10168:2005 — Layout e codici del certificato

> **Uso**: dizionario campi per estrazione AI dei certificati (MC-2) e per capire cosa chiede un capitolato.  
> **Fonte**: UNI EN 10168:2005 (bilingue). Testo in `docs/Normative/Normative NORMA_00020_ UNI EN 10168_2005 Rev. 0.md`. Edizione EN inglese: `NORMA_00021`.  
> **Tipi documento**: [EN 10204](EN-10204-documenti-controllo.md).  
> **Esempio reale**: [facsimile MTC](MTC-facsimile-campi.md).

## Scopo

Elenca **quali informazioni** possono comparire su un documento di controllo acciaio e assegna un **codice univoco** (A01, B07, C11, …). Non cambia i tipi 2.1–3.2: li descrive.

Il fabbricante può cambiare ordine e layout e omettere sezioni inutili. **I numeri di codice sono unici**: non se ne inventano altri. Se manca spazio, il dato va in un supplemento **con lo stesso codice**.

## Gruppi (prospetto 1)

| Gruppo | Contenuto | Sezioni fisse | Sezioni libere |
|--------|-----------|---------------|----------------|
| **A** | Transazioni e parti | A01–A09 | A10–A99 |
| **B** | Descrizione prodotto | B01–B13 | B14–B99 |
| **C** | Prove e chimica | vedi sotto | vedi sotto |
| **D** | Altre prove (NDT, aspetto) | D01–D50 | D51–D99 |
| **Z** | Validazione | Z01–Z04 | Z05–Z99 |

Tutti i tipi EN 10204 hanno A+B+Z. Il tipo **2.1 non ha** C né D (niente risultati di prova). 2.2 / 3.1 / 3.2 hanno C e/o D.

### Sottogruppi C

| Range | Tema | Chiave SGQ |
|-------|------|------------|
| C00–C03 | Campione: id, punto prelievo, direzione, temperatura | `sample_*` |
| C10–C13 | Trazione: forma, ReH/Rp, Rm, A% | `ReH`, `Rm`, `A` |
| C30–C32 | Durezza | `hardness` |
| C40–C43 | Resilienza KV (tipo provino obbligatorio) | `KV` |
| C50–C69 | Altre prove meccaniche | libero |
| C70 | Processo di elaborazione acciaio | `steelmaking_process` |
| C71–C92 | Composizione chimica (solo elementi con limiti in specifica) | `C`, `Mn`, `P`, `S`, … |
| C93–C99 | Supplemento chimica (nel facsimile: formula Ceq in C99) | `CEV` |

## Campi MVP (allineati alla griglia DDT + anagrafica)

| Codice | Nome IT | Chiave canonica | Note |
|--------|---------|-----------------|------|
| A01 | Stabilimento fabbricante | `manufacturer_works` | ragione sociale + indirizzo |
| A02 | Tipo documento | `inspection_document_type` | 2.1 / 2.2 / 3.1 / 3.2 |
| A03 | Numero documento | `certificate_no` | colonna griglia «N. certificato» |
| A06 | Committente / destinatario | `purchaser` | A06.1 acquirente, A06.2 destinatario merce, A06.3 destinatario certificato |
| A07 | N. ordine committente | `purchaser_order_no` | ponte ordine / DDT |
| B01 | Forma prodotto | `product_form` | lamiera, tubo, profilato, … (vocabolario ISO 6929) |
| B02 | Designazione acciaio | `steel_designation` | es. S355J2 + norma prodotto |
| B04 | Condizione di fornitura | `delivery_condition` | N, QT, AR, … |
| B07 | Identificazione / colata | `heat_no` | colata, lingotto, lotto, n. prova |
| B09–B11 | Dimensioni | `dimensions` | spessore / Ø / lunghezza |
| B13 | Massa effettiva | `actual_mass` | |
| C11 | Snervamento | `ReH` | MPa (Rp0,2 se prova) |
| C12 | Resistenza | `Rm` | MPa |
| C13 | Allungamento | `A` | %; se L0 ≠ 5,65√S0 indicarlo |
| C40–C43 | Resilienza | `KV` | tipo provino obbligatorio; singoli + media |
| C71–C92 | Chimica | elementi | solo quelli con limite in specifica |
| Z01 | Dichiarazione conformità | `compliance_statement` | |
| Z02 | Data e validazione | `validated_at`, `validated_by` | **firma non obbligatoria** (ISO 10474 §7: nome e funzione) |

## Simboli direzione provino (C02)

`L` longitudinale · `T` trasversale · `Z` spessore. Obbligatori se la specifica offre una scelta.

## Regole per l’estrazione AI (certificato)

1. Cercare prima i **codici** (`A03`, `B07`, `C11`) poi le etichette (Heat No., Colata, ReH, Yield).
2. Un certificato può omettere sezioni: assenza ≠ fail (ADR-021: livello assente → `skip` solo sui **requisiti**; sul certificato un campo atteso dalla specifica di prodotto è un gap).
3. Chimica: non inventare elementi non stampati. CEV/Ceq spesso **non** è in C71–C92 ma in colonna extra o C99.
4. Layout a colonne invertite (testo RTL da PDF): non inventare i numeri; GAP onesto (lezione RC-5/RC-6).

## Cosa NON fare

- Hardcodare un layout grafico unico: EN 10168 consente sequenza diversa.
- Usare codici fuori tabella (es. inventare `C15` per CEV): usare C93–C99 o annotare `field_key=CEV` senza codice falso.
- Mettere in griglia elenco chimica/ReH: restano in scheda dettaglio (PLAN MC).
