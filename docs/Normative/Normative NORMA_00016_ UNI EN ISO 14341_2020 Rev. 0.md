> **Ruolo SGQ**: norma di **supporto** a ISO 3834 (classificazione fili-elettrodo / depositi MAG-MIG per acciai non legati e a grano fine). Non è una norma di sistema a clausole 4–10: **non** va in import-norms-from-markdown.js / seed norm_requirements. Uso primario: campo `filler_material` su WPS/WPQR (designazione tipo `G 42 4 M21 3Si1`), estratto RC-11.
> **Edizione**: ISO 14341:2020 (terza edizione; supersede 2010). **Estratto operativo**: docs/reference/ISO-14341-consumabili-filo.md + fillerWire14341.js (solo regole/prompt; non catalogo esaustivo di tutte le combinazioni).
> **Qualità estrazione**: 22 pagine, 20 con testo utile (pdfplumber). Pagine 6 e 21 ATTENZIONE (bassa qualità/vuote). Tabella 3A/3B composizione chimica (pag. ~11) parzialmente illeggibile (font/layout a due colonne) — **GAP**: non inventare simboli chimici oltre gli esempi §11 e i simboli già leggibili. Gas di classificazione rinvia a ISO 14175 (RC-3).

<!-- Pagina 1 (motore: pdfplumber) -->

## ISO

## 14341

## INTERNATIONAL

## STANDARD

Third edition 2020-08

## Welding consumables — Wire

## electrodes and weld deposits for

## gas shielded metal arc welding of

## non alloy and fine grain steels —

## Classification

Produits consommables pour le soudage — Fils-électrodes et métaux d'apport déposés en soudage à l'arc sous protection gazeuse des aciers non alliés et à grains fins — Classification Reference number ©

## ISO 2020

<!-- Pagina 2 (motore: pdfplumber) -->

## COPYRIGHT PROTECTED DOCUMENT

## © ISO 2020

All rights reserved. Unless otherwise specified, or required in the context of its implementation, no part of this publication may be reproduced or utilized otherwise in any form or by any means, electronic or mechanical, including photocopying, or posting on the internet or an intranet, without prior written permission. Permission can be requested from either ISO at the address below or ISO’s member body in the country of the requester. ISO copyright office CP 401 • Ch. de Blandonnet 8 CH-1214 Vernier, Geneva Phone: +41 22 749 01 11 Email: copyright@iso.org Website: www.iso.org Published in Switzerland ii © ISO 2020 – All rights reserved

<!-- Pagina 3 (motore: pdfplumber) -->

## Contents

Page Foreword iv Introduction v ........................................................................................................................................................................................................................................

# 1 Scope 1

..................................................................................................................................................................................................................................

# 2 Normative references 1

.................................................................................................................................................................................................................................

# 3 Terms and definitions 1

......................................................................................................................................................................................

# 4 Classification 2

.....................................................................................................................................................................................

# 5 Symbols and requirements 2

............................................................................................................................................................................................................ ........................................................................................................................................................................ 5.1 Symbol for product/process .......................................................................................................................................................2

## 5.2 Symbol for strength and elongation of all-weld metal .........................................................................................3

5.3 Symbol for impact properties of all-weld metal .........................................................................................................3 5.4 Symbol for shielding gas .................................................................................................................................................................4

# 6 Mechanical tests 8

## 5.5 Symbol for chemical composition of wire electrodes............................................................................................4

.................................................................................................................................................................................................... 6.1 Preheating and interpass temperatures ...........................................................................................................................8 6.2 Welding conditions and pass sequence .............................................................................................................................9

# 7 Chemical analysis 10

6.3 Post-weld heat-treated (PWHT) condition ..................................................................................................................10

# 8 Rounding procedure 11

..............................................................................................................................................................................................

# 9 Retests 11

......................................................................................................................................................................................

# 10 Technical delivery conditions 11

..........................................................................................................................................................................................................................

# 11 Examples of designation 11

.............................................................................................................................................................. Bibliography 14 ............................................................................................................................................................................ ............................................................................................................................................................................................................................. © ISO 2020 – All rights reserved iii

<!-- Pagina 4 (motore: pdfplumber) -->

## Foreword

ISO (the International Organization for Standardization) is a worldwide federation of national standards bodies (ISO member bodies). The work of preparing International Standards is normally carried out through ISO technical committees. Each member body interested in a subject for which a technical committee has been established has the right to be represented on that committee. International organizations, governmental and non-governmental, in liaison with ISO, also take part in the work. ISO collaborates closely with the International Electrotechnical Commission (IEC) on all matters of electrotechnical standardization. The procedures used to develop this document and those intended for its further maintenance are described in the ISO/IEC Directives, Part 1. In particular, the different approval criteria needed for the different types of ISO documents should be noted. This document was drafted in accordance with the editorial rules of the ISO/IEC Directives, Part 2 (see www .iso .org/ directives). Attention is drawn to the possibility that some of the elements of this document may be the subject of patent rights. ISO shall not be held responsible for identifying any or all such patent rights. Details of any patent rights identified during the development of the document will be in the Introduction and/or on the ISO list of patent declarations received (see www .iso .org/ patents). Any trade name used in this document is information given for the convenience of users and does not constitute an endorsement. For an explanation of the voluntary nature of standards, the meaning of ISO specific terms and expressions related to conformity assessment, as well as information about ISO's adherence to the World Trade Organization (WTO) principles in the Technical Barriers to Trade (TBT), see www .iso .org/ iso/ foreword .html. Welding and allied processes] Welding consumables, This document was prepared by Technical Committee WISeOld/iTnCg , 44, , Subcommittee SC 3, in collaboration with the European Committee for Standardization (CEN) Technical Committee CEN/TC 121, in accordance with the Agreement on technical cooperation between ISO and CEN (Vienna Agreement). This third edition cancels and replaces the second edition (ISO 14341:2010), which has been technically revised. The main changes compared to the previous edition are as follows: — all references have been updated; — in Table 3A, the footnote for Cu that appeared in the 2008 edition has been reintroduced; — in Table 3B and Table 4B, a new symbol S8 has been added; — in Table 3B, Ni, Cr, Mo and V values have been added for symbols S2, S3, S4, S5, S6, and S7; — Clause 8 has been updated to the latest agreed text; — in Clause 11, an example for a Z classification has been added as Example 2A. Any feedback or questions on this document should be directed to the user’s national standards body. A complete listing of these bodies can be found at www .iso .org/ members .html. Official interpretations of ISO/TC 44 documents, where they exist, are available from this page: https:// committee .iso .org/ sites/ tc44/ home/ interpretation .html. iv © ISO 2020 – All rights reserved

<!-- Pagina 5 (motore: pdfplumber) -->

## Introduction

This document recognizes that there are two somewhat different approaches in the global market to classifying a given wire electrode, and allows for either or both to be used, to suit a particular market need. Application of either type of classification designation (or both where suitable) identifies a product as classified in accordance with this document. This document provides a classification in order to designate wire electrodes in terms of their chemical composition and, where required, in terms of the yield strength, tensile strength and elongation of the all-weld metal. The ratio of yield strength to tensile strength of weld metal is generally higher than that of parent metal. Users should note that matching weld metal yield strength to parent metal yield strength does not necessarily ensure that the weld metal tensile strength matches that of the parent material. Therefore, where the application requires matching tensile strength, selection of the consumable should be made by reference to column 3 of Table 1A or 1B. It should be noted that the mechanical properties of all-weld metal test specimens used to classify the electrodes vary from those obtained in production joints because of differences in welding procedures such as electrode size, width of weave, welding position and material composition. © ISO 2020 – All rights reserved v

<!-- Pagina 6 (motore: pdfplumber) -- ATTENZIONE: testo di bassa qualita' (probabile font non standard), revisionare -->

<!-- Pagina 7 (motore: pdfplumber) -->

## INTERNATIONAL STANDARD ISO 14341:2020(E)

## Welding consumables — Wire electrodes and weld

## deposits for gas shielded metal arc welding of non alloy

## and fine grain steels — Classification

# 1 Scope

This document specifies requirements for classification of wire electrodes and weld deposits in the as-welded condition and in the post-weld heat-treated condition for gas shielded metal arc welding of non alloy and fine grain steels with a minimum yield strength of up to 500 MPa or a minimum tensile strength of up to 570 MPa. One wire electrode can be tested and classified with different shielding gases. This document constitutes a combined specification providing classification utilizing a system based upon the yield strength and the average impact energy of 47 J of all-weld metal, or utilizing a system based upon the tensile strength and the average impact energy of 27 J of all-weld metal.

a) Clauses and tables which carry the suffix letter “A” are applicable only to wire electrodes classified

to the system based on the yield strength and the average impact energy of 47 J of all-weld metal in accordance with this document.

b) Clauses and tables which carry the suffix letter “B” are applicable only to wire electrodes classified

to the system based on the tensile strength and the average impact energy of 27 J of all-weld metal in accordance with this document.

c) Clauses and tables which have neither the suffix letter “A” nor the suffix letter “B” are applicable to

all wire electrodes classified in accordance with this document.

# 2 Normative references

The following documents are referred to in the text in such a way that some or all of their content constitutes requirements of this document. For dated references, only the edition cited applies. For undated rWefeelrdeinngc ecso, nthsuem laatbelsets e —dit Tioenc honf itchael dreeflievreernyc ceodn ddoitciuonmse fnotr ( fiinllcelru dminagte arniayl sa manedn dflmuxeenst s—) a Tpyppleie so.f product, dimensions, tolerances and markings ISO 544, Welding consumables — Gases and gas mixtures for fusion welding and allied processes ISO 14175:2W00el8d,i ng consumables — Procurement of filler materials and fluxes ISO 14344, Welding consumables — Test methods — Part 1: Test methods for all-weld metal test specimens in steel, nickel and nickel alloys ISO 15792-1:2020, Quantities and units — Part 1: General ISO 80000-1:2009, . Corrected by ISO 80000-1:2009/Cor 1:2011

# 3 Terms and definitions

No terms and definitions are listed in this document. ISO and IEC maintain terminological databases for use in standardization at the following addresses: — ISO Online browsing platform: available at https:// www .iso .org/ obp — IEC Electropedia: available at http:// www .electropedia .org/

<!-- Pagina 8 (motore: pdfplumber) -->

# 4 Classification

Classification designations are based upon two approaches to indicate the tensile properties and the impact properties of the all-weld metal obtained with a given electrode. The two designation approaches include additional designators for some other classification requirements, but not all, as will be clear from the following subclauses. In most cases, a given commercial product can be classified in both systems. Then either or both classification designations can be used for the product. A wire electrode shall be classified according to its chemical composition as in Table 3A or Table 3B. A weld deposit shall be classified with additional symbols according to the mechanical properties of its a4lAl- wCellads msiefitcaal,t uiosnin bgy a ysiheiledld sitnrge gnagst hfr aomnd a 4 s7p eJ cific gro4uBp .Classification by tensile strength and 27 J impact energy impact energy The classification is divided into five parts: The classification is divided into five parts:

1) the first part gives a symbol indicating the 1) the first part gives a symbol indicating the

product/process to be identified; product/process to be identified;

2) the second part gives a symbol indicating 2) the second part gives a symbol indicating

the strength and elongation of the all-weld the strength and elongation of the all-weld metal (see Table 1A); metal in either the as-welded or post-weld heat-treated condition (see Table 1B);

3) the third part gives a symbol indicating the 3) the third part gives a symbol indicating

impact properties of the all-weld metal (see the impact properties of the all-weld metal Table 2); in the same condition as specified for the tensile strength (see Table 2). The letter U after this symbol indicates that the deposit meets an average optional requirement of 47 J at the designated impact test temperature;

4) the fourth part gives a symbol indicating the 4) the fourth part gives a symbol indicating the

shielding gas used (see 5.4); shielding gas used (see 5.4);

5) the fifth part gives a symbol indicating the 5) the fifth part gives a symbol indicating the

chemical composition of the wire electrode chemical composition of the wire electrode used (see Table 3A). used (see Table 3B).

# 5 Symbols and requirements

## 5.1 Symbol for product/process

The symbol for a weld deposit produced by gas shielded metal arc welding shall be the letter G placed at the beginning of the designation. The symbol for a wire electrode for use in gas shielded metal arc welding shall be the letter G placed at the beginning of the wire electrode designation.

<!-- Pagina 9 (motore: pdfplumber) -->

## 5.2 Symbol for strength and elongation of all-weld metal

5.2A Classification by yield strength and 47 J 5.2B Classification by tensile strength and impact energy 27 J impact energy The symbols in Table 1A indicate the yield strength, The symbols in Table 1B indicate the yield strength, tensile strength, and elongation of the all-weld tensile strength, and elongation of the all-weld metal in the as-welded condition determined in metal in the as-welded condition or in the post-weld accordance with Clause 6. heat-treated condition determined in accordance with Clause 6. Table 1A — Symbols for strength Table 1B — Symbols for strength and and elongation of all-weld metal elongation of all-weld metal Minimum Minimum Tensile Minimum Tensile Minimum Symbol yield Symbol yield strength elongation strength elongation strength strength a b c a b MPa MPa % MPa MPa %

# 35 355 440 to 570 22 43X 330 430 to 600 20

# 38 380 470 to 600 20 49X 390 490 to 670 18

# 42 420 500 to 640 20 55X 460 550 to 740 17

# 46 460 530 to 680 20 57X 490 570 to 770 17

a

# 50 500 560 to 720 18 X is A or P, where A indicates testing in the

as-welded condition and P indicates testing in R a the post-weld heat-treated condition. For yield strengthR, the lower yield strength R b ( eL) is used when yielding occurs. Otherwise the For yield strength, theR lower yield strength 0,2 % proof strength ( p0,2) is used. ( eL) is used when yielding occurs. Otherwise b the 0,2 % proof strength ( p0,2) is used. Gauge length is equal to five times the test c specimen diameter. Gauge length is equal to five times the test specimen diameter.

## 5.3 Symbol for impact properties of all-weld metal

5.3A Classification by yield strength and 47 J 5.3B Classification by tensile strength and impact energy 27 J impact energy The symbols in Table 2 indicate the temperature at The symbols in Table 2 indicate the temperature at which an impact energy of 47 J is achieved under which an impact energy of 27 J is achieved under the conditions given in Clause 6. the conditions given in Clause 6. Three test specimens shall be tested. Only one Five test specimens shall be tested. The lowest and individual value may be lower than 47 J but not highest values obtained shall be disregarded. Two lower than 32 J. of the three remaining values shall be greater than the specified 27 J level, one of the three may be lower but shall not be less than 20 J. The average of the three remaining values shall be at least 27 J. The addition of the optional symbol U, immediately after the symbol for condition of heat treatment, indicates that the supplemental requirement of 47 J impact energy at the normal 27 J impact test temperature has also been satisfied. For the 47 J impact requirement, the number of specimens tested and values obtained shall meet the requirement of 5.3A.

| Symbol | Minimum yield strength a | Tensile strength | Minimum elongation b |
| --- | --- | --- | --- |
|  |  |  |  |
|  | MPa | MPa | % |
| 35 | 355 | 440 to 570 | 22 |
| 38 | 380 | 470 to 600 | 20 |
| 42 | 420 | 500 to 640 | 20 |
| 46 460 530 to 680 20 50 500 560 to 720 18 R a For yield strengthR, the lower yield strength ( eL) is used when yielding occurs. Otherwise the 0,2 % proof strength ( p0,2) is used. b Gauge length is equal to five times the test |  |  |  |

| Symbol a | Minimum yield strength b | Tensile strength | Minimum elongation c |
| --- | --- | --- | --- |
|  |  |  |  |
|  | MPa | MPa | % |
| 43X | 330 | 430 to 600 | 20 |
| 49X | 390 | 490 to 670 | 18 |
| 55X 460 550 to 740 17 57X 490 570 to 770 17 a X is A or P, where A indicates testing in the as-welded condition and P indicates testing in the post-weld heat-treated condition. R b For yield strength, theR lower yield strength ( eL) is used when yielding occurs. Otherwise the 0,2 % proof strength ( p0,2) is used. c |  |  |  |

<!-- Pagina 10 (motore: pdfplumber) -->

When an all-weld metal has been classified for a certain temperature, it automatically covers any higher temperature listed in Table 2. Table 2 — Symbol for impact properties of all-weld metal Temperature for minimum average Symbol impact energy of 47 J or 27 J a,b b °C Z No requirement a b A or Y +20 0 0

# 2 −20

# 3 −30

# 4 −40

# 5 −50

# 6 −60

# 7 −70

# 8 −80

# 9 −90

# 10 −100

a See 5.3A. b See 5.3B.

## 5.4 Symbol for shielding gas

The symbols for shielding gases shall be in accordance with ISO 14175:2008, for example: — the symbol M12, for mixed gases, shall be used when the classification has been performed with shielding gas ISO 14175-M12, but without helium; — the symbol M13 shall be used when the classification has been performed with shielding gas ISO 14175-M13; — the symbol M20, for mixed gases, shall be used when the classification has been performed with shielding gas ISO 14175-M20, but without helium; — the symbol M21, for mixed gases, shall be used when the classification has been performed with shielding gas ISO 14175-M21, but without helium; — the symbol C1 shall be used when the classification has been performed with shielding gas ISO 14175- C1, carbon dioxide; — the symbol Z is used for an unspecified shielding gas.

## 5.5 Symbol for chemical composition of wire electrodes

The symbol in Table 3A or Table 3B indicates the chemical composition of the wire electrode and includes an indication of characteristic alloying elements.

| Symbol | Temperature for minimum average impact energy of 47 J or 27 J a,b b |
| --- | --- |
|  |  |
|  | °C |
| Z a b | No requirement |
| A or Y | +20 |
| 0 | 0 |
| 2 | −20 |
| 3 | −30 |
| 4 | −40 |
| 5 | −50 |
| 6 | −60 |
| 7 | −70 |
| 8 | −80 |
| 9 −90 10 −100 a See 5.3A. |  |

<!-- Pagina 11 (motore: pdfplumber) -->

noitisopmoc lacimehc rof lobmyS

## —

A3 elbaT )ygrene tcapmi J 74 dna htgnerts dleiy yb nonitoaictiisfoispsmaloCc( lacimehC lobmyS a )ssam yb( % ,

## b

rZ + iT lA uC V oM rC iN S P nM iS C 51,0 20,0 53,0 30,0 51,0 51,0 51,0 520,0 520,0 03,1 ot 09,0 08,0 ot 05,0 41,0 ot 60,0 iS2 51,0 20,0 53,0 30,0 51,0 51,0 51,0 520,0 520,0 06,1 ot 03,1 00,1 ot 07,0 41,0 ot 60,0 1iS3 51,0 20,0 53,0 30,0 51,0 51,0 51,0 520,0 520,0 06,1 ot 03,1 03,1 ot 00,1 41,0 ot 60,0 2iS3 51,0 20,0 53,0 30,0 51,0 51,0 51,0 520,0 520,0 09,1 ot 06,1 02,1 ot 08,0 41,0 ot 60,0 1iS4 52,0 ot 50,0 02,0 ot 50,0 53,0 30,0 51,0 51,0 51,0 520,0 520,0 04,1 ot 09,0 08,0 ot 04,0 41,0 ot 40,0 iT2 51,0 57,0 ot 53,0 53,0 30,0 51,0 51,0 51,0 520,0 520,0 03,1 ot 09,0 05,0 ot 03,0 41,0 ot 80,0 lA2 51,0 20,0 53,0 30,0 51,0 51,0 05,1 ot 08,0 020,0 020,0 06,1 ot 00,1 09,0 ot 05,0 41,0 ot 60,0 1iN3 51,0 20,0 53,0 30,0 51,0 51,0 07,2 ot 01,2 020,0 020,0 04,1 ot 08,0 08,0 ot 04,0 41,0 ot 60,0 2iN2 51,0 20,0 53,0 30,0 06,0 ot 04,0 51,0 51,0 020,0 020,0 03,1 ot 09,0 07,0 ot 03,0 21,0 ot 80,0 oM2 51,0 20,0 53,0 30,0 06,0 ot 04,0 51,0 51,0 520,0 520,0 01,2 ot 07,1 08,0 ot 05,0 41,0 ot 60,0 oM4 c noitisopmoc deerga rehto ynA Z a .seulav mumixam era elbat eht ni nwohs seulav elgniS

## b

.ssam yb % 53,0 deecxe ton llahs gnitaoc yna sulp leets eht ni tnetnoc reppoc laudiseR c ton era segnar noitisopmoc lacimehc ehT .Z rettel eht yb dexiferp dna ylralimis dezilobmys eb llahs elbat siht ni detsil ton si noitisopmoc lacimehc eht hcihw rof selbamusnoC .elbaegnahcretni eb ton yam noitacifissalc Z emas eht htiw sedortcele owt erofereht dna deificeps

| )ygrene tcapmi J 74 dna htgnerts a dleiy yb nonitoaictiisfoispsmaloCc( lacimehC |  | rZ + iT | 51,0 | 51,0 | 51,0 | 51,0 | 52,0 ot 50,0 | 51,0 | 51,0 | 51,0 | 51,0 20,0 53,0 30,0 06,0 ot 04,0 51,0 51,0 020,0 020,0 03,1 ot 09,0 07,0 ot 03,0 21,0 ot 80,0 | 51,0 20,0 53,0 30,0 06,0 ot 04,0 noitisopmoc 51,0 deerga 51,0 .ssam rehto yb ynA % 53,0 520,0 deecxe ton 520,0 llahs .seulav gnitaoc 01,2 mumixam ot yna 07,1 sulp era leets 08,0 elbat eht ot 05,0 eht ni tnetnoc ni 41,0 nwohs reppoc ot seulav 60,0 laudiseR elgniS oM4 c Z a b c |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
|  |  | lA | 20,0 | 20,0 | 20,0 | 20,0 | 02,0 ot 50,0 | 57,0 ot 53,0 | 20,0 | 20,0 |  |  |
|  | b | uC | 53,0 | 53,0 | 53,0 | 53,0 | 53,0 | 53,0 | 53,0 | 53,0 |  |  |
|  |  | V | 30,0 | 30,0 | 30,0 | 30,0 | 30,0 | 30,0 | 30,0 | 30,0 |  |  |
|  | )ssam | oM | 51,0 | 51,0 | 51,0 | 51,0 | 51,0 | 51,0 | 51,0 | 51,0 |  |  |
|  | yb( % , | rC | 51,0 | 51,0 | 51,0 | 51,0 | 51,0 | 51,0 | 51,0 | 51,0 |  |  |
|  |  | iN | 51,0 | 51,0 | 51,0 | 51,0 | 51,0 | 51,0 | 05,1 ot 08,0 | 07,2 ot 01,2 |  |  |
|  |  | S | 520,0 | 520,0 | 520,0 | 520,0 | 520,0 | 520,0 | 020,0 | 020,0 |  |  |
|  |  | P | 520,0 | 520,0 | 520,0 | 520,0 | 520,0 | 520,0 | 020,0 | 020,0 |  |  |
|  |  | nM | 03,1 ot 09,0 | 06,1 ot 03,1 | 06,1 ot 03,1 | 09,1 ot 06,1 | 04,1 ot 09,0 | 03,1 ot 09,0 | 06,1 ot 00,1 | 04,1 ot 08,0 |  |  |
|  |  | iS | 08,0 ot 05,0 | 00,1 ot 07,0 | 03,1 ot 00,1 | 02,1 ot 08,0 | 08,0 ot 04,0 | 05,0 ot 03,0 | 09,0 ot 05,0 | 08,0 ot 04,0 |  |  |
|  |  | C | 41,0 ot 60,0 | 41,0 ot 60,0 | 41,0 ot 60,0 | 41,0 ot 60,0 | 41,0 ot 40,0 | 41,0 ot 80,0 | 41,0 ot 60,0 | 41,0 ot 60,0 |  |  |
| lobmyS |  |  | iS2 | 1iS3 | 2iS3 | 1iS4 | iT2 | lA2 | 1iN3 | 2iN2 | oM2 |  |

<!-- Pagina 12 (motore: pdfplumber) -->

noitisopmoc lacimehc rof lobmyS — B3 elbaT )ygrene tcapmi J 72 dna htgnerts elisnet yb nnooitiaticsiofipsmsaolCc (l acimehC lobmyS b,a )ssam yb( % , c rZ + iT lA uC V oM rC iN S P nM iS C 51,0 ot 50,0 : iT 51,0 ot 50,0 05,0 30,0 51,0 51,0 51,0 030,0 520,0 04,1 ot 09,0 07,0 ot 04,0 70,0 2S 21,0 ot 20,0 : rZ — — 05,0 30,0 51,0 51,0 51,0 530,0 520,0 04,1 ot 09,0 57,0 ot 54,0 51,0 ot 60,0 3S — — 05,0 30,0 51,0 51,0 51,0 530,0 520,0 05,1 ot 00,1 58,0 ot 56,0 51,0 ot 60,0 4S — — 05,0 30,0 51,0 51,0 51,0 530,0 520,0 58,1 ot 04,1 51,1 ot 08,0 51,0 ot 60,0 6S — — 05,0 30,0 51,0 51,0 51,0 530,0 520,0 00,2 ot 05,1 08,0 ot 05,0 51,0 ot 70,0 7S 03,0 ot 01,0 05,0 30,0 51,0 51,0 51,0 530,0 520,0 09,1 ot 04,1 01,1 ot 55,0 01,0 ot 20,0 8S 03,0 ot 20,0 — 05,0 — — — — 030,0 030,0 09,1 ot 04,1 01,1 ot 55,0 51,0 ot 20,0 11S — — 05,0 — — — — 030,0 030,0 09,1 ot 52,1 00,1 ot 55,0 51,0 ot 20,0 21S 03,0 ot 20,0 05,0 ot 01,0 05,0 — — — — 030,0 030,0 09,1 ot 53,1 01,1 ot 55,0 51,0 ot 20,0 31S — — 05,0 — — — — 030,0 030,0 06,1 ot 03,1 53,1 ot 00,1 51,0 ot 20,0 41S 51,0 ot 20,0 — 05,0 — — — — 030,0 030,0 06,1 ot 00,1 00,1 ot 04,0 51,0 ot 20,0 51S — — 05,0 — — — — 030,0 030,0 06,1 ot 09,0 00,1 ot 04,0 51,0 ot 20,0 61S 03,0 ot 20,0 — 05,0 — — — — 030,0 030,0 01,2 ot 05,1 55,0 ot 02,0 51,0 ot 20,0 71S 03,0 ot 20,0 — 05,0 — — — — 030,0 030,0 04,2 ot 06,1 01,1 ot 05,0 51,0 ot 20,0 81S 53,0 — 56,0 ot 04,0 — 02,0 520,0 520,0 03,1 07,0 ot 03,0 21,0 3M1S — — 05,0 — 56,0 ot 04,0 — — 520,0 520,0 04,1 ot 06,0 07,0 ot 03,0 21,0 3M2S — — 05,0 — 56,0 ot 04,0 — — 520,0 520,0 05,1 ot 08,0 09,0 ot 03,0 21,0 13M2S 03,0 ot 20,0 :iT — 05,0 — 56,0 ot 04,0 — — 520,0 520,0 08,1 ot 00,1 00,1 ot 04,0 21,0

## T3M3S

— — 05,0 — 54,0 ot 01,0 — — 520,0 520,0 01,2 ot 04,1 00,1 ot 04,0 51,0 ot 50,0 1M3S 03,0 ot 20,0 :iT — 05,0 — 54,0 ot 01,0 — — 520,0 520,0 01,2 ot 04,1 00,1 ot 04,0 21,0

## T1M3S

— — 05,0 — 06,0 ot 04,0 — — 520,0 520,0 01,2 ot 06,1 08,0 ot 05,0 21,0 ot 70,0 13M4S 03,0 ot 20,0 :iT — 05,0 — 56,0 ot 04,0 — — 520,0 520,0 02,2 ot 06,1 08,0 ot 05,0 21,0

## T3M4S

— — 53,0 — 53,0 — 00,1 ot 06,0 520,0 520,0 52,1 05,0 ot 02,0 21,0 1NS

## a

eht ,krow siht fo esruoc eht ni ,detacidni si stnemele rehto fo ecneserp eht fI .elbat siht ni nwohs era seulav hcihw rof stnemele cificeps eht rof desylana eb llahs edortcele ehT .)ssam yb( % 05,0 deecxe ton seod tnetnoc )nori gnidulcxe( latot rieht taht erusne ot denimreted eb llahs stnemele eseht fo tnuoma b .seulav mumixam era elbat eht ni nwohs seulav elgniS c .gnitaoc yna sulp leets eht ni reppoc laudiser yna gnidulcnI d .stekcarb ni dedda eb yam rerutcafunam eht yb dehsilbatse lobmys lacimehc ehT .ZS dezilobmys eb nac elbat siht ni detsil ton selbamusnoC

| )ygrene tcapmi J 72 dna htgnerts b,a elisnet yb nnooitiaticsiofipsmsaolCc (l acimehC | rZ + iT | 51,0 ot 50,0 : iT | 21,0 ot 20,0 : rZ | — | — | — | — | 03,0 ot 01,0 | 03,0 ot 20,0 | — | 03,0 ot 20,0 | — | 51,0 ot 20,0 | — | 03,0 ot 20,0 | 03,0 ot 20,0 |  | — | — | 03,0 ot 20,0 :iT | — | 03,0 ot 20,0 :iT | 03,0 ot — 20,0 :iT | eht ,krow — siht fo esruoc eht — ni ,detacidni 53,0 si stnemele .)ssam — rehto yb( fo % ecneserp 05,0 53,0 deecxe eht ton fI .elbat seod — siht tnetnoc 00,1 ni nwohs )nori ot 06,0 era gnidulcxe( seulav 520,0 hcihw latot rieht 520,0 rof .gnitaoc stnemele taht .seulav erusne yna 52,1 cificeps mumixam sulp ot denimreted leets eht 05,0 rof era eht ot desylana elbat ni eb reppoc 02,0 llahs eht eb ni laudiser stnemele nwohs llahs 21,0 edortcele seulav yna eseht gnidulcnI fo elgniS 1NS ehT tnuoma a b c |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
|  | lA | 51,0 ot 50,0 |  | — | — | — | — |  | — | — | 05,0 ot 01,0 | — | — | — | — | — |  | — | — | — | — | — | — — |  |
|  | c uC | 05,0 |  | 05,0 | 05,0 | 05,0 | 05,0 | 05,0 | 05,0 | 05,0 | 05,0 | 05,0 | 05,0 | 05,0 | 05,0 | 05,0 | 53,0 | 05,0 | 05,0 | 05,0 | 05,0 | 05,0 | 05,0 05,0 |  |
|  | V | 30,0 |  | 30,0 | 30,0 | 30,0 | 30,0 | 30,0 | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — — |  |
|  | )ssam oM yb | 51,0 |  | 51,0 | 51,0 | 51,0 | 51,0 | 51,0 | — | — | — | — | — | — | — | — | 56,0 ot 04,0 | 56,0 ot 04,0 | 56,0 ot 04,0 | 56,0 ot 04,0 | 54,0 ot 01,0 | 54,0 ot 01,0 | 06,0 56,0 ot ot 04,0 04,0 |  |
|  | ( % , rC | 51,0 |  | 51,0 | 51,0 | 51,0 | 51,0 | 51,0 | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — — |  |
|  | iN | 51,0 |  | 51,0 | 51,0 | 51,0 | 51,0 | 51,0 | — | — | — | — | — | — | — | — | 02,0 | — | — | — | — | — | — — |  |
|  | S | 030,0 |  | 530,0 | 530,0 | 530,0 | 530,0 | 530,0 | 030,0 | 030,0 | 030,0 | 030,0 | 030,0 | 030,0 | 030,0 | 030,0 | 520,0 | 520,0 | 520,0 | 520,0 | 520,0 | 520,0 | 520,0 520,0 |  |
|  | P | 520,0 |  | 520,0 | 520,0 | 520,0 | 520,0 | 520,0 | 030,0 | 030,0 | 030,0 | 030,0 | 030,0 | 030,0 | 030,0 | 030,0 | 520,0 | 520,0 | 520,0 | 520,0 | 520,0 | 520,0 | 520,0 520,0 |  |
|  | nM | 04,1 ot 09,0 |  | 04,1 ot 09,0 | 05,1 ot 00,1 | 58,1 ot 04,1 | 00,2 ot 05,1 | 09,1 ot 04,1 | 09,1 ot 04,1 | 09,1 ot 52,1 | 09,1 ot 53,1 | 06,1 ot 03,1 | 06,1 ot 00,1 | 06,1 ot 09,0 | 01,2 ot 05,1 | 04,2 ot 06,1 | 03,1 | 04,1 ot 06,0 | 05,1 ot 08,0 | 08,1 ot 00,1 | 01,2 ot 04,1 | 01,2 ot 04,1 | 01,2 02,2 ot ot 06,1 06,1 |  |
|  | iS | 07,0 ot 04,0 |  | 57,0 ot 54,0 | 58,0 ot 56,0 | 51,1 ot 08,0 | 08,0 ot 05,0 | 01,1 ot 55,0 | 01,1 ot 55,0 | 00,1 ot 55,0 | 01,1 ot 55,0 | 53,1 ot 00,1 | 00,1 ot 04,0 | 00,1 ot 04,0 | 55,0 ot 02,0 | 01,1 ot 05,0 | 07,0 ot 03,0 | 07,0 ot 03,0 | 09,0 ot 03,0 | 00,1 ot 04,0 | 00,1 ot 04,0 | 00,1 ot 04,0 | 08,0 08,0 ot ot 05,0 05,0 |  |
|  | C | 70,0 |  | 51,0 ot 60,0 | 51,0 ot 60,0 | 51,0 ot 60,0 | 51,0 ot 70,0 | 01,0 ot 20,0 | 51,0 ot 20,0 | 51,0 ot 20,0 | 51,0 ot 20,0 | 51,0 ot 20,0 | 51,0 ot 20,0 | 51,0 ot 20,0 | 51,0 ot 20,0 | 51,0 ot 20,0 | 21,0 | 21,0 | 21,0 | 21,0 | 51,0 ot 50,0 | 21,0 | 21,0 21,0 ot 70,0 |  |
| lobmyS |  | 2S |  | 3S | 4S | 6S | 7S | 8S | 11S | 21S | 31S | 41S | 51S | 61S | 71S | 81S | 3M1S | 3M2S | 13M2S | T3M3S | 1M3S | T1M3S | 13M4S T3M4S |  |

<!-- Pagina 13 (motore: pdfplumber) -->

)deunitnoc( B3 elbaT noitisopmoc lacimehC lobmyS b,a )ssam yb( % , c rZ + iT lA uC V oM rC iN S

## P

nM iS C — — 53,0 50,0 53,0 51,0 01,1 ot 08,0 520,0 520,0 52,1 08,0 ot 04,0 21,0 2NS — — 53,0 — 53,0 — 09,1 ot 05,1 520,0 520,0 06,1 ot 02,1 08,0 ot 03,0 21,0 3NS — — 53,0 — — — 57,2 ot 00,2 520,0 520,0 52,1 08,0 ot 04,0 21,0 5NS — — 53,0 — 53,0 — 57,3 ot 00,3 520,0 520,0 52,1 05,0 ot 02,0 21,0 7NS — — 53,0 — — — 57,3 ot 00,3 520,0 520,0 52,1 08,0 ot 04,0 21,0 17NS — — 53,0 — 53,0 — 57,4 ot 00,4 520,0 520,0 04,1 05,0 01,0 9NS ot 02,0 ot 05,0 — — — — 03,0 ot 01,0 030,0 030,0 56,1 ot 00,1 09,0 ot 06,0 21,0

## CCNS

06,0 08,0 ot 02,0 ot 05,0 03,0 ot 20,0 :iT — — — 03,0 ot 01,0 030,0 030,0 56,1 ot 01,1 09,0 ot 06,0 21,0

## TCCNS

06,0 08,0 ot 02,0 ot 05,0 03,0 ot 20,0 :iT — — 03,0 ot 20,0 04,0 ot 01,0 030,0 030,0 08,1 ot 02,1 08,0 ot 05,0 21,0

## 1TCCNS

06,0 08,0 ot 02,0 ot 05,0 03,0 ot 20,0 :iT — — — 08,0 ot 04,0 030,0 030,0 07,1 ot 01,1 09,0 ot 05,0 21,0

## 2TCCNS

06,0 08,0 03,0 ot 20,0 :iT — 05,0 — 06,0 ot 02,0 — 08,0 ot 04,0 520,0 520,0 03,2 ot 07,1 00,1 ot 06,0 21,0

## T2M1NS

03,0 ot 20,0 :iT — 05,0 — 54,0 ot 01,0 — 06,1 ot 08,0 520,0 520,0 09,1 ot 01,1 08,0 ot 03,0 21,0

## T1M2NS

03,0 ot 20,0 :iT — 05,0 — 06,0 ot 02,0 — 02,1 ot 07,0 520,0 520,0 08,1 ot 00,1 09,0 ot 03,0 51,0 ot 50,0

## T2M2NS

03,0 ot 20,0 :iT — 05,0 — 56,0 ot 04,0 — 02,1 ot 07,0 520,0 520,0 01,2 ot 04,1 09,0 ot 03,0 51,0 ot 50,0

## T3M2NS

03,0 ot 20,0 :iT — 05,0 — 58,0 ot 55,0 — 03,1 ot 08,0 520,0 520,0 03,2 ot 07,1 00,1 ot 05,0 21,0

## T4M2NS

d noitisopmoc deerga ynA ZS a eht ,krow siht fo esruoc eht ni ,detacidni si stnemele rehto fo ecneserp eht fI .elbat siht ni nwohs era seulav hcihw rof stnemele cificeps eht rof desylana eb llahs edortcele ehT .)ssam yb( % 05,0 deecxe ton seod tnetnoc )nori gnidulcxe( latot rieht taht erusne ot denimreted eb llahs stnemele eseht fo tnuoma b .seulav mumixam era elbat eht ni nwohs seulav elgniS c .gnitaoc yna sulp leets eht ni reppoc laudiser yna gnidulcnI d .stekcarb ni dedda eb yam rerutcafunam eht yb dehsilbatse lobmys lacimehc ehT .ZS dezilobmys eb nac elbat siht ni detsil ton selbamusnoC

| b,a noitisopmoc lacimehC | rZ + iT |  | — | — | — | — | — — | — | 03,0 ot 20,0 :iT | 03,0 ot 20,0 :iT | 03,0 ot 20,0 :iT |  | 03,0 ot 20,0 :iT | 03,0 ot 20,0 :iT | 03,0 ot 20,0 :iT | 03,0 ot 20,0 :iT — 05,0 — 56,0 ot 04,0 — 02,1 ot 07,0 520,0 520,0 01,2 ot 04,1 09,0 ot 03,0 51,0 ot 50,0 | eht 03,0 ,krow ot 20,0 siht :iT fo esruoc eht — ni ,detacidni 05,0 si stnemele .)ssam — rehto yb( 58,0 fo % ecneserp 05,0 ot deecxe 55,0 noitisopmoc eht ton fI .elbat seod — siht tnetnoc deerga 03,1 ni nwohs )nori ot ynA 08,0 era gnidulcxe( seulav 520,0 hcihw latot rieht 520,0 rof .gnitaoc stnemele taht .seulav 03,2 erusne yna ot cificeps mumixam sulp 07,1 ot denimreted leets eht 00,1 rof era eht ot desylana elbat ni eb reppoc 05,0 llahs eht eb ni laudiser stnemele nwohs llahs 21,0 edortcele seulav yna eseht gnidulcnI T4M2NS fo elgniS d ehT tnuoma ZS a b c |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
|  | lA |  | — | — | — | — | — — | — | — | — | — |  | — | — | — |  |  |
|  | c uC |  | 53,0 | 53,0 | 53,0 | 53,0 | 53,0 53,0 | ot 06,0 02,0 | ot 06,0 02,0 | ot 06,0 02,0 | ot 02,0 | 06,0 | 05,0 | 05,0 | 05,0 |  |  |
|  | V |  | 50,0 | — | — | — | — — | — | — | — | — |  | — | — | — |  |  |
|  | )ssam oM yb |  | 53,0 | 53,0 | — | 53,0 | 53,0 — | — | — | 03,0 ot 20,0 | — |  | 06,0 ot 02,0 | 54,0 ot 01,0 | 06,0 ot 02,0 |  |  |
|  | ( % , rC |  | 51,0 | — | — | — | — — | ot 08,0 05,0 | ot 08,0 05,0 | ot 08,0 05,0 | ot 05,0 | 08,0 | — | — | — |  |  |
|  | iN |  | 01,1 ot 08,0 | 09,1 ot 05,1 | 57,2 ot 00,2 | 57,3 ot 00,3 | 57,3 57,4 ot ot 00,3 00,4 | 03,0 ot 01,0 | 03,0 ot 01,0 | 04,0 ot 01,0 | 08,0 ot 04,0 |  | 08,0 ot 04,0 | 06,1 ot 08,0 | 02,1 ot 07,0 |  |  |
|  | S |  | 520,0 | 520,0 | 520,0 | 520,0 | 520,0 520,0 | 030,0 | 030,0 | 030,0 | 030,0 |  | 520,0 | 520,0 | 520,0 |  |  |
|  | P |  | 520,0 | 520,0 | 520,0 | 520,0 | 520,0 520,0 | 030,0 | 030,0 | 030,0 | 030,0 |  | 520,0 | 520,0 | 520,0 |  |  |
|  | nM |  | 52,1 | 06,1 ot 02,1 | 52,1 | 52,1 | 52,1 04,1 | 56,1 ot 00,1 | 56,1 ot 01,1 | 08,1 ot 02,1 | 07,1 ot 01,1 |  | 03,2 ot 07,1 | 09,1 ot 01,1 | 08,1 ot 00,1 |  |  |
|  | iS |  | 08,0 ot 04,0 | 08,0 ot 03,0 | 08,0 ot 04,0 | 05,0 ot 02,0 | 08,0 05,0 ot 04,0 | 09,0 ot 06,0 | 09,0 ot 06,0 | 08,0 ot 05,0 | 09,0 ot 05,0 |  | 00,1 ot 06,0 | 08,0 ot 03,0 | 09,0 ot 03,0 |  |  |
|  | C |  | 21,0 | 21,0 | 21,0 | 21,0 | 21,0 01,0 | 21,0 | 21,0 | 21,0 | 21,0 |  | 21,0 | 21,0 | 51,0 ot 50,0 |  |  |
| lobmyS |  |  | 2NS | 3NS | 5NS | 7NS | 17NS 9NS | CCNS | TCCNS | 1TCCNS | 2TCCNS |  | T2M1NS | T1M2NS | T2M2NS | T3M2NS |  |

<!-- Pagina 14 (motore: pdfplumber) -->

# 6 Mechanical tests

6A Classification by yield strength and 47 J 6B Classification by tensile strength and 27 J impact energy impact energy Tensile and impact tests and any required Tensile and impact tests shall be carried out retests shall be carried out in the as-welded in the as-welded condition or in the post-weld condition using an all-weld metal test assembly heat-treated condition using an all-weld metal type 1.3 in accordance with ISO 15792-1:2020, test assembly type 1.3 in accordance with using a 1,2 mm diameter wire electrode under ISO 15792-1:2020, using a 1,2 mm diameter wire welding conditions specified in 6.1A and 6.2A. electrode under welding conditions specified in 6.1B and 6.2B. If 1,2 mm is not manufactured, the closest size at settings as recommended by the manufacturer shall be used.

## 6.1 Preheating and interpass temperatures

6.1A Classification by yield strength and 47 J 6.1B Classification by tensile strength and impact energy 27 J impact energy Preheating is not required; welding may start from Preheating and interpass temperatures shall be room temperature. The interpass temperature selected for the appropriate weld metal type from shall be measured using temperature indicator Table 4B. The interpass temperature shall be meascrayons, surface thermometers or thermocouples ured using temperature indicator crayons, surface (for example, in accordance with ISO 13916). thermometers or thermocouples (for example, in accordance with ISO 13916). The interpass temperature shall not exceed 250 °C. If, after any pass, this interpass temperature is Welding shall continue until the assembly has exceeded, the test assembly shall be cooled in air reached a maximum interpass temperature (165 °C). to a temperature below that limit. If, after any pass, this interpass temperature is exceeded, the test assembly shall be cooled in air to a temperature within that range. If below the indicated interpass temperature, the test assembly shall be reheated into interpass range.

<!-- Pagina 15 (motore: pdfplumber) -->

Table 4B — Preheating and interpass temperatures (Classification by tensile strength and 27 J impact energy) Interpass Preheat Symbol temperatemperature ture °C °C S2, S3, S4, S6, S7, S8, Room S11, S12, S13, S14, temperature

## S15, S16, S17, S18

S1M3, S2M3, S2M31, S3M3T, S3M1, S3M1T,

## S4M31, S4M3T

## SN1, SN2, SN3, SN5, 150 ± 15

## SN7, SN71, SN9

Minimum 100 SNCC, SNCCT,

## SNCCT1, SNCCT2

SN1M2T, SN2M1T, SN2M2T, SN2M3T,

## SN2M4T

As agreed between SZ purchaser and supplier

## 6.2 Welding conditions and pass sequence

6.2A Classification by yield strength and 47 J 6.2B Classification by tensile strength and 27 J impact energy impact energy The welding conditions in Table 5A shall be used The welding conditions in Table 5B shall be used with the pass sequence in Table 6A. The direction with the pass sequence in Table 6B. The direction of welding used to complete a layer consisting of of welding for each pass shall not vary. However, two passes shall not vary. However, the direction the direction of the welding for different passes of the welding of layers shall be alternated. may be alternated.

| and 27 J Symbol | impact energy Preheat temperature | ) Interpass tempera- ture |
| --- | --- | --- |
| S2, S3, S4, S6, S7, S8, S11, S12, S13, S14, | °C Room | °C 150 ± 15 |
| S15, S16, S17, S18 S1M3, S2M3, S2M31, S3M3T, S3M1, S3M1T, | temperature Minimum 100 |  |
| S4M31, S4M3T SN1, SN2, SN3, SN5, |  |  |
| SN7, SN71, SN9 SNCC, SNCCT, |  |  |
| SNCCT1, SNCCT2 SN1M2T, SN2M1T, SN2M2T, SN2M3T, |  |  |
| SN2M4T |  |  |

<!-- Pagina 16 (motore: pdfplumber) -->

Table 5A — Welding conditions Table 5B — Welding conditions Contact Contact Welding Welding Welding Welding Diameter tube dis- Diameter tube discurrent voltage current voltage tance tance mm A V mm mm A V mm a a 1,2 280 ± 20 20 ± 3 1,2 290 ± 30 20 ± 3 a a The welding voltage depends on the choice of The welding voltage depends on the choice of shielding gas. shielding gas. Table 6A — Pass sequence Table 6B — Pass sequence Electrode Split weave Electrode Passes Number of Layer No. diameter diameter per layer layers Passes Number of Layer No. per layer layers mm mm a 1,2 1 to top 2 6 to 10 1,2 1 to top 2 or 3 6 to 10 a The top two layers may be completed with three passes per layer.

## 6.3 Post-weld heat-treated (PWHT) condition

6.3A Classification by yield strength and 47 J 6.3B Classification by tensile strength and 27 J impact energy impact energy No PWHT condition is used in this document. Test assemblies mad6e0 w(+i1t5h) wire electrodes classi- 0 fied in the PWHT condition shall be heat treated at 620 °C ± 15 °C for min. The furnace shall be at a temperature not higher than 315 °C when the test assembly is placed in it. The heating rate, from that point to the 620 °C ± 15 °C holding temperature, shall not exceed 220 °C/h. When the holding time has been completed, the assembly shall be allowed to cool in the furnace to a temperature below 315 °C at a rate not exceeding 195 °C/h. The assembly may be removed from the furnace at any temperature below 315 °C and allowed to cool in still air to room temperature.

# 7 Chemical analysis

Chemical analysis shall be performed on specimens of the wire. Any analytical technique may be used, but in case of dispute, reference shall be made to established published methods. In the case of chemical elements which do not change during production, chemical analysis of the wire may be substituted by an analysis of product in process or raw material or a report of the ladle chemical a7nAa l yCsliass osfi fai craawti omna bteyr iyaile.ld strength and 47 J 7B Classification by tensile strength and 27 J impact energy impact energy The results of the chemical analysis shall fulfil the The results of the chemical analysis shall fulfil the requirements given in Table 3A for the classifica- requirements given in Table 3B for the classification under test. tion under test.

| Diameter | Welding current | Welding voltage | Contact tube dis- tance |
| --- | --- | --- | --- |
|  |  |  |  |
| mm A V mm a 1,2 280 ± 20 20 ± 3 a |  |  |  |

| Diameter | Welding current | Welding voltage | Contact tube dis- tance |
| --- | --- | --- | --- |
|  |  |  |  |
| mm A V mm a 1,2 290 ± 30 20 ± 3 a |  |  |  |

| Electrode diameter | Split weave Passes Number of Layer No. per layer layers |  |  |
| --- | --- | --- | --- |
| mm |  |  |  |
| a 1,2 1 to top 2 6 to 10 a |  |  |  |

| Electrode diameter | Layer No. | Passes per layer | Number of layers |
| --- | --- | --- | --- |
| mm |  |  |  |

<!-- Pagina 17 (motore: pdfplumber) -->

# 8 Rounding procedure

Actual test values obtained shall be subject to ISO 80000-1:2009, B.3, Rule A. If the measured values are obtained by equipment calibrated in units other than those of this document, the measured values shall be converted to the units of this document before rounding. If an average value is to be compared to the requirements of this document, rounding shall be done only after calculating the average. The rounded results shall fulfil the requirements of the appropriate table for the classification under test.

# 9 Retests

If any test fails to meet the requirement(s), that test shall be repeated twice. The results of both retests shall meet the requirement. Specimens for the retest may be taken from the original test assembly or sample or from one or two new test assemblies. For chemical analysis, retests need only be for those specific elements that failed to meet the requirement. If the results of one or both retests fail to meet the requirement, the material under test shall be considered as not meeting the requirements of this document for that classification. In the event that during preparation, or after completion of any test, it is clearly determined that prescribed or proper procedures were not followed in preparing the weld test assembly or sample(s) or test specimen(s), or in conducting the tests, the test shall be considered invalid. This determination is made without regard to whether the test was actually completed, or whether the test results met, or failed to meet, the requirements. That test shall be repeated, following proper prescribed procedures. In this case, the requirement for doubling the number of test specimens does not apply.

# 10 Technical delivery conditions

Technical delivery conditions shall meet the requirements in ISO 544 and ISO 14344.

# 11 Examples of designation

11A Classification by yield strength and 47 J 11B Classification by tensile strength and 27 J impact energy impact energy The designation of the wire electrode shall follow The designation of the wire electrode shall follow the principle given in the example below. the principle given in the examples below.

## EXAMPLE 1A EXAMPLE 1B

A weld deposit produced by gas shielded metal A weld deposit produced by gas shielded metal arc welding having a minimum yield strength of arc welding having a minimum tensile strength 460 MPa (46) and a minimum average impact en- of 490 MPa (49) and a minimum average impact ergy of 47 J at −50 °C (5) under mixed gas (M21) energy of 27 J at −60°C (6) in the as-welded conusing the wire 3Si1 is designated as follows: dition under mixed gas (M21) using the wire S3 ISO 14341-A-G 46 5 M21 3Si1 i s I dSeOs i1g4n3a4te1d-B a-sG f o4l9loAw 6s :M21 S3 A wire electrode complying with the chemical A wire electrode complying with the chemical requirement of 3Si1 in Table 3A is designated as requirement of S3 in Table 3B is designated as follows: follows:

<!-- Pagina 18 (motore: pdfplumber) -->

ISO 14341-A-G 3Si1 ISO 14341-B-G S3 where where ISO 14341-A is the number of this ISO 14341-B is the number of this document, with classification document, with classification by yield strength and 47 J by tensile strength and 27 J impact energy; impact energy; G designates a wire electrode G designates a wire electrode and/or deposit produced by and/or deposit produced by gas shielded metal arc gas shielded metal arc welding (see 5.1); welding (see 5.1);

# 46 is the strength and 49A is the strength and elongaelongation (see Table 1A); tion in the as-welded condition

(see Table 1B);

# 5 is the impact properties (see 6 is the impact properties in

Table 2); the as-welded condition (see Table 2); M21 is the shielding gas (see 5.4); M21 is the shielding gas (see 5.4); 3Si1 is the chemical composition S3 is the chemical composition of the wire electrode (see of the wire electrode (see Table 3A). Table 3B).

## EXAMPLE 2A EXAMPLE 2B

A wire electrode with a chemical composition: A weld deposit produced by gas shielded metal

# 2 % Mn, 1 % Mo not listed in Table 3A is arc welding having a minimum tensile strength

ISO 14341-A-G Z4Mo1 designated as follows: of 490 MPa (49) and a minimum average impact energy of 47 J at 0 °C (0) in the as-welded condition under carbon dioxide (C1) using the wire S11 is designated as follows: where

## ISO 14341-B-G 49A 0U C1 S11

ISO 14341-A is the number of this document, with classification by yield strength and 47 J A wire electrode complying with the chemical impact energy; requirement of S11 in Table 3B is designated as

## ISO 14341-B-G S11

follows: G designates a wire electrode and/or deposit produced by gas shielded metal arc where welding (see 5.1); Z4Mo1 is the chemical composition ISO 14341-B is the number of this as agreed between document, with classification manufacturer and custom- by tensile strength and 27 J er (2 % Mn, 1 % Mo). impact energy; G designates a wire electrode or deposit produced by gas shielded metal arc welding (see 5.1);

<!-- Pagina 19 (motore: pdfplumber) -->

49A is the strength and elongation in the as-welded condition (see Table 1B); 0U is the impact properties in the as-welded condition [see 4B 3) and Table 2]; C1 is the shielding gas (see 5.4); S11 is the chemical composition of the wire electrode (see Table 3B).

<!-- Pagina 20 (motore: pdfplumber) -->

## Bibliography

Welding — Measurement of preheating temperature, interpass temperature and preheat maintenance temperature [1] ISO 13916,

<!-- Pagina 21 (motore: pdfplumber) -- ATTENZIONE: testo di bassa qualita' (probabile font non standard), revisionare -->

<!-- Pagina 22 (motore: pdfplumber) -->

## ICS 25.160.20

Price based on 14 pages
