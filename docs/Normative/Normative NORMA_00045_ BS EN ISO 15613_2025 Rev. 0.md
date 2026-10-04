> **Ruolo SGQ**: norma di **qualifica WPS mediante prova di saldatura di pre-produzione** (alternativa/complemento alla serie ISO 15614 quando il provino standard non rappresenta il giunto di produzione). Non è SGQ a clausole 4–10: **non** va in `import-norms-from-markdown.js` / seed `norm_requirements`. Uso primario: WPQR/WPS/fattibilità quando il certificato o la specifica cita ISO 15613.
> **Edizione**: ISO 15613:2025 (Second edition) / BS EN ISO 15613:2025 (settembre 2025; BSI 31 October 2025). **Sostituisce** ISO 15613:2004 / EN ISO 15613:2004. **Estratto operativo**: `docs/reference/ISO-15613-qualifica-pre-produzione.md`.
> **Schema JSON**: `norm-clause` `--standard-code ISO_15613_2025` — le clausole operative sono numerate 1–10 (come 15609/15614). Il sommario (Contents) è stato demosso da H1 a elenco, altrimenti il JSON duplicava i numeri di clausola senza testo.
> **Qualità estrazione (CLI 04/10/2026)**: 22 pagine; 21 con testo utile; motore `pdfplumber`; **ATTENZIONE** solo pagina 4 (copertina/verso vuoto, nessun requisito). Nessuna `Nota tecnica` pymupdf. Tabelle 1 e 2 ricostruite dal testo a flusso (griglia pdfplumber incompleta/avvolta). Annex ZA.2: edizioni mappate in tabella Markdown; alcune celle fuse (es. 15614-14 ↔ 15614-13) = **GAP**, non inventare. Pagina 21 duplicava §8–10 di pagina 20: duplicato omesso. Pagina copyright BSI (22) rumorosa (non normativa). Font BSI: qualche parola del National foreword e di §2 mescolata (`rCeoqnutersatc`, `edSpiteiocinfi`) — boilerplate noto, non soglie.
> **Catalogo JS**: no (procedura, non catalogo simboli). **ISO 14555 non è in Tabella 2**; lo Scope cita comunque stud welding. PDF **non** in Git.

<!-- Pagina 1 (motore: pdfplumber) -->

BSI Standards Publication Specification and qualification of welding procedures for metallic materials — Qualification based on a pre-production welding test

|  |  |  |  |  |
| --- | --- | --- | --- | --- |
|  |  |  |  |  |
| BSI Standards Publication |  |  |  |  |

<!-- Pagina 2 (motore: pdfplumber) -->

## BS EN ISO 15613:2025 BRITISH STANDARD

## National foreword

This British Standard is the UK implementation of EN ISO 15613:2025. It is identical to ISO 15613:2025. It supersedes BS EN ISO 15613:2004, which is withdrawn. The UK participation in its preparation was entrusted to Technical Committee WEE/36, Qualification of welding personnel and welding procedures. A list of organizations represented on this committee can be obtained on rCeoqnutersatc ttou iatls acnodm lmegitatel ec omnasnidaegrear.tions This publication has been prepared in good faith, however no representation, warranty, assurance or undertaking (express or implied) is or will be made, and no responsibility or liability is or will be accepted by BSI in relation to the adequacy, accuracy, completeness or reasonableness of this publication. All and any such responsibility and liability is expressly disclaimed to the full extent permitted by the law. This publication is provided as is, and is to be used at the recipient’s own risk. The recipient is advised to consider seeking professional guidance with respect to its use of this publication. This publication is not intended to constitute a contract. Users are responsible for its correct application. This publication has been prepared under a mandate given to the European Standards Organizations by the European Commission and the European Free Trade Association. It is intended to support requirements of the EU legislation detailed in the European Foreword. A European Annex, usually Annex ZA or ZZ, describes how this publication relates to that EU legislation. For the Great Britain market (England, Scotland and Wales), if UK Government has designated this publication for conformity with UKCA marking (or similar) legislation, it may contain an additional National Annex. Where such a National Annex exists, it shows the correlation between this publication and the relevant UK legislation. If there is no National Annex of this kind, the relevant Annex ZA or ZZ in the body of the European text will indicate the relationship to UK regulation applicable in Great Britain. References to EU legislation may need to be read in accordance with the UK designation and the applicable UK law. Further information on designated standards can be found at www. bsigroup.com/standardsandregulation. For the Northern Ireland market, UK law will continue to implement relevant EU law subject to periodic confirmation. Therefore Annex ZA/ZZ in the European text, and references to EU legislation, are still valid for this market. UK Government is responsible for legislation. For information on legislation and policies relating to that legislation, consult the relevant pages of www.gov.uk. © The British Standards Institution 2025 Published by BSI Standards Limited 2025

<!-- Pagina 3 (motore: pdfplumber) -->

## BRITISH STANDARD BS EN ISO 15613:2025

## ISBN 978 0 539 15543 3

ICCoSm 2p5l.1ia6n0c.1e0 with a British Standard cannot confer immunity from legal obligations. This British Standard was published under the authority of the Standards Policy and Strategy Committee on 31 October 2025. Amendments/corrigenda issued since publication Date Text affected

<!-- Pagina 4 (motore: pdfplumber) -- ATTENZIONE: testo di bassa qualita' (probabile font non standard), revisionare -->

<!-- Pagina 5 (motore: pdfplumber) -->

## EN ISO 15613

## EUROPEAN STANDARD

## NORME EUROPÉENNE

## EUROPÄISCHE NORM

## September 2025

ICS 25.160.10 Supersedes EN ISO 15613:2004

## English Version

## Specification and qualification of welding procedures for

metallic materials - Qualification based on a preproduction welding test (ISO 15613:2025) Descriptif et qualification d'un mode opératoire de Anforderung und Qualifizierung von Schweißverfahren soudage pour les matériaux métalliques - Qualification für metallische Werkstoffe - Qualifizierung aufgrund sur la base d'un assemblage soudé de préproduction einer vorgezogenen Arbeitsprüfung (ISO 15613:2025)

## (ISO 15613:2025)

This European Standard was approved by CEN on 17 August 2025. CEN members are bound to comply with the CEN/CENELEC Internal Regulations which stipulate the conditions for giving this European Standard the status of a national standard without any alteration. Up-to-date lists and bibliographical references concerning such national standards may be obtained on application to the CEN-CENELEC Management Centre or to any CEN member. This European Standard exists in three official versions (English, French, German). A version in any other language made by translation under the responsibility of a CEN member into its own language and notified to the CEN-CENELEC Management Centre has the same status as the official versions. CEN members are the national standards bodies of Austria, Belgium, Bulgaria, Croatia, Cyprus, Czech Republic, Denmark, Estonia, Finland, France, Germany, Greece, Hungary, Iceland, Ireland, Italy, Latvia, Lithuania, Luxembourg, Malta, Netherlands, Norway, Poland, Portugal, Republic of North Macedonia, Romania, Serbia, Slovakia, Slovenia, Spain, Sweden, Switzerland, Türkiye and United Kingdom.

## EUROPEAN COMMITTEE FOR STANDARDIZATION

## COMITÉ EUROPÉEN DE NORMALISATION

## EUROPÄISCHES KOMITEE FÜR NORMUNG

CEN-CENELEC Management Centre: Rue de la Science 23, B-1040 Brussels © 2025 CEN All rights of exploitation in any form and by any means reserved Ref. No. EN ISO 15613:2025 E worldwide for CEN national Members.

<!-- Pagina 6 (motore: pdfplumber) -->

## EN ISO 15613:2025 (E)

## European foreword

This document (EN ISO 15613:2025) has been prepared by Technical Committee ISO/TC 44 "Welding and allied processes" in collaboration with Technical Committee CEN/TC 121 “Welding and allied processes” the secretariat of which is held by AFNOR. This European Standard shall be given the status of a national standard, either by publication of an identical text or by endorsement, at the latest by March 2026, and conflicting national standards shall be withdrawn at the latest by March 2026. Attention is drawn to the possibility that some of the elements of this document may be the subject of patent rights. CEN shall not be held responsible for identifying any or all such patent rights. This document supersedes EN ISO 15613:2004. This document has been prepared under a standardization request addressed to CEN by the European Commission. The Standing Committee of the EFTA States subsequently approves these requests for its Member States. For the relationship with EU Legislation, see informative Annex ZA, which is an integral part of this document. Any feedback and questions on this document should be directed to the users’ national standards body/national committee. A complete listing of these bodies can be found on the CEN website. According to the CEN-CENELEC Internal Regulations, the national standards organizations of the following countries are bound to implement this European Standard: Austria, Belgium, Bulgaria, Croatia, Cyprus, Czech Republic, Denmark, Estonia, Finland, France, Germany, Greece, Hungary, Iceland, Ireland, Italy, Latvia, Lithuania, Luxembourg, Malta, Netherlands, Norway, Poland, Portugal, Republic of North Macedonia, Romania, Serbia, Slovakia, Slovenia, Spain, Sweden, Switzerland, Türkiye and the United Kingdom.

## Endorsement notice

The text of ISO 15613:2025 has been approved by CEN as EN ISO 15613:2025 without any modification.

<!-- Pagina 7 (motore: pdfplumber) -->

## EN ISO 15613:2025 (E)

## Annex ZA

## Relationship between this( iEnuforrompaetainve S)tandard and the Essential

## Requirements of EU Directive 2014/68/EU (PED) aimed to be covered

This European Standard has been prepared under a Commission’s standardization request M/601 to provide one voluntary means of conforming to Essential Safety Requirements of the New Approach Pressure Equipment Directive 2014/68/EU. Once this standard is cited in the Official Journal of the European Union under that Directive, compliance with the normative clauses of this standard given in Table ZA.1 and application of the edition of the normatively referenced standards as given in Table ZA.2 confers, within the limits of the scope of this standard, a presumption of conformity with the corresponding Essential Safety Table ZA.1 — Correspondence between this European Standard and Annex I Requirements of that Directive and associated EFTA regulations. of the Directive 2014/68/EU (PED) Essential Requirements of Clauses of this EN Remarks/Notes Directive 2014/68/EU (PED) Permanent joining. For pressure resistant components of pressure 3.1.2, paragraphs 3, 4 and 5 4, 5, 6, 7, 8, 9 and 10 equipment in the categories II, III and IV the examiner/examining body is a Table ZA.2 — Normative references from Clause 2 of this doccoummpeentet natn tdh itrhde pira rctoyr. responding European publications Column 1 Column 2 Column 3 Column 4 Reference in International Standard Title Corresponding Edition European Standard Edition Clause 2 Specification and qualification of welding ISO 15607 ISO 15607:2019 procedures for metallic EN ISO 15607:2019 materials — General rules Specification and qualification of welding ISO 15609-1 ISO 15609-1:2019 procedures for metallic EN ISO 15609-1:2019 materials — Welding procedure specification — Part 1: Arc welding Specification and qualification of welding ISO 15609-2 ISO 15609-2:2019 procedures for metallic EN ISO 15609-1:2019 materials — Welding procedure specification —

| Essential Requirements of Directive 2014/68/EU (PED) | Clauses of this EN | Remarks/Notes |
| --- | --- | --- |
| 3.1.2, paragraphs 3, 4 and 5 | 4, 5, 6, 7, 8, 9 and 10 | Permanent joining. For pressure resistant components of pressure equipment in the categories II, III and |

| Column 1 Reference in | Column 2 International Standard Edition | Column 3 Title | Column 4 Corresponding European Standard Edition |
| --- | --- | --- | --- |
| Clause 2 ISO 15607 | ISO 15607:2019 | Specification and qualification of welding procedures for metallic materials — General rules | EN ISO 15607:2019 |
| ISO 15609-1 | ISO 15609-1:2019 | Specification and qualification of welding procedures for metallic materials — Welding procedure specification — Part 1: Arc welding | EN ISO 15609-1:2019 |
| ISO 15609-2 | ISO 15609-2:2019 | Specification and qualification of welding procedures for metallic materials — Welding procedure specification — | EN ISO 15609-1:2019 |

<!-- Pagina 8 (motore: pdfplumber) -->

## EN ISO 15613:2025 (E)

Column 1 Column 2 Column 3 Column 4 Reference in International Standard Title Corresponding Edition European Standard Edition Clause 2 Part 2: Gas welding Specification and qualification of welding ISO 15609-3 ISO 15609-3:2004 procedures for metallic EN ISO 15609-3:2004 materials — Welding procedure specification — Part 3: Electron beam welding Specification and qualification of welding ISO 15609-4 ISO 15609-4:2009 procedures for metallic EN ISO 15609-4:2009 materials — Welding procedure specification — Part 4: Laser beam welding Specification and qualification of welding ISO 15609-5 ISO 15609-5:2011 procedures for metallic EN ISO 15609-5:2011 materials — Welding procedure specification — Part 5: Resistance welding Specification and qualification of welding ISO 15609-6 ISO 15609-6:2013 procedures for metallic EN ISO 15609-6:2013 materials — Welding procedure specification — Part 6: Laser-arc hybrid welding Specification and qualification of welding ISO 15614-1 ISO 15614-1:2017 procedures for metallic EN ISO 15614-1:2017 ISO 15614-1:2017/Amd materials — Welding EN ISO 15614- 1:1019 procedure test — Part 1: 1:2017/A1:2019 Arc and gas welding of steels and arc welding of nickel and nickel alloys Specification and qualification of welding ISO 15614-2 ISO 15614-2:2005 procedures for metallic EN ISO 15614-2:2005 ISO 15614-2:2005/Cor materials — Welding EN ISO 15614- 2:2009 procedure test — Part 2: 2:2005/AC:2009 Arc welding of aluminium and its alloys Specification and qualification of welding ISO 15614-3 ISO 15614-3:2008 procedures for metallic EN ISO 15614-3:2008

| Column 1 Reference in | Column 2 International Standard Edition | Column 3 Title | Column 4 Corresponding European Standard Edition |
| --- | --- | --- | --- |
| Clause 2 |  | Part 2: Gas welding |  |
| ISO 15609-3 | ISO 15609-3:2004 | Specification and qualification of welding procedures for metallic materials — Welding procedure specification — Part 3: Electron beam welding | EN ISO 15609-3:2004 |
| ISO 15609-4 | ISO 15609-4:2009 | Specification and qualification of welding procedures for metallic materials — Welding procedure specification — Part 4: Laser beam welding | EN ISO 15609-4:2009 |
| ISO 15609-5 | ISO 15609-5:2011 | Specification and qualification of welding procedures for metallic materials — Welding procedure specification — Part 5: Resistance welding | EN ISO 15609-5:2011 |
| ISO 15609-6 | ISO 15609-6:2013 | Specification and qualification of welding procedures for metallic materials — Welding procedure specification — Part 6: Laser-arc hybrid welding | EN ISO 15609-6:2013 |
| ISO 15614-1 | ISO 15614-1:2017 ISO 15614-1:2017/Amd 1:1019 | Specification and qualification of welding procedures for metallic materials — Welding procedure test — Part 1: Arc and gas welding of steels and arc welding of nickel and nickel alloys | EN ISO 15614-1:2017 EN ISO 15614- 1:2017/A1:2019 |
| ISO 15614-2 | ISO 15614-2:2005 ISO 15614-2:2005/Cor 2:2009 | Specification and qualification of welding procedures for metallic materials — Welding procedure test — Part 2: Arc welding of aluminium and its alloys | EN ISO 15614-2:2005 EN ISO 15614- 2:2005/AC:2009 |
| ISO 15614-3 | ISO 15614-3:2008 | Specification and qualification of welding procedures for metallic | EN ISO 15614-3:2008 |

<!-- Pagina 9 (motore: pdfplumber) -->

## EN ISO 15613:2025 (E)

Column 1 Column 2 Column 3 Column 4 Reference in International Standard Title Corresponding Edition European Standard Edition Clause 2 materials — Welding procedure test — Part 3: Fusion welding of nonalloyed and low-alloyed cast irons Specification and qualification of welding ISO 15614-5 ISO 15614-5:2004 procedures for metallic EN ISO 15614-5:2004 materials — Welding procedure test — Part 5: Arc welding of titanium, zirconium and their alloys Specification and qualification of welding ISO 15614-6 ISO 15614-6:2006 procedures for metallic EN ISO 15614-6:2006 materials — Welding procedure test — Part 6: Arc and gas welding of copper and its alloys Specification and qualification of welding ISO 15614-8 ISO 15614-8:2016 procedures for metallic EN ISO 15614-8:2016 materials — Welding procedure test — Part 8: Welding of tubes to tubeplate joints Specification and qualification of welding ISO 15614-10 ISO 15614-10:2005 procedures for metallic EN ISO 15614-10:2005 materials — Welding procedure test — Part 10: Hyperbaric dry welding Specification and qualification of welding ISO 15614-11 ISO 15614-11:2002 procedures for metallic EN ISO 15614-11:2002 materials — Welding procedure test — Part 11: Electron and laser beam welding Specification and qualification of welding ISO 15614-12 ISO 15614-12:2021 procedures for metallic EN ISO 15614-12:2021 materials — Welding procedure test — Part 12: Spot, seam and projection

| Column 1 Reference in | Column 2 International Standard Edition | Column 3 Title | Column 4 Corresponding European Standard Edition |
| --- | --- | --- | --- |
| Clause 2 |  | materials — Welding procedure test — Part 3: Fusion welding of non- alloyed and low-alloyed cast irons |  |
| ISO 15614-5 | ISO 15614-5:2004 | Specification and qualification of welding procedures for metallic materials — Welding procedure test — Part 5: Arc welding of titanium, zirconium and their alloys | EN ISO 15614-5:2004 |
| ISO 15614-6 | ISO 15614-6:2006 | Specification and qualification of welding procedures for metallic materials — Welding procedure test — Part 6: Arc and gas welding of copper and its alloys | EN ISO 15614-6:2006 |
| ISO 15614-8 | ISO 15614-8:2016 | Specification and qualification of welding procedures for metallic materials — Welding procedure test — Part 8: Welding of tubes to tube- plate joints | EN ISO 15614-8:2016 |
| ISO 15614-10 | ISO 15614-10:2005 | Specification and qualification of welding procedures for metallic materials — Welding procedure test — Part 10: Hyperbaric dry welding | EN ISO 15614-10:2005 |
| ISO 15614-11 | ISO 15614-11:2002 | Specification and qualification of welding procedures for metallic materials — Welding procedure test — Part 11: Electron and laser beam welding | EN ISO 15614-11:2002 |
| ISO 15614-12 | ISO 15614-12:2021 | Specification and qualification of welding procedures for metallic materials — Welding procedure test — Part 12: Spot, seam and projection | EN ISO 15614-12:2021 |

<!-- Pagina 10 (motore: pdfplumber) -->

## EN ISO 15613:2025 (E)

Column 1 Column 2 Column 3 Column 4 Reference in International Standard Title Corresponding Edition European Standard Edition Clause 2 welding Specification and qualification of welding ISO 15614-13 ISO 15614-13:2021 procedures for metallic EN ISO 15614-13:2021 materials — Welding procedure test — Part 13: Upset (resistance butt) and flash welding Specification and qualification of welding ISO 15614-14 ISO 15614-13:2013 procedures for metallic EN ISO 15614-13:2013 materials — Welding procedure test — Part 14: Laser-arc hybrid welding of steels, nickel and nickel alloys Welding and allied processes — Vocabulary — ISO/TR 25901- ISO/TR 17671-4:2016 Part 1: General terms None 1 For applicable standard Welding and allied edition see Column 2 processes — Vocabulary — ISO 25901-2 ISO 25901-2:2022 Part 2: Health and safety EN ISO 25901-2:2023 Welding and allied processes — Vocabulary — ISO/TR 25901- ISO/TR 25901-4:2016 Part 4: Arc welding None 4 For applicable standard edition see Column 2

| Column 1 Reference in | Column 2 International Standard Edition | Column 3 Title | Column 4 Corresponding European Standard Edition |
| --- | --- | --- | --- |
| Clause 2 |  | welding |  |
| ISO 15614-13 | ISO 15614-13:2021 | Specification and qualification of welding procedures for metallic materials — Welding procedure test — Part 13: Upset (resistance butt) and flash welding | EN ISO 15614-13:2021 |
| ISO 15614-14 | ISO 15614-13:2013 | Specification and qualification of welding procedures for metallic materials — Welding procedure test — Part 14: Laser-arc hybrid welding of steels, nickel and nickel alloys | EN ISO 15614-13:2013 |
| ISO/TR 25901- | ISO/TR 17671-4:2016 | Welding and allied processes — Vocabulary — Part 1: General terms | None |
| 1 ISO 25901-2 | ISO 25901-2:2022 | Welding and allied processes — Vocabulary — Part 2: Health and safety | For applicable standard edition see Column 2 EN ISO 25901-2:2023 |
| ISO/TR 25901- 4 | ISO/TR 25901-4:2016 | Welding and allied processes — Vocabulary — Part 4: Arc welding | None |

<!-- Pagina 11 (motore: pdfplumber) -->

## EN ISO 15613:2025 (E)

The documents listed in the Column 1 of Table ZA.2, in whole or in part, are normatively referenced in this document, i.e. are indispensable for its application. The achievement of the presumption of conformity is subject to the application of the edition of Standards as listed in Column 4 or, if no

## WARNING 1

European Standard Edition exists, the International Standard Edition given in Column 2 of Table ZA.2. Presumption of conformity stays valid only as long as a reference to this European Standard is maintained in the list published in the Official Journal of the European Union. Users of this standard should WcoAnsRuNltI NfrGeq 2uently the latest list published in the Official Journal of the European Union. Other Union legislation may be applicable to the products falling within the scope of this standard.

<!-- Pagina 12 (motore: pdfplumber) -->

ISO 15613:2025(en)

## Contents

Page Foreword iv Introduction v ....................................................................................................................................................................................................................................................

- 1 Scope 1

.............................................................................................................................................................................................................................................

- 2 Normative references 1

.............................................................................................................................................................................................................................................

- 3 Terms and definitions 2

.................................................................................................................................................................................................

- 4 Preliminary welding procedure specification (pWPS) 2

................................................................................................................................................................................................

- 5 Qualification of the welding procedure 2

..........................................................................................................

- 6 Welding of test pieces 3

..................................................................................................................................................

- 7 Testing 3

................................................................................................................................................................................................. ......................................................................................................................................................................................................................................... 7.1 Fusion welding .....................................................................................................................................................................................................3 7.2 Resistance welding ..........................................................................................................................................................................................3 7.2.1 Spot, seam and projection welding .................................................................................................................................3

- 8 Range of qualification 3

7.2.2 Upset (resistance butt) and flash welding ................................................................................................................3

- 9 Validity 4

................................................................................................................................................................................................

- 10 Welding procedure qualification record (WPQR) 4

....................................................................................................................................................................................................................................... ........................................................................................................................ This page deliberately left blank © ISO 2025 – All rights reserved iii

<!-- Pagina 13 (motore: pdfplumber) -->

ISO 15613:2025(en)

## Contents

Page Foreword iv Introduction v ....................................................................................................................................................................................................................................................

- 1 Scope 1

.............................................................................................................................................................................................................................................

- 2 Normative references 1

.............................................................................................................................................................................................................................................

- 3 Terms and definitions 2

.................................................................................................................................................................................................

- 4 Preliminary welding procedure specification (pWPS) 2

................................................................................................................................................................................................

- 5 Qualification of the welding procedure 2

..........................................................................................................

- 6 Welding of test pieces 3

..................................................................................................................................................

- 7 Testing 3

................................................................................................................................................................................................. ......................................................................................................................................................................................................................................... 7.1 Fusion welding .....................................................................................................................................................................................................3 7.2 Resistance welding ..........................................................................................................................................................................................3 7.2.1 Spot, seam and projection welding .................................................................................................................................3

- 8 Range of qualification 3

7.2.2 Upset (resistance butt) and flash welding ................................................................................................................3

- 9 Validity 4

................................................................................................................................................................................................

- 10 Welding procedure qualification record (WPQR) 4

....................................................................................................................................................................................................................................... ........................................................................................................................ © ISO 2025 – All rights reserved iii

<!-- Pagina 14 (motore: pdfplumber) -->

ISO 15613:2025(en)

## Foreword

ISO (the International Organization for Standardization) is a worldwide federation of national standards bodies (ISO member bodies). The work of preparing International Standards is normally carried out through ISO technical committees. Each member body interested in a subject for which a technical committee has been established has the right to be represented on that committee. International organizations, governmental and non-governmental, in liaison with ISO, also take part in the work. ISO collaborates closely with the International Electrotechnical Commission (IEC) on all matters of electrotechnical standardization. The procedures used to develop this document and those intended for its further maintenance are described in the ISO/IEC Directives, Part 1. In particular, the different approval criteria needed for the different types of ISO document should be noted. This document was drafted in accordance with the editorial rules of the ISO/IEC Directives, Part 2 (see www.iso.org/directives). ISO draws attention to the possibility that the implementation of this document may involve the use of (a) patent(s). ISO takes no position concerning the evidence, validity or applicability of any claimed patent rights in respect thereof. As of the date of publication of this document, ISO had not received notice of (a) patent(s) which may be required to implement this document. However, implementers are cautioned that this may not represent the latest information, which may be obtained from the patent database available at www.iso.org/patents. ISO shall not be held responsible for identifying any or all such patent rights. Any trade name used in this document is information given for the convenience of users and does not constitute an endorsement. For an explanation of the voluntary nature of standards, the meaning of ISO specific terms and expressions related to conformity assessment, as well as information about ISO's adherence to the World Trade Organization (WTO) principles in the Technical Barriers to Trade (WTBeTld)i,n sge ae nwdw alwli.eidso p.ororcge/sisseos/foreword.html. Quality management in the field of welding This document was prepared by Technical Committee ISO/TWC e4ld4i, ng and allied processes , Subcommittee SC 10, , in collaboration with the European Committee for Standardization (CEN) Technical Committee CEN/TC 121, , in accordance with the Agreement on technical cooperation between ISO and CEN (Vienna Agreement). This second edition cancels and replaces the first edition (ISO 15613:2004), which has been technically revised. The main changes are as follows: — the normative references have been updated and extensively revised; — all parts of the document related to the changes in normative references have been updated accordingly; — Tables have been added to Clause 4 and 5 to give the relevant standards for each welding process; — Clause 5 has been revised to clarify the intent; — the text of Clause 7 has been revised and refers to the standards in Table 2. All testing information has been deleted to avoid conflict with the relevant parts of the ISO 15614 series; — the title of 7.2.1 has been updated to reflect the title of ISO 15614-12; — Clauses 8 and 10 have been revised. Any feedback or questions on this document should be directed to the user’s national standards body. A complete listing of these bodies can be found at www.iso.org/members.html. Official interpretations of ISO/TC 44 documents, where they exist, are available from this page: https://committee.iso.org/sites/tc44/home/interpretation.html. © ISO 2025 – All rights reserved iv

<!-- Pagina 15 (motore: pdfplumber) -->

ISO 15613:2025(en)

## Introduction

One of the methods for welding procedure qualification is based on a pre-production welding test as given in ISO 15607. Qualification based on a pre-production welding test can be used where the shape and dimensions of the standard test pieces do not adequately represent the joint to be welded. In such cases, one or more special test pieces can be made to simulate the production joint in all essential features, for example dimensions, restraint, heat sink effects and limited access. This document is one of a number of standards dealing with specification and qualification of welding procedures. Details are given in ISO 15607. © ISO 2025 – All rights reserved v

<!-- Pagina 16 (motore: pdfplumber) -->

<!-- Pagina 17 (motore: pdfplumber) -->

International Standard BISS OE N1 5IS6O1 31:52601235:(2e0n2)5

## Specification and qualification of welding procedures for

## metallic materials — Qualification based on a pre-production

## welding test

# 1 Scope

This document specifies how a preliminary welding procedure specification is qualified based on a preproduction welding test. This document is applicable to arc welding, gas welding, beam welding, resistance welding, stud welding and friction welding of metallic materials.

# 2 Normative references

The following documents are referred to in the text in such a way that some or all of their content constitutes requirements of this document. For dated references, only the edition cited applies. For undated references, the latest edition of the referenced document (including any amendments) applies. Specification and qualification of welding procedures for metallic materials — General rules ISO 15607, Specification and qualification of welding procedures for metallic materials — Welding procedure specification — Part 1: Arc welding ISO 15609-1, Specification and qualification of welding procedures for metallic materials — Welding procedure specification — Part 2: Gas welding ISO 15609-2, Specification and qualification of welding procedures for metallic materials — Welding procedure specification — Part 3: Electron beam welding ISO 15609-3, Specification and qualification of welding procedures for metallic materials — Welding procedure specification — Part 4: Laser beam welding ISO 15609-4, Specification and qualification of welding procedures for metallic materials — Welding procedure specification — Part 5: Resistance welding ISO 15609-5, Specification and qualification of welding procedures for metallic materials — Welding procedure specification — Part 6: Laser-arc hybrid welding ISO 15609-6, Specification and qualification of welding procedures for metallic materials — Welding procedure test — Part 1: Arc and gas welding of steels and arc welding of nickel and nickel alloys ISO 15614-1, Specification and qualification of welding procedures for metallic materials — Welding procedure test — Part 2: Arc welding of aluminium and its alloys ISO 15614-2, Specification and qualification of welding procedures for metallic materials — Welding procedure test — Part 3: Fusion welding of non-alloyed and low-alloyed cast irons ISO 15614-3, Specification and qualification of welding procedures for metallic materials — Welding procedure test — Part 5: Arc welding of titanium, zirconium and their alloys ISO 15614-5, Specification and qualification of welding procedures for metallic materials — Welding procedure test — Part 6: Arc and gas welding of copper and its alloys ISO 15614-6, © ISO 2025 – All rights reserved

<!-- Pagina 18 (motore: pdfplumber) -->

ISO 15613:2025(en) Specification and qualification of welding procedures for metallic materials — Welding procedure test — Part 8: Welding of tubes to tube-plate joints ISO 15614-8, Specification and qualification of welding procedures for metallic materials — Welding procedure test — Part 10: Hyperbaric dry welding ISO 15614-10, Specification and qualification of welding procedures for metallic materials — Welding procedure test — Part 11: Electron and laser beam welding ISO 15614-11, Specification and qualification of welding procedures for metallic materials — Welding procedure test — Part 12: Spot, seam and projection welding ISO 15614-12, Specification and qualification of welding procedures for metallic materials — Welding procedure test — Part 13: Upset (resistance butt) and flash welding ISO 15614-13, Specification and qualification of welding procedures for metallic materials — Welding procedure test — Part 14: Laser-arc hybrid welding of steels, nickel and nickel alloys ISO 15614-14, Welding and allied processes — Vocabulary ISO 25901 (all parts),

# 3 Terms and definitions

For the purposes of this document, the terms and definitions given in ISO 15607 and the ISO 25901 series apply. ISO and IEC maintain terminology databases for use in standardization at the following addresses: — ISO Online browsing platform: available at https:// www .iso .org/ obp — IEC Electropedia: available at https:// www .electropedia .org/

# 4 Preliminary welding procedure specification (pWPS)

A preliminary welding procedure specification shall be prepared in accordance with the appropriate standard given in Table 1: Table 1 — Welding procedure specification standards ISO standard Welding process ISO 15609-1 Arc welding ISO 15609-2 Gas welding ISO 15609-3 Electron beam welding ISO 15609-4 Laser beam welding ISO 15609-5 Resistance welding ISO 15609-6 Laser-arc hybrid welding

**Tabella 1 — Welding procedure specification standards (ricostruita dal testo §4, HITL 04/10/2026)**

| ISO standard | Welding process |
| --- | --- |
| ISO 15609-1 | Arc welding |
| ISO 15609-2 | Gas welding |
| ISO 15609-3 | Electron beam welding |
| ISO 15609-4 | Laser beam welding |
| ISO 15609-5 | Resistance welding |
| ISO 15609-6 | Laser-arc hybrid welding |

> **Nota HITL Tabella 1:** la griglia pdfplumber della pagina 18 era incompleta (solo 15609-1…4). Completata dal paragrafo immediatamente precedente, stesso contenuto.

# 5 Qualification of the welding procedure

Qualification of the welding procedure shall be carried out by an examiner or examining body in accordance with the relevant standard given in Table 2. © ISO 2025 – All rights reserved

| ISO standard | Welding process |
| --- | --- |
|  |  |
|  |  |
| ISO 15609-1 | Arc welding |
| ISO 15609-2 | Gas welding |
| ISO 15609-3 | Electron beam welding |
| ISO 15609-4 | Laser beam welding |

<!-- Pagina 19 (motore: pdfplumber) -->

ISO 15613:2025(en) Table 2 — Welding procedure test standards ISO standard Welding process ISO 15614-1 Arc and gas welding of steels and arc welding of nickel and nickel alloys ISO 15614-2 Arc welding of aluminium and its alloys ISO 15614-3 Fusion welding of non-alloyed and low-alloyed cast irons ISO 15614-5 Arc welding of titanium, zirconium and their alloys ISO 15614-6 Arc and gas welding of copper and its alloys ISO 15614-8 Welding of tubes to tube-plate joints ISO 15614-10 Hyperbaric dry welding ISO 15614-11 Electron and laser beam welding ISO 15614-12 Spot, seam and projection welding ISO 15614-13 Upset (resistance butt) and flash welding ISO 15614-14 Laser-arc hybrid welding of steels, nickel and nickel alloys

**Tabella 2 — Welding procedure test standards (ricostruita dal testo §5, HITL 04/10/2026)**

| ISO standard | Welding process |
| --- | --- |
| ISO 15614-1 | Arc and gas welding of steels and arc welding of nickel and nickel alloys |
| ISO 15614-2 | Arc welding of aluminium and its alloys |
| ISO 15614-3 | Fusion welding of non-alloyed and low-alloyed cast irons |
| ISO 15614-5 | Arc welding of titanium, zirconium and their alloys |
| ISO 15614-6 | Arc and gas welding of copper and its alloys |
| ISO 15614-8 | Welding of tubes to tube-plate joints |
| ISO 15614-10 | Hyperbaric dry welding |
| ISO 15614-11 | Electron and laser beam welding |
| ISO 15614-12 | Spot, seam and projection welding |
| ISO 15614-13 | Upset (resistance butt) and flash welding |
| ISO 15614-14 | Laser-arc hybrid welding of steels, nickel and nickel alloys |

> **Nota HITL Tabella 2:** **non** compare ISO 14555. La griglia pdfplumber di pagina 19 avvolgeva le celle (15614-1 spezzato su due righe). Ricostruzione dal paragrafo elenco, non da numeri inventati. ISO 15614-4 assente anche nel testo (come nelle altre parti 15614 del repo: salto di numerazione della serie).

# 6 Welding of test pieces

Preparation and welding of the test pieces shall be carried out under the general conditions of production welding, which they shall represent with shapes and dimensions of the test piece simulating the actual welding conditions of the structure. This includes welding positions and other essential items, for example stress conditions, heating effects, limited access and edge condition. When actual components are used, jigs and fixtures shall be those which will be used in production. If tack welds are to be fused into the final joint, they shall be included in the test piece.

# 7 Testing

## 7.1 Fusion welding

As far as technically possible, test pieces shall be tested in accordance with appropriate standard given in Table 2. Where ISO 15614-1 is the reference standard, and unless otherwise specified, level 2 shall be the default.

## 7.2 Resistance welding

### 7.2.1 Spot, seam and projection welding

Actual components shall be used for the pre-production test. As far as technically possible, test pieces shall be tested in accordance with ISO 15614-12.

### 7.2.2 Upset (resistance butt) and flash welding

Actual components shall be used for the pre-production test. As far as technically possible, test pieces shall be tested in accordance with ISO 15614-13.

# 8 Range of qualification

Any qualification issued under this document shall be limited to the type of joint used in the pre-production test. © ISO 2025 – All rights reserved

| ISO standard | Welding process |
| --- | --- |
|  |  |
| ISO 15614-1 | Arc and gas welding of steels and arc welding of nick- |
| ISO 15614-2 | el and nickel alloys Arc welding of aluminium and its alloys |
| ISO 15614-3 | Fusion welding of non-alloyed and low-alloyed cast |
|  | irons |
| ISO 15614-5 | Arc welding of titanium, zirconium and their alloys |
| ISO 15614-6 | Arc and gas welding of copper and its alloys |
| ISO 15614-8 | Welding of tubes to tube-plate joints |
| ISO 15614-10 | Hyperbaric dry welding |
| ISO 15614-11 | Electron and laser beam welding |
| ISO 15614-12 ISO 15614-13 | Spot, seam and projection welding Upset (resistance butt) and flash welding |

<!-- Pagina 20 (motore: pdfplumber) -->

ISO 15613:2025(en) As far as technically possible, the range of qualification shall be in accordance with the relevant standard given in Table 2. However, the range of qualification for thickness shall be applied to each component in the joint, as well as weld thickness. For resistance welding, the qualification range shall be limited to the pre-production test piece which was tested. However, if available, other welding procedure qualification records (WPQRs) can be taken into consideration if all conditions are sufficiently comparable, for example equipment, electrodes, material (type, surface, thickness) and welding parameters.

# 9 Validity

A qualified welding procedure based on pre-production weld testing is valid if production welding is carried out within the specified range in accordance with clause 8.

# 10 Welding procedure qualification record (WPQR)

The WPQR shall contain the results of assessing the pre-production test piece, including re-tests. The relevant items listed for the WPS in the standards given in Table 1 shall be included in the WPQR, together with details of any features that do not conform to the requirements of Clause 7. If no non-conforming features or unacceptable test results are found, a WPQR detailing the welding procedure test piece results is qualified and shall be signed and dated by the examiner or the examining body. A WPQR form shall be used to record details for the welding procedure and the test results, in order to facilitate uniform presentation and assessment of the data. © ISO 2025 – All rights reserved

<!-- Pagina 21 (motore: pdfplumber) — duplicato di §8–10 già in pagina 20; omesso in revisione HITL -->

<!-- Pagina 22 (motore: pdfplumber) -->

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
