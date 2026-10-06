> **STATO: TESTO INTEGRALE.** Il PDF fornito dal committente (`BS_EN_ISO_14732_2025_Welding_personnel_Qualification_testing_of_f3b7.pdf`, 34 pagine, copia BSI) contiene l'intera norma: copertina e *National foreword* BSI, *European foreword* e Annex ZA/ZB (EN), Foreword/Introduction ISO, **clausole 1-8**, **Annex A (normative), B e C (informative)** e Bibliography. Questo file **sostituisce** l'anteprima iTeh di 4 pagine (`Rev. 0`, storia in Git) e chiude la richiesta HITL 1 dell'epic «Verifica qualifiche vs norma».
> **Edizione**: **BS EN ISO 14732:2025** = recepimento UK di EN ISO 14732:2025 (approvata CEN 9 giugno 2025, luglio 2025), «identical to ISO 14732:2025» (terza edizione, 2025-06). Pubblicata BSI il 31 luglio 2025, **«Incorporating corrigendum October 2025»** (31 ottobre 2025: correzione del titolo del mandato nell'Annex ZB, recepimento della CEN correction notice del 3 settembre 2025). ISBN 978 0 539 39333 0, ICS 25.160.01. **Sostituisce** BS EN ISO 14732:2013 / EN ISO 14732:2013 (ritirata). Comitato UK: WEE/36. Il codice UNI nazionale (UNI EN ISO 14732:2025) **non** compare nel PDF: non assumerlo. Recepimento nazionale EN: entro gennaio 2026 (European foreword).
> **Titolo**: *Welding personnel — Qualification testing of welding operators and weld setters for mechanized and automatic welding of metallic materials* (FR: *Personnel en soudage — Épreuve de qualification des opérateurs soudeurs et des régleurs en soudage pour le soudage mécanisé et le soudage automatique des matériaux métalliques*).
> **Schema JSON**: `norm-clause` `--standard-code ISO_14732_2025`, rigenerato dal Markdown rivisto con `markdown_to_json` (stessa convenzione di `NORMA_00045`: solo le sezioni con numero di clausola producono record; `Foreword`, `Introduction`, Annex A/B/C e ZA/ZB sono nel `.md` ma **non** nel `.json`). Questo file **non** va in `import-norms-from-markdown.js` / seed `norm_requirements` (norma di qualifica personale, non SGQ a clausole 4-10).
> **Qualità estrazione (CLI 06/10/2026)**: 34 pagine, 34 con testo utile, motore `pdfplumber`, nessuna pagina `ATTENZIONE`, nessuna `Nota tecnica`. Tuttavia `pdfplumber` mescola il testo dove il PDF ha più livelli di testo sovrapposti (riferimenti normativi di §2, definizioni di §3, Annex ZA/ZB: es. `ISO 4063:20Q23ua, lification testing of welders` nei riferimenti normativi, `wewldeilndgin og poeprearatotorr` nelle definizioni) e raddoppia le tabelle ZA. Il corpo ISO (pag. 17-32 del PDF, clausole 1-8, Annex A-C, Bibliography) è stato quindi **ricostruito con `pymupdf`** (stesso PDF, estrazione per blocchi: leggibile, senza mescolanze) e **verificato riga per riga** contro il testo `pdfplumber`; le pagine 30 e 31 (certificato Annex C) sono state controllate anche sul rendering a immagine. Non è stato necessario nessun dizionario di correzione font. Correzioni manuali: nessuna sul contenuto normativo; solo normalizzazione di spazi e rimozione di header/footer (`ISO 14732:2025(en)`, `© ISO 2025 – All rights reserved`, `BS EN ISO 14732:2025`, numeri di pagina) e del boilerplate non normativo (copyright BSI, disclaimer legale, elenco paesi CEN, procedure ISO/WTO/brevetti). Refusi **presenti nel testo ufficiale** sono conservati e segnalati con `[sic]` (§5.1 a)2 `sold wire`; spazi mancanti `process141`, `or147`).
> **Tabelle**: non ci sono tabelle normative con dati numerici nel corpo ISO. Le uniche tabelle sono l'Annex C (modulo di certificato **vuoto**, ricostruito come elenco di campi, verificato sul rendering) e le tabelle ZA.1/ZB.1/ZA.2 dell'Annex ZA/ZB (riportate sotto). Nessuna figura. **Nessun GAP di leggibilità** sul testo normativo.
> **Estratto operativo collegato**: `docs/reference/ISO-14732-operatori-saldatura.md` (riscritto sull'edizione 2025 a partire da questo testo).

<!-- Pagina 1-4 (BS): copertina BSI, National foreword, ISBN/ICS/data di pubblicazione, emendamenti -->

## BS EN ISO 14732:2025 — National foreword (BSI)

*(Estratto delle parti specifiche; disclaimer legale BSI e testo generale omessi.)*

- This British Standard is the UK implementation of EN ISO 14732:2025. It is identical to ISO 14732:2025. It supersedes BS EN ISO 14732:2013, which is withdrawn.
- The UK participation in its preparation was entrusted to Technical Committee WEE/36, Qualification of welding personnel and welding procedures.
- This British Standard was published under the authority of the Standards Policy and Strategy Committee on 31 July 2025.
- Amendments/corrigenda issued since publication: 31 October 2025 — Implementation of CEN correction notice 3 September 2025: Annex ZB «Mandate title» corrected.

## EN ISO 14732:2025 — European foreword

- This document (EN ISO 14732:2025) has been prepared by Technical Committee ISO/TC 44 «Welding and allied processes» in collaboration with Technical Committee CEN/TC 121 «Welding and allied processes», the secretariat of which is held by AFNOR.
- This European Standard shall be given the status of a national standard, either by publication of an identical text or by endorsement, at the latest by January 2026, and conflicting national standards shall be withdrawn at the latest by January 2026.
- This document supersedes EN ISO 14732:2013.
- This document has been prepared under a standardization request addressed to CEN by the European Commission. For the relationship with EU Legislation, see informative Annex ZA and ZB, which is an integral part of this document.
- Endorsement notice: The text of ISO 14732:2025 has been approved by CEN as EN ISO 14732:2025 without any modification.

## Annex ZA (informative) — Relationship with Directive 2014/68/EU (PED)

Preparata nell'ambito della richiesta di standardizzazione M/601 «Mandate to CEN for standardization in the field of Pressure equipment». Una volta citata nella Gazzetta Ufficiale UE, la conformità alle clausole normative della Table ZA.1 e l'applicazione delle edizioni di Table ZA.2 conferiscono presunzione di conformità ai corrispondenti requisiti essenziali della Direttiva.

**Table ZA.1 — Correspondence between this European Standard and Directive 2014/68/EU (PED)**

| Essential Requirements of Directive 2014/68/EU (PED) | Clause(s)/sub-clause(s) of this EN | Remarks/Notes |
| --- | --- | --- |
| 3.1.2, paragraphs 3, 4 and 5 | 4, 5, 6.1, 6.3 a), 6.3 b), 7 | Permanent joining – personnel qualification. For pressure equipment in categories II, III and IV the examiner/examining body is a competent third party. |
| 3.1.2, paragraphs 3, 4 and 5 | 6.3 c) | Revalidation route 6.3.c) is not permitted for the categories II, III and IV products |

*(La seconda riga è la lettura della cella a due righe della tabella nel PDF: «6.3 c)» nella colonna clausole e la nota «Revalidation route 6.3.c) is not permitted…» nella colonna Remarks.)*

**Table ZA.2 — Normative references from Clause 2 and corresponding European publications** (edizione internazionale citata → edizione europea corrispondente)

| Reference in Clause 2 | International Standard Edition | Corresponding European Standard Edition |
| --- | --- | --- |
| ISO 4063:2023 | ISO 4063:2023 | EN ISO 4063:2023 |
| ISO 9606-1 | ISO 9606-1:2012; ISO 9606-1:2012/Cor1:2012; ISO 9606-1:2012/Cor2:2013 | EN ISO 9606-1:2017 |
| ISO 9606-2 | ISO 9606-2:2004 | EN ISO 9606-2:2004 |
| ISO 9606-3 | ISO 9606-3:1999 | EN ISO 9606-3:1999 |
| ISO 9606-4 | ISO 9606-4:1999 | EN ISO 9606-4:1999 |
| ISO 9606-5 | ISO 9606-5:2000 | EN ISO 9606-5:2000 |
| ISO 14555 | ISO 14555:2017 | EN ISO 14555:2017 |
| ISO 15609-1 | ISO 15609-1:2019 | EN ISO 15609-1:2019 |
| ISO 15609-3 | ISO 15609-3:2004 | EN ISO 15609-3:2004 |
| ISO 15609-4 | ISO 15609-4:2009 | EN ISO 15609-4:2009 |
| ISO 15609-5 | ISO 15609-5:2011 | EN ISO 15609-5:2011 |
| ISO 15609-6 | ISO 15609-6:2013 | EN ISO 15609-6:2013 |
| ISO 15613 | ISO 15613:2004 | EN ISO 15613:2004 |
| ISO 15614-1 | ISO 15614-1:2017; ISO 15614-1:2017/Amd 1:2019 | EN ISO 15614-1:2017; EN ISO 15614-1:2017/A1:2019 |
| ISO 15614-2 | ISO 15614-2:2005; ISO 15614-2:2005/Cor 2:2009 | EN ISO 15614-2:2005; EN ISO 15614-2:2005/AC:2009 |
| ISO 15614-5 | ISO 15614-5:2004 | EN ISO 15614-5:2004 |
| ISO 15614-6 | ISO 15614-6:2006 | EN ISO 15614-6:2006 |
| ISO 15614-7 | ISO 15614-7:2016 | EN ISO 15614-7:2019 |
| ISO 15614-8 | ISO 15614-8:2016 | EN ISO 15614-8:2016 |
| ISO 15614-11 | ISO 15614-11:2002 | EN ISO 15614-11:2002 |
| ISO 15614-12 | ISO 15614-12:2021 | EN ISO 15614-12:2021 |
| ISO 15614-13 | ISO 15614-13:2021 | EN ISO 15614-13:2021 |
| ISO 15614-14 | ISO 15614-14:2013 | EN ISO 15614-14:2013 |
| ISO/TR 25901-1 | ISO/TR 25901-1:2016 | None (for applicable standard edition see Column 2) |
| ISO 25901-2 | ISO 25901-2:2022 | EN ISO 25901-2:2023 |
| ISO/TR 25901-3 | ISO/TR 25901-3:2016 | None (for applicable standard edition see Column 2) |
| ISO/TR 25901-4 | ISO/TR 25901-4:2016 | None (for applicable standard edition see Column 2) |

La Table ZA.2 non elenca ISO 3834-2/-3 né ISO 15609-2 (presenti nella Clause 2). Il PDF riporta anche i WARNING 1 e 2 (la presunzione di conformità vale finché il riferimento è mantenuto nell'elenco della Gazzetta Ufficiale UE; altra legislazione UE può applicarsi).

## Annex ZB (informative) — Relationship with Directive 2014/29/EU (SPVD)

Preparata nell'ambito della richiesta M/602 «Mandate to CEN for standardization in the field of Simple pressure vessels». **Table ZB.1**:

| Essential Requirements of Directive 2014/29/EU (SPVD) | Clause(s)/sub-clause(s) of this EN | Remarks/Notes |
| --- | --- | --- |
| 3.2, paragraph 2 | 4, 5, 6.1, 6.3 a), 6.3 b), 7 | For welds on pressurized parts of simple pressure vessels, the examiner/examining body is a notified body. |

## Contents (ISO 14732:2025)

Struttura dell'edizione 2025 (numeri di pagina della norma ISO tra parentesi):

- Foreword (iv) · Introduction (v)
- 1 Scope (1) · 2 Normative references (1) · 3 Terms and definitions (2)
- 4 Qualification (4): 4.1 General (4) · 4.2 Fusion welding (5) · 4.3 Resistance welding (6) · 4.4 Arc stud welding (6)
- 5 Variables and range of qualification (6): 5.1 Mechanized welding (6) · 5.2 Automatic welding (7)
- 6 Period of validity (7): 6.1 Initial qualification (7) · 6.2 Confirmation of validity (7) · 6.3 Revalidation of qualification (7) · 6.4 Revocation of qualification (8)
- 7 Welding operator or weld setter qualification test certificate (8)
- 8 Documentation (8)
- Annex A (normative) Functional knowledge of the welding unit (9)
- Annex B (informative) Knowledge of welding technology (10)
- Annex C (informative) Example of a qualification test certificate for welding operators and/or weld setters (14)
- Bibliography (16)

## Foreword (ISO)

*(Testo generale ISO su procedure, brevetti e WTO omesso.)*

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

## Introduction (ISO)

This document is intended to provide the basis for the mutual recognition by examining bodies of qualification related to the competence of welding operators and weld setters in the various fields of application. The welding operator's or weld setter's ability and job knowledge continue to be approved only if the welding operators or weld setters are working with reasonable continuity on welding work within the extent of qualification. However, a functional knowledge test is mandatory. It is presumed that the welding operator or weld setter has received training or has industrial practice within the range of qualification.

All new qualifications should be in accordance with this document from the date of issue. At the end of its period of validity, the existing and valid qualification testing of welding operators and weld setters in accordance with the requirements of a national standard can be revalidated in accordance with this document. The new range of qualification will be interpreted in accordance with the requirements of this document.

<!-- Pagina 17-32 (motore: pymupdf — ricostruzione del corpo ISO; pdfplumber mescola i livelli di testo) -->

# 1 Scope

This document specifies requirements for qualification of welding operators and weld setters for mechanized and automatic welding of metallic materials.

This document does not apply to personnel who:

- do not control or adjust welding parameters;
- are not involved in the setup of welding equipment.

Qualification of welding operators and weld setters for friction stir welding and friction stir spot welding are covered by ISO 25239-3 and ISO 18785-3, respectively.

# 2 Normative references

The following documents are referred to in the text in such a way that some or all of their content constitutes requirements of this document. For dated references, only the edition cited applies. For undated references, the latest edition of the referenced document (including any amendments) applies.

- ISO 3834-2, Quality requirements for fusion welding of metallic materials — Part 2: Comprehensive quality requirements
- ISO 3834-3, Quality requirements for fusion welding of metallic materials — Part 3: Standard quality requirements
- ISO 4063:2023, Welding, brazing, soldering and cutting — Nomenclature of processes and reference numbers
- ISO 9606-1, Qualification testing of welders — Fusion welding — Part 1: Steels
- ISO 9606-2, Qualification test of welders — Fusion welding — Part 2: Aluminium and aluminium alloys
- ISO 9606-3, Approval testing of welders — Fusion welding — Part 3: Copper and copper alloys
- ISO 9606-4, Approval testing of welders — Fusion welding — Part 4: Nickel and nickel alloys
- ISO 9606-5, Approval testing of welders — Fusion welding — Part 5: Titanium and titanium alloys, zirconium and zirconium alloys
- ISO 14555, Welding — Arc stud welding of metallic materials
- ISO 15609-1, Specification and qualification of welding procedures for metallic materials — Welding procedure specification — Part 1: Arc welding
- ISO 15609-2, … — Welding procedure specification — Part 2: Gas welding
- ISO 15609-3, … — Welding procedure specification — Part 3: Electron beam welding
- ISO 15609-4, … — Welding procedure specification — Part 4: Laser beam welding
- ISO 15609-5, … — Welding procedure specification — Part 5: Resistance welding
- ISO 15609-6, … — Welding procedure specification — Part 6: Laser-arc hybrid welding
- ISO 15613, Specification and qualification of welding procedures for metallic materials — Qualification based on pre-production welding test
- ISO 15614-1, … — Welding procedure test — Part 1: Arc and gas welding of steels and arc welding of nickel and nickel alloys
- ISO 15614-2, … — Welding procedure test — Part 2: Arc welding of aluminium and its alloys
- ISO 15614-5, … — Welding procedure test — Part 5: Arc welding of titanium, zirconium and their alloys
- ISO 15614-6, … — Welding procedure test — Part 6: Arc and gas welding of copper and its alloys
- ISO 15614-7, … — Welding procedure test — Part 7: Overlay welding
- ISO 15614-8, … — Welding procedure test — Part 8: Welding of tubes to tube-plate joints
- ISO 15614-11, … — Welding procedure test — Part 11: Electron and laser beam welding
- ISO 15614-12, … — Welding procedure test — Part 12: Spot, seam and projection welding
- ISO 15614-13, … — Welding procedure test — Part 13: Upset (resistance butt) and flash welding
- ISO 15614-14, … — Welding procedure test — Part 14: Laser-arc hybrid welding of steels, nickel and nickel alloys
- ISO 25901 (all parts), Welding and allied processes — Vocabulary

*(Il segno «…» abbrevia il titolo comune «Specification and qualification of welding procedures for metallic materials» presente per esteso nel PDF.)*

# 3 Terms and definitions

For the purposes of this document, the terms and definitions given in the ISO 25901 series and the following apply. ISO and IEC maintain terminology databases for use in standardization at: ISO Online browsing platform (`https://www.iso.org/obp`) e IEC Electropedia (`https://www.electropedia.org/`).

## 3.1 mechanized welding

welding where the required welding parameters are maintained by mechanical or electronic means

Note 1 to entry: Manual adjustment of welding parameters by the welding operator (3.3) during welding is possible.

[SOURCE: ISO/TR 25901-1:2016, 2.1.1.10, modified — the alternative preferred term, fully mechanized welding, has not been included.]

## 3.2 automatic welding

welding in which all operations are performed without welding operator intervention during the process

Note 1 to entry: Manual adjustment of welding variables by the welding operator (3.3) during welding is not possible.

[SOURCE: ISO/TR 25901-1:2016, 2.1.1.11]

## 3.3 welding operator

person who controls or adjusts any welding parameter for mechanized welding (3.1) or automatic welding (3.2)

[SOURCE: ISO/TR 25901-1:2016, 2.5.25]

## 3.4 weld setter

person who sets up (3.6) the welding unit (3.7) for mechanized welding (3.1) or automatic welding (3.2)

[SOURCE: ISO/TR 25901-1:2016, 2.5.26 modified — changed welding equipment to welding unit.]

## 3.5 programming

incorporation of the approved welding procedure specification and/or the specified movements of the welding unit (3.7) into a programme

## 3.6 setup

correct adjustment of the welding unit (3.7) before welding, and if required by entering the robot programme

## 3.7 welding unit

welding installation, including auxiliary apparatus

Note 1 to entry: Welding installations include welding equipment (3.8), sensors, tracking systems, interfaces and control systems. Auxiliary apparatus can include jigs and fixtures, robot(s), manipulators and rotating devices.

[SOURCE: ISO/TR 25901-1:2016, 2.3.2, modified — Example changed to note to entry and revised.]

## 3.8 welding equipment

individual apparatus used in welding

EXAMPLE Power source, wire feeder.

[SOURCE: ISO/TR 25901-1:2016, 2.3.1]

## 3.9 pre-production welding test

welding test having the same function as a welding procedure test, but based on a non-standard test piece, representative of the production conditions

[SOURCE: ISO/TR 25901-1:2016, 2.5.8]

## 3.10 production test

welding test carried out in the production environment with the welding unit, on actual products or on simplified test pieces, before or during an interruption in normal production

[SOURCE: ISO/TR 25901-1:2016, 2.5.11]

## 3.11 examiner

person who has been appointed to verify compliance with the applicable standard

Note 1 to entry: In certain cases, an external independent examiner can be required.

[SOURCE: ISO/TR 25901-1:2016, 2.5.29]

## 3.12 examining body

organization that has been appointed to verify compliance with the applicable standard

Note 1 to entry: In certain cases, an external independent examining body can be required.

[SOURCE: ISO/TR 25901-1:2016, 2.5.30]

# 4 Qualification

## 4.1 General

Qualification and revalidation shall be in accordance with this document.

Welding operators and weld setters shall follow a work instruction based on or following directly a preliminary welding procedure specification (pWPS) or a welding procedure specification (WPS) in accordance with the documents listed below:

- ISO 15609-1 for arc welding;
- ISO 15609-2 for gas welding;
- ISO 15609-3 for electron beam welding;
- ISO 15609-4 for laser beam welding;
- ISO 15609-5 for resistance welding;
- ISO 15609-6 for laser-arc hybrid welding;
- ISO 14555 for arc stud welding.

The requirements for the qualification of welding operators and weld setters shall be in accordance with:

- 4.2 for fusion welding, including arc welding and beam welding;
- 4.3 for resistance welding;
- 4.4 for arc stud welding.

For other welding processes, the requirements for qualification of the weld setter and welding operator shall be specified.

To demonstrate the competence of the welding operator or weld setter, the qualification method used shall be supplemented by a test of the functional knowledge of the welding unit. The requirements given in Annex A shall be met and documented.

NOTE A qualification method can be supplemented by a test of knowledge related to welding technology. Annex B includes recommendations for such a test.

The variables and range of qualification for welding operators and weld setters are specified in Clause 5. The period of validity is addressed in Clause 6.

If a mechanised/automatic welding procedure is qualified in accordance with one of the following standards, the welding operator or weld setter who performed the test is also qualified in accordance with this document and a qualification test certificate shall be issued:

- ISO 15613 for qualification based on pre-production welding test;
- ISO 15614-1 for arc and gas welding of steels and arc welding of nickel and nickel alloys;
- ISO 15614-2 for arc welding of aluminium and its alloys;
- ISO 15614-5 for arc welding of titanium, zirconium and their alloys;
- ISO 15614-6 for arc and gas welding of copper and its alloys;
- ISO 15614-7 for overlay welding;
- ISO 15614-8 for welding of tubes to tube-plate joints;
- ISO 15614-11 for electron and laser beam welding;
- ISO 15614-12 for spot, seam and projection welding;
- ISO 15614-13 for upset (resistance butt) and flash welding;
- ISO 15614-14 for laser-arc hybrid welding of steels, nickel and nickel alloys.

An example of a test certificate is given in Annex C.

## 4.2 Fusion welding

For welding operators or weld setters, qualification testing and acceptance criteria shall be based on test pieces in accordance with one of the following methods.

a) Method 1: For butt or fillet welds, in accordance with the following documents:

- ISO 9606-1 for steels;
- ISO 9606-2 for aluminium and aluminium alloys;
- ISO 9606-3 for copper and copper alloys;
- ISO 9606-4 for nickel and nickel alloys;
- ISO 9606-5 for titanium and titanium alloys, zirconium and zirconium alloys.

b) Method 2: For tube to tube-plate welds, in accordance with ISO 15614-8. Only the following tests are required:

- visual testing;
- surface (magnetic particle/liquid penetrant) testing;
- macroscopic testing.

c) Method 3: For overlay welding, in accordance with ISO 15614-7. Only the following tests are required:

- visual testing;
- surface (magnetic particle/liquid penetrant) testing;
- bend testing or macroscopic testing.

d) Method 4: For qualification testing based on pre-production or production test pieces, testing and acceptance criteria shall be in accordance with Methods 1, 2 or 3 as applicable.

## 4.3 Resistance welding

Qualification shall be based on test pieces in accordance with the following documents:

- ISO 15614-12 for spot, seam and projection welding;
- ISO 15614-13 for upset (resistance butt) and flash welding;
- ISO 15613 for qualification based on pre-production resistance welding test.

The required tests and acceptance criteria shall be specified. This shall include at least visual testing and one destructive testing method.

## 4.4 Arc stud welding

The requirements for testing of stud welding operators and weld setters shall be in accordance with ISO 14555.

# 5 Variables and range of qualification

## 5.1 Mechanized welding

A change in any of the following, when applicable to the welding process, requires requalification.

a) A change of the welding process group (two digits), in accordance with ISO 4063:2023. However, changes in the process subgroup (three digits) or process variants within a process group (two digits) do not require requalification. The following exceptions apply:

1. A change from autogenous TIG welding (process 142) to TIG welding with filler material (process 141, 143, 145, 146, or 147) requires requalification. *(Testo ufficiale: «process 141, 143, 145, 146, or147».)*
2. A change from SAW with strip electrode (122 or 126) to any SAW using sold [sic] wire or tubular cored electrodes (121, 123, 124, 125), or vice versa requires requalification. *(Il §5.2 a)2 riporta «solid wire».)*

b) A change from direct visual control to remote visual control and vice versa.

c) Deletion of automatic joint tracking.

d) Deletion of automatic arc length control.

e) A change in the welding unit (see 3.7), only when this affects how the setup (see 3.6) is performed and/or how parameter settings are entered.

f) A change from single-run-per-side technique to multi-run-per-side technique (but not vice versa).

g) For orbital welding equipment, a change from welding in a single position to welding in multiple positions (but not vice versa).

h) Deletion of backing.

i) Deletion of consumable inserts.

## 5.2 Automatic welding

A change in any of the following requires requalification:

a) A change of the welding process group (two digits), in accordance with ISO 4063:2023. However, changes in the process subgroup (three digits) or process variants within a process group (two digits) do not require requalification. The following exceptions apply:

1. A change from autogenous TIG welding (process 142) to TIG welding with filler material (process 141, 143, 145, 146 or 147) requires requalification. *(Testo ufficiale: «process141, 143, 145, 146 or147».)*
2. A change from SAW with strip electrode (122 or 126) to any SAW using solid wire or tubular cored electrodes (121, 123, 124, 125), or vice versa, requires requalification.

b) For weld setters only, using fusion welding, a change from single-run-per-side to multi-run-per-side (but not vice versa).

c) A change in the welding unit (see 3.7) only when this affects how the setup (see 3.6) is performed and/or how parameter settings are entered.

# 6 Period of validity

## 6.1 Initial qualification

The welding operator or weld setter qualification begins from the date of welding of the test piece(s), provided that the required testing has been carried out and the test results obtained were acceptable.

The validity of a welding operator or weld setter qualification test certificate may be extended as specified in 6.3. The method chosen for the extension of qualification, 6.3 a), b) or c), shall be stated on the welding operator or weld setter qualification test certificate at the time of issue.

## 6.2 Confirmation of validity

The person responsible for welding activities or the examiner or the examining body shall confirm that the welding operator or weld setter has successfully worked within their range of qualification during each six-month period from the date they were qualified, otherwise the qualification becomes invalid.

This subclause is applicable to all the options for revalidation given in 6.3.

## 6.3 Revalidation of qualification

The welding operator or weld setter qualification shall be periodically revalidated using one of the following methods.

a) The welding operator or weld setter shall perform a new qualification test every six years.

b) Every three years, two production welds made during the last 6 months of the validity period shall be tested by radiographic testing (RT) or ultrasonic testing (UT) or destructive testing.

If RT or UT or destructive testing is not technically possible, revalidation using other volumetric NDT methods or production testing (e.g. leak testing) shall be performed in accordance with the application standard.

The results shall be verified by an examiner or examining body as meeting the requirements of this document. The acceptance criteria shall be in accordance with Clause 4.

The weld tested shall be within the range of qualification. These tests revalidate the welding operator or weld setter qualification test certificate for an additional three years.

c) A welding operator or weld setter qualification test certificate shall be valid as long as it is confirmed in accordance with 6.2 and provided all the following conditions are fulfilled:

- the welding operator or weld setter is working for the same manufacturer for whom they qualified and who is responsible for the manufacture of the product;
- the manufacturer's ISO 3834-2 or ISO 3834-3 quality requirements shall have been proven by verification;
- the manufacturer has documented that the welding operator or weld setter has produced welds of acceptable quality based on application standards.

## 6.4 Revocation of qualification

When there is a specific reason to question a welding operator's or weld setter's ability to make welds that meet the product standard quality requirements, the qualifications that support the welding they are doing shall be revoked. All other qualifications not questioned shall remain valid.

# 7 Welding operator or weld setter qualification test certificate

If the acceptance criteria in accordance with Clause 4 have been met, the examiner or examining body shall confirm that the welding operator or weld setter has successfully passed the qualification test.

If the welding operator or weld setter fails any of the prescribed tests, no certificate shall be issued.

The identification of the pWPS or WPS followed, the variables used for the qualification test, and the range of qualification shall be recorded on the certificate.

The certificate shall be issued under the sole responsibility of the examiner or examining body. An example of a test certificate is given in Annex C.

Any change of the essential variables for the qualification testing beyond the permitted ranges requires a new test and a new certificate.

# 8 Documentation

Certificates and test reports or records of welding tests and revalidations shall be kept on file.

# Annex A (normative) — Functional knowledge of the welding unit

## A.1 General

This annex outlines the functional knowledge of the welding unit that a welding operator or weld setter, as applicable, shall have to ensure that procedures are followed.

## A.2 Welding sequences and/or procedures in the relevant process

Recognition of welding procedure requirements and the influence of welding parameters.

## A.3 Joint preparation and weld representation in the relevant process

Verification of:

a) conformity of the joint preparation to the WPS;

b) cleanliness of the fusion faces.

## A.4 Weld imperfections

Identification of visual weld imperfections for the process being used.

## A.5 Welding operator's or weld setter's qualification

Knowledge of the range of the qualification.

## A.6 Welding unit and process operation

Knowledge of the following, where applicable:

a) programming;

NOTE Knowledge of programming is limited to handling the qualification test which could be performed with a pre-programmed module that the operator uploads.

b) the control system and the signals given by this system;

c) moving system;

d) auxiliary equipment;

e) jigs and fixtures and setup;

f) parameters and adjustments within the given procedures;

g) safety regulations and precautions;

h) start-stop procedures.

# Annex B (informative) — Knowledge of welding technology

## B.1 General

The test of job knowledge is recommended but is not mandatory. However, some countries require that the welding operator or weld setter undergo a test of job knowledge. If the job knowledge test is carried out, it should be recorded on the welding operator's or weld setter's certificate.

This annex outlines the job knowledge that a welding operator or weld setter should have to ensure that procedures are followed. The job knowledge described in this annex provides basic recommendations. This may be supplemented by additional subject matter where applicable.

Owing to different training programmes in various countries, it is only proposed that general objectives and categories of job knowledge be standardized. The actual questions used should be drawn up by the individual country, but should include questions on areas, covered in B.2, relevant to the welding operator's or weld setter's qualification test.

The actual test of a welding operator's or weld setter's job knowledge can be given by any of the following methods or combinations of these methods:

a) a written objective test (multiple choice);

b) oral questioning following a set of written questions;

c) computer testing;

d) demonstration or observation testing following a written set of criteria.

The test of job knowledge is limited to the matters related to the welding process used in the test.

The process numbers in this annex are in accordance with ISO 4063:2023 (see also 4.2).

## B.2 Job knowledge scope

**B.2.1 Welding equipment**

- B.2.1.1 Arc welding: a) identification of gas cylinders; b) identification and assembly of essential components; c) selection of correct nozzles and welding torches; d) wire feed control method.
- B.2.1.2 Beam welding: a) electron beam welding equipment; b) laser beam welding equipment.
- B.2.1.3 Pressure welding: a) types and equipment; b) identification and assembly of essential components.
- B.2.1.4 Resistance welding: a) identification and assembly of essential components; b) selection of correct electrodes; c) cooling system; d) maintenance of the equipment; e) welding controller functions; f) force system.

**B.2.2 Welding processes**

- B.2.2.1 Shielded metal-arc welding (processes 114, 13, 14 and 15): a) procedures; b) type and size of electrodes; c) identification of shielding gas and flow rate (without process 114); d) type, size and maintenance of nozzles or contact tip; e) selection and limitation of mode of metal transfer; f) protection of the welding arc from draughts.
- B.2.2.2 Submerged arc welding (process 12): a) procedures; b) drying, feeding and correct recovery of flux; c) correct alignment and travel of welding head; d) single-wire or multi-wire process; e) influence of welding current and voltage.
- B.2.2.3 Electron beam welding (process 51): a) procedures; b) parameters and their influence on the welding process; c) focusing system; d) parameter control; e) preparation of parent material; f) vacuum system, including leak test.
- B.2.2.4 Laser beam welding (process 52): a) procedures; b) parameters and their influence on the welding process; c) focusing system; d) parameter control; e) preparation of parent material; f) choice of assist and shielding gases; g) processing in or on different types of laser; h) type of mode for operation.
- B.2.2.5 Pressure welding (process 4): a) procedures; b) surface condition (material group 21, 22 and 23); c) surface preparation (material group 24 and 25); d) important welding parameters; e) measuring and monitoring; f) causes of defects; g) variables influencing weld quality; h) test methods, failure modes; i) weld diameter or width, quality criteria.
- B.2.2.6 Resistance welding (process 2): a) procedures; b) surface preparation; c) parameters; d) material and shape of electrodes, contact area and fixing of electrodes; e) method of welding; f) control and surveillance system; g) causes of defects; h) test methods.
- B.2.2.7 Electroslag welding (process 72): a) procedures; b) drying and feeding of flux; c) correct alignment and travel of welding head; d) single-wire/strip or multi-wire/strip process; e) use of consumable guide tubes; f) positioning and alignment of cooled shoes; g) influence of welding current and voltage.

**B.2.3 Parent metals**: a) identification of material; b) methods and control of pre-heating; c) control of interpass temperature.

**B.2.4 Consumables**: a) identification of consumables; b) storage, handling and conditioning of consumables; c) selection of correct size; d) cleanliness of wire electrodes and flux-cored electrodes; e) control of wire spooling; f) control and monitoring of gas flow rates and quality; g) principles of welding without consumables.

**B.2.5 Safety and accident prevention**

- B.2.5.1 General: a) electrical risk; b) mechanical risk; c) risk of welding fumes and gases; d) noise risk; e) risk in radiographic application (if relevant).
- B.2.5.2 All arc processes: a) environment of increased hazard of electric shock; b) radiation from the arc; c) effects of stray arcing; d) effects of poor earthing.

**B.2.6 Visual testing of welds**: knowledge of visual testing for the welding process used and ability to identify the typical surface imperfections.

# Annex C (informative) — Example of a qualification test certificate for welding operators and/or weld setters

*(Modulo di certificato **vuoto**: nessun dato; ricostruito come elenco di campi e verificato sul rendering delle pagine 14-15 della norma. Il layout a tabella non è riprodotto.)*

**Intestazione**

- Manufacturer's pWPS or WPS reference No.
- Examiner or examining body — Reference No.
- Photograph (if required)
- Name
- Role: welding operator ☐ and/or weld setter ☐
- Identification
- Method of identification
- Employer
- Code/testing standard
- Functional knowledge test reference
- Welding technology knowledge: acceptable/not tested (delete as necessary)

**Tabella «Variables» — colonne: Variables · Test piece · Range of qualification**

- Common to mechanized/automatic welding: Welding process(es) – (Clause 4); Welding equipment – (3.8); Welding unit – (3.7).
- Mechanized welding – (5.1): Visual control/remote visual control; Automatic joint tracking; Automatic arc length control; Single run/multi run technique; Orbital welding position (single/multiple); Material backing; Consumable insert.
- Automatic welding – (5.2): Single run/multi run technique.

**Base della qualifica e validità** (pagina 15)

- The qualification is based on Clause 4: 4.2 Fusion welding (Method 1 ☐ · Method 2 ☐ · Method 3 ☐ · Method 4 ☐); 4.3 Resistance welding ☐; 4.4 Arc stud welding ☐.
- Results of the qualification test see document No. … (Welding procedure qualification record or other documents of testing).
- Name, date and signature; Examiner or examining body; Date of welding of test piece; Location; Validity of qualification until.
- Riga di rivalidazione: Requalification 6.3 a) — Valid until · Revalidation 6.3 b) — Valid until · Revalidation 6.3 c) — Valid until.
- Revalidation by examiner or examining body for the following 3 years (See 6.3 b): Date · Signature · Position or title.
- Confirmation of the validity by the employer/welding coordinator/examiner or examining body for the following 6 months (See 6.2): Date · Signature · Position or title (5 righe).

# Bibliography

1. ISO 6947, Welding and allied processes — Welding positions
2. ISO 10447, Resistance welding — Testing of welds — Peel and chisel testing of resistance spot and projection welds
3. ISO 18785-3, Friction stir spot welding — Aluminium — Part 3: Qualification of welding personnel
4. ISO 25239-3, Friction stir welding — Aluminium — Part 3: Qualification of welding operators
