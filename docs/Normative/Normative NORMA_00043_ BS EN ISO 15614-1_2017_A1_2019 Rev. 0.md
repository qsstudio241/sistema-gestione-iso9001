> **Ruolo SGQ**: norma di **supporto** a ISO 3834 e all'ingest WPQR (procedura di saldatura). Definisce livelli di qualifica (Level 1/Level 2) e range di qualificazione (spessore, diametro tubo, gruppo materiale, processo, numero di passate, posizione) per WPS/WPQR. Non è una norma di sistema a clausole 4–10: **non** va in `import-norms-from-markdown.js` / seed `norm_requirements`. Uso primario: campi copertura WPQR — estratto operativo in `docs/reference/ISO-15614-1-range-validita-WPQR.md`.
> **Edizione**: BS EN ISO 15614-1:2017+A1:2019 (identica a ISO 15614-1:2017 con amendment 1:2019). **Sostituisce** come testo operativo di piattaforma l'ed. 2017 senza A1 digitalizzata in `NORMA_00019` (archivio).
> **standard_code JSON**: `ISO_15614_1_2017` (allineato a `NORMA_00019` / regole JS esistenti).
> **Qualità estrazione (06/09/2026)**: 54 pagine, 54 con testo utile (pdfplumber), nessuna pagina `ATTENZIONE` / `Nota tecnica` ordinamento. Correzioni manuali: National foreword (paragrafo mescolato), riga ICS, §8.5.2.3 Transfer mode (tag A1 + «Text deleted» verificato pymupdf). Residuo GAP (come `NORMA_00019`): Tabella 7 colonna Level 1 spesso perde lo «0,» iniziale (`5 to 2 t` vs `0,5 to 2 t`); matrici Tabella 5/6 usabili ma dense — non inventare celle. **Delta A1 rilevante**: eliminate le sotto-clausole 8.5.2.3.1–8.5.2.3.4 (waveform/pulsed) presenti in `NORMA_00019`.

<!-- Pagina 1 (motore: pdfplumber) -->

Incorporating corrigenda July 2017 and May 2018 BSI Standards Publication Specification and qualification of welding procedures for metallic materials — Welding procedure test Part 1: Arc and gas welding of steels and arc welding of nickel and nickel alloys

|  |  |  |  |  |
| --- | --- | --- | --- | --- |
|  |  |  |  |  |
| BSI Standards Publication |  |  |  |  |

<!-- Pagina 2 (motore: pdfplumber) -->

## BS EN ISO 15614‑1:2017+A1:2019 BRITISH STANDARD

## National foreword

This British Standard is the UK implementation of EN ISO 15614-1:2017+A1:2019. It is identical to ISO 15614-1:2017, incorporating amendment 1:2019. It supersedes BS EN ISO 15614-1:2017, which is withdrawn. BSI, as a member of CEN, is obliged to publish EN ISO 15614-1:2017+A1:2019 as a British Standard. However, attention is drawn to the fact that during the development of this standard, the UK committee voted against its approval. The UK committee is concerned that the format of this standard may cause a problem when working to either of the two welding procedure test levels. Level 1 is based on the requirements of ASME BPVC Section IX, Welding, Brazing, and Fusing Qualifications, and Level 2, for which the extent of testing is greater, is based on the previous version of this standard; BS EN ISO 15614-1:2004+A2:2012. It is important to note that a procedure test carried out to Level 2 automatically qualifies for Level 1 requirements, but not vice-versa. Furthermore, when no level is specified in a contract or application standard, all the requirements of Level 2 should be applied. Users should be aware that, as the requirements of the two levels are often specified in the same clause, vigilance is required to identify the testing requirements and the range of qualification for the particular welding procedure test level. The start and finish of text introduced or altered by amendment is indicated in the text by tags. Tags indicating changes to ISO text carry the number of the ISO amendment. For example, text altered by ISO amendment 1 is indicated by A1 tags. The UK participation in its preparation was entrusted to Technical Committee WEE/36, Qualification of welding personnel and welding procedures. A list of organizations represented on this committee can be obtained on request to its secretary. This publication does not purport to include all the necessary provisions of a contract. Users are responsible for its correct application. © The British Standards Institution 2019 Published by BSI Standards Limited 2019

## ISBN 978 0 539 00265 2

ICS 25.160.10

Compliance with a British Standard cannot confer immunity from legal obligations. This British Standard was published under the authority of the Standards Policy and Strategy Committee on 31 July 2017. Amendments/corrigenda issued since publication Date Text affected

# 31 July 2017 Missing Annexes ZA and ZB added

<!-- Pagina 3 (motore: pdfplumber) -->

## BRITISH STANDARD BS EN ISO 15614‑1:2017+A1:2019

Date Text affected

# 31 May 2018 Implementation of ISO corrected text 01 October

2017: Table 5 and Figure 6 corrected

# 31 August 2019 Implementation of ISO amendment 1:2019 with

CENELEC endorsement A1:2019

<!-- Pagina 4 (motore: pdfplumber) -->

## EN ISO 15614-1:2017+A1

## EUROPEAN STANDARD

## NORME EUROPÉENNE

## August 2019

## EUROPÄISCHE NORM

## ICS 25.160.10

## English Version

## Specification and qualification of welding procedures for

## metallic materials - Welding procedure test - Part 1: Arc

## and gas welding of steels and arc welding of nickel and

## nickel alloys (ISO 15614-1:2017)

Descriptif et qualification d'un mode opératoire de Anforderung und Qualifizierung von Schweißverfahren soudage pour les matériaux métalliques - Épreuve de für metallische Werkstoffe - qualification d'un mode opératoire de soudage - Partie Schweißverfahrensprüfung - Teil 1: Lichtbogen- und 1: Soudage à l'arc et aux gaz des aciers et soudage à Gasschweißen von Stählen und Lichtbogenschweißen l'arc du nickel et des alliages de nickel (ISO 15614- von Nickel und Nickellegierungen (ISO 15614-1:2017) 1:2017) This European Standard was approved by CEN on 17 April 2017. CEN members are bound to comply with the CEN/CENELEC Internal Regulations which stipulate the conditions for giving this European Standard the status of a national standard without any alteration. Up-to-date lists and bibliographical references concerning such national standards may be obtained on application to the CEN-CENELEC Management Centre or to any CEN member. This European Standard exists in three official versions (English, French, German). A version in any other language made by translation under the responsibility of a CEN member into its own language and notified to the CEN-CENELEC Management Centre has the same status as the official versions. CEN members are the national standards bodies of Austria, Belgium, Bulgaria, Croatia, Cyprus, Czech Republic, Denmark, Estonia, Finland, Former Yugoslav Republic of Macedonia, France, Germany, Greece, Hungary, Iceland, Ireland, Italy, Latvia, Lithuania, Luxembourg, Malta, Netherlands, Norway, Poland, Portugal, Romania, Serbia, Slovakia, Slovenia, Spain, Sweden, Switzerland, Turkey and United Kingdom.

## EUROPEAN COMMITTEE FOR STANDARDIZATION

## COMITÉ EUROPÉEN DE NORMALISATION

## EUROPÄISCHES KOMITEE FÜR NORMUNG

CEN-CENELECManagement Centre: Avenue Marnix 17, B-1000 Brussels © 2017 CEN All rights of exploitation in any form and by any means reserved Ref. No. EN ISO 15614-1:2017 E worldwide for CEN national Members.

<!-- Pagina 5 (motore: pdfplumber) -->

## EUROPEAN STANDARD

## EN ISO 15614-1:2017+A1

## NORME EUROPÉENNE

## EUROPÄISCHE NORM

## 201

## August 9

## ICS 25.160.10

## English Version

## Specification and qualification of welding procedures for

## metallic materials - Welding procedure test - Part 1: Arc

## and gas welding of steels and arc welding of nickel and

## nickel alloys (ISO 15614-1:2017)

Descriptif et qualification d'un mode opératoire de Anforderung und Qualifizierung von Schweißverfahren soudage pour les matériaux métalliques - Épreuve de für metallische Werkstoffe - qualification d'un mode opératoire de soudage - Partie Schweißverfahrensprüfung - Teil 1: Lichtbogen- und 1: Soudage à l'arc et aux gaz des aciers et soudage à Gasschweißen von Stählen und Lichtbogenschweißen l'arc du nickel et des alliages de nickel (ISO 15614- von Nickel und Nickellegierungen (ISO 15614-1:2017) 1:2017) This European Standard was approved by CEN on 17 April 2017. CEN members are bound to comply with the CEN/CENELEC Internal Regulations which stipulate the conditions for giving this European Standard the status of a national standard without any alteration. Up-to-date lists and bibliographical references concerning such national standards may be obtained on application to the CEN-CENELEC Management Centre or to any CEN member. This European Standard exists in three official versions (English, French, German). A version in any other language made by translation under the responsibility of a CEN member into its own language and notified to the CEN-CENELEC Management Centre has the same status as the official versions. CEN members are the national standards bodies of Austria, Belgium, Bulgaria, Croatia, Cyprus, Czech Republic, Denmark, Estonia, Finland, Former Yugoslav Republic of Macedonia, France, Germany, Greece, Hungary, Iceland, Ireland, Italy, Latvia, Lithuania, Luxembourg, Malta, Netherlands, Norway, Poland, Portugal, Romania, Serbia, Slovakia, Slovenia, Spain, Sweden, Switzerland, Turkey and United Kingdom.

## EUROPEAN COMMITTEE FOR STANDARDIZATION

## COMITÉ EUROPÉEN DE NORMALISATION

## EUROPÄISCHES KOMITEE FÜR NORMUNG

CEN-CENELEC Management Centre: Avenue Marnix 17, B-1000 Brussels © 2017 CEN All rights of exploitation in any form and by any means reserved Ref. No. EN ISO 15614-1:2017 E worldwide for CEN national Members.

<!-- Pagina 6 (motore: pdfplumber) -->

## EN ISO 15614-1:2017+A1:2019 (E)

## European foreword

This document (EN ISO 15614-1:2017) has been prepared by Technical Committee ISO/TC 44 "Welding and allied processes" in collaboration with Technical Committee CEN/TC 121 “Welding and allied processes” the secretariat of which is held by DIN. This European Standard shall be given the status of a national standard, either by publication of an identical text or by endorsement, at the latest by December 2017 and conflicting national standards shall be withdrawn at the latest by December 2017. Attention is drawn to the possibility that some of the elements of this document may be the subject of patent rights. CEN shall not be held responsible for identifying any or all such patent rights. This document supersedes EN ISO 15614-1:2004. This document has been prepared under a mandate given to CEN by the European Commission and the European Free Trade Association, and supports essential requirements of EU Directive(s). For relationship with EU Directive(s), see informative Annex ZA, B, which is an integral part of this document. According to the CEN-CENELEC Internal Regulations, the national standards organizations of the following countries are bound to implement this European Standard: Austria, Belgium, Bulgaria, Croatia, Cyprus, Czech Republic, Denmark, Estonia, Finland, Former Yugoslav Republic of Macedonia, France, Germany, Greece, Hungary, Iceland, Ireland, Italy, Latvia, Lithuania, Luxembourg, Malta, Netherlands, Norway, Poland, Portugal, Romania, Serbia, Slovakia, Slovenia, Spain, Sweden, Switzerland, Turkey and the United Kingdom. Endorsement notice The text of ISO 15614-1:2017 has been approved by CEN as EN ISO 15614-1:2017 without any modification. ii

<!-- Pagina 7 (motore: pdfplumber) -->

## EN ISO 15614-1:2017+A1:2019 (E)

## Foreword to amendment A1

This document (EN ISO 15614-1:2017/A1:2019) has been prepared by Technical Committee ISO/TC 44 "Welding and allied processes" in collaboration with Technical Committee CEN/TC 121 “Welding and allied processes” the secretariat of which is held by DIN. This Amendment to the European Standard ISO 15614-1:2017 shall be given the status of a national standard, either by publication of an identical text or by endorsement, at the latest by February 2020, and conflicting national standards shall be withdrawn at the latest by February 2020. Attention is drawn to the possibility that some of the elements of this document may be the subject of patent rights. CEN shall not be held responsible for identifying any or all such patent rights. This document has been prepared under a mandate given to CEN by the European Commission and the European Free Trade Association, and supports essential requirements of EU Directive(s). For relationship with EU Directive(s), see informative Annex ZA and ZB, which is an integral part of this document. According to the CEN-CENELEC Internal Regulations, the national standards organizations of the following countries are bound to implement this European Standard: Austria, Belgium, Bulgaria, Croatia, Cyprus, Czech Republic, Denmark, Estonia, Finland, France, Germany, Greece, Hungary, Iceland, Ireland, Italy, Latvia, Lithuania, Luxembourg, Malta, Netherlands, Norway, Poland, Portugal, Republic of North Macedonia, Romania, Serbia, Slovakia, Slovenia, Spain, Sweden, Switzerland, Turkey and the United Kingdom.

## Endorsement notice

The text of ISO 15614-1:2017/Amd 1:2019 has been approved by CEN as EN ISO 15614- 1:2017/A1:2019 without any modification. iii

<!-- Pagina 8 (motore: pdfplumber) -->

## EN ISO 15614-1:2017+A1:2019 (E)

## Annex ZA

Relationship between this( iEnuforrompaetainve S)tandard and the Essential

## Requirements of EU Directive 2014/68/EU (PED)

This European Standard has been prepared under a Commission's standardization request M/071 “Mandate to CEN for standardization in the field of pressure equipment” to provide one voluntary means of conforming to essential requirements of Directive 2014/68/EU (PED) on the harmonisation of the laws of the Member States relating to the making available on the market of pressure equipment. Once this standard is cited in the Official Journal of the European Union under that Directive, compliance with the normative clauses of this standard given in Table ZA.1 confers, within the limits of the scope of this standard, a presumption of conformity with the corresponding essential requirements Table ZA.1 — Correspondence between this European Standard and Directive 2014/68/EU of that Directive, and associated EFTA regulations.

## (PED)

Essential Requirements of Clauses of this European Remarks/Notes Directive 2014/68/EU (PED) Standard Annex I, 3.1.2 All clauses limited to level 2 Permanent joining WARNING 1 — Presumption of conformity stays valid only as long as a reference to this International Standard is maintained in the list published in the Official Journal of the European Union. Users of this standard should consult frequently the latest list published in the Official Journal of the European Union. WARNING 2 — Other Union legislation may be applicable to the product(s) and services falling within the scope of this standard. iv

| Essential Requirements of Directive 2014/68/EU (PED) | Clauses of this European Standard | Remarks/Notes |
| --- | --- | --- |
|  |  |  |

<!-- Pagina 9 (motore: pdfplumber) -->

## EN ISO 15614-1:2017+A1:2019 (E)

## Annex ZB

## Relationship between this I(nitnefornrmataitoinvea)l Standard and the Essential

## Requirements of EU Directive 2014/29/EU (SPVD)

This European Standard has been prepared under a Commission's standardization request M/071 “Mandate to CEN for standardization in the field of pressure equipment” to provide one voluntary means of conforming to essential requirements of Directive 2014/29/EU (SPVD) on the harmonisation of the laws of the Member States relating to the making available on the market of simple pressure vessels. Once this standard is cited in the Official Journal of the European Union under that Directive, compliance with the normative clauses of this standard given in Table ZB.1 confers, within the limits of the scope of this standard, a presumption of conformity with the corresponding essential requirements Table ZB.1 — Correspondence between this European Standard and Directive 2014/29/EU of that Directive, and associated EFTA regulations.

## (SPVD)

Essential Requirements of Clauses of this European Remarks/Notes Directive 2014/29/EU Standard

## (SPVD)

Annex II, 3.c.iii Clause 9, Annex B Report on Welding procedure test WARNING 1 — Presumption of conformity stays valid only as long as a reference to this International Standard is maintained in the list published in the Official Journal of the European Union. Users of this standard should consult frequently the latest list published in the Official Journal of the European Union. WARNING 2 — Other Union legislation may be applicable to the product(s) and services falling within the scope of this standard. v

| Essential Requirements of Directive 2014/29/EU (SPVD) | Clauses of this European Standard | Remarks/Notes |
| --- | --- | --- |
|  |  |  |

<!-- Pagina 10 (motore: pdfplumber) -->

<!-- Pagina 11 (motore: pdfplumber) -->

## Contents

Page Foreword v Introduction vi ..........................................................................................................................................................................................................................................

# 1 Scope 1

................................................................................................................................................................................................................................

# 2 Normative references 2

.................................................................................................................................................................................................................................

# 3 Terms and definitions 3

......................................................................................................................................................................................

# 4 Preliminary welding procedure specification (pWPS) 3

.....................................................................................................................................................................................

# 5 Welding procedure test 3

.................................................................................................

# 6 Test piece 3

................................................................................................................................................................................. ...................................................................................................................................................................................................................... 6.1 General ...........................................................................................................................................................................................................3 6.2 Shape and dimensions of test pieces ...................................................................................................................................4 6.2.1 General......................................................................................................................................................................................4

### 6.2.2 Butt joint in plate with full penetration .......................................................................................................4

### 6.2.3 Butt joint in pipe with full penetration .........................................................................................................4

6.2.4 T-joint.........................................................................................................................................................................................4 6.2.5 Branch connection ..........................................................................................................................................................4

# 7 Examination and testing 8

6.3 Welding of test pieces .......................................................................................................................................................................4 ............................................................................................................................................................................... 7.1 Type and extent of testing .............................................................................................................................................................8 7.2 Location and taking of test specimens ...............................................................................................................................9 7.3 Non-destructive testing ................................................................................................................................................................13 7.4 Destructive testing ............................................................................................................................................................................13 7.4.1 Transverse tensile test .............................................................................................................................................13 7.4.2 Bend test ..............................................................................................................................................................................13 7.4.3 Macroscopic examination .....................................................................................................................................13 7.4.4 Impact testing ..................................................................................................................................................................14 7.4.5 Hardness testing ...........................................................................................................................................................14 7.5 Acceptance levels ...............................................................................................................................................................................15

# 8 Range of qualification 16

7.6 Re-testing ..................................................................................................................................................................................................16 .................................................................................................................................................................................. 8.1 General ........................................................................................................................................................................................................16 8.2 Related to the manufacturer ....................................................................................................................................................16 8.3 Related to the parent material ................................................................................................................................................17 8.3.1 Parent material grouping ......................................................................................................................................17 8.3.2 Material thickness........................................................................................................................................................19

### 8.3.3 Diameter of pipes and branch connections ...........................................................................................21

8.3.4 Angle of branch connection .................................................................................................................................21 8.4 Common to all welding procedures ...................................................................................................................................22 8.4.1 Welding processes .......................................................................................................................................................22 8.4.2 Welding positions .........................................................................................................................................................22 8.4.3 Type of joint/weld .......................................................................................................................................................23

### 8.4.4 Filler material, manufacturer/trade name, designation.............................................................24

8.4.5 Filler material size .......................................................................................................................................................24 8.4.6 Type of current ...............................................................................................................................................................25 8.4.7 Heat input (arc energy) ...........................................................................................................................................25 8.4.8 Preheat temperature .................................................................................................................................................25 8.4.9 Interpass temperature .............................................................................................................................................25

### 8.4.10 Post-heating for hydrogen release .................................................................................................................26

8.4.11 Heat-treatment ...............................................................................................................................................................26 8.5 Specific to processes .......................................................................................................................................................................26

### 8.5.1 Submerged arc welding (process 12) .........................................................................................................26

### 8.5.2 Gas-shielded metal arc welding (process 13) ......................................................................................27

© ISO 2017 – All rights reserved iii

<!-- Pagina 12 (motore: pdfplumber) -->

### 8.5.3 Gas-shielded arc welding with non-consumable electrode (process 14) ....................29

### 8.5.4 Plasma arc welding (process 15) ....................................................................................................................29

### 8.5.5 Oxy-acetylene welding (process 311) ........................................................................................................29

# 9 Welding procedure qualification record (WPQR) 29

8.5.6 Backing gas ........................................................................................................................................................................29 Annex A Filler material, designation 31 ........................................................................................................... Annex B Welding procedure qualification record form (WPQR) 33 (normative) .............................................................................................................................. Bibliography 38 (informative) ................................................... ............................................................................................................................................................................................................................. iv © ISO 2017 – All rights reserved

<!-- Pagina 13 (motore: pdfplumber) -->

## Foreword

ISO (the International Organization for Standardization) is a worldwide federation of national standards bodies (ISO member bodies). The work of preparing International Standards is normally carried out through ISO technical committees. Each member body interested in a subject for which a technical committee has been established has the right to be represented on that committee. International organizations, governmental and non-governmental, in liaison with ISO, also take part in the work. ISO collaborates closely with the International Electrotechnical Commission (IEC) on all matters of electrotechnical standardization. The procedures used to develop this document and those intended for its further maintenance are described in the ISO/IEC Directives, Part 1. In particular the different approval criteria needed for the different types of ISO documents should be noted. This document was drafted in accordance with the editorial rules of the ISO/IEC Directives, Part 2 (see www.iso.org/directives). Attention is drawn to the possibility that some of the elements of this document may be the subject of patent rights. ISO shall not be held responsible for identifying any or all such patent rights. Details of any patent rights identified during the development of the document will be in the Introduction and/or on the ISO list of patent declarations received (see www.iso.org/patents). Any trade name used in this document is information given for the convenience of users and does not constitute an endorsement. For an explanation on the voluntary nature of standards, the meaning of ISO specific terms and expressions related to conformity assessment, as well as information about ISO's adherence to the World Trade Organization (WTO) principles in the Technical Barriers to Trade (TBT) see the following URL: www.iso.org/iso/foreword.html. Welding and allied processes Quality management in the field of welding This document was prepared by Technical Committee ISO/TC 44, , Subcommittee SC 10, . This second edition cancels and replaces the first edition (ISO 15614-1:2004), which has been technically revised. It also incorporates the Amendments ISO 15614-1:2004/Amd 1:2008 and ISO 15614-1:2004/Amd 2:2012 and the Technical Corrigendum ISO 15614-1:2004/Cor. 1:2005. A list of all parts in the ISO 15614 series can be found on the ISO website. Requests for official interpretations of any aspect of this document should be directed to the Secretariat of ISO/TC 44/SC 10 via your national standards body. A complete listing of these bodies can be found at www.iso.org. This corrected version of ISO 15614-1:2017 incorporates the following corrections: — in Table 5, the value “10-5” has been added for test piece material A of group 10 for test piece material B of group 5; — Figure 6 has been updated to match the Key. © ISO 2017 – All rights reserved v

<!-- Pagina 14 (motore: pdfplumber) -->

## Introduction

All new welding procedure tests are to be carried out in accordance with this document from the date of its issue. However, this document does not invalidate previous welding procedure tests made to former national standards or specifications or previous issues of this document. Two levels of welding procedure tests are given in order to permit application to a wide range of welded fabrication. They are designated by levels 1 and 2. Level 1 is based on requirements of ASME Section IX and level 2 is based on the previous issues of this document. vi © ISO 2017 – All rights reserved

<!-- Pagina 15 (motore: pdfplumber) -->

## INTERNATIONAL STANDARD ISO 15614-1:2017+A1:2019(E)

## Specification and qualification of welding procedures for

## metallic materials — Welding procedure test —

## Arc and gas welding of steels and arc welding of nickel and

## Pnaicrkt e1l: alloys

# 1 Scope

This document specifies how a preliminary welding procedure specification is qualified by welding procedure tests. This document applies to production welding, repair welding and build-up welding. This document defines the conditions for the execution of welding procedure tests and the range of qualification for welding procedures for all practical welding operations within the qualification of this document. The primary purpose of welding procedure qualification is to demonstrate that the joining process proposed for construction is capable of producing joints having the required mechanical properties for the intended application. Two levels of welding procedure tests are given in order to permit application to a wide range of welded fabrication. They are designated by levels 1 and 2. In level 2, the extent of testing is greater and the ranges of qualification are more restrictive than in level 1. Procedure tests carried out to level 2 automatically qualify for level 1 requirements, but not vice-versa. When no level is specified in a contract or application standard, all the requirements of level 2 apply. This document applies to the arc and gas welding of steels in all product forms and the arc welding of nickel and nickel alloys in all product forms. Arc and gas welding are covered by the following processes in accordance with ISO 4063. 111 — manual metal arc welding (metal-arc welding with covered electrode); 114 — self-shielded tubular-cored arc welding;

# 12 — submerged arc welding;

# 13 — gas-shielded metal arc welding;

# 14 — gas-shielded arc welding with non-consumable electrode;

# 15 — plasma arc welding;

311 — oxy-acetylene welding. The principles of this document may be applied to other fusion welding processes. NOTE A former process number does not require a new qualification test according to this document. Specification and qualification of welding procedures that were made in accordance with previous editions of this document may be used for any application for which the current edition is specified. In this case, the ranges of qualification of previous editions remain applicable.

<!-- Pagina 16 (motore: pdfplumber) -->

It is also possible to create a new WPQR (welding procedure qualification record) range of qualification according to this edition based on the existing qualified WPQR, provided the technical intent of the testing requirements of this document has been satisfied. Where additional tests have to be carried out to make the qualification technically equivalent, it is only necessary to perform the additional test on a test piece.

# 2 Normative references

The following documents are referred to in the text in such a way that some or all of their content constitutes requirements of this document. For dated references, only the edition cited applies. For undated reMfeerteanllciec sm, tahtee rliaatless —t e dChitaiornpy o pf ethnde urleufmer iemncpeadc td toecsut m—e Pnat r(tin 1c: lTuedsitn mg eatnhyo admendments) applies. ISO 148-1, Non-destructive testing — Penetrant testing — Part 1: General principles ISO 3452-1W, elding and allied processes — Nomenclature of processes and reference numbers ISO 4063, Destructive tests on welds in metallic materials — Transverse tensile test ISO 4136, Destructive tests on welds in metallic materials — Bend tests ISO 5173, Welding — Fusion-welded joints in steel, nickel, titanium and their alloys (beam welding excluded) — Quality levels for imperfections ISO 5817, Welding and allied processes — Classification of geometric imperfections in metallic materials — Part 1: Fusion welding ISO 6520-1, Welding and allied processes — Welding positions ISO 6947, Destructive tests on welds in metallic materials — Hardness testing — Part 1: Hardness test on arc welded joints ISO 9015-1, Destructive tests on welds in metallic materials — Impact tests — Test specimen location, notch orientation and examination ISO 9016, Welding consumables — Gases and gas mixtures for fusion welding and allied processes ISO 14175, Specification and qualification of welding procedures for metallic materials — Welding procedure specification — Part 1: Arc welding ISO 15609-1, Specification and qualification of welding procedures for metallic materials — Welding procedure specification — Part 2: Gas welding ISO 15609-2, Specification and qualification of welding procedures for metallic materials — Qualification based on pre-production welding test ISO 15613, Non-destructive testing of welds — Radiographic testing — Part 1: X- and gamma-ray techniques with film ISO 17636-1, Non-destructive testing of welds — Radiographic testing — Part 2: X- and gamma-ray techniques with digital detectors ISO 17636-2, Non-destructive testing of welds — Visual testing of fusion-welded joints ISO 17637, Non-destructive testing of welds — Magnetic particle testing ISO 17638, Destructive tests on welds in metallic materials — Macroscopic and microscopic examination of welds ISO 17639, Non-destructive testing of welds — Ultrasonic testing — Techniques, testing levels, and assessment ISO 17640,

<!-- Pagina 17 (motore: pdfplumber) -->

Welding — Guidelines for a metallic materials grouping system ISO/TR 15608, Welding — Recommendations for welding of metallic materials — Part 1: General guidance for arc welding ISO/TR 17671-1, Welding and allied processes — Guidelines for measurement of welding energies ISO/TR 18491, Welding — Grouping systems for materials — European materials ISO/TR 20172, Welding — Grouping systems for materials — American materials ISO/TR 20173, Welding — Grouping systems for materials — Japanese materials ISO/TR 20174, Welding and allied processes — Vocabulary ISO/TR 25901 (all parts),

# 3 Terms and definitions

For the purposes of this document, the terms and definitions given in ISO/TR 25901 (all parts) and the following apply. ISO and IEC maintain terminological databases for use in standardization at the following addresses: — ISO Online browsing platform: available at http://www.iso.org/obp 3—.1 IEC Electropedia: available at http://www.electropedia.org/ run out length length of a run produced by the melting of a covered electrode N3.o2te 1 to entry: See ISO/TR 17671-2. build-up welding addition of weld metal to obtain or restore required dimensions

# 4 Preliminary welding procedure specification (pWPS)

The preliminary welding procedure specification shall be prepared in accordance with ISO 15609-1 or ISO 15609-2.

# 5 Welding procedure test

The welding and testing of test pieces shall be in accordance with Clauses 6 and 7. The welder or welding operator who undertakes the welding procedure test satisfactorily in accordance with this document is qualified according to the relevant national/international standard being applied, provided that the relevant testing requirements of that standard are met.

# 6 Test piece

## 6.1 General

The welded joint to which the welding procedure will relate in production shall be represented by making a standard test piece or pieces, as specified in 6.2. If required by the application standard, the direction of plate rolling shall be marked on the test piece when impact tests are required to be taken in the Heat Affected Zone (HAZ) and shall be mentioned in the impact test report. 3

<!-- Pagina 18 (motore: pdfplumber) -->

For level 1: Any butt joint test qualifies all joint For level 2: Where the joint requirements and/or configurations. dimension of the test piece are not covered by the standard test pieces as shown in this document, the use of ISO 15613 shall be required.

## 6.2 Shape and dimensions of test pieces

### 6.2.1 General

The length or number of test pieces shall be sufficient to allow all required tests to be carried out. Additional test pieces, or longer test pieces than the minimum size, may be prepared in order to allow for extra testing and/or for re-testing specimens (see 7.6). t D For all test pieces except branch connections (see Figure 4) and T-joints (T-butt weld or fillet weld; see Figure 3), the material thickness, , and the diameter, , shall be the same for both plates and pipes on the required length of the test piece to be welded. The thickness and/or pipe outside diameter of the test pieces shall be selected in accordance with 8.3.2 to 8.3.3.

### 6.2.2 Butt joint in plate with full penetration

The test piece shall be prepared in accordance with Figure 1.

### 6.2.3 Butt joint in pipe with full penetration

The test piece shall be prepared in accordance with Figure 2. NOTE The word “pipe”, alone or in combination, is used to mean “pipe”, “tube” or “hollow section” except square or rectangular hollow section.

### 6.2.4 T-joint

The test piece shall be prepared in accordance with Figure 3. This test piece applies to fully penetrated butt welds or fillet welds.

### 6.2.5 Branch connection

α For level 1: No specific test piece required. For level 2: The test piece shall be prepared in accordance with Figure 4. The angle is the minimum one used in production. This test piece applies to fully penetrated joints (set-on, set-in or set-through joint) and for fillet welds.

## 6.3 Welding of test pieces

Preparation and welding of test pieces shall be carried out in accordance with the pWPS, which they shall represent. Welding positions and limitations for the angle of slope and rotation of the test piece shall be in accordance with ISO 6947. If tack welds are to be fused into the final joint, they shall be included in the test piece. The welding and the testing of the test piece shall be verified by the examiner or examining body.

<!-- Pagina 19 (motore: pdfplumber) -->

Key a

# 1 joint preparation and fit-up as detailed in the preliminary welding procedure specification (pWPS)

b minimum dimension 150 mm t minimum dimension 350 mm material thickness Figure 1 — Test piece for a butt joint in plate with full penetration Key a

# 1 joint preparation and fit-up as detailed in the preliminary welding procedure specification (pWPS)

D minimum dimension 150 mm t outside pipe diameter material thickness Figure 2 — Test piece for a butt joint in pipe with full penetration

|  |
| --- |
|  |
|  |

|  |
| --- |
|  |

|  |  |
| --- | --- |
|  |  |

|  |  |  |
| --- | --- | --- |

<!-- Pagina 20 (motore: pdfplumber) -->

Key a

# 1 joint preparation and fit-up as detailed in the preliminary welding procedure specification (pWPS)

b minimum dimension 150 mm t t minimum dimension 350 mm 1, 2 material thickness Figure 3 — Test piece for a T-joint

|  |  |
| --- | --- |

<!-- Pagina 21 (motore: pdfplumber) -->

Key α

# 1 joint preparation and fit-up as detailed in the preliminary welding procedure specification (pWPS)

a branch angle D minimum dimension 150 mm D

# 1 outside diameter of main pipe

t

# 2 outside diameter of branch pipe

t

# 1 main pipe material thickness

# 2 branch pipe material thickness

Figure 4 — Test piece for a branch connection

<!-- Pagina 22 (motore: pdfplumber) -->

# 7 Examination and testing

## 7.1 Type and extent of testing

For level 1: Type and the extent of testing shall be For level 2: Type and the extent of testing shall be in accordance with the requirements of Table 1. in accordance with the requirements of Table 2. If impact testing, hardness testing or non-destructive testing (NDT) is required by an application standard or specification, they shall be carried out and assessed in accordance with the requirements of level 2, unless otherwise specified by the application standard or specification. An application standard may specify additional tests, e.g.: — longitudinal weld tensile test; — all weld metal bend test; — corrosion test; — chemical analysis; — microscopic examination; — delta ferrite examination; — hardness test; — cruciform test; — impact test; — non-destructive testing (NDT). NOTE Specific service, material or manufacturing conditions may require more comprehensive testing than is specified by this document in order to gain more information and to avoid repeating the welding procedure test at a later date just to obtain additional test data. Table 1 — For level 1: Examination and testing of the test pieces Test piece Type of test Extent of testing Footnote Butt joint with full Visual testing 100 % penetration — Figure 1 a Transverse tensile test 2 specimens and Figure 2 Transverse bend test 4 specimens Fillet welds — Figure 3 Visual testing 100 % b Macroscopic examination 2 specimens a For bend tests, see 7.4.2. b Where mechanical properties are required by an application standard, it shall be tested accordingly. If an additional test piece is needed, the dimensions should be sufficient enough to allow testing of the mechanical properties. For this additional test piece, the welding parameter range, parent material group, filler metal and heat treatment are required to be the same.

| Test piece | Type of test | Extent of testing | Footnote |
| --- | --- | --- | --- |
| Butt joint with full penetration — Figure 1 | Visual testing Transverse tensile test | 100 % 2 specimens | a |
| and Figure 2 Fillet welds — Figure 3 | Transverse bend test Visual testing | 4 specimens 100 % |  |
| b Macroscopic examination 2 specimens a For bend tests, see 7.4.2. b Where mechanical properties are required by an application standard, it shall be tested accordingly. If an additional test piece is needed, the dimensions should be sufficient enough to allow testing of the mechanical properties. For this |  |  |  |

<!-- Pagina 23 (motore: pdfplumber) -->

## Table 2 — For level 2: Examination and testing of the test pieces

Test piece Type of test Extent of testing Footnote Butt joint with full Visual testing 100 % — penetration — Figure 1 a Radiographic or ultrasonic testing 100 % and Figure 2 b Surface crack detection 100 % Transverse tensile test 2 specimens — c Transverse bend test 4 specimens d Impact test 2 sets e Hardness test required Macroscopic examination 1 specimen — T- joint with full Visual testing 100 % penetration — b Surface crack detection 100 % Figure 3 a, g Ultrasonic or radiographic testing 100 % Branch connection with e full penetration — Hardness test required Figure 4 Macroscopic examination 2 specimens f Fillet weld — Figure 3 and Visual testing 100 % Figure 4 b Surface crack detection 100 % f e Hardness test required t Macroscopic examination 2 specimens a Ultrasonic testing shall not be used for < 8 mm and not for material groups 8, 10, 41 to 48. b Accessible weld surfaces: penetrant testing or magnetic particle testing. For non-magnetic materials, penetrant testing. c For bend tests, see 7.4.2. d One set in the weld metal and one set in the HAZ for materials ≥12 mm thick and having specified impact properties required by technical delivery conditions and/or if appropriate according to the service conditions. Application standards may require impact testing below 12 mm thick. The testing temperature shall be chosen by the manufacturer with regard to the application or application standards. For additional tests, see 7.4.4. e Not required for parent metals: sub-group 1.1, groups 8 and 41 to 48 and dissimilar joints between these groups, except for dissimilar joints between sub-group 1.1 and group 8. f Where mechanical properties are required by an application standard, it shall be tested accordingly. If an additional test piece is needed, the dimensions should be sufficient enough to allow testing of the mechanical properties. For this additional test piece, the welding parameter range, parent material group, filler metal and heat treatment are required to be the same. g For outside diameter ≤50 mm, no ultrasonic testing is required, but radiographic testing is required provided that the joint configuration will provide valid results. For outside diameter >50 mm and where it is not technically possible to carry out ultrasonic testing, a radiographic testing shall be carried out provided that the joint configuration will provide valid results.

## 7.2 Location and taking of test specimens

## Test specimens shall be taken in accordance with Figures 5, 6, 7 and 8.

## For location of hardness and impact specimens, 8.4.2 shall be considered.

## It is acceptable to take the test specimens from locations avoiding areas which have imperfections

## within the acceptance limits for the NDT method(s) used.

| Test piece | Type of test | Extent of testing | Footnote |
| --- | --- | --- | --- |
| Butt joint with full penetration — Figure 1 and Figure 2 | Visual testing Radiographic or ultrasonic testing Surface crack detection Transverse tensile test Transverse bend test Impact test Hardness test | 100 % 100 % 100 % 2 specimens 4 specimens 2 sets required | — a b — c d e |
| T- joint with full penetration — Figure 3 Branch connection with full penetration — Figure 4 | Macroscopic examination Visual testing Surface crack detection Ultrasonic or radiographic testing Hardness test Macroscopic examination | 1 specimen 100 % 100 % 100 % required 2 specimens | — b a, g e |
| f Fillet weld — Figure 3 and Figure 4 f | Visual testing Surface crack detection Hardness test | 100 % 100 % required | b e |
| t Macroscopic examination 2 specimens a Ultrasonic testing shall not be used for < 8 mm and not for material groups 8, 10, 41 to 48. b Accessible weld surfaces: penetrant testing or magnetic particle testing. For non-magnetic materials, penetrant testing. c For bend tests, see 7.4.2. d One set in the weld metal and one set in the HAZ for materials ≥12 mm thick and having specified impact properties required by technical delivery conditions and/or if appropriate according to the service conditions. Application standards may require impact testing below 12 mm thick. The testing temperature shall be chosen by the manufacturer with regard to the application or application standards. For additional tests, see 7.4.4. e Not required for parent metals: sub-group 1.1, groups 8 and 41 to 48 and dissimilar joints between these groups, except for dissimilar joints between sub-group 1.1 and group 8. f Where mechanical properties are required by an application standard, it shall be tested accordingly. If an additional test piece is needed, the dimensions should be sufficient enough to allow testing of the mechanical properties. For this additional test piece, the welding parameter range, parent material group, filler metal and heat treatment are required to be the same. g For outside diameter ≤50 mm, no ultrasonic testing is required, but radiographic testing is required provided that the joint configuration will provide valid results. For outside diameter >50 mm and where it is not technically possible to carry |  |  |  |

<!-- Pagina 24 (motore: pdfplumber) -->

Dimensions in millimetres Key

# 1 discard 25 mm

# 2 welding direction

# 3 area for:

— 1 tensile test specimen — bend test specimens

# 4 area for:

— impact and additional test specimens if required

# 5 area for:

— 1 tensile test specimen — bend test specimens

# 6 area for:

— 1 macro test specimen — 1 hardness test specimen NOTE Not to scale. Figure 5 — Location of test specimens for a butt joint in plate

|  |  |  |  |
| --- | --- | --- | --- |
|  |  |  |  |
|  |  |  |  |

<!-- Pagina 25 (motore: pdfplumber) -->

Key

# 1 end of weld

# 2 area for:

— 1 tensile test specimen — bend test specimens

# 3 area for:

— impact and additional test specimens if required

# 4 area for:

— 1 tensile test specimen — bend test specimens

# 5 start of weld; area for:

— 1 macro test specimen — 1 hardness test specimen (taken from the start of weld)

# 6 weld direction

NOTE Not to scale. Figure 6 — Location of test specimens for a butt joint in pipe

|  |
| --- |
|  |

|  |
| --- |
|  |

<!-- Pagina 26 (motore: pdfplumber) -->

Dimensions in millimetres Key

# 1 discard 25 mm

# 2 macro test specimen

# 3 macro and hardness test specimen

# 4 welding direction

Figure 7 — Location of test specimens in a T-joint Key A macro and hardness test specimen to be taken α B macro test specimen to be taken branch angle Figure 8 — Location of test specimens for a branch connection on pipe

|  |  |
| --- | --- |
|  |  |

<!-- Pagina 27 (motore: pdfplumber) -->

## 7.3 Non-destructive testing

All non-destructive testing in accordance with 7.1 shall be carried out and accepted on the test pieces prior to cutting of the test specimens. The discard (see Figure 5 and Figure 7) shall not be considered for NDT. Any post-weld heat treatment (PWHT) that is specified shall be completed prior to nondestructive testing. For materials that are susceptible to hydrogen induced cracking and where no post-heating or no PWHT is specified, non-destructive testing shall be delayed. Depending upon joint geometry, materials and the requirements for work, the NDT shall be carried out as required in Table 1 and Table 2 in accordance with ISO 17637 (visual testing), ISO 17636-1 or ISO 17636-2 (radiographic testing), ISO 17640 (ultrasonic testing), ISO 3452-1 (penetrant testing) and ISO 17638 (magnetic particle testing). Acceptance levels shall be in accordance with 7.5.

## 7.4 Destructive testing

### 7.4.1 Transverse tensile test

Specimens and testing for transverse tensile testing for butt joint shall be in accordance with ISO 4136. The test shall represent the whole thickness except as necessary to obtain parallel sides on the specimens. Tensile testing shall ensure all welding processes used and the associated essential variables are tested. NOTE It is not essential to overlap the specimens as identified in ISO 4136. For pipes >50 mm outside diameter, the excess weld metal shall be removed on both faces to give the test specimen a thickness equal to the wall thickness of the pipe. For pipes ≤50 mm outside diameter, for which the transverse tensile test is performed on the full pipe, the excess weld metal may be left undressed on the inside surface of the pipe. The tensile strength of the test specimen shall not be less than the corresponding specified minimum value for the parent metal unless otherwise specified prior to testing. For dissimilar parent metal joints, the tensile strength shall not be less than the minimum value specified for the parent material having the lowest tensile strength.

### 7.4.2 Bend test

Specimens and testing for bend testing for butt joints shall be in accordance with ISO 5173:2009. For thicknesses <12 mm, two root and two face bend test specimens shall be tested. For thicknesses ≥12 mm, four side bend specimens may be used instead of root and face bend tests. For dissimilar metal joints or heterogeneous butt joints in plates, one root and one face longitudinal bend test specimen may be used instead of four transverse bend tests. During testing, the test specimens shall not reveal any imperfection >3 mm in any direction. Imperfections appearing at the corners of a test specimen during testing shall be ignored in the evaluation.

### 7.4.3 Macroscopic examination

The test specimen shall be prepared and etched in accordance with ISO 17639 on one side to clearly reveal the fusion line, the HAZ and the build-up of the runs. The test specimen shall include unaffected parent metal and shall be recorded by at least one photograph of macro cross-section per procedure test.

<!-- Pagina 28 (motore: pdfplumber) -->

The acceptance levels shall be in accordance with 7.5.

### 7.4.4 Impact testing

Test specimens and testing for impact tests shall be in accordance with this document for location of specimens and temperature of testing, and with ISO 9016 for dimensions and testing. The striker radius of 2 mm according to ISO 148-1 shall be used, unless otherwise specified. For weld metal, test specimen type VWT (V: Charpy V-notch - W: notch in weld metal - T: notch through the thickness) and for HAZ specimen type VHT (V: Charpy V-notch - H: notch in heat affected zone - T: notch through the thickness) shall be used. From each specified location, each set shall be comprised of three specimens. Specimens shall be sampled from a maximum of 2 mm below the upper surface of the parent metal and transverse to the weld. In the HAZ, the mid-point of the notch shall be at 1 mm to 2 mm from the fusion line. In the weld metal, the mid-point of the notch shall be at the weld centtreline. For butt joints where the material thickness is > 50 mm, two additional sets of specimens shall be taken from the root area, one set taken in the weld and one set taken from the HAZ. For joints between materials with the same material specification and designation, the absorbed energy shall be in accordance with the appropriate parent material standard unless modified by the application standards. For dissimilar metal joints, impact tests shall be carried out on specimens from the HAZ in each parent metal and the absorbed energy shall be in accordance with the appropriate parent material standard. The average value of the three specimens shall meet the specified requirements. For each notch location, one individual value may be below the minimum average value specified, provided that it is not less than 70 % of that value. Where more than one welding process or type of covering and fluxes are qualified in a single test piece, additional impact test specimens shall be taken from the weld metal and HAZ that include each process and type of covering and fluxes.

### 7.4.5 Hardness testing

Vickers hardness testing with a load of HV 10 shall be performed in accordance with ISO 9015-1. Hardness measurements shall be taken in the weld, the heat affected zones and the parent metal in order to evaluate the range of hardness values across the welded joint. For weld thicknesses less than or equal to 5 mm, only one row of indentations shall be made at a depth of up to 2 mm below the upper surface of the welded joint. For weld thicknesses over 5 mm, one row of indentation from each side shall be made at a depth of up to

# 2 mm from the surface.

For double sided welds, one additional row of indentations shall be made through the root area. Examples of typical indentation patterns are given in ISO 9015-1. Where more than one welding process is used, each welding process has to be tested by at least one row of indentation. For each row of indentation at least three individual indentations shall be made in each of the following areas: — the weld; — both heat affected zones;

<!-- Pagina 29 (motore: pdfplumber) -->

— both parent metals. For the HAZ, the first indentation shall be placed as close to the fusion line as possible. The results from the hardness test shall meet the requirements given in Table 3. However, requirements for groups 6 (non-heat treated), 7, 10 and 11 and any dissimilar metal joints shall be specified prior to testing. Table 3 — Permitted maximum hardness values (HV 10) Steel groups Non-heat treated Heat treated

## ISO/TR 15608

a b

# 1 , 2 380 320

b

# 3 450 380

c c 4, 5 380 350

# 6 — 350

## 9.1 350 300

## 9.2 450 350

## 9.3 450 350

a R If hardness tests are required. b For steels with min eH > 890 MPa, special values shall be specified. c For certain materials, higher values may be accepted, if specified before the welding procedure test.

## 7.5 Acceptance levels

The acceptance levels for imperfections corresponding to level 1 and level 2 are given in Table 4. NOTE The correlation between the quality levels of ISO 5817 and the acceptance levels of the different NDT techniques is given in ISO 17635. Table 4 — Acceptance levels for imperfections ISO 5817 ISO 6520-1 Designation Level 1 Level 2 Ref. no. Ref. no. Quality level toISO 581 7

## 1.1 100 Crack Not permitted B (not

permitted)

## 1.5 401 Lack of fusion (incomplete fusion) Not permitted B (not

permitted)

## 1.6 4021 Incomplete root penetration Not permitted B (not

permitted)

## 1.7 5011 Continuous undercut No specific

requirements C 5012 Intermittent undercut

## 1.9 502 Excess weld metal (butt weld) No specific C

requirements

## 1.10 503 Excessive convexity (fillet weld) No specific C

requirements

## 1.11 504 Excess penetration No specific C

requirements

## 1.12 505 Incorrect weld toe No specific C

requirements a If required by the application standard or specified, micro crack sensitive materials may need specific examination.

| Steel groups ISO/TR 15608 | Non-heat treated | Heat treated |
| --- | --- | --- |
|  |  |  |
| a b |  |  |
| 1 , 2 b | 380 | 320 |
| 3 | 450 c | 380 c |
| 4, 5 6 9.1 9.2 | 380 — 350 450 | 350 350 300 350 |
| 9.3 450 350 a R If hardness tests are required. b For steels with min eH > 890 MPa, special values shall be specified. |  |  |

| ISO 5817 Ref. no. | ISO 6520-1 Ref. no. | Designation | Level 1 | Level 2 Quality level toISO 581 7 |
| --- | --- | --- | --- | --- |
|  |  |  |  |  |
| 1.1 | 100 | Crack | Not permitted | B (not permitted) |
| 1.5 | 401 | Lack of fusion (incomplete fusion) | Not permitted | B (not permitted) |
| 1.6 1.7 | 4021 5011 | Incomplete root penetration Continuous undercut | Not permitted No specific | B (not permitted) |
|  | 5012 | Intermittent undercut | requirements | C |
| 1.9 | 502 | Excess weld metal (butt weld) | No specific requirements | C |
| 1.10 | 503 | Excessive convexity (fillet weld) | No specific requirements | C |
| 1.11 | 504 | Excess penetration | No specific requirements | C |
| 1.12 505 Incorrect weld toe No specific C |  |  |  |  |

<!-- Pagina 30 (motore: pdfplumber) -->

Table 4 (continued) ISO 5817 ISO 6520-1 Designation Level 1 Level 2 Ref. no. Ref. no. Quality level toISO 581 7

## 1.16 512 Excessive asymmetry of fillet weld (excessive

h ≤ 3 mm B unequal leg length)

## 1.21 5214 Excessive throat thickness No specific C

requirements a — — All other imperfections No specific B requirements a If required by the application standard or specified, micro crack sensitive materials may need specific examination.

## 7.6 Re-testing

If the test piece fails to comply with any of the requirements for NDT, one further test piece shall be welded and subjected to the same examination. If this additional test piece does not comply with the requirements, the welding procedure test has failed. Alternatively, an analysis may be performed to determine the main cause of the defect. If it is established that the main cause of failure is not procedure-related and due to insufficient welder's skill, no additional test piece is needed and a report of the evidence shall be added to the report. If any test specimen required by Table 1 or Table 2 fails to meet the applicable acceptance criteria, the test piece shall be considered as failed. In the case of failure of the test piece, a new test piece with the same welding parameters may be welded. If all destructive tests provide acceptable test results and a macro section test failed, two additional test specimens for macro section test can be taken. In the case of failure of any destructive test specimen, except for macroscopic examination, two additional test specimens may be removed from the original test piece for each test specimen that failed if adequate material is available. The test specimens shall be taken as close as possible to the original specimen location. Each additional test specimen shall be subjected to the same tests as the initial test specimen that failed. If any of the additional test specimens do not comply with the requirements, the welding procedure test shall be considered failed. For hardness tests, if there are single hardness values in different test zones above the values indicated in Table 3, an additional row of indentation may be carried out (on the reverse of the specimen or after sufficient preparation of the tested surfaces). None of the additional hardness values shall exceed the maximum hardness values given in Table 3. For impact tests, where the results from a set of three specimens do not comply with the requirements, with not more than one value lower than 70 % of the specified minimum average value, three additional specimens shall be taken. The new set of three specimens shall comply with the requirement of 7.4.4 and the average value of these specimens together with the initial results shall not be lower than the required average.

# 8 Range of qualification

## 8.1 General

Changes outside of the ranges specified shall require a new welding procedure test.

## 8.2 Related to the manufacturer

A welding procedure test according to this document prepared by a manufacturer is valid for welding in workshops or sites when the manufacturer who performed the welding procedure test retains complete responsibility for all welding carried out to it.

| ISO 5817 Ref. no. | ISO 6520-1 Ref. no. | Designation | Level 1 | Level 2 Quality level toISO 581 7 |
| --- | --- | --- | --- | --- |
|  |  |  |  |  |
| 1.16 | 512 | Excessive asymmetry of fillet weld (excessive unequal leg length) | h ≤ 3 mm | B |
| 1.21 | 5214 | Excessive throat thickness a | No specific requirements | C |
| — — All other imperfections No specific B |  |  |  |  |

<!-- Pagina 31 (motore: pdfplumber) -->

## 8.3 Related to the parent material

### 8.3.1 Parent material grouping

#### 8.3.1.1 General

In order to minimize the number of welding procedure tests, steels, nickel and nickel alloys are grouped according to ISO/TR 15608. Where materials are assigned to groups by ISO/TR 20172, ISO/TR 20173 or ISO/TR 20174, those assignments shall be used. Separate welding procedure qualifications are required for each parent material or parent material combinations not covered by the grouping system according to ISO/TR 20172, ISO/TR 20173, ISO/TR 20174 or ISO/TR 15608. Permanent backing material shall be considered as a parent metal within the approval (sub-)group.

#### 8.3.1.2 Steels

The ranges of qualification are given in Table 5.

#### 8.3.1.3 Nickel alloys

The ranges of qualification are given in Table 6.

#### 8.3.1.4 Dissimilar joints between steels and nickel alloys

The ranges of qualification are given in Table 6. Table 5 — Range of qualification for steel groups and sub-groups a,b,c Test piece Test piece material B material A

# 1 2 3 4 5 6 7 8 9 10 11

# 1 1-1 — — — — — — — — — —

1-1 1-1

# 2 2-1 — — — — — — — — —

2-1 2-2 1-1 1-1 2-1 1-1 2-1 2-2

# 3 2-1 2-2 — — — — — — — —

3-1 3-1 3-1 3-2 3-2 3-3 4-1 4-1 4-1 4-2

# 4 4-1 4-2 — — — — — — —

4-2 4-3 4-3 4-4 a Test piece materials in groups 1, 2, 3 and 11 qualify the equal or lower specified minimum yield strength steels (independent of the material thickness). b Test piece materials in groups 4, 5, 6, 8 and 9 qualify steels in the same sub-group and any lower sub-group within the same group. c Test piece materials in groups 7 and 10 qualify steels in the same sub-group.

| Test piece material A | a,b,c Test piece material B |  |  |  |  |  |  |  |  |  |  |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
|  |  |  |  |  |  |  |  |  |  |  |  |
| 1 2 | 1 1-1 1-1 | 2 — 1-1 2-1 | 3 — — | 4 — — | 5 — — | 6 — — | 7 — — | 8 — — | 9 — — | 10 — — | 11 — — |
| 3 | 2-1 1-1 2-1 3-1 | 2-2 1-1 2-1 2-2 3-1 | 1-1 2-1 2-2 3-1 3-2 | — | — | — | — | — | — | — | — |
| 4 | 4-1 | 3-2 4-1 | 3-3 4-1 4-2 | 4-1 4-2 4-3 | — | — | — | — | — | — | — |
| 4-2 4-3 4-4 a Test piece materials in groups 1, 2, 3 and 11 qualify the equal or lower specified minimum yield strength steels (independent of the material thickness). b Test piece materials in groups 4, 5, 6, 8 and 9 qualify steels in the same sub-group and any lower sub-group within the same group. |  |  |  |  |  |  |  |  |  |  |  |

<!-- Pagina 32 (motore: pdfplumber) -->

Table 5 (continued) Test piece Test piece material B material A

# 1 2 3 4 5 6 7 8 9 10 11

5-1

# 5 5-1 5-2 5-3 5-4 5-2 — — — — — —

5-5 6-1 6-1 6-1 6-2 6-1 6-2 6-1 6-2 6-3

# 6 6-1 6-2 6-3 — — — — —

6-2 6-3 6-4 6-3 6-4 6-4 6-5 6-5 6-6 7-1 7-1 7-5

# 7 7-1 7-2 7-4 7-5 7-7 — — — —

7-2 7-6 7-3 8-1 8-1 8-1 8-2 8-2

# 8 8-1 8-1 8-2 8-4 8-4 8-4 8-7 8-8 — — —

8-2 8-3 8-5 8-5 8-6 8-6 9-1 9-1

# 9 9-1 9-2 9-4 9-5 9-6 9-7 9-8 9-9 — —

9-2 9-3 10-1 10-2 10-1 10-1 10-1 10-3 10-2

# 10 10-1 10-2 10-2 10-4 10-4 10-4 10-7 10-8 10-9 10-10 —

10-3 10-5 10-6 10-6 11-1 1-1 11-1 11-1

# 11 11-2 11-4 11-5 11-6 11-7 11-8 11-9 11-10 11-1

1-1 11-2 11-3 11-11 a Test piece materials in groups 1, 2, 3 and 11 qualify the equal or lower specified minimum yield strength steels (independent of the material thickness). b Test piece materials in groups 4, 5, 6, 8 and 9 qualify steels in the same sub-group and any lower sub-group within the same group. c Test piece materials in groups 7 and 10 qualify steels in the same sub-group.

| Test piece material A | Test piece material B |  |  |  |  |  |  |  |  |  |  |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 5 | 1 5-1 | 2 5-2 | 3 5-3 | 4 5-4 | 5 5-1 5-2 | 6 — | 7 — | 8 — | 9 — | 10 — | 11 — |
| 6 | 6-1 | 6-1 6-2 | 6-1 6-2 6-3 | 6-1 6-2 6-3 | 5-5 6-1 6-2 6-3 6-4 | 6-1 6-2 6-3 6-4 6-5 | — | — | — | — | — |
|  |  | 7-1 | 7-1 7-2 | 6-4 | 6-5 | 6-6 7-5 |  |  |  |  |  |
| 7 8 | 7-1 8-1 | 7-2 8-1 8-2 | 7-3 8-1 8-2 8-3 | 7-4 8-4 | 7-5 8-1 8-2 8-4 8-5 | 7-6 8-1 8-2 8-4 8-5 | 7-7 8-7 | — 8-8 | — — | — — | — — |
| 9 | 9-1 | 9-1 | 9-1 9-2 | 9-4 | 8-6 9-5 | 8-6 9-6 | 9-7 | 9-8 | 9-9 | — | — |
| 10 | 10-1 | 9-2 10-1 10-2 | 9-3 10-1 10-2 10-3 | 10-4 | 10-1 10-2 10-3 10-4 | 10-1 10-2 10-4 | 10-7 | 10-8 | 10-9 | 10-10 | — |
| 11 | 11-1 | 11-1 | 11-1 11-2 | 11-4 | 10-5 10-6 11-5 | 10-6 11-6 | 11-7 | 11-8 | 11-9 | 11-10 | 1-1 11-1 |
| 1-1 11-2 11-3 11-11 a Test piece materials in groups 1, 2, 3 and 11 qualify the equal or lower specified minimum yield strength steels (independent of the material thickness). b Test piece materials in groups 4, 5, 6, 8 and 9 qualify steels in the same sub-group and any lower sub-group within the same group. |  |  |  |  |  |  |  |  |  |  |  |

<!-- Pagina 33 (motore: pdfplumber) -->

Table 6 — Range of qualification for nickel alloy and nickel alloy/steel groups Test piece Test piece material B material A

# 41 42 43 44 45 46 47 48

c

# 41 41 -41 — — — — — — —

c c

# 42 42 -41 42 -42 — — — — — —

c

# 43 -43

c c c

# 43 43 -41 43 -42 45 -45 — — — — —

c 47-47 c c c c

# 44 44 -41 44 -42 44 -43 44 -44 — — — —

c c c c c 45 -45

# 45 45 -41 45 -42 45 -43 45 -44 c — — —

# 43 -43

c c c c c c

# 46 46 -41 46 -42 46 -43 46 -44 46 -45 46 -46 — —

c 47-47 c c c c c c c

# 47 47-41 47-42 47-43 47-44 47-45 47-46 43 -43 —

c

# 45 -45

c c c c c c c c

# 48 48 -41 48 -42 48 -43 48 -44 48 -45 48 -46 48 -47 48 -48

c c c c c c c c

# 1 41 -1 42 -1 43 -1 44 -1 45 -1 46 -1 47-1 48 -1

c a c a c a c a c a c a c a c a

# 41 -2 42 -2 43 -2 44 -2 45 -2 46 -2 47-2 48 -2

# 2 c c c c c c c c

# 41 -1 42 -1 43 -1 44 -1 45 -1 46 -1 47-1 48 -1

c a c a c a c a c a c a c a c a

# 41 -3 42 -3 43 -3 44 -3 45 -3 46 -3 47-3 48 -3

c c c c c c c c

# 3 41 -2 42 -2 43 -2 44 -2 45 -2 46 -2 47-2 48 -2

c c c c c c c c

# 41 -1 42 -1 43 -1 44 -1 45 -1 46 -1 47-1 48 -1

c b c b c b c b c b c b c b c b

# 41 -5 42 -5 43 -5 44 -5 45 -5 46 -5 47-5 48 -5

c c c c c c c c

# 41 -6 42 -6 43 -6 44 -6 45 -6 46 -6 47-6 48 -6

c c c c c c c c

# 5 41 -4 42 -4 43 -4 44 -4 45 -4 46 -4 47-4 48 -4

c c c c c c c c

# 41 -2 42 -2 43 -2 44 -2 45 -2 46 -2 47-2 48 -2

c c c c c c c c

# 41 -1 42 -1 43 -1 44 -1 45 -1 46 -1 47-1 48 -1

c b c b c b c b c b c b c b c b

# 41 -6 42 -6 43 -6 44 -6 45 -6 46 -6 47-6 48 -6

c c c c c c c c

# 41 -4 42 -4 43 -4 44 -4 45 -4 46 -4 47-4 48 -4

# 6 c c c c c c c c

# 41 -2 42 -2 43 -2 44 -2 45 -2 46 -2 47-2 48 -2

c c c c c c c c

# 41 -1 42 -1 43 -1 44 -1 45 -1 46 -1 47-1 48 -1

c b c b c b c b c b c b c b c b

# 8 41 -8 42 -8 43 -8 44 -8 45 -8 46 -8 47-8 48 -8

c c c c c c c c

# 11 41 -11 42 -11 43 -11 44 -11 45 -11 46 -11 47-11 48 -11

a Covers the equal or lower specified yield strength steels of the same group. b Covers steels in the same sub-group and any lower sub-group within the same group. c For groups 41 to 48, a procedure test carried out with a solid solution or precipitation hardening alloy in a group covers all solid solution or precipitation hardening alloys, respectively, in the same group.

### 8.3.2 Material thickness

#### 8.3.2.1 General

Limits of qualification of both the parent material and deposited metal shall be as shown in Tables 7 and 8. The deposited metal limits qualified shall not be exceeded in production welds except that the fillet weld thickness shall not be considered. Both parts of the parent material to be welded shall be within the limits of thickness qualified, except that for dissimilar thickness parent materials there is no limit on the thickest part provided the qualification was performed on parent material of 30 mm or greater. For multi-process qualification, the recorded thickness of the deposited metal of each process shall be used as a basis for the range of qualification for the individual welding process.

| Test piece material A | Test piece material B |  |  |  |  |  |  |  |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
|  |  |  |  |  |  |  |  |  |
|  |  |  |  |  |  |  |  |  |
|  | 41 c | 42 | 43 | 44 | 45 | 46 | 47 | 48 |
| 41 42 | 41 -41 c 42 -41 c | — c 42 -42 c | — — c 43 -43 c | — — | — — | — — | — — | — — |
| 43 | 43 -41 | 43 -42 | 45 -45 c | — | — | — | — | — |
| 44 | c 44 -41 | c 44 -42 | 47-47 c 44 -43 | c 44 -44 | — c | — | — | — |
| 45 | c 45 -41 | c 45 -42 | c 45 -43 | c 45 -44 | 45 -45 c | — | — | — |
| 46 | c 46 -41 c | c 46 -42 c | c 46 -43 c | c 46 -44 c | 43 -43 c 46 -45 c | c 46 -46 c | — c 47-47 c | — |
| 47 | 47-41 | 47-42 | 47-43 | 47-44 | 47-45 | 47-46 | 43 -43 c | — |
|  | c | c | c | c | c | c | 45 -45 c | c |
| 48 1 | 48 -41 c 41 -1 c a | 48 -42 c 42 -1 c a | 48 -43 c 43 -1 c a | 48 -44 c 44 -1 c a | 48 -45 c 45 -1 c a | 48 -46 c 46 -1 c a | 48 -47 c 47-1 c a | 48 -48 c 48 -1 c a |
| 2 | 41 -2 c 41 -1 c a 41 -3 c | 42 -2 c 42 -1 c a 42 -3 c | 43 -2 c 43 -1 c a 43 -3 c | 44 -2 c 44 -1 c a 44 -3 c | 45 -2 c 45 -1 c a 45 -3 c | 46 -2 c 46 -1 c a 46 -3 c | 47-2 c 47-1 c a 47-3 c | 48 -2 c 48 -1 c a 48 -3 c |
| 3 5 | 41 -2 c 41 -1 c b 41 -5 c 41 -6 c 41 -4 c | 42 -2 c 42 -1 c b 42 -5 c 42 -6 c 42 -4 c | 43 -2 c 43 -1 c b 43 -5 c 43 -6 c 43 -4 c | 44 -2 c 44 -1 c b 44 -5 c 44 -6 c 44 -4 c | 45 -2 c 45 -1 c b 45 -5 c 45 -6 c 45 -4 c | 46 -2 c 46 -1 c b 46 -5 c 46 -6 c 46 -4 c | 47-2 c 47-1 c b 47-5 c 47-6 c 47-4 c | 48 -2 c 48 -1 c b 48 -5 c 48 -6 c 48 -4 c |
| 6 | 41 -2 c 41 -1 c b 41 -6 c 41 -4 c | 42 -2 c 42 -1 c b 42 -6 c 42 -4 c | 43 -2 c 43 -1 c b 43 -6 c 43 -4 c | 44 -2 c 44 -1 c b 44 -6 c 44 -4 c | 45 -2 c 45 -1 c b 45 -6 c 45 -4 c | 46 -2 c 46 -1 c b 46 -6 c 46 -4 c | 47-2 c 47-1 c b 47-6 c 47-4 c | 48 -2 c 48 -1 c b 48 -6 c 48 -4 c |
|  | 41 -2 c | 42 -2 c | 43 -2 c | 44 -2 c | 45 -2 c | 46 -2 c | 47-2 c | 48 -2 c |
|  | 41 -1 c b | 42 -1 c b | 43 -1 c b | 44 -1 c b | 45 -1 c b | 46 -1 c b | 47-1 c b | 48 -1 c b |
| 8 41 -8 42 -8 43 -8 44 -8 45 -8 46 -8 47-8 48 -8 c c c c c c c c 11 41 -11 42 -11 43 -11 44 -11 45 -11 46 -11 47-11 48 -11 a Covers the equal or lower specified yield strength steels of the same group. b Covers steels in the same sub-group and any lower sub-group within the same group. c |  |  |  |  |  |  |  |  |

<!-- Pagina 34 (motore: pdfplumber) -->

It is not intended that deposited metal thickness or base metal thickness or outside pipe diameters should be measured precisely, but rather the general philosophy behind the values given in Tables 7, 8 and 9 should be applied.

#### 8.3.2.2 Range of qualification for butt joints, T- joints, branch connections and fillet welds

t The qualification of a welding procedure test on thickness shall include qualification for thickness in the following ranges given in Table 7 and Table 8. For level 1: Any butt weld or fillet weld tests For level 2: The range of qualification of fillet welds qualify all fillet sizes and all material thicknesses. qualified by a full penetration butt weld or fillet weld test is given in Table 8. For processes 114, 12 and 13 in which t any pass is greater than 13 mm thick, the maximum parent metal thickness qualified shall be 1,1 t. When impact testing is a requirement, the following applies: — for test pieces 16 mm thick or greater, the minimum thickness qualified is 16 mm; — for test pieces less than 16 mm thick, the minimum thickness qualified is the thickness of the test piece; — for test piece thicknesses 6 mm and thinner, the minimum thickness qualified is 0,5 times the thickness of the test piece. Table 7 — Range of qualification for butt welds material thickness and deposited metal thickness Range of qualification Dimensions in millimetres Thickness of Parent material thickness Deposited weld metal thickness for test piece Level 1 Level 2 each process t s Single run Multi-run t t t s t t t t t s ≤ 3 0,5 to 2 max. 2 t t t t t at sa

# 3 < ≤ 12 1,5 to 2 0,5 (3 min) to 1,3 3 to 2 max. 2

t t t t t t s s

# 12 < ≤ 20 5 to 2 0,5 to 1,1 0,5 to 2 max. 2

t s

# 20 < ≤ 40 5 to 2 0,5 to 1,1 0,5 to 2 max. 2 when < 20

t t t s s max. 2 when ≥ 20 s

# 40 < ≤ 100 5 to 200 — 0,5 to 2 max. 2 when < 20

t t s s max. 200 when ≥ 20 s 100 < ≤ 150 5 to 200 — 50 to 2 max. 2 when < 20 t t t s s max. 300 when ≥ 20 t s > 150 5 to 1,33 — 50 to 2 max. 2 when < 20 max. 1,33 when ≥ 20 a For level 2: when impact requirements are specified but impact tests have not been performed, the maximum thickness of qualification is limited to 12 mm.

| Thickness of test piece t | Range of qualification Dimensions in millimetres Parent material thickness Deposited weld metal thickness for Level 1 Level 2 each process s Single run Multi-run |  |  |  |
| --- | --- | --- | --- | --- |
| t | t t |  |  | s |
| t | t | t t | t | s |
| ≤ 3 t | t | 0,5 to 2 t t | t at | max. 2 sa |
| 3 < ≤ 12 t 12 < ≤ 20 20 < ≤ 40 | 1,5 to 2 t 5 to 2 5 to 2 | 0,5 (3 min) to 1,3 t t 0,5 to 1,1 0,5 to 1,1 | 3 to 2 t t 0,5 to 2 0,5 to 2 | max. 2 s s max. 2 t s max. 2 when < 20 |
| t 40 < ≤ 100 | 5 to 200 | — | t t 0,5 to 2 | s s max. 2 when ≥ 20 s max. 2 when < 20 |
| t 100 < ≤ 150 | 5 to 200 | — | t 50 to 2 | s s max. 200 when ≥ 20 s max. 2 when < 20 |
| t > 150 | t 5 to 1,33 | — | t 50 to 2 | s s max. 300 when ≥ 20 t s max. 2 when < 20 |
| max. 1,33 when ≥ 20 a |  |  |  |  |

<!-- Pagina 35 (motore: pdfplumber) -->

Table 8 — For level 2: Range of qualification for material thickness and throat thickness of fillet welds Range of qualification Dimensions in millimetres Thickness of test piece Throat thickness t Material thickness Single run Multi-run a t t t a a t t ≤ 3 0,7 to 2 0,75 to 1,5 No restriction t

# 3 < < 30 3 to 2

≥ 30 ≥5 Where a fillet weld is qualified by means of a butt weld test, the throat thickness range shall be based on the thickness of a the deposited weld metal. NOTE is the nominal throat thickness as specified in pWPS for the test piece. a In case of different material thicknesses, the range of qualification of both thicknesses of the test pieces shall be calculated separately.

### 8.3.3 Diameter of pipes and branch connections

D For level 1: The diameter is not an essential For level 2: The qualification of a welding procevariable. Any product form, i.e. plate, pipe, dure test on diameter shall include qualification forging or casting, qualifies for all product for diameters in the following ranges given in forms. Table 9. A butt weld qualification for pipes covers butt welds in plates. Qualification given for plates also covers pipes when the outside diameter is >500 mm or when the outside diameter is >150 mm welded in the PC, in PF rotated position or in PA rotated position. Table 9 — For level 2: Range of qualification for pipe and branch connection diameters Diameter of the test Range of qualification Dimensions in millimetres piece D D D ≥0,5 D NOTE 1 For hollow section other than circular (for example, elliptic), is the dimension of the smaller side. D NOTE 2 is the outside diameter for the pipe of a butt weld or the outside diameter of the branch pipe for a branch connection (see Figure 4, outside diameter 2).

### 8.3.4 Angle of branch connection

α For level 1: The angle of branch connection is not For level 2: A welding procedure test shall be caran essential variable. rαied out on a branch connection with angle (see Figure 4). A test piece maαde with a branchα angle ( ) between 60° and 90° in the procedure test qualifαies the angle 60° ≤ < 90°. An angle < 60° requires a separate test piece and qualifies angles from up to 90°.

| Thickness of test piece t | Range of qualification Dimensions in millimetres Throat thickness Material thickness Single run Multi-run |  |  |
| --- | --- | --- | --- |
| t | a t t | a a 0,75 to 1,5 | No restriction |
| t | t |  |  |
| ≤ 3 t | 0,7 to 2 |  |  |
| 3 < < 30 3 to 2 ≥ 30 ≥5 Where a fillet weld is qualified by means of a butt weld test, the throat thickness range shall be based on the thickness of a the deposited weld metal. NOTE is the nominal throat thickness as specified in pWPS for the test piece. a |  |  |  |

| Diameter of the test piece | Range of qualification Dimensions in millimetres |
| --- | --- |
| D | D |
| D ≥0,5 D NOTE 1 For hollow section other than circular (for example, elliptic), is the dimension of the smaller side. D |  |

<!-- Pagina 36 (motore: pdfplumber) -->

## 8.4 Common to all welding procedures

### 8.4.1 Welding processes

For level 1: The degree of mechanization is not an For level 2: Each degree of mechanization shall be essential variable. qualified independently (manual, partly mechanized, fully mechanized and automatic). The qualification is only valid for the welding process(es) used in the welding procedure test. For multi-process procedures, the welding procedure qualification may be carried out with separate welding procedure tests for each welding process. It is also possible to make the welding procedure test as a multi-process procedure test. For level 1: Where more than one process or For level 2: When the test piece is welded with consumable are used in a single test piece, each more than one welding process, the procedure is process and consumable may be used individually valid only for the sequence of processes used on or in different combinations, provided: the test piece. Test specimens shall include deposited material from each welding process used.

a) the variables associated with each process

and consumable are addressed in the pWPS; Back run is permitted using one of the welding processes used in the qualification.

b) the parent material and deposited metal

thickness limits of Table 7 for each process and If a single process of a multi-process qualification is consumable are restricted in the pWPS to the used in production, this single process shall be testthickness limits qualified. ed individually in accordance with the standard.

### 8.4.2 Welding positions

When neither impact nor hardness requirements are specified, welding of the test piece in any position (pipe or plate) qualifies for welding in all positions (pipe or plate). For qualification of all welding positions, the following requirements shall be fulfilled: — specimens for impact test shall be taken from the weld in the highest heat input position; — specimens for hardness test shall be taken from the weld in the lowest heat input position. To satisfy both hardness and impact requirements, two test pieces in different welding positions are required, unless a single position qualification is required or in case of when a fixed pipe is used for the qualification. Where qualification is required for all positions, both test pieces shall be subjected to full visual testing and further non-destructive methods. Vertical down welding (welding positions PG, PJ and J-L045) shall be qualified by a specific test piece. For material of group 10, the lowest and highest heat input positions shall be subjected to impact testing. NOTE For example, for butt welds in plate, the highest heat input position is normally PF and PA and the lowest heat input position is PC and PE.

<!-- Pagina 37 (motore: pdfplumber) -->

### 8.4.3 Type of joint/weld

For level 1: The range of qualification for the type For level 2: The range of qualification for the type of welded joints is as used in the welding pro- of welded joints is as used in the welding procedure test subject to limitations given in other cedure test subject to limitations given in other clauses (e.g. thickness) and additionally: clauses (e.g. thickness) and additionally:

a) full penetration butt welds qualify full and a) butt welds qualify full and partial penetration

partial penetration butt welds and fillet welds in butt welds and fillet welds, while fillet weld tests any type of joints; are required where T-joints are performed by fillet welds or partial penetration butt welds in the preb) butt joints qualify any branch connections; dominant form of welded connections in

c) fillet welds qualify fillet welding only; relation to the design and production welding;

d) welds made from one side without backing b) full penetration butt welds qualify full and

qualify welds made from both sides and welds partial penetration butt welds and fillet welds in with backing; any type of joints; α α

e) welds made with backing qualify welds made c) butt joints in pipe qualify branch connections

from both sides and welds made without backing; with an angle ≥ 60° (see Figure 4 for );

f) welds made from both sides without gouging d) butt welds in T-joints with full penetration

qualify welds made from both sides with gouging; qualify full and partial penetration butt welds in T-joints and fillet welds but not vice versa;

g) welds made from both sides with or without

gouging qualify welds made from one side with e) fillet welds qualify fillet welding only; backing;

f) welds made from one side without backing

h) when impact or hardness requirements apply, qualify welds made from both sides and welds with

it is not permitted to change a multi-run deposit backing; into a single run deposit (or single run on each

g) welds made with backing qualify welds made

side) or vice versa for a given process; from both sides;

i) build-up welding. Build up is qualified by butt

h) welds made from both sides without removing

weld test piece. the root qualify welds made from both sides with removing the root (except thermal gouging);

i) welds made from both sides with or without

gouging qualify welds made from one side with backing;

j) when impact or hardness requirements apply, it

is not permitted to change a multi-run deposit into a single run deposit (or single run on each side) or vice versa for a given process;

k) build-up welding. Build up is qualified by butt

weld test piece;

l) buttering shall be performed by a separate test

piece in combination with the butt weld.

<!-- Pagina 38 (motore: pdfplumber) -->

### 8.4.4 Filler material, manufacturer/trade name, designation

For level 1: A change from one filler metal For level 2: Filler materials cover other filler F-number as shown in Table A.1 to another or a materials as long as, according to the designation change in the weld metal chemical analysis from in the appropriate international standard for the one A-number shown in Table A.2 to another or filler material, they have equivalent mechanical a change in the manufacturer or the manufactur- properties, same type of covering or flux core, er’s trade name when the filler metal does not same nominal chemical composition and the same conform to an F-number and an A-number or lower hydrogen content. requires a separate qualification. When impact testing is required by the When the WPS is to be qualified for impact-tested application standard at temperatures less than applications, a change in the filler metal classifica- −20 °C, for processes 111, 114, 12, 136 and 132 tion within a filler metal specification or to a filler according to ISO 4063, the range of validity is metal not covered by a filler metal specification, restricted to the manufacturer trade name of the or from one filler metal not covered by a filler filler material used in the procedure test. In this metal specification to another filler metal that is case, it is also permissible to change the manufacnot covered by a filler metal specification, turer of filler material to another with the same requires a re-qualification. When a filler metal compulsory part of the designation provided one conforms to a filler metal classification within a additional test piece is welded using the maximum filler metal specification, re-qualification is not heat input qualified and only weld metal impact required if a change is made in any of the test specimens shall be tested. This does not apply following: to solid wire and rods with the same designation and nominal chemical compositions.

a) from a filler metal that is designated as

moisture-resistant to one that is not designated as moisture-resistant and vice versa;

b) from one diffusible hydrogen level to another;

c) for carbon, low alloy, and stainless steel filler

metals having the same minimum tensile strength and the same nominal chemical composition, a change from one low hydrogen coating type to another low hydrogen coating type;

d) from one position-usability designation to

another for flux-cored electrodes;

e) from a classification that requires impact

testing to the same classification which has a suffix which indicates that impact testing was performed at a lower temperature or exhibited greater toughness at the required temperature or both, as compared to the classification which was used during procedure qualification; from the classification qualified to another filler metal within the same filler metal specification when weld metal impact testing is not required by the application standards.

### 8.4.5 Filler material size

It is permitted to change the size of filler material provided that the requirements of 8.4.7 are satisfied. NOTE When neither impact nor hardness testing is required, there is no limitation on filler material size.

<!-- Pagina 39 (motore: pdfplumber) -->

### 8.4.6 Type of current

The qualification is given for the type of current [alternating current (AC), direct current (DC), pulsed current] and polarity used in the welding procedure test. For process 111, alternating current also qualifies direct current (both polarities) unless impact testing is required.

### 8.4.7 Heat input (arc energy)

The heat input can be replaced by arc energy (J/mm). The arc energy shall be calculated in accordance with ISO/TR 18491. When using the calculation for the heat input, the k-factor according to ISO/TR 17671-1 shall be considered. The kind of calculation, either heat input or arc energy, shall be documented. For level 1: When impact requirements apply, the For level 2: When impact requirements apply, the upper limit of heat input qualified is the maximum upper limit of the heat input qualified is 25 % heat input used when welding the test piece. greater than used in welding the test piece. When hardness requirements apply, the lower limit of the heat input qualified is 25 % lower than that used in welding the test piece. If welding procedure test has been performed at both a high and a low heat input level, then all intermediate heat input levels are also qualified. It is not necessary to calculate every run. For covered electrode, the heat input average shall be calculated for each used diameter in order to define the qualified heat input. For process 111, the heat input may also be measured by the run out length per unit length of electrode. When the welding time is too short and when the length of the weld is not significant (e.g. for small repair, for tack welds), the heat input need not to be verified; only the adjustable parameters should be checked like amperage and/or voltage. Arc energy and heat input are measures of the heat generated by the arc. Whereas, in the past, these were different terms for the same measure, they are now calculated in different ways. Either arc energy or heat input may be used for welding control, calculated in accordance with ISO/TR 18491.

### 8.4.8 Preheat temperature

A decrease of more than 50 °C from the recorded preheating temperature on the WPQR requires a requalification. A decrease of the preheating temperature is permitted only if the requirements concerning preheating (especially the combined thickness) are fulfilled, e.g. ISO/TR 17671-2. The pre-heat temperature may be specified, e.g. by a material data sheet, and will depend on the material thickness.

### 8.4.9 Interpass temperature

An increase of more than 50 °C in the maximum interpass temperature reached in the welding procedure test shall require re-qualification. An increased preheat temperature intentionally applied during welding of the capping passes to reduce hardness in HAZ of a welding procedure test shall be considered as an essential variable. Both minimum preheat temperature applied and the preheating temperatures applied during welding of the capping passes shall be reported.

<!-- Pagina 40 (motore: pdfplumber) -->

For level 1: This limitation does not apply when For level 2: The upper limit of the qualification is impact test is not required. the highest interpass temperature reached in the welding procedure test for material groups 8, 10 and 41 to 48. This limitation does not apply when a WPS qualified with a PWHT above the upper transformation temperature or when an austenitic material is solution annealed after welding.

### 8.4.10 Post-heating for hydrogen release

For level 1: Post-heating for hydrogen release is For level 2: The temperature and duration of not an essential variable. post-heating for hydrogen release shall not be reduced. Post-heating shall not be omitted, but may be added.

### 8.4.11 Heat-treatment

Addition or deletion of post-weld heat-treatment is not permitted. A separate procedure qualification is required for each of the following conditions:

a) For ISO/TR 15608 groups 1, 2, 3, 4, 5, 6, 7, 9, 10 and 11 materials, the following PWHT conditions

apply:

1) PWHT below the lower transformation temperature (e.g. stress relieving);

2) PWHT above the upper transformation temperature (e.g. normalizing);

3) PWHT above the upper transformation temperature followed by heat treatment below the

lower transformation temperature (e.g. normalizing or quenching followed by tempering);

4) PWHT between the upper and lower transformation temperatures.

For level 2: The temperature range validated is the holding temperature used in the welding procedure test ± 20 °C unless otherwise specified. Where required, heating rates, cooling rates and holding time shall be related to the product.

b) For all other materials, PWHT within a specified temperature range applies.

## 8.5 Specific to processes

### 8.5.1 Submerged arc welding (process 12)

A change as described below requires a re-qualification.

<!-- Pagina 41 (motore: pdfplumber) -->

For level 1: For level 2:

a) A change in the minimum tensile strength a) Each variant of process 12 (121 to 126) shall be

when the flux/wire combination is classified in qualified independently. Any change in the number filler metal specification. A change in either the of electrodes requires re-qualification. Any addition flux trade name or wire trade name when neither or deletion of wires (cold wire or hot wire) shall the flux nor the wire is classified. A change in the require re-qualification. Also, a change of more flux trade name when the wire is classified but the than ±10 % of the ratio of the supplementary filler flux is not. material to the electrode requires re-qualification.

b) A change in the flux trade name for A-No. 8 b) The qualification of the welding procedure

or 9 deposits, as shown in Table A.2. test is restricted to manufacturer, trade name and designation of the flux used in the test.

c) If the weld metal alloy content is dependent

upon the composition of the flux, any change in c) When flux from re-crushed slag is used, each the welding procedure which would result in the batch or blend requires a new qualification test. important weld metal alloying elements being outside the specified chemical composition range of the WPS.

d) An addition or deletion of supplementary

filler metal (powder or wire), or a change of more than ±10 % in the ratio of electrode to supplemental filler material.

e) A change in flux type (i.e. neutral to active or

vice versa) for multi-run welds for material groups

# 1 and 11 according to ISO/TR 15608.

f) When flux from re-crushed slag is used, each

batch or blend shall be tested in accordance with the filler metal specification requirements by either the manufacturer or user, or qualified as an unclassified flux as required by a).

g) When the WPS is to be qualified for impact-tested applications, re-qualification is required if there is a change in the flux/wire classification or a change in either the electrode or flux

trade name when not classified in a filler metal specification. Re-qualification is not required when a wire/flux combination conforms to a filler metal specification and a change is made from one diffusible hydrogen level to another. This variable does not apply when the weld metal is exempt from impact testing by other application standards.

### 8.5.2 Gas-shielded metal arc welding (process 13)

#### 8.5.2.1 Shielding gases

The qualification is restricted to nominal composition of the shielding gas used in the procedure test. The designation of ISO 14175 may be used to specify the shielding gas composition, e.g. ISO 14175:2008-M21-ArC-18. A deviation of max. ±20 % (relative) of the nominal composition of the CO2 content is allowed. However, an intentional addition or deletion of maximum 0,1 % of any gas component does not require a new welding procedure test.

<!-- Pagina 42 (motore: pdfplumber) -->

#### 8.5.2.2 Process variants

A change as described below requires a re-qualification. For level 1: The addition, deletion, or change of For level 2: The qualification given is restricted more than 10 % in the volume of supplemental to the wire system used in the welding procedure filler metal. Where the alloy content of the weld test (e.g. single-wire or multiple-wire system). metal is largely dependent upon the composition of the supplemental filler metal, any change in any part of the welding procedure that would result in the important alloying elements in the weld metal being outside of the specification range of chemistry given in the welding procedure specification. When the WPS is to be qualified for impact-tested applications, re-qualification is required if there is a change from single electrode to multiple electrode acting in the same weld pool or vice versa.

#### 8.5.2.3 Transfer mode

<!-- Revisione A1:2019 (pymupdf p.42): testo tra tag A1; subito dopo «Text deleted» — le sotto-clausole 8.5.2.3.1–8.5.2.3.4 (General / Waveform controlled / Pulsed / without pulsed) dell'ed. 2017 senza A1 (NORMA_00019) risultano eliminate dall'amendment. -->

For solid and metal cored wires, the qualification using short circuiting transfer qualifies only short-circuiting transfer. Qualification using spray, pulse or globular transfer qualifies spray, pulse and globular transfer.

**[A1:2019 — Text deleted]** (sotto-clausole 8.5.2.3.1–8.5.2.3.4 dell'edizione 2017).

<!-- Pagina 43 (motore: pdfplumber) -->

### 8.5.3 Gas-shielded arc welding with non-consumable electrode (process 14)

#### 8.5.3.1 Shielding gases

The qualification is restricted to nominal composition of the shielding gas used in the procedure test. The designation of ISO 14175 may be used to specify the shielding gas composition, e.g. ISO 14175:2008-I3- ArHe-30. A deviation of max. ±10 % (relative) of the nominal composition of the helium content is allowed. However, an intentional addition or deletion of maximum 0,1 % of any gas component does not require a new welding procedure test.

#### 8.5.3.2 Filler material

Welding with filler material does not qualify for welding without filler material or vice versa.

### 8.5.4 Plasma arc welding (process 15)

Qualification of the welding procedure is restricted to the nominal composition of plasma gas used in the welding procedure test. The qualification is restricted to nominal composition of the shielding gas used in the procedure test. Welding with filler material does not qualify for welding without filler material or vice versa. If impact tests are required, a change in the type of joint preparation (groove) requires a re-qualification.

### 8.5.5 Oxy-acetylene welding (process 311)

Welding with filler material does not qualify for welding without filler material or vice versa.

### 8.5.6 Backing gas

For level 1: For material groups 7.1 and 41 to 48, For level 2: A butt weld procedure test made deletion of backing gas or change in the backing without backing gas qualifies a welding procedure gas nominal composition from an inert gas to with group I, N1, N2 and N3 backing gas according a mixture including non-inert gas(es) requires to ISO 14175, but not vice versa. re-qualification. For material groups 7.1 and 41 Main group of backing gas covers all sub-groups of to 48, addition of backing gas does not require the same main group (classification according to re-qualification. For all other material groups, ISO 14175). the addition or deletion of backing gas does not require re-qualification. For material groups 1 to 6 according to ISO/ TR 15608, a change between group I, N1, N2 and N3 backing gas does not require re-qualification. For material groups 8 and 41 to 48, a change between group I, N and R backing gas does not require re-qualification. Any change in the backing gas classification for material groups 7 and 10 requires re-qualification. If production welds are made on material backing support with a thickness greater than 5 mm, the deletion of backing gas is acceptable.

# 9 Welding procedure qualification record (WPQR)

The WPQR is a statement of the results of assessing each test piece including re-tests. The relevant items listed for the WPS in the relevant part of ISO 15609 shall be included, together with details of

<!-- Pagina 44 (motore: pdfplumber) -->

any features that would be rejectable by the requirements of Clause 7. If no rejectable features or unacceptable test results are found, a WPQR detailing the welding procedure test piece results is qualified and shall be signed and dated by the examiner or the examining body. For level 1: A WPQR format shall be used to For level 2: A WPQR format shall be used to record record details and level for the welding procedure details, range of qualification and level for the and the test results, in order to facilitate uniform welding procedure and the test results, in order to presentation and assessment of the data. facilitate uniform presentation and assessment of the data. If required by an application standard or a specification, for example, the certificates of base metals and welding consumables shall be added to the WPQR. An example of WPQR format is shown in Annex B.

<!-- Pagina 45 (motore: pdfplumber) -->

## Annex A

Filler ma(nteorrimala, tdivees)i gnation Table A.1 — For level 1: Grouping of filler metals and electrodes for qualification (grouping of welding electrodes and rods for qualification) Steels F-No. International A B Standard Classification by yield strength (or Classification by tensile strength (or nom. comp.) alloy type)

# 1 ISO 2560 EXXxA13,EXXxA33,EXXxRR4,EXXx- EXX20, EXX24,EXX27, EXX28

RA54, EXXxB53 ISO 3581 EXX XX Bx3, EXX XX Rx3 ESXXX(X)-25, ESXXX(X)-26 ISO 2560 EXXxMo EXX20–1M3, EXX27–1M3

# 2 ISO 2560 EXXxR12, EXXxR32, EXXxRA12 EXX12, EXX13, EXX14, EXX19

## ISO 2560 — EXX13-XX

# 3 ISO 2560 EXXxC21, EXXxC11 EXX10, EXX11

ISO 2560 EXXxMoC21, EXXxMoC11 EXX10-XX, EXX11-XX

# 4 ISO 2560 EXXxB22,EXXxB12,EXXxB32, EXXxB35 EXX15, EXX16, EXX18, EXX48

ISO 3581 other than E13 XX Bx1, E13 XX Rx1 ES4XX(X)-15, ES4XX(X)-16, ES4XX- austenitic and duplex (X)-17 E17 XX Bx1, E17 XX Rx1

## ES6XX(X)-15, ES6XX(X)-16, ES6XX-

(X)-17

## ISO 3580 E XXX B EXX15-XX, EXX16-XX, EXX18-XX

ISO 18275 EXXXx1.5NiMo B EXX18-N3M1, EXX18-N3M2 ISO 2560 EXXxMn2NiCrMo B, EXXxMn2Ni1CrMo EXX18-N4CM2, EXX18-N4CM2M2 B

## ISO 18275

# 5 ISO 3581 austenitic EXX XX Bx1, EXX XX Rx1 ESXXX(X)-15, ESXXX(X)-16, ESXXX-

and duplex (X)-17

# 6 ISO 14343 All classifications All classifications

ISO 14171 All classifications All classifications ISO 14341 All classifications All classifications ISO 636 All classifications All classifications ISO 17632 All classifications All classifications ISO 17633 All classifications All classifications ISO 24598 All classifications All classifications ISO 26304 All classifications All classifications ISO 16834 All classifications All classifications ISO 21952 All classifications All classifications ISO 17634 All classifications All classifications ISO 18276 All classifications All classifications

| Steels |  |  |  |
| --- | --- | --- | --- |
| F-No. | International Standard | A Classification by yield strength (or nom. comp.) | B Classification by tensile strength (or alloy type) |
| 1 |  |  |  |
|  | ISO 2560 | EXXxA13,EXXxA33,EXXxRR4,EXXx- | EXX20, EXX24,EXX27, EXX28 |
|  |  | RA54, EXXxB53 |  |
|  | ISO 3581 | EXX XX Bx3, EXX XX Rx3 | ESXXX(X)-25, ESXXX(X)-26 |
|  | ISO 2560 | EXXxMo | EXX20–1M3, EXX27–1M3 |
| 2 | ISO 2560 | EXXxR12, EXXxR32, EXXxRA12 | EXX12, EXX13, EXX14, EXX19 |
|  | ISO 2560 | — | EXX13-XX |
| 3 4 | ISO 2560 | EXXxC21, EXXxC11 | EXX10, EXX11 |
|  | ISO 2560 ISO 2560 ISO 3581 other than austenitic and duplex | EXXxMoC21, EXXxMoC11 EXXxB22,EXXxB12,EXXxB32, EXXxB35 E13 XX Bx1, E13 XX Rx1 E17 XX Bx1, E17 XX Rx1 | EXX10-XX, EXX11-XX EXX15, EXX16, EXX18, EXX48 ES4XX(X)-15, ES4XX(X)-16, ES4XX- (X)-17 |
|  | ISO 3580 ISO 18275 ISO 2560 | E XXX B EXXXx1.5NiMo B EXXxMn2NiCrMo B, EXXxMn2Ni1CrMo | ES6XX(X)-15, ES6XX(X)-16, ES6XX- (X)-17 EXX15-XX, EXX16-XX, EXX18-XX EXX18-N3M1, EXX18-N3M2 EXX18-N4CM2, EXX18-N4CM2M2 |
|  | ISO 18275 | B |  |
| 5 6 | ISO 3581 austenitic | EXX XX Bx1, EXX XX Rx1 | ESXXX(X)-15, ESXXX(X)-16, ESXXX- |
|  | and duplex |  | (X)-17 |
|  | ISO 14343 | All classifications | All classifications |
|  | ISO 14171 | All classifications | All classifications |
|  | ISO 14341 | All classifications | All classifications |
|  | ISO 636 | All classifications | All classifications |
|  | ISO 17632 | All classifications | All classifications |
|  | ISO 17633 | All classifications | All classifications |
|  | ISO 24598 | All classifications | All classifications |
|  | ISO 26304 | All classifications | All classifications |
|  | ISO 16834 | All classifications | All classifications |
|  | ISO 21952 | All classifications | All classifications |

<!-- Pagina 46 (motore: pdfplumber) -->

Table A.1 (continued) Nickel and nickel alloys F-No. International Classification Standard

# 41 ISO 14172 ENi 2061

ISO 18274 SNi 2061

# 42 ISO 14172 ENi 4060

ISO 18274 SNi 4060, SNi 5504

# 43 ISO 14172 ENi 6062, ENi 6133, ENi 6182, ENi 6093, ENi 6152, ENi 6094, ENi 6095, ENi

6025, ENi 6002, ENi 6625, ENi 6276, ENi 6275, ENi 6620, ENi 6455, ENi 6022, ENi 6627, ENi 6059, ENi 6686, ENi 6200, ENi 6650, ENi 6117 ISO 18274 SNi 6082, SNi 6072, SNi 6076, SNi 6062, SNi 7092, SNi 6052 SNi 7069, SNi 6601, SNi 6025, SNi 6693, SNi 6002, SNi 6625, SNi 6276, SNi 6455, SNi 6022, SNi 6059, SNi 6686, SNi 6057, SNi 6200, SNi 6650, SNi 6660, SNi 6205, SNi 6231, SNi 6617

# 44 ISO 14172 ENi 1001, ENi 1004, ENi 1066, ENi 1008, ENi 1009, ENi 1067, ENi 1069

ISO 18274 SNi 1001, SNi 1003, SNi 1004, SNi 1066, SNi 1008, SNi 1009, SNi 1067, SNi 1069

# 45 ISO 14172 ENi 6985, ENi 6030

ISO 18274 SNi 6975, SNi 6985, SNi 6030, SNi 8065

# 46 ISO 18274 SNi 6160

Table A.2 — For level 1: Grouping of ferrous weld metal by chemical analysis (not applicable to nonferrous materials) Chemical composition, weight percent A-No. Type of weld metal C Cr Mo Ni Man Si

# 1 Mild steel (non-alloy steel) 0,20 0,20 0,30 0,50 1,60 1,00

# 2 Carbon-molybdenum 0,15 0,50 0,40 to 0,65 0,50 1,60 1,00

Chrome (0,4 % to 2 %)-molyb-

# 3 0,15 0,40 to 2,00 0,40 to 0,65 0,50 1,60 1,00

denum Chrome (2 % to 4 %)-molybde-

# 4 0,15 2,00 to 4,00 0,40 to 1,50 0,50 1,60 2,00

num Chrome (4 % to 10,5 %)-mo-

# 5 0,15 4,00 to 10,50 0,40 to 1,50 0,80 1,20 2,00

lybdenum

# 6 Chrome-martensitic 0,15 11,00 to 15,00 0,70 0,80 2,00 1,00

# 7 Chrome-ferritic 0,15 11,00 to 30,00 1,00 0,80 1,00 3,00

# 8 Chromium-nickel 0,15 14,50 to 30,00 4,00 7,50 to 15,00 2,50 1,00

15,00 to

# 9 Chromium-nickel 0,30 19,00 to 30,00 6,00 2,50 1,00

37,00

# 10 Nickel to 4 % 0,15 0,50 0,55 0,80 to 4,00 1,70 1,00

# 11 Manganese-molybdenum 0,17 0,50 0,25 to 0,75 0,85 1,25 to 2,25 1,00

# 12 Nickel-chrome-molybdenum 0,15 1,50 0,25 to 0,80 1,25 to 2,80 0,75 to 2,25 1,00

a Single values are maximum values. NOTE Only listed elements are used to determine A-numbers.

| Nickel and nickel alloys |  |  |
| --- | --- | --- |
| F-No. | International Standard | Classification |
|  |  |  |
|  |  |  |
| 41 | ISO 14172 | ENi 2061 |
|  | ISO 18274 | SNi 2061 |
| 42 43 | ISO 14172 ISO 18274 ISO 14172 | ENi 4060 SNi 4060, SNi 5504 ENi 6062, ENi 6133, ENi 6182, ENi 6093, ENi 6152, ENi 6094, ENi 6095, ENi |
|  | ISO 18274 | 6025, ENi 6002, ENi 6625, ENi 6276, ENi 6275, ENi 6620, ENi 6455, ENi 6022, ENi 6627, ENi 6059, ENi 6686, ENi 6200, ENi 6650, ENi 6117 SNi 6082, SNi 6072, SNi 6076, SNi 6062, SNi 7092, SNi 6052 SNi 7069, SNi 6601, |
|  |  | SNi 6025, SNi 6693, SNi 6002, SNi 6625, SNi 6276, SNi 6455, SNi 6022, SNi 6059, |
|  |  | SNi 6686, SNi 6057, SNi 6200, SNi 6650, SNi 6660, SNi 6205, SNi 6231, SNi 6617 |
| 44 | ISO 14172 | ENi 1001, ENi 1004, ENi 1066, ENi 1008, ENi 1009, ENi 1067, ENi 1069 |
|  | ISO 18274 | SNi 1001, SNi 1003, SNi 1004, SNi 1066, SNi 1008, SNi 1009, SNi 1067, SNi 1069 |
| 45 | ISO 14172 | ENi 6985, ENi 6030 |

| Chemical composition, weight percent A-No. Type of weld metal C Cr Mo Ni Man Si |
| --- |
| 1 Mild steel (non-alloy steel) 0,20 0,20 0,30 0,50 1,60 1,00 2 Carbon-molybdenum 0,15 0,50 0,40 to 0,65 0,50 1,60 1,00 Chrome (0,4 % to 2 %)-molyb- 3 0,15 0,40 to 2,00 0,40 to 0,65 0,50 1,60 1,00 denum Chrome (2 % to 4 %)-molybde- 4 0,15 2,00 to 4,00 0,40 to 1,50 0,50 1,60 2,00 num Chrome (4 % to 10,5 %)-mo- 5 0,15 4,00 to 10,50 0,40 to 1,50 0,80 1,20 2,00 lybdenum 6 Chrome-martensitic 0,15 11,00 to 15,00 0,70 0,80 2,00 1,00 7 Chrome-ferritic 0,15 11,00 to 30,00 1,00 0,80 1,00 3,00 8 Chromium-nickel 0,15 14,50 to 30,00 4,00 7,50 to 15,00 2,50 1,00 15,00 to 9 Chromium-nickel 0,30 19,00 to 30,00 6,00 2,50 1,00 37,00 10 Nickel to 4 % 0,15 0,50 0,55 0,80 to 4,00 1,70 1,00 |
| 11 Manganese-molybdenum 0,17 0,50 0,25 to 0,75 0,85 1,25 to 2,25 1,00 12 Nickel-chrome-molybdenum 0,15 1,50 0,25 to 0,80 1,25 to 2,80 0,75 to 2,25 1,00 a Single values are maximum values. |

<!-- Pagina 47 (motore: pdfplumber) -->

## Annex B

Welding procedure q(uinafloifrimcaattiiovne) r ecord form (WPQR) Welding procedure qualification — Test certificate Manufacturer’s WPQR no.: Examiner or examining body: Manufacturer: Reference no.: Address: Code/testing standard: Level: Date of welding:

<!-- Pagina 48 (motore: pdfplumber) -->

Test piece Range of qualification Product form: Welding process(es): Welding processes used No. 1 No. 2 No. 3 Process Deposited metal thickness (mm): Type of joint and weld: Parent material group(s) and sub-group(s): Parent material thickness (mm): Throat thickness (mm): Single layer/multi-run: Outside pipe diameter (mm): Filler material designation: Filler material make: Filler material size: Designation of shielding gas/flux: Designation of backing gas: Type of welding current and polarity: Transfer mode: Heat input: Welding positions: Preheat temperature: Interpass temperature: Post-heating: Post-weld heat-treatment: Other information (see also 8.5): We confirm that the statements in this record are correct and that the test pieces were prepared, welded, tested and have fulfilled the requirements in accordance with ISO 15614-1. ……………………………………. ……………………………………………… ……………………………………………………………… Location Date of issue Examiner or examining body Name, date and signature

|  |  |  |  |
| --- | --- | --- | --- |
| Welding proc | ess(es): |  |  |
|  | Weld | ing processe | s used |
| Process Deposited metal thick- | No. 1 | No. 2 | No. 3 |

<!-- Pagina 49 (motore: pdfplumber) -->

Record of weld test Location: Examiner or examining body: Manufacturer’s pWPS no.: Method of preparation and cleaning: Manufacturer's WPQR no.: Parent material specification: Manufacturer: Material thickness (mm): Welder’s/operator's name: Outside pipe diameter (mm): Joint type and weld: Welding position: Weld preparation details (sketch)*: Joint design Welding sequences Welding details Run Welding Size of Current Voltage Type of Wire feed Travel Heat Metal process filler current/ speed speed* input* transfer A V material polarity Filler material designation and make: Other information*, e.g.: Any special baking or drying: Weaving (maximum width of run): Gas/flux — shielding: Oscillation: amplitude, frequency, dwell time Backing: Pulse welding details: Gas flow rate — shielding: Distance contact tube/workpiece: Backing: Plasma welding details: Tungsten electrode type/size: Torch angle: Details of back gouging/backing: Preheat temperature: Interpass temperature: Post-heating: Post-weld heat treatment (PWHT): (Time, temperature, method: heating and cooling rates*): ………………………………………………………………………… ………………………………………………………………………… Manufacturer Examiner or examining body Name, date and signature Name, date and signature *If required

|  |  |
| --- | --- |
| Weld preparation details (sketch)*: Joint design | Welding sequences |

| Weldi Run | ng details Welding | Size of | Current | Voltage | Type of | Wire feed | Travel | Heat | Metal |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
|  | process | filler material | A | V | current/ polarity | speed | speed* | input* | transfer |

<!-- Pagina 50 (motore: pdfplumber) -->

Test results Manufacturer’s WPQR no.: Examiner or examining body: Visual: Reference no.: Penetrant/magnetic particle testing*: Radiographic testing*: Ultrasonic testing*: Temperature: Tensile tests Type/no. Re Rm A % on Z % Fracture location Remarks MPa MPa Requirement Bend tests Former diameter Type/no. Bend angle Elongation* Results Macroscopic examination (add photograph/image) Impact test* Type Size Requirement Values Notch location/direction Temp. 1 2 3 Average Remarks °C Hardness Test* (type/load) Location of measurements (Sketch*) Parent metal:

## HAZ:

Weld metal:

| Tensile tests Type/no. | Re | Rm | A % on | Z % | Fracture location | Remarks |
| --- | --- | --- | --- | --- | --- | --- |
|  |  |  |  |  |  |  |
| Requirement | MPa | MPa |  |  |  |  |

|  |  |  |  |
| --- | --- | --- | --- |
| Bend tests Type/no. | Bend angle | Former diameter Elongation* | Results |

| Impact test* | Type | Size Values |  | Requirement |
| --- | --- | --- | --- | --- |
| Notch location/direction | Temp. °C | 1 2 3 | Average | Remarks |

<!-- Pagina 51 (motore: pdfplumber) -->

Other tests: Remarks: Tests carried out in accordance with the requirements of: Laboratory report reference no.: Test results were acceptable/not acceptable: (Delete as appropriate) Test carried out in the presence of: *If required …………………………………………………………………………… Examiner or examining body

<!-- Pagina 52 (motore: pdfplumber) -->

## Bibliography

Qualification testing of welders — Fusion welding — Part 1: Steels [1] ISO 9606-1, Approval testing of welders — Fusion welding — Part 4: Nickel and nickel alloys [2] ISO 9606-4, Welding and allied processes — Types of joint preparation — Part 1: Manual metal arc welding, gas-shielded metal arc welding, gas welding, TIG welding and beam welding of steels [3] ISO 9692-1, Welding and allied processes — Joint preparation — Part 2: Submerged arc welding of steels [4] ISO 9692-2, Welding personnel — Qualification testing of welding operators and weld setters for mechanized and automatic welding of metallic materials [5] ISO 14732, Specification and qualification of welding procedures for metallic materials — General rules [6] ISO 15607, Non-destructive testing of welds — General rules for metallic materials [7] ISO 17635, Welding, Brazing, and Fusing Qualifications [8] ASME BPVC, SectiWone lIdXin, g — Recommendations for welding of metallic materials — Part 2: Arc welding of ferritic steels [9] ISO/TR 17671-2,

<!-- Pagina 53 (motore: pdfplumber) -->

This page deliberately left blank

<!-- Pagina 54 (motore: pdfplumber) -->

## NO COPYING WITHOUT BSI PERMISSION EXCEPT AS PERMITTED BY COPYRIGHT LAW

## British Standards Institution (BSI)

## BSI is the national body responsible for preparing British Standards and other

## standards-related publications, information and services.

## BSI is incorporated by Royal Charter. British Standards and other standardization

## products are published by BSI Standards Limited.

## About us Reproducing extracts

We bring together business, industry, government, consumers, innovators For permission to reproduce content from BSI publications contact the BSI and others to shape their combined experience and expertise into standards Copyright and Licensing team. -based solutions.

## Subscriptions

The knowledge embodied in our standards has been carefully assembled in a dependable format and refined through our open consultation process. Our range of subscription services are designed to make using standards Organizations of all sizes and across all sectors choose standards to help easier for you. For further information on our subscription products go to bsigroup. them achieve their goals. com/subscriptions. With British Standards Online (BSOL) you’ll have instant access to over 55,000

## Information on standards

British and adopted European and international standards from your desktop. We can provide you with the knowledge that your organization needs It’s available 24/7 and is refreshed daily so you’ll always be up to date. to succeed. Find out more about British Standards by visiting our website at You can keep in touch with standards developments and receive substantial bsigroup.com/standards or contacting our Customer Services team or discounts on the purchase price of standards, both in single copy and subscription Knowledge Centre. format, by becoming a BSI Subscribing Member. Buying standards PLUS is an updating service exclusive to BSI Subscribing Members. You will automatically receive the latest hard copy of your standards when they’re You can buy and download PDF versions of BSI publications, including British and revised or replaced. adopted European and international standards, through our website at bsigroup. com/shop, where hard copies can also be purchased. To find out more about becoming a BSI Subscribing Member and the benefits of membership, please visit bsigroup.com/shop. If you need international and foreign standards from other Standards Development Organizations, hard copies can be ordered from our Customer Services team. With a Multi-User Network Licence (MUNL) you are able to host standards publications on your intranet. Licences can cover as few or as many users as you

## Copyright in BSI publications wish. With updates supplied as soon as they’re available, you can be sure your

documentation is current. For further information, email cservices@bsigroup.com. All the content in BSI publications, including British Standards, is the property of and copyrighted by BSI or some person or entity that owns copyright in the Revisions information used (such as the international standardization bodies) and has Our British Standards and other publications are updated by amendment or revision. formally licensed such information to BSI for commercial publication and use. We continually improve the quality of our products and services to benefit your Save for the provisions below, you may not transfer, share or disseminate any business. If you find an inaccuracy or ambiguity within a British Standard or other portion of the standard to any other person. You may not adapt, distribute, BSI publication please inform the Knowledge Centre. commercially exploit or publicly display the standard or any portion thereof in any manner whatsoever without BSI’s prior written consent.

## Useful Contacts

## Storing and using standards

Customer Services Standards purchased in soft copy format: Tel: +44 345 086 9001

• A British Standard purchased in soft copy format is licensed to a sole named Email: cservices@bsigroup.com

user for personal or internal company use only.

## Subscriptions

• The standard may be stored on more than one device provided that it is Tel: +44 345 086 9001

accessible by the sole named user only and that only one copy is accessed at Email: subscriptions@bsigroup.com any one time.

• A single paper copy may be printed for personal or internal company use only. Knowledge Centre

Tel: +44 20 8996 7004 Standards purchased in hard copy format: Email: knowledgecentre@bsigroup.com

• A British Standard purchased in hard copy format is for personal or internal

company use only. Copyright & Licensing Tel: +44 20 8996 7070

• It may not be further reproduced – in any format – to create an additional copy.

This includes scanning of the document. Email: copyright@bsigroup.com If you need more than one copy of the document, or if you wish to share the BSI Group Headquarters document on an internal network, you can save money by choosing a subscription 389 Chiswick High Road London W4 4AL UK product (see ‘Subscriptions’).

## This page deliberately left blank
