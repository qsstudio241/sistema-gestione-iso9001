> **Ruolo SGQ**: norma di **supporto** a ISO 3834 (misura temperature di saldatura: preriscaldo, interpass, mantenimento). Non è una norma di sistema a clausole 4–10: **non** va in import-norms-from-markdown.js / seed norm_requirements. Uso primario: ingest WPS/WPQR e campi `preheat_temp` / `interpass_temp`, estratto RC-9.
> **Edizione**: ISO 13916:2025 (terza edizione; supersede 2017). BS EN ISO 13916:2025 = EN ISO 13916:2025 = ISO 13916:2025. **Estratto operativo**: docs/reference/ISO-13916-temperature-saldatura.md + weldingTemperatures13916.js (solo prompt/regole, non catalogo simboli).
> **Qualità estrazione**: 12 pagine, tutte con testo utile via pdfplumber. Rumore tipico BSI su pagine 1–4 (foreword bilingue/layout a due colonne) e pag. 12 (copyright BSI). Contenuto normativo utile da pag. 6–10 (§1–§6). Formule distanza misura A=4×t parzialmente spezzate nel testo grezzo — vedi estratto operativo per sintesi corretta.

<!-- Pagina 1 (motore: pdfplumber) -->

BSI Standards Publication Welding — Measurement of preheating temperature, interpass temperature and preheat maintenance temperature

|  |  |  |  |  |
| --- | --- | --- | --- | --- |
|  |  |  |  |  |
| BSI Standards Publication |  |  |  |  |

<!-- Pagina 2 (motore: pdfplumber) -->

## EN ISO 13916

## BS EN ISO 13916:2025 BRITISH STANDARD

## National foreword

## EUROPEAN STANDARD

## NORME EUROPÉENNE

September 2025 This British Standard is the UK implementation of EN ISO 13916:2025. EUROPÄISCHE NORM It is identical to ISO 13916:2025. It supersedes BS EN ISO 13916:2017, ICS 25.160.10 Supersedes EN ISO 13916:2017 which is withdrawn. The UK participation in its preparation was entrusted to Technical Committee WEE/36, Qualification of welding personnel and English Version welding procedures.

## A list of organizations represented on this committee can be obtained on Welding - Measurement of preheating temperature,

rCeoqnutersatc ttou iatls acnodm lmegitatel ec omnasnidaegrear.tions

## interpass temperature and preheat maintenance

## temperature (ISO 13916:2025)

Soudage - Mesurage de la température de Schweißen - Messung der Vorwärm-, Zwischenlagen- This publication has been prepared in good faith, however no préchauffage, de la température entre passes et de la und Haltetemperatur (ISO 13916:2025) representation, warranty, assurance or undertaking (express or température de maintien du préchauffage (ISO implied) is or will be made, and no responsibility or liability is or will be 13916:2025) accepted by BSI in relation to the adequacy, accuracy, completeness or reasonableness of this publication. All and any such responsibility and This European Standard was approved by CEN on 18 August 2025. liability is expressly disclaimed to the full extent permitted by the law. CEN members are bound to comply with the CEN/CENELEC Internal Regulations which stipulate the conditions for giving this This publication is provided as is, and is to be used at the European Standard the status of a national standard without any alteration. Up-to-date lists and bibliographical references recipient’s own risk. concerning such national standards may be obtained on application to the CEN-CENELEC Management Centre or to any CEN member. The recipient is advised to consider seeking professional guidance with respect to its use of this publication. This European Standard exists in three official versions (English, French, German). A version in any other language made by translation under the responsibility of a CEN member into its own language and notified to the CEN-CENELEC Management This publication is not intended to constitute a contract. Users are Centre has the same status as the official versions. responsible for its correct application. CEN members are the national standards bodies of Austria, Belgium, Bulgaria, Croatia, Cyprus, Czech Republic, Denmark, Estonia, © The British Standards Institution 2025 Finland, France, Germany, Greece, Hungary, Iceland, Ireland, Italy, Latvia, Lithuania, Luxembourg, Malta, Netherlands, Norway, Poland, Portugal, Republic of North Macedonia, Romania, Serbia, Slovakia, Slovenia, Spain, Sweden, Switzerland, Türkiye and Published by BSI Standards Limited 2025 United Kingdom.

## ISBN 978 0 539 31982 8

ICCoSm 2p5l.1ia6n0c.1e0 with a British Standard cannot confer immunity from legal obligations. This British Standard was published under the authority of the Standards Policy and Strategy Committee on 30 September 2025. Amendments/corrigenda issued since publication Date Text affected

## EUROPEAN COMMITTEE FOR STANDARDIZATION

## COMITÉ EUROPÉEN DE NORMALISATION

## EUROPÄISCHES KOMITEE FÜR NORMUNG

CEN-CENELECM anagement Centre: Rue de la Science 23, B-1040 Brussels © 2025 CEN All rights of exploitation in any form and by any means reserved Ref. No. EN ISO 13916:2025 E worldwide for CEN national Members.

<!-- Pagina 3 (motore: pdfplumber) -->

## EN ISO 13916

## EUROPEAN STANDARD

## NORME EUROPÉENNE

## September 2025

## EUROPÄISCHE NORM

ICS 25.160.10 Supersedes EN ISO 13916:2017

## English Version

## Welding - Measurement of preheating temperature,

## interpass temperature and preheat maintenance

## temperature (ISO 13916:2025)

Soudage - Mesurage de la température de Schweißen - Messung der Vorwärm-, Zwischenlagenpréchauffage, de la température entre passes et de la und Haltetemperatur (ISO 13916:2025) température de maintien du préchauffage (ISO 13916:2025) This European Standard was approved by CEN on 18 August 2025. CEN members are bound to comply with the CEN/CENELEC Internal Regulations which stipulate the conditions for giving this European Standard the status of a national standard without any alteration. Up-to-date lists and bibliographical references concerning such national standards may be obtained on application to the CEN-CENELEC Management Centre or to any CEN member. This European Standard exists in three official versions (English, French, German). A version in any other language made by translation under the responsibility of a CEN member into its own language and notified to the CEN-CENELEC Management Centre has the same status as the official versions. CEN members are the national standards bodies of Austria, Belgium, Bulgaria, Croatia, Cyprus, Czech Republic, Denmark, Estonia, Finland, France, Germany, Greece, Hungary, Iceland, Ireland, Italy, Latvia, Lithuania, Luxembourg, Malta, Netherlands, Norway, Poland, Portugal, Republic of North Macedonia, Romania, Serbia, Slovakia, Slovenia, Spain, Sweden, Switzerland, Türkiye and United Kingdom.

## EUROPEAN COMMITTEE FOR STANDARDIZATION

## COMITÉ EUROPÉEN DE NORMALISATION

## EUROPÄISCHES KOMITEE FÜR NORMUNG

CEN-CENELECM anagement Centre: Rue de la Science 23, B-1040 Brussels © 2025 CEN All rights of exploitation in any form and by any means reserved Ref. No. EN ISO 13916:2025 E worldwide for CEN national Members.

<!-- Pagina 4 (motore: pdfplumber) -->

## EN ISO 13916:2025 (E)

## European foreword

This document (EN ISO 13916:2025) has been prepared by Technical Committee ISO/TC 44 "Welding and allied processes " in collaboration with Technical Committee CEN/TC 121 “Welding and allied processes” the secretariat of which is held by AFNOR. This European Standard shall be given the status of a national standard, either by publication of an identical text or by endorsement, at the latest by March 2026, and conflicting national standards shall be withdrawn at the latest by March 2026. Attention is drawn to the possibility that some of the elements of this document may be the subject of patent rights. CEN shall not be held responsible for identifying any or all such patent rights. This document supersedes EN ISO 13916:2017. Any feedback and questions on this document should be directed to the users’ national standards body/national committee. A complete listing of these bodies can be found on the CEN website. According to the CEN-CENELEC Internal Regulations, the national standards organizations of the following countries are bound to implement this European Standard: Austria, Belgium, Bulgaria, Croatia, Cyprus, Czech Republic, Denmark, Estonia, Finland, France, Germany, Greece, Hungary, Iceland, Ireland, Italy, Latvia, Lithuania, Luxembourg, Malta, Netherlands, Norway, Poland, Portugal, Republic of North Macedonia, Romania, Serbia, Slovakia, Slovenia, Spain, Sweden, Switzerland, Türkiye and the United Kingdom.

## Endorsement notice

The text of ISO 13916:2025 has been approved by CEN as EN ISO 13916:2025 without any modification.

<!-- Pagina 5 (motore: pdfplumber) -->

ISO 13916:2025(en)

## Contents

Page Foreword iv

# 1 Scope 1

....................................................................................................................................................................................................................................................

# 2 Normative references 1

.............................................................................................................................................................................................................................................

# 3 Terms and definitions 1

.................................................................................................................................................................................................

# 4 Requirements 1

................................................................................................................................................................................................ ...................................................................................................................................................................................................................... 4.1 Point of measurement ...................................................................................................................................................................................1 4.2 Time of measurement ....................................................................................................................................................................................3

# 5 Measurement records 3

4.3 Equipment ................................................................................................................................................................................................................3

# 6 Designation 3

................................................................................................................................................................................................ ............................................................................................................................................................................................................................ 6.1 General ........................................................................................................................................................................................................................3 6.2 Example 1 .................................................................................................................................................................................................................3 Bibliography 4 6.3 Example 2 .................................................................................................................................................................................................................3 ............................................................................................................................................................................................................................................ © ISO 2025 – All rights reserved iii

<!-- Pagina 6 (motore: pdfplumber) -->

ISO 13916:2025(en)

## Foreword

ISO (the International Organization for Standardization) is a worldwide federation of national standards bodies (ISO member bodies). The work of preparing International Standards is normally carried out through ISO technical committees. Each member body interested in a subject for which a technical committee has been established has the right to be represented on that committee. International organizations, governmental and non-governmental, in liaison with ISO, also take part in the work. ISO collaborates closely with the International Electrotechnical Commission (IEC) on all matters of electrotechnical standardization. The procedures used to develop this document and those intended for its further maintenance are described in the ISO/IEC Directives, Part 1. In particular, the different approval criteria needed for the different types of ISO documents should be noted. This document was drafted in accordance with the editorial rules of the ISO/IEC Directives, Part 2 (see www.iso.org/directives). ISO draws attention to the possibility that the implementation of this document may involve the use of (a) patent(s). ISO takes no position concerning the evidence, validity or applicability of any claimed patent rights in respect thereof. As of the date of publication of this document, ISO had not received notice of (a) patent(s) which may be required to implement this document. However, implementers are cautioned that this may not represent the latest information, which may be obtained from the patent database available at www.iso.org/patents. ISO shall not be held responsible for identifying any or all such patent rights. Any trade name used in this document is information given for the convenience of users and does not constitute an endorsement. For an explanation of the voluntary nature of standards, the meaning of ISO specific terms and expressions related to conformity assessment, as well as information about ISO's adherence to the World Trade Organization (WTO) principles in the Technical Barriers to Trade (WTBeTld)i,n sge ae nwdw alwli.eidso p.ororcge/sisseos/foreword.html. Quality management in the field of welding This document was prepared by Technical Committee ISO/TWC e4ld4i, ng and allied processes , Subcommittee SC 10, , in collaboration with the European Committee for Standardization (CEN) Technical Committee CEN/TC 121, , in accordance with the Agreement on technical cooperation between ISO and CEN (Vienna Agreement). This third edition cancels and replaces the second edition (ISO 13916:2017), which has been technically revised. The main changes are as follows: — subclause 4.1, addition of requirements regarding the point of measurement of the temperature, for joint thicknesses not exceeding 50 mm, if the source of heat is localized outside of the groove of the weld. Any feedback or questions on this document should be directed to the user’s national standards body. A complete listing of these bodies can be found at www.iso.org/members.html. Official interpretations of ISO/TC 44 documents, where they exist, are available from this page: https://committee.iso.org/sites/tc44/home/interpretation.html. © ISO 2025 – All rights reserved iv

<!-- Pagina 7 (motore: pdfplumber) -->

International Standard BISSO E N1 3IS9O1 61:32901265:(2e0n2)5

## Welding — Measurement of preheating temperature,

## interpass temperature and preheat maintenance temperature

# 1 Scope

This document specifies requirements for the measurement of preheating temperature, interpass temperature and preheat maintenance temperature for fusion welding. This document can also be applied as appropriate in the case of other welding processes. This document does not apply to the measurement of post weld heat treatment temperatures.

# 2 Normative references

There are no normative references in this document.

# 3 Terms and definitions

For the purposes of this document, the following terms and definitions apply. ISO and IEC maintain terminology databases for use in standardization at the following addresses: — ISO Online browsing platform: available at https:// www .iso .org/ obp —3.1 IEC Electropedia: available at https:// www .electropedia .org/ preheating temperature T p temperature of the workpiece in the weld zone immediately prior to any welding operation N3.o2te 1 to entry: It is normally expressed as a minimum and is usually equal to the minimum interpass temperature. interpass temperature T i temperature in a multi-run weld and adjacent parent metal immediately prior to the application of the next run N3.o3te 1 to entry: It is normally expressed as a maximum temperature. preheat maintenance temperature T m minimum temperature in the weld zone which is to be maintained if welding is interrupted

# 4 Requirements

## 4.1 Point of measurement

t For a workpiece thickness not exceeding 50 mm in the weld, tAhe tempterature measurement shall normally be made on the surface of the workpiece facing the welder. If the heat source is centred on the groove, the temperature measurement shall normally be at a distance of = 4 × , but not more than 50 mm, from the longitudinal edge of the groove (see Figure 1). If the source of heat is localized outside of the groove (e.g. © ISO 2025 – All rights reserved

<!-- Pagina 8 (motore: pdfplumber) -->

ISO 13916:2025(en) fixed permanent heaters on the base material) then the temperature shall be measured on the weld metal or on the exposed parent metal surface immediately adjacent to the weld preparation. When the thickness exceeds 50 mm, the required temperature shall exist in the parent metal for a distance of minimum 75 mm or as otherwise agreed in any direction from the joint preparation. Where practicable, the temperature shall be measured on the face opposite to that being heated. Otherwise, the temperature shall be confirmed on the heated face at a time after removal of the heat source related to parent metal thickness to allow for temperature equalization. Where fixed permanent heaters are in use and there is no access to the reverse face for temperature measurement, readings shall be taken on the exposed parent metal surface immediately adjacent to the weld preparation. The time allowed for the temperature equalization shall be of the order of 2 min for each 25 mm of parent metal thickness. Interpass temperature shall be measured on the weld metal or the immediately adjacent parent metal. Dimensions in millimetres

a) Butt joint

b) T-joint

Key t A t t A ≤ 50 mm: = 4 × , max. 50 mm > 50 mm: = min. 75 mm Figure 1 — Distance between points of measurement © ISO 2025 – All rights reserved

<!-- Pagina 9 (motore: pdfplumber) -->

ISO 13916:2025(en)

## 4.2 Time of measurement

Interpass temperature shall be measured in the weld area immediately prior to the application of the next run. If the preheat maintenance temperature is specified, it shall be monitored during the period of welding interruption.

## 4.3 Equipment

Equipment used for temperature measurement should be specified in the welding procedure specifications, for example: — temperature sensitive materials (e.g. crayons or paints) (TS); — contact thermometer (CT); — thermocouple (TE); — optical or electrical devices for contactless measurement (TB). NOTE ISO 17662 provides requirements for the calibration, verification and validation of such equipment.

# 5 Measurement records

If records of measurements are required, reference to this document shall be made and the following minimum information shall be given in accordance with the welding procedure specification: — measured preheating temperature, in °C; — measured interpass temperature, in °C; — measured preheat maintenance temperature, in °C; — any deviation from this document, if applicable.

# 6 Designation

## 6.1 General

Examples of designation, which should be used in measurement records, are given in 6.2 and 6.3.

## 6.2 Example 1

T T A preheating temperature, p, measured only once in accordance with this document as 155 °C ( p 155) using a contact thermometer (TCT) shall be designated as follows: Temperature ISO 13916:2025 p 155 — CT.

## 6.3 Example 2

T T An interpass temperature, i, measured more than once in accordance with this document as 130 °C, 153 °C and 160 °C ( i 130/160) using Ta thermocouple (TE) shall be designated as follows: Temperature ISO 13916:2025 i 130/160 — TE. © ISO 2025 – All rights reserved

<!-- Pagina 10 (motore: pdfplumber) -->

ISO 13916:2025(en)

## Bibliography

Welding — Calibration, verification and validation of equipment used for welding, including ancillary activities [1] ISO 17662, © ISO 2025 – All rights reserved

<!-- Pagina 11 (motore: pdfplumber) -->

This page deliberately left blank

<!-- Pagina 12 (motore: pdfplumber) -->

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
