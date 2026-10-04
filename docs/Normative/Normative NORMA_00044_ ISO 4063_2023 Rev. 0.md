> **Ruolo SGQ**: catalogo di **classificazione processi** (ISO 4063:2023, quinta edizione). Non è una norma di sistema a clausole 4–10: **non** va in `import-norms-from-markdown.js` / seed `norm_requirements`.
> **Schema CLI**: `generic` (albero sezioni) — le liste processi non sono clausole SGQ; `norm-clause` spezzerebbe i numeri di processo come se fossero `clause_ref`.
> **Qualità estrazione (04/10/2026)**: 24 pagine PDF, 23 con testo utile (pdfplumber). Pagina 23 vuota (`ATTENZIONE` font / nessuna informazione tecnica — copertina/verso). Pagine 6–14: elenco processi **ricostruito con pymupdf** (pdfplumber intercalava due colonne: es. `11124`, `77583`). Annex A–C restano dall’estrazione pdfplumber (tabelle).
> **Famiglia 78 (pag. 11, pymupdf)**: 78 Arc stud welding; **783** Drawn arc stud welding with ceramic ferrule or shielding gas; **784** Short-cycle drawn arc stud welding; **785** Capacitor discharge drawn arc stud welding; **786** Capacitor discharge stud welding with tip ignition. Obsoleti (Annex B): 781, 787 — non sono i numeri correnti.
> **PDF**: non in Git. Estratto operativo: `docs/reference/ISO-4063-processi-saldatura.md`. Catalogo JS: `weldingProcesses4063.js` (frequenti + 78x). Seed VPS: non applicabile.

<!-- Pagina 1 (motore: pdfplumber) -->

## ISO

## INTERNATIONAL

## STANDARD

Fifth edition 2023-03

## Welding, brazing, soldering and

## cutting — Nomenclature of processes

## and reference numbers

Soudage, brasage et coupage — Nomenclature et numérotation des procédés Reference number

## © ISO 2023

<!-- Pagina 2 (motore: pdfplumber) -->

## COPYRIGHT PROTECTED DOCUMENT

## © ISO 2023

All rights reserved. Unless otherwise specified, or required in the context of its implementation, no part of this publication may be reproduced or utilized otherwise in any form or by any means, electronic or mechanical, including photocopying, or posting on the internet or an intranet, without prior written permission. Permission can be requested from either ISO at the address below or ISO’s member body in the country of the requester. ISO copyright office CP 401 • Ch. de Blandonnet 8 CH-1214 Vernier, Geneva Phone: +41 22 749 01 11 Email: copyright@iso.org Website: www.iso.org Published in Switzerland ii © ISO 2023 – All rights reserved

<!-- Pagina 3 (motore: pdfplumber) -->

## Contents

Page Foreword iv

# 1 Scope 1

........................................................................................................................................................................................................................................

# 2 Normative references 1

.................................................................................................................................................................................................................................

# 3 Terms and definitions 1

.....................................................................................................................................................................................

# 4 Designation 1

.................................................................................................................................................................................... ................................................................................................................................................................................................................ 4.1 General ...........................................................................................................................................................................................................1

# 5 List of processes and reference numbers 2

4.2 Hybrid joining processes ...............................................................................................................................................................2 .................................................................................................................................. 5.1 General ...........................................................................................................................................................................................................2 5.2 Welding ..........................................................................................................................................................................................................2 5.3 Thermal cutting .....................................................................................................................................................................................7 Annex A Process variants 11 5.4 Brazing and soldering ......................................................................................................................................................................8 Annex B Replaced and obsolete processes 13 (informative) ...................................................................................................................................................... Annex C Acronyms for welding and allied processes used in the United States (informative) .......................................................................................................... of America 14 (informative) Bibliography 18 ................................................................................................................................................................................................................ ............................................................................................................................................................................................................................. © ISO 2023 – All rights reserved iii

<!-- Pagina 4 (motore: pdfplumber) -->

## Foreword

ISO (the International Organization for Standardization) is a worldwide federation of national standards bodies (ISO member bodies). The work of preparing International Standards is normally carried out through ISO technical committees. Each member body interested in a subject for which a technical committee has been established has the right to be represented on that committee. International organizations, governmental and non-governmental, in liaison with ISO, also take part in the work. ISO collaborates closely with the International Electrotechnical Commission (IEC) on all matters of electrotechnical standardization. The procedures used to develop this document and those intended for its further maintenance are described in the ISO/IEC Directives, Part 1. In particular, the different approval criteria needed for the different types of ISO documents should be noted. This document was drafted in accordance with the editorial rules of the ISO/IEC Directives, Part 2 (see www.iso.org/directives). Attention is drawn to the possibility that some of the elements of this document may be the subject of patent rights. ISO shall not be held responsible for identifying any or all such patent rights. Details of any patent rights identified during the development of the document will be in the Introduction and/or on the ISO list of patent declarations received (see www.iso.org/patents). Any trade name used in this document is information given for the convenience of users and does not constitute an endorsement. For an explanation of the voluntary nature of standards, the meaning of ISO specific terms and expressions related to conformity assessment, as well as information about ISO's adherence to the World Trade Organization (WTO) principles in the Technical Barriers to Trade (TBT), see www.iso.org/iso/foreword.html. Welding and allied processes Representation and terms This document was prepared by Technical Committee WISeOl/dTinCg a4n4d, allied processes , Subcommittee SC 7, , in collaboration with the European Committee for Standardization (CEN) Technical Committee CEN/TC 121, , in accordance with the Agreement on technical cooperation between ISO and CEN (Vienna Agreement). This fifth edition cancels and replaces the fourth edition (ISO 4063:2009), which has been technically revised. The main changes are as follows: — incorporation of processes and reference numbers for welding and thermal joining of plastics. Any feedback or questions on this document should be directed to the user’s national standards body. A complete listing of these bodies can be found at www.iso.org/members.html. Official interpretations of ISO/TC 44 documents, where they exist, are available from this page: https://committee.iso.org/sites/tc44/home/interpretation.html. iv © ISO 2023 – All rights reserved

<!-- Pagina 5 (motore: pdfplumber) -->

## INTERNATIONAL STANDARD ISO 4063:2023(E)

## Welding, brazing, soldering and cutting — Nomenclature of

## processes and reference numbers

# 1 Scope

This document establishes a nomenclature for: — welding; — brazing, soldering and weld brazing; — thermal cutting; with each process identified by a reference number. It covers the main processes (one digit), groups (two digits) and sub-groups (three digits). The reference number for any process has a maximum of three digits. This system is intended as an aid in computerization and the drafting of, for example, drawings, working papers and welding procedure specifications, and enables the uniform international designation of the processes. This document does not cover all process variants. The process numbers can be supplemented with additional information for variants not listed.

# 2 Normative references

There are no normative references in this document.

# 3 Terms and definitions

No terms and definitions are listed in this document. ISO and IEC maintain terminology databases for use in standardization at the following addresses: — ISO Online browsing platform: available at https:// www .iso .org/ obp — IEC Electropedia: available at https:// www .electropedia .org/

# 4 Designation

## 4.1 General

Where a full designation is required for a joining process, it shall have the following structure: the number of this document (i.e. “ISO 4063”), separated by a dash from the reference number of the process, as shown in these examples. EXAMPLE 1 Process “Cold pressure welding” with reference number 48 is designated as:

## ISO 4063 – 48

EXAMPLE 2 Process “Radio frequency welding” with reference number 62 is designated as:

## ISO 4063 – 62

EXAMPLE 3 Process “Heated wedge welding with hot gas” with reference number 662-A is designated as:

<!-- Pagina 6 (motore: pymupdf, ricostruzione elenco processi) -->

ISO 4063 – 662-A
4.2	 Hybrid joining processes
When multiple processes are used simultaneously in one process area, the processes shall be described
using the designations for each process separated by the symbol “+”.
EXAMPLE
Process “Gas laser welding” (reference number 522) together with process “Plasma arc welding”
(reference number 15) is designated as:
ISO 4063 – 522 + 15
5	 List of processes and reference numbers
5.1	 General
The first designation listed is the preferred one and any subsequent designations are synonyms. Terms
used in the United States of America (USA) are shown for information where there are differences.
Annex A provides supplementary options for process variants.
Annex B provides an overview for replaced and obsolete processes.
Annex C provides a list of commonly used acronyms and abbreviations for the welding processes in the
United States of America included in this document.
5.2	 Welding
Arc welding
Metal arc welding without gas protection
111
Manual metal arc welding
Shielded metal arc welding, USA
112
Gravity welding
Gravity arc welding with covered electrode
Gravity feed welding, USA
114
Self-shielded tubular cored arc welding
Submerged arc welding
121
Submerged arc welding with solid wire electrode
122 Submerged arc welding with strip electrode
124 Submerged arc welding with metal powder addition
125 Submerged arc welding with tubular cored electrode
126 Submerged arc welding with cored strip electrode
Gas-shielded metal arc welding
Metal inert gas (MIG) welding/Metal active gas (MAG) welding
Gas metal arc welding (GMAW), USA
﻿

﻿

<!-- Pagina 7 (motore: pymupdf, ricostruzione elenco processi) -->

131
MIG welding with solid wire electrode
GMAW using inert gas and solid wire electrode, USA
132
MIG welding with flux cored electrode
Gas shielded flux cored arc welding, USA
133 MIG welding with metal cored electrode
GMAW using inert gas and metal cored wire, USA
135 MAG welding with solid wire electrode
GMAW using active gas with solid wire electrode, USA
136 MAG welding with flux cored electrode
GMAW using active gas and flux cored electrode, USA
138 MAG welding with metal cored electrode
GMAW using active gas and metal cored electrode, USA
Gas-shielded arc welding with non-consumable tungsten electrode
Tungsten inert gas (TIG) welding/Tungsten active gas (TAG) welding
Gas tungsten arc welding (GTAW), USA
141
TIG welding with solid filler material
GTAW using inert gas and solid filler material, USA
142
Autogenous TIG welding
Autogenous gas tungsten arc welding using inert gas, USA
143
TIG welding with tubular cored filler material
GTAW using inert gas and tubular cored filler material, USA
145
TIG welding using reducing gas and solid filler material
GTAW using inert gas plus reducing gas additions and solid filler material, USA
146
TIG welding using reducing gas and tubular cored filler material
GTAW using inert gas plus reducing gas additions and tubular cored filler material, USA
147
Gas-shielded arc welding with non-consumable tungsten electrode using active gas
TAG welding
GTAW using active gas, USA
Plasma arc welding
151
Plasma MIG welding
152
Powder plasma arc welding
153 Plasma welding with transferred arc
154 Plasma arc welding with non-transferred arc
155 Plasma arc welding with partially transferred arc
﻿
﻿

<!-- Pagina 8 (motore: pymupdf, ricostruzione elenco processi) -->

Other arc welding processes
185
Magnetically impelled arc welding
Resistance welding
21
Resistance spot welding
211
Indirect spot welding
212
Direct spot welding
22
Resistance seam welding
221
Lap seam welding
222 Mash seam welding
223 Prep-lap seam welding
224
Wire seam welding
225 Foil butt-seam welding
226 Seam welding with strip
23
Projection welding
231
Indirect projection welding
232
Direct projection welding
24
Flash welding
241
Flash welding with preheating
242
Flash welding without preheating
25
Resistance butt welding
Upset welding, USA
26
Resistance stud welding
27
HF resistance welding
High-frequency resistance welding
High-frequency upset welding, USA
29
Other resistance welding processes
Gas welding
Oxyfuel gas welding, USA
31
Oxyfuel gas welding
311
Oxyacetylene welding
312
Oxypropane welding
313
Oxyhydrogen welding
﻿

﻿

<!-- Pagina 9 (motore: pymupdf, ricostruzione elenco processi) -->

Welding with pressure
41
Ultrasonic welding
411
Ultrasonic hot welding
412
Ultrasonic spot welding
413
Ultrasonic seam welding
414
Ultrasonic torsion welding
42
Friction welding
421
Direct drive friction welding
422
Inertia friction welding
423
Friction stud welding
424
Linear friction welding (generally referred to as “vibration welding” when the base materials are
plastics)
425
Radial friction welding
426
Orbital friction welding
43
Friction stir welding
431
Friction stir spot welding
432
Refill friction stir spot welding
433
Stitch friction stir spot welding
434 Swept friction stir spot welding
435
Swing friction stir spot welding
44
Impact welding (referred to as shock welding in ISO/TR 25901-3:2016, 2.2.1.6.10)
441 Explosion welding
442 Magnetic pulse welding
45
Diffusion welding
451
Hot isostatic pressure welding
47
Oxyfuel gas pressure welding
Pressure gas welding, USA
48
Cold pressure welding
Cold welding, USA
481 Cold pressure extrusion welding
49
Hot pressure welding
491 Hot nozzle welding
﻿
﻿

<!-- Pagina 10 (motore: pymupdf, ricostruzione elenco processi) -->

492 Nail head welding
493 Coextrusion welding
Beam welding
51
Electron beam welding
511
Electron beam welding in vacuum
512
Electron beam welding in atmosphere
513
Electron beam welding with addition of shielding gases
52
Laser welding
Laser beam welding, USA
521
Solid state laser welding
522
Gas laser welding
523
Diode laser welding
Semi-conductor laser welding, USA
Plastics-specific welding processes
61
Resistive implant welding
611
Electrofusion welding
62
Radio frequency welding
High-frequency welding
Dielectric welding
63
Solvent welding
631 Solvent cement welding
64
Hot gas welding
641 Hot gas speed welding
642 Hot gas round nozzle welding
643 Hot gas manual welding without welding rod
644 Hot gas machine welding without welding rod
645 Hot gas machine welding with welding rod
646 Hot gas convection welding
647 Extrusion welding
65
Heat sealing
651
Impulse welding
652 Hot bar welding
﻿

﻿

<!-- Pagina 11 (motore: pymupdf, ricostruzione elenco processi) -->

66
Heated tool welding
661
Hot plate welding
662 Heated wedge welding
663 Socket fusion welding
664 Saddle fusion welding
67
Flash-free welding
671
Flow fusion welding
69
Other plastics-specific welding processes
691
Microwave welding
692 Staking
Other welding processes
71
Aluminothermic welding
Thermite welding, USA
72
Electroslag welding
721 Electroslag welding with strip electrode
722 Electroslag welding with wire electrode
73
Electrogas welding
74
Induction welding
741
Induction butt welding
Induction upset welding, USA
742
Induction seam welding
743
High frequency induction welding
75
Light radiation welding
753 Infrared welding
78
Arc stud welding
783 Drawn arc stud welding with ceramic ferrule or shielding gas
784 Short-cycle drawn arc stud welding
785 Capacitor discharge drawn arc stud welding
786 Capacitor discharge stud welding with tip ignition
5.3	 Thermal cutting
Cutting and gouging
﻿
﻿

<!-- Pagina 12 (motore: pymupdf, ricostruzione elenco processi) -->

81
Flame cutting
Oxygen cutting
Oxyfuel cutting, USA
82
Arc cutting
821
Air arc cutting
Air carbon arc cutting, USA
822 Oxygen arc cutting
83
Plasma cutting
Plasma arc cutting, USA
831 Plasma cutting with oxidising gas
832 Plasma cutting without oxidising gas
833 Air plasma cutting
834 High-tolerance plasma cutting
84
Laser cutting
Laser beam cutting, USA
86
Flame gouging
Thermal gouging, USA
87
Arc gouging
871
Air arc gouging
Air carbon arc cutting, USA
872 Oxygen arc gouging
Oxygen gouging, USA
88
Plasma gouging
5.4	 Brazing and soldering
Brazing and soldering
91
Brazing with local heating
911
Infrared brazing
912 Flame brazing
Torch brazing, USA
913
Laser beam brazing
914
Electron beam brazing
916
Induction brazing
﻿

﻿

<!-- Pagina 13 (motore: pymupdf, ricostruzione elenco processi) -->

918
Resistance brazing
919
Diffusion brazing
92
Brazing with global heating
921
Furnace brazing
922 Vacuum brazing
923 Dip-bath brazing
924
Salt-bath brazing
925 Flux-bath brazing
926 Immersion brazing
93
Other brazing processes
94
Soldering with local heating
941
Infrared soldering
942 Flame soldering
Torch soldering, USA
943 Soldering with soldering iron
944 Drag soldering
945 Laser soldering
946 Induction soldering
947
Ultrasonic soldering
948 Resistance soldering
949 Diffusion soldering
95
Soldering with global heating
951
Wave soldering
953 Furnace soldering
954 Vacuum soldering
955 Dip soldering
957
Salt-bath soldering
96
Other soldering processes
97
Weld brazing
Braze welding, USA
971
Gas weld brazing
Gas braze welding, USA
﻿
﻿

<!-- Pagina 14 (motore: pymupdf, ricostruzione elenco processi) -->

972 Arc weld brazing
Arc braze welding, USA
973 Gas metal arc weld brazing
Gas metal arc braze welding, USA
974
Gas tungsten arc weld brazing
Gas tungsten arc braze welding, USA
975 Plasma arc weld brazing
Plasma arc braze welding, USA
976
Laser weld brazing
Laser braze welding, USA
977 Electron beam weld brazing
Electron beam braze welding, USA
﻿

﻿

<!-- Pagina 15 (motore: pdfplumber) -->

## Annex A

## Pr(oincefosrsm vaatriivaen) ts

## A.1 Transfer modes

For welding processes where different modes are possible, the mode can be indicated by a letter in accordance with Table A.1 and as shown in the example. Table A.1 — Transfer modes Mode Term B Buried-arc transfer Short-circuit transfer D (dip transfer) G Globular transfer S Spray transfer a P Pulsed transfer a Referred to as “pulsed current” in ISO/TR 25901-4. EXAMPLE MIG welding with solid wire electrode using short-circuit transfer is designated as:

## ISO 4063 – 131-D

## A.2 Number of electrodes

If more than one electrode is used, it can be indicated by an additional number as shown in the example. EXAMPLE MIG welding with two solid wire electrodes is designated as:

## ISO 4063 – 131 – 2

## A.3 Additional items

If additional filler material is used, the option hot wire/cold wire can be indicated in accordance with Table A.2 and as shown in the example. Table A.2 — Additional items Mode Term C Cold wire H Hot wire EXAMPLE Submerged arc welding with a solid wire electrode and an additional cold wire is designated as:

## ISO 4063 – 121-C

| Mode | Term |
| --- | --- |
|  |  |
| B | Buried-arc transfer |
| D | Short-circuit transfer |
|  | (dip transfer) |
| G | Globular transfer |
| S Spray transfer a |  |

| Mode | Term |
| --- | --- |
|  |  |
|  |  |

<!-- Pagina 16 (motore: pdfplumber) -->

## A.4 Plastics joining

Additional process variants for plastics joining can be identified in accordance with Table A.3 and as shown in the example. Table A.3 — Additional processes Reference Term number Transmission laser welding – contour 52-A Transmission laser welding – quasi-simultaneous 52-B Transmission laser welding – simultaneous 52-C Transmission laser welding – scan 52-D Transmission laser welding – mask 52-E Direct laser welding 52-F Vibration welding with IR pre-heat 424-A Heated wedge welding with hot gas 662-A Heated wedge welding (electric) 662-B EXAMPLE Heated wedge welding with hot gas is designated as:

## ISO 4063 – 662-A

## A.5 Staking

Staking process variants can be identified in accordance with Table A.4 and as shown in the example. Table A.4 — Staking processes Reference Term number Electrical E Hot air H Infrared I Ultrasonic U EXAMPLE Staking with hot air is designated as:

## ISO 4063 – 692-H

| Term | Reference number |
| --- | --- |
|  |  |
|  |  |
| Transmission laser welding – contour | 52-A |
| Transmission laser welding – quasi-simultaneous | 52-B |
| Transmission laser welding – simultaneous | 52-C |
| Transmission laser welding – scan | 52-D |
| Transmission laser welding – mask | 52-E |
| Direct laser welding | 52-F |
| Vibration welding with IR pre-heat | 424-A |

| Term | Reference number |
| --- | --- |
|  |  |
|  |  |
| Electrical | E |
| Hot air | H |

<!-- Pagina 17 (motore: pdfplumber) -->

## Annex B

## Replaced a(nindfo orbmsaotlievtee) processes

Table B.1 presents a list of processes included in previous editions of this document which have been replaced or have become obsolete. They may be used retrospectively or in special cases but shall then be designated as shown in the last column. Table B.1 — Designation if replaced and obsolete processes Former designa- Process Designation to use tion 113 Bare wire metal arc welding ISO 4063:1990–113 Bare metal arc welding, USA 115 Coated wire metal arc welding ISO 4063:1990–115 118 Firecracker welding ISO 4063:1990–118 137 Tubular cored metal arc welding with inert gas ISO 4063:1990–137 shield Flux cored arc welding, USA 149 Atomic-hydrogen welding ISO 4063:1990–149

# 32 Air-fuel gas welding

181 Carbon-arc welding ISO 4063:1990–181

## ISO 4063:1990–32

321 Air-acetylene welding ISO 4063:1990–321 Air acetylene welding, USA

# 43 Forge welding

322 Air-propane welding ISO 4063:1990–322

## ISO 4063:1990–43

# 77 Percussion welding

752 Arc image welding ISO 4063:1990–752

## ISO 4063:1990–77

781 Arc stud welding ISO 4063:1990–781 787 Drawn arc stud welding with fusible collar ISO 4063:1998–787 917 Ultrasonic brazing ISO 4063:1990–917 923 Friction brazing ISO 4063:1990–923 953 Abrasion soldering ISO 4063:1990–953

| Former designa- tion | Process | Designation to use |
| --- | --- | --- |
| 113 | Bare wire metal arc welding | ISO 4063:1990–113 |
|  |  |  |
|  | Bare metal arc welding, USA |  |
| 115 118 137 | Coated wire metal arc welding Firecracker welding Tubular cored metal arc welding with inert gas shield | ISO 4063:1990–115 ISO 4063:1990–118 ISO 4063:1990–137 |
|  |  |  |
|  | Flux cored arc welding, USA |  |
| 149 32 | Atomic-hydrogen welding Air-fuel gas welding | ISO 4063:1990–149 |
| 181 321 | Carbon-arc welding Air-acetylene welding | ISO 4063:1990–181 ISO 4063:1990–32 ISO 4063:1990–321 |
|  |  |  |
| 43 | Air acetylene welding, USA Forge welding |  |
| 322 | Air-propane welding | ISO 4063:1990–322 |
| 77 | Percussion welding | ISO 4063:1990–43 |
| 752 | Arc image welding | ISO 4063:1990–752 |
|  |  | ISO 4063:1990–77 |
| 781 | Arc stud welding | ISO 4063:1990–781 |
| 787 | Drawn arc stud welding with fusible collar | ISO 4063:1998–787 |
| 917 | Ultrasonic brazing | ISO 4063:1990–917 |

<!-- Pagina 18 (motore: pdfplumber) -->

## Annex C

## Acronyms for welding an(din afollrimeda tpivreo)c esses used in the United

## States of America

Tables C.1 to C.4 present acronyms for welding and allied processes used in the United States of 1) America. These are given together with corresponding reference numbers in this document, where such numbers exist. A dash signifies that no equivalent or corresponding reference number can be given. Table C.1 — Commonly used US acronyms for welding US acronym Corresponding reference number in this document b

## AAW 321

b

## AHW 149

AW 1 b

## BMAW 113

b

## CAW-G 181

b

## CAW-S 181

b

## CAW-T 181

## CEW 493

CW 48

## DFW 45

## EBW 51

## EBW-HV 511

## EBW-MV 511

## EBW-NV 512

## EGW 73

## ESW 72

a

## ESW-CG 72

## EXW 441

## FCAW 114, 136

## FCAW-G 136

## FCAW-S 114

b

## FOW 43

## FRW 42

## FRW-DD 421

## FRW-I 422

## FSW 43

FW 24 a Not exactly equivalent. b See Annex B. 11)4 According to the American Welding Society (AWS).

| US acronym | Corresponding reference number in this document |
| --- | --- |
|  |  |
|  | b |
| AAW | 321 b |
| AHW | 149 |
| AW | 1 b |
| BMAW | 113 b |
| CAW-G | 181 b |
| CAW-S | 181 b |
| CAW-T | 181 |
| CEW | 493 |
| CW | 48 |
| DFW | 45 |
| EBW | 51 |
| EBW-HV | 511 |
| EBW-MV | 511 |
| EBW-NV | 512 |
| EGW | 73 |
| ESW | 72 a |
| ESW-CG | 72 |
| EXW | 441 |
| FCAW | 114, 136 |
| FCAW-G | 136 |
| FCAW-S | 114 b |
| FOW | 43 |
| FRW | 42 |
| FRW-DD | 421 |
| FRW-I FSW | 422 43 |
| FW 24 a Not exactly equivalent. |  |

<!-- Pagina 19 (motore: pdfplumber) -->

TTaabbllee CC..11 ((ccoonnttiinnuueedd)) US acronym Corresponding reference number in this document

## GMAW 13

## GMAW-P 13-P

## GMAW-S 13-D

## GTAW 14

## GTAW-P 14-P

## HIPW 451

## HPW 49

IW 74

## LBW 52

## MIAW 185

## OAW 311

## OFW 31

## OHW 313

## PAW 15

b

## PEW 77

## PGW 47

PW 23 a

## ROW 27

## RSEW 22

a

## RSEW-HF 22

## RSEW-I 742

## RSEW-MS 222

## RSW 21

RW 2

## RW-PC 2

## SAW 12

a

## SAW-S 12

## SMAW 111

## SSW 4

SW 783/785/786 TW 71

## USW 41

UW 25 a

## UW-HF 27

## UW-I 741

a Not exactly equivalent. b See Annex B.

| US acronym | Corresponding reference number in this document |
| --- | --- |
|  |  |
|  |  |
| GMAW | 13 |
| GMAW-P | 13-P |
| GMAW-S | 13-D |
| GTAW | 14 |
| GTAW-P | 14-P |
| HIPW | 451 |
| HPW | 49 |
| IW | 74 |
| LBW | 52 |
| MIAW | 185 |
| OAW | 311 |
| OFW | 31 |
| OHW | 313 |
| PAW | 15 b |
| PEW | 77 |
| PGW | 47 |
| PW | 23 a |
| ROW | 27 |
| RSEW | 22 a |
| RSEW-HF | 22 |
| RSEW-I | 742 |
| RSEW-MS | 222 |
| RSW | 21 |
| RW | 2 |
| RW-PC | 2 |
| SAW | 12 a |
| SAW-S | 12 |
| SMAW | 111 |
| SSW | 4 |
| SW | 783/785/786 |
| TW | 71 |
| USW | 41 |
| UW | 25 a |
| UW-HF 27 UW-I 741 a Not exactly equivalent. |  |

<!-- Pagina 20 (motore: pdfplumber) -->

Table C.2 — Commonly used US acronyms for brazing US acronym Corresponding reference number in this document

## ABW 972

B 9 BW 97 DB 923

## DFB 919

## EBBW 977

## EXB 93

a

## EXBW 97

FB 921 IB 916

## IRB 911

## LBBW 913

RB 918 TB 912 a Not exactly equivalent. Table C.3 — Commonly used US acronyms for soldering US acronym Corresponding reference number in this document DS 955 FS 953

## IRS 941

IS 946 RS 948 TS 942

## USS 947

WS 951 Table C.4 — Commonly used US acronyms for cutting US acronym Corresponding reference number in this document AC 82 a

## CAC 82

## CAC-A 821/871

## EBC —

## GMAC 82

## GTAC 82

a

## HEBC 84

## LBC 84

## LBC-A 84

## LBC-EV 84

## LBC-IG 84

a Not exactly equivalent.

| US acronym | Corresponding reference number in this document |
| --- | --- |
|  |  |
|  |  |
| ABW | 972 |
| B | 9 |
| BW | 97 |
| DB | 923 |
| DFB | 919 |
| EBBW | 977 |
| EXB | 93 a |
| EXBW | 97 |
| FB | 921 |
| IB | 916 |
| IRB | 911 |
| LBBW | 913 |
| RB 918 |  |

| US acronym | Corresponding reference number in this document |
| --- | --- |
|  |  |
|  |  |
| DS | 955 |
| FS | 953 |
| IRS | 941 |
| IS | 946 |
| RS | 948 |
| TS | 942 |

| US acronym | Corresponding reference number in this document |
| --- | --- |
|  |  |
|  |  |
| AC | 82 a |
| CAC | 82 |
| CAC-A | 821/871 |
| EBC | — |
| GMAC | 82 |
| GTAC | 82 a |
| HEBC | 84 |
| LBC | 84 |
| LBC-A LBC-EV | 84 84 |
|  |  |

<!-- Pagina 21 (motore: pdfplumber) -->

TTaabbllee CC..44 ((ccoonnttiinnuueedd)) US acronym Corresponding reference number in this document

## LBC-O 84

## OAC 822

OC 81

## OC-P 81

## OFC 81

## OFC-A 81

## OFC-F 81

## OFC-H 81

## OFC-N 81

## OFC-P 81

OG 872

## OLC 822

## PAC 83

## SMAC 82

TC 8 a Not exactly equivalent.

| US acronym | Corresponding reference number in this document |
| --- | --- |
|  |  |
|  |  |
| LBC-O | 84 |
| OAC | 822 |
| OC | 81 |
| OC-P | 81 |
| OFC | 81 |
| OFC-A | 81 |
| OFC-F | 81 |
| OFC-H | 81 |
| OFC-N | 81 |
| OFC-P | 81 |
| OG | 872 |
| OLC | 822 |
| PAC | 83 |
| SMAC 82 |  |

<!-- Pagina 22 (motore: pdfplumber) -->

## Bibliography

Welding and allied processes — Vocabulary — Part 3: Welding processes [1] ISO/TR 25901-3, Welding and allied processes — Vocabulary — Part 4: Arc welding [2] ISO/TR 25901-4,

<!-- Pagina 23 (motore: pdfplumber) -- ATTENZIONE: pagina senza testo estraibile (verso/bianca, 0 caratteri). Nessun codice processo. GAP irrilevante per il catalogo. -->

*Pagina 23: vuota nel PDF (non elenco processi).*

<!-- Pagina 24 (motore: pdfplumber) -->

## ICS 01.040.25; 25.160.01

Price based on 18 pages
