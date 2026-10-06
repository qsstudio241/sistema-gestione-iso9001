> **STATO: ANTEPRIMA, NON TESTO INTEGRALE.** Il PDF fornito dal committente (`iso-14732-2025_12f5.pdf`) è la *Document Preview* gratuita del distributore iTeh (`standards.iteh.ai`): **4 pagine** su circa 20 della norma (copertina, copyright, indice, prefazione). **Le clausole 1–8 e gli Annex A–C NON sono presenti.** Questo file contiene solo ciò che il PDF mostra davvero; nessun contenuto normativo è stato dedotto o ricostruito a memoria. Per ogni regola (variabili essenziali, campo di validità, 3 vs 6 anni, revalidazione, certificato) la fonte 2025 è **GAP**: serve l'edizione integrale (richiesta HITL già presente in `docs/reference/NORME_MANCANTI_BACKLOG.md`, riga ISO 14732).
> **Edizione**: ISO 14732:2025, *Third edition*, 2025-06. **Sostituisce** ISO 14732:2013 (seconda edizione), come dichiarato nella prefazione. Il codice CEN/UNI nazionale (EN ISO 14732 / UNI EN ISO 14732) **non** compare nell'anteprima: non assumerlo.
> **Titolo**: *Welding personnel — Qualification testing of welding operators and weld setters for mechanized and automatic welding of metallic materials* (FR: *Personnel en soudage — Épreuve de qualification des opérateurs soudeurs et des régleurs en soudage pour le soudage mécanisé et le soudage automatique des matériaux métalliques*).
> **Schema JSON**: `norm-clause` `--standard-code ISO_14732_2025`, rigenerato dal Markdown rivisto con `markdown_to_json` (la CLI sul solo PDF produceva record spazzatura dal sommario). Il sommario (Contents) è un elenco, non intestazioni, per non duplicare i numeri di clausola senza testo. **Non** va in `import-norms-from-markdown.js` / seed `norm_requirements`.
> **Qualità estrazione (CLI 06/10/2026)**: 4 pagine, 4 con testo utile, motore `pdfplumber`; nessuna pagina `ATTENZIONE`; nessuna `Nota tecnica`. Il filigrana iTeh si sovrappone al testo: indice (pag. iii) e prefazione (pag. iv) escono mescolati in `pdfplumber` (es. `Thhitstp tsh:/i/rsdt aenddiatirodns`, `qualificatiioTn .. e ..... h`). Testo **ricostruito con `pymupdf`** (stesso PDF, estrazione per blocchi: leggibile e senza mescolanze) e verificato a vista riga per riga. Pagine di copertina e copyright: nessun requisito. Header/footer (`ISO 14732:2025(en)`, `© ISO 2025 – All rights reserved`) e banner iTeh omessi. Boilerplate ISO standard della prefazione (patent, WTO, direttive) omesso: non normativo.
> **Estratto operativo collegato** (edizione 2013, OCR, non allineato alla 2025): `docs/reference/ISO-14732-operatori-saldatura.md`.

## International Standard ISO 14732

Third edition, 2025-06. Reference number ISO 14732:2025(en). © ISO 2025.

## Contents

Struttura dell'edizione 2025 (numeri di pagina della norma tra parentesi; il corpo di ogni voce è **GAP**, non presente nell'anteprima):

- Foreword (iv)
- Introduction (v)
- 1 Scope (1)
- 2 Normative references (1)
- 3 Terms and definitions (2)
- 4 Qualification (4)
- 4.1 General (4)
- 4.2 Fusion welding (5)
- 4.3 Resistance welding (6)
- 4.4 Arc stud welding (6)
- 5 Variables and range of qualification (6)
- 5.1 Mechanized welding (6)
- 5.2 Automatic welding (7)
- 6 Period of validity (7)
- 6.1 Initial qualification (7)
- 6.2 Confirmation of validity (7)
- 6.3 Revalidation of qualification (7)
- 6.4 Revocation of qualification (8)
- 7 Welding operator or weld setter qualification test certificate (8)
- 8 Documentation (8)
- Annex A (normative) Functional knowledge of the welding unit (9)
- Annex B (informative) Knowledge of welding technology (10)
- Annex C (informative) Example of a qualification test certificate for welding operators and/or weld setters (14)
- Bibliography (16)

## Foreword

Estratto delle parti specifiche di questo documento (testo generale ISO sulle procedure, brevetti e WTO omesso).

This document was prepared by Technical Committee ISO/TC 44, Welding and allied processes, Subcommittee SC 11, Qualification requirements for welding and allied processes personnel, in collaboration with the European Committee for Standardization (CEN) Technical Committee CEN/TC 121, Welding and allied processes, in accordance with the Agreement on technical cooperation between ISO and CEN (Vienna Agreement).

This third edition cancels and replaces the second edition (ISO 14732:2013), which has been technically revised.

The main changes are as follows:

- introduction has been revised to exclude reference to application standards;
- scope clarifies that the standard does not apply to personnel who do not control or adjust welding parameters; or are not involved in the setup of welding equipment;
- scope is now limited to metallic materials per the title;
- scope references ISO 25239-3 and ISO 18785-3, respectively for friction stir and friction stir spot welding;
- normative references in Clause 2 have been updated;
- terms and definitions in Clause 3 have been updated and re-ordered;
- Clause 4 has been significantly revised and variables and range of qualification are now in a new Clause 5;
- Clause 6 (previously Clause 5) has been revised;
- Annexes A and B have been updated.

Any feedback or questions on this document should be directed to the user's national standards body. Official interpretations of ISO/TC 44 documents, where they exist, are available at https://committee.iso.org/sites/tc44/home/interpretation.html.

## Clausole (indice 2025, corpo GAP)

Gli Annex A (normative, pag. 9), B (informative, pag. 10) e C (informative, pag. 14) e la Bibliography (pag. 16) sono pure **GAP**: nell'indice senza numero di clausola, quindi non producono record JSON.

Verifica richiesta quando arriva l'edizione integrale: rilanciare `python3 -m backend.scripts.pdf_to_json.cli --schema norm-clause --standard-code ISO_14732_2025` sul PDF completo, rivedere il `.md` per intero e sostituire questo file (stesso `NORMA_00046`, `Rev. 0` → `Rev. 1`).

## 1 Scope

**GAP** (pag. 1). Il titolo e il numero di pagina derivano dall'indice del PDF. Dalla prefazione (non è il testo della clausola): l'ambito è limitato ai materiali metallici; esclude il personale che non controlla né regola i parametri di saldatura o non partecipa all'impostazione dell'attrezzatura; rinvia a ISO 25239-3 e ISO 18785-3 per friction stir e friction stir spot welding.

## 2 Normative references

**GAP** (pag. 1). Il titolo e il numero di pagina derivano dall'indice del PDF. Dalla prefazione: riferimenti normativi aggiornati rispetto al 2013. Elenco non disponibile.

## 3 Terms and definitions

**GAP** (pag. 2). Il titolo e il numero di pagina derivano dall'indice del PDF. Dalla prefazione: definizioni aggiornate e riordinate rispetto al 2013. Elenco non disponibile.

## 4 Qualification

**GAP** (pag. 4). Il titolo e il numero di pagina derivano dall'indice del PDF. Dalla prefazione: clausola significativamente rivista. Sottoclausole da indice: 4.1 General (pag. 4), 4.2 Fusion welding (pag. 5), 4.3 Resistance welding (pag. 6), 4.4 Arc stud welding (pag. 6). Metodi di qualifica e prove: **GAP**.

## 5 Variables and range of qualification

**GAP** (pag. 6). Il titolo e il numero di pagina derivano dall'indice del PDF. Dalla prefazione: nuova clausola 2025 (nel 2013 le variabili stavano nella clausola 4). Sottoclausole da indice: 5.1 Mechanized welding (pag. 6), 5.2 Automatic welding (pag. 7). Variabili essenziali e campo di validità: **GAP**.

## 6 Period of validity

**GAP** (pag. 7). Il titolo e il numero di pagina derivano dall'indice del PDF. Dalla prefazione: già clausola 5 nel 2013, rivista. Sottoclausole da indice: 6.1 Initial qualification, 6.2 Confirmation of validity, 6.3 Revalidation of qualification (pag. 7), 6.4 Revocation of qualification (pag. 8). Intervalli di conferma e revalidazione (3 vs 6 anni): **GAP**.

## 7 Welding operator or weld setter qualification test certificate

**GAP** (pag. 8). Il titolo e il numero di pagina derivano dall'indice del PDF. Campi del certificato: **GAP**. L'Annex C (informative, pag. 14) contiene l'esempio di certificato: **GAP**.

## 8 Documentation

**GAP** (pag. 8). Il titolo e il numero di pagina derivano dall'indice del PDF. Clausola presente nell'indice 2025: contenuto **GAP**.
