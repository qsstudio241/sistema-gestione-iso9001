# Sintesi norme certificati — uso ISO-3 e Material Compliance

> **Data**: 16/08/2026.  
> **Input**: PDF consegnati dal committente (EN/UNI 10168, UNI EN 10204 commentata, ISO 10474, ISO 6929, ISO 404+A1, facsimile MTC, **BS EN 10025-2:2019**).  
> **Digitalizzazione**: `docs/Normative/` NORMA_00020–00026 + `MTC_Type_3.1_FAC_SIMILE.*` (PDF **non** in Git).  
> **Estratti**: [EN 10204](EN-10204-documenti-controllo.md) · [EN 10168](EN-10168-layout-certificato.md) · [ISO 10474](ISO-10474-documenti-controllo.md) · [ISO 404](ISO-404-condizioni-fornitura.md) · [ISO 6929](ISO-6929-vocabolario-prodotti.md) · [facsimile](MTC-facsimile-campi.md) · [EN 10025-2](EN-10025-2-acciai-strutturali.md).

## Dove finiscono queste norme (non confondere i moduli)

| Modulo | Domanda | Cosa usiamo da questo pacchetto |
|--------|---------|----------------------------------|
| **ISO-3** — analisi AI capitolato (`ContractReviewPage`, `caseTextAnalysis.service.js`) | «Cosa chiede il cliente sull’acciaio / sui certificati?» | Tipo documento 2.1–3.2, forma prodotto, designazione, condizione di fornitura, NDT, divieti intermediario |
| **Material Compliance** — verifica 3.1/3.2 sul PDF | «Questo certificato è la prova giusta e i valori coprono i requisiti?» | Layout EN 10168, tipi EN 10204, dizionario campi, facsimile, **soglie EN 10025-2** (lamiere/profili) |

ISO-3 **estrae requisiti dal capitolato**. MC **estrae valori dal certificato** e li confronta (ADR-021: il 3.1 non si auto-valuta). Stesso dizionario chiavi, due pipeline.

## Cosa sblocca lo sviluppo

Consegnato ora:

- Enum chiuso tipi documento: `2.1` \| `2.2` \| `3.1` \| `3.2`
- Dizionario campi certificato (codici A/B/C/D/Z)
- Checklist ordine ISO 404 §4.1
- Vocabolario forme prodotto (sottoinsieme)
- Esempio di MTC reale (di fatto 3.2)

**Soglie grado lamiere/profili** (EN 10025-2:2019): consegnate — [estratto](EN-10025-2-acciai-strutturali.md). MC-2 può seedare S235/S275/S355 (e S460/S500 lunghi). **Non** copre tubi/sezioni cave.

**Ancora assente (non inventare seed):**

- EN 10210-1 / EN 10219-1 (hollow sections / tubi)
- Altre parti 10025 (3/4/5/6) se arrivano certificati fine grain / TM / weathering
- Requisiti cliente FASSI/CLAAS (`knowledge/.../customers/`)
- Criteri interni azienda (`companies/<slug>/`)

MC-0 può chiudere DATA_MODEL/UI/API con campi **estendibili** + dizionario 10168. MC-2 seed soglie **lamiere/profili Sxxx** = EN 10025-2.

## ISO-3 — chiavi da aggiungere all’estrazione capitolato

Oggi `caseTextAnalysis` ha `req_type`: `delivery` \| `legal` \| `commercial` \| `spec` \| `note` e `field_key` libero. Non serve nuova colonna: basta **prompt + elenco chiavi** in `buildUserPrompt`.

| `field_key` | `req_type` | Esempio in capitolato |
|-------------|------------|------------------------|
| `inspection_document_type` | spec | «certificato 3.1 EN 10204», «ISO 10474 3.2» |
| `material_standard` | spec | EN 10025-2, EN 10219-1 (già citato nel prompt) |
| `steel_designation` | spec | S355J2, S420KT-40 |
| `product_form` | spec | lamiera, tubo, profilato |
| `delivery_condition` | spec | normalizzato, QT, as rolled |
| `heat_treatment_required` | spec | PWHT, vacuum degassed |
| `ndt_required` | spec | UT, PT, MT su prodotto |
| `original_mill_cert_required` | spec | niente copia intermediario |
| `intermediary_allowed` | spec | centro servizi sì/no |
| `qms_required` | legal | ISO 9001 del fabbricante |
| `quantity` / `dimensions` / `tolerances` | delivery/spec | ISO 404 §4.1 a–d |

`identified_standards` in `aiContextBuilder` deve riconoscere: `EN 10204`, `EN 10168`, `ISO 10474`, `ISO 404`, `ISO 6929`, `EN 10025-2` oltre a 9001/3834.

NormBroker: queste norme **non** vanno in `import-norms-from-markdown.js` (non sono SGQ a clausole 4–10). Restano KB + prompt, come gas 14175 / temperature 13916.

## Material Compliance — schema estrazione certificato (MVP)

Allineato alla griglia HITL 16/08 + EN 10168:

```text
certificate_no          ← A03
inspection_document_type← A02   (2.1|2.2|3.1|3.2)
manufacturer_works      ← A01
purchaser_order_no      ← A07   (ponte DDT/ordine)
steel_designation       ← B02
product_form            ← B01   (enum ISO 6929 ridotto)
heat_no                 ← B07
dimensions              ← B09–B11
actual_mass             ← B13
delivery_condition      ← B04
ReH, Rm, A              ← C11–C13
KV                      ← C40–C43
hardness                ← C30–C32
chemistry{}             ← C71–C92  (mappa elemento → %)
CEV                     ← spesso C99 / colonna extra
ndt[]                   ← D02–D50
validated_by            ← Z02
compliance_statement    ← Z01
```

Rule Engine (dopo MC-2): confronta questi valori con il **più restrittivo** tra norma materiale + PO + cliente + azienda. EN 10204 serve solo a verificare che il **tipo** richiesto dal capitolato sia quello ricevuto (3.1 vs 3.2 vs 2.2).

## Qualità conversione PDF

| File | Pagine | Note |
|------|--------|------|
| UNI EN 10168 | 26 | OK, bilingue; tabelle A–Z utilizzabili |
| EN 10168 BSI | 16 | OK, inglese; watermark BSI rimosso |
| UNI EN 10204 commentata | 19 | OK; qualche glifo `Þ` in copertina, tabelle tipi pulite |
| ISO 10474 | 10 | p.9 colophon vuoto (segnata ATTENZIONE, nessun requisito) |
| ISO 6929 | 46 | p.45 colophon; definizioni lunghe a volte fuse (usare estratto, non il JSON grezzo per l’UI) |
| ISO 404+A1 | 24 | OK; due copie PDF identiche, convertita una |
| Facsimile MTC | 1 | tabella ok; una riga testo con caratteri invertiti |
| BS EN 10025-2:2019 | 44 | nessuna ATTENZIONE; p. 29–33 e 36 ricostruite pymupdf. Griglie Tab. 1/3/5 a volte fuse: soglie da [estratto](EN-10025-2-acciai-strutturali.md) |

Duplicato scartato: `BS ISO 404-2013 + A1-2022 (1).pdf` = stesso hash del file senza `(1)`.

## Inventario fonti Markdown (traccia, non blocco)

Fonte unica per «cosa abbiamo / cosa manca». Aggiornare **qui** dopo ogni `pdf-to-json`, non solo in chat.

**Dichiarazione obbligatoria** (skill `pdf-to-json` / `gap-analysis-normativa`, Rule Engine, seed MC-2, prompt ISO-3) — 3 righe in chat, poi si parte:

```text
Fonti Markdown:
- Coperte: …
- Mancanti (non bloccano): … → GAP, skip su quel prodotto
- Si parte su: …
```

Vietato inventare soglie. Vietato rinviare la slice coperta perché manca un’altra norma.

| Norma | Markdown / estratto | Stato | Serve a |
|-------|---------------------|-------|---------|
| EN 10204 | NORMA_00022 + `EN-10204-documenti-controllo.md` | **presente** | tipo 2.1–3.2 |
| EN 10168 | NORMA_00020/00021 + `EN-10168-layout-certificato.md` | **presente** | layout campi A–Z |
| ISO 10474 | NORMA_00023 | **presente** | equivalente 10204 |
| ISO 404 | NORMA_00025 | **presente** | contenuto ordine |
| ISO 6929 | NORMA_00024 | **presente** | forme prodotto |
| Facsimile MTC | `MTC_Type_3.1_FAC_SIMILE.*` | **presente** | esempio 3.2 |
| EN 10025-2:2019 | NORMA_00026 + `EN-10025-2-acciai-strutturali.md` | **presente** | soglie lamiere/profili S235–S500 |
| ISO/TR 15608 | `ISO-TR-15608-gruppi-materiali.md` | **presente** | gruppi materiale |
| **EN 10210-1** | — | **mancante** (traccia) | soglie tubi/hollow a caldo |
| **EN 10219-1** | — | **mancante** (traccia) | soglie tubi/hollow a freddo |
| EN 10025-3/4/5/6 | — | traccia, non ora | fine grain / TM / weathering |
| EN 10164, 10163, 10160, EN 1011-2 | — | traccia, solo se capitolato | Z, superfici, UT, saldatura |
| EN ISO 6892-1, 148-1, 377, 14284 | — | non richiesta MVP | metodi di prova |
| EN 10027, 10029, 10051, 10025-1 | — | non richiesta MVP | nomi e tolleranze |
| ISO 4990 | — | traccia, solo getti | da ISO 10474 |

Dettaglio perché (non l’elenco §2 intero della 10025-2): 10025-2 **non** copre tubi — senza 10210/10219 un 3.1 su tubo resta senza soglie (skip, non fail).

## Prossimi passi consigliati

1. **ISO-3** (capitolato): estendere il prompt di `caseTextAnalysis` / `aiContextBuilder` con le chiavi sopra + elenco norme (ora anche EN 10025-2). Persistenza già coperta da mig. 116: non serve nuova tabella.
2. **MC-0**: chiudere le tre spec con il dizionario 10168 (campi lab estendibili).
3. **MC-2**: seed soglie da [EN 10025-2](EN-10025-2-acciai-strutturali.md) **dopo dichiarazione fonti**. Tubi: skip finché EN 10210-1 / EN 10219-1 non sono in Markdown (riga inventario sopra).
