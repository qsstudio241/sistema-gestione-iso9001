# EN 10204:2004 / UNI EN 10204:2005 — Tipi di documenti di controllo

> **Uso**: riesame capitolato (ISO-3) + Material Compliance (MC).  
> **Fonte**: estratto operativo da UNI EN 10204:2005 (EN 10204:2004). Testo digitalizzato in `docs/Normative/Normative NORMA_00022_ UNI EN 10204_2005 Rev. 0.md`.  
> **Equivalente acciaio ISO**: [ISO 10474:2013](ISO-10474-documenti-controllo.md) (stessi tipi 2.1 / 2.2 / 3.1 / 3.2).  
> **Layout campi sul certificato**: [EN 10168](EN-10168-layout-certificato.md).

## Scopo

Definisce i **tipi** di documento che il fabbricante consegna all’acquirente. Non definisce chimica né prove meccaniche: quelle stanno nella **specifica di prodotto** (es. EN 10025-2) e nell’ordine.

Campo: tutti i prodotti metallici (applicabile anche a non metallici se la specifica di prodotto lo richiede). Da usare **insieme** alle condizioni di fornitura (ISO 404 / specifica di prodotto).

## Due famiglie di controllo

| Termine | Significato | Documenti |
|---------|-------------|-----------|
| Controllo **non specifico** | Prove secondo procedure del fabbricante; i pezzi provati possono non essere quelli consegnati | 2.1, 2.2 |
| Controllo **specifico** | Prove **prima della consegna** sui prodotti (o unità di prova) effettivamente forniti | 3.1, 3.2 |

## Tipi (Tabella A.1) — dizionario chiuso

| Tipo | Nome IT | Cosa contiene | Chi valida |
|------|---------|---------------|------------|
| `2.1` | Dichiarazione di conformità all’ordine | Solo dichiarazione, **senza** risultati di prova | Fabbricante |
| `2.2` | Rapporto di prova | Dichiarazione + risultati di controllo **non specifico** | Fabbricante |
| `3.1` | Certificato di controllo 3.1 | Dichiarazione + risultati di controllo **specifico** | Rappresentante del fabbricante **autorizzato e indipendente** dal reparto di fabbricazione |
| `3.2` | Certificato di controllo 3.2 | Come 3.1 | Come 3.1 **più** rappresentante del committente **oppure** ispettore designato da regolamenti ufficiali |

Nomi storici (edizione precedente, da riconoscere in capitolati vecchi):

- `3.1.B` → oggi **3.1**
- `3.1.A`, `3.1.C`, verbale di collaudo 3.2 → oggi **3.2**

## Regole per l’estrazione AI (capitolato / ordine)

| Campo canonico | Regola |
|----------------|--------|
| `inspection_document_type` | Solo `2.1` \| `2.2` \| `3.1` \| `3.2`. Se il testo dice «certificato mill», «MTC», «3.1», «Abnahmeprüfzeugnis» → `3.1` salvo 3.2 esplicito |
| `inspection_specificity` | `non_specific` se 2.x; `specific` se 3.x |
| Sinonimi 3.1 | mill test certificate, MTC, inspection certificate 3.1, Abnahmeprüfzeugnis 3.1, certificat de réception 3.1 |
| Sinonimi 2.1 | dichiarazione di conformità, Werksbescheinigung |
| Non confondere | Il **filename** del PDF non è prova del tipo (il facsimile in archivio si chiama «3.1» ma il testo è **3.2**) |

## Trasferimento risultati da materiale primario

Sia 3.1 sia 3.2: il fabbricante **può** copiare sul certificato risultati di controllo specifico su prodotti in entrata, **solo se** ha rintracciabilità e può esibire i documenti originali. Per ISO-3: se il capitolato vieta il trasferimento, è un requisito `spec` da estrarre (`mill_cert_transfer_allowed=false`).

## PED / attrezzature a pressione

L’allegato ZA collega 3.1/3.2 all’Allegato I §4.3 della Direttiva 97/23/CE (oggi 2014/68/UE). Un capitolato PED che chiede «certificato di controllo specifico sul prodotto» = **3.1 o 3.2**, non 2.1/2.2.

## Cosa NON fare

- Trattare «3.1» come sinonimo di «conforme»: il 3.1 è **prova**, i limiti stanno in norma materiale + ordine (ADR-021).
- Inventare tipi `3.1.B` nel database: normalizzare all’edizione 2004.
- Valutare chimica/ReH con questa norma: non ci sono soglie.
