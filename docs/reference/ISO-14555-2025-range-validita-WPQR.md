# ISO 14555:2025 — Range di validità WPQR stud / prigioniero (riferimento operativo SGQ)

> **Uso**: HITL (Human In The Loop) committente/Mason prima di qualsiasi motorino range; ingest WPQR stud; slice STUD-3-B (codice) **solo dopo OK HITL**.
> **Fonte**: BS EN ISO 14555:2025 "Welding — Arc stud welding of metallic materials". Testo integrale nel Patrimonio Studio — **qui solo tabelle/regole sintetiche**, mai testo normativo copiato.
> **Digitalizzazione**: `docs/Normative/Normative NORMA_00033_ BS EN ISO 14555_2025 Rev. 0.md` (+ `.json`). PDF **non** in Git (indice: `docs/Normative/SOURCE_PDF_INDEX.md`).
> **2° passaggio HITL (29/08/2026)**: stesso PDF riconsegnato; CLI `pdf_to_json` + lettura **pymupdf diretta** sulle pagine critiche (11, 12, 20–22, 36) per chiudere GAP OCR del 1° passaggio. Vietato inventare soglie.
> **Modello editoriale**: `docs/reference/ISO-15614-1-range-validita-WPQR.md`.
> **Codice**: **nessuno** in questa slice. Vietato seedare `norm_requirements` e vietato toccare `weldingQualificationRules*` finché l’estratto non è revisionato.

**Non confondere** con ISO 15614-1 (qualifica procedura arco/gas su acciaio: BW/FW, tabelle 7/8/9 spessore/diametro tubo). Lo stud welding 14555 ha **regole di validità diverse** (sezione trasversale del prigioniero, tempo di saldatura `tw`, protezione bagno CF/SG/NP). Il verbale Mason 001P-21 (fillet 135 su prigioniero tubolare, norma dichiarata 15614-1) **non** è automaticamente una qualifica 14555.

## Fonti Markdown (questa slice)

```text
Fonti Markdown:
- Coperte: NORMA_00033 MD+JSON (#584); estratto operativo (STUD-3-A #589); modello ISO-15614-1-range-validita-WPQR.md
- Mancanti / residuali: codici ISO 4063 famiglia stud (assenti dal testo 14555); interpretazione §10.2.8.5 (a);
  Tabella 2 (boiler pins) fuori scope WPQR Mason / ancora non ricostruita
- Si parte su: PDF upload 2° passaggio + pymupdf pagine critiche; chiudere GAP OCR dove leggibile;
  GAP onesto dove resta illeggibile; VIETATO inventare soglie
```

## Nota sulla fonte (qualità estrazione)

| Zona | Motore 2° passaggio | Stato |
|---|---|---|
| §10.2.8.1–10.2.8.12 (pag. 21–22) | pymupdf diretto | **OK** — testo continuo; heading `10.2.8.11 Preheating` chiaro; «sub group 11.1» continuo |
| §3.14 through-deck (pag. 11) | pymupdf diretto | **OK** — «thickness of less than 3 mm» |
| §4.1 Simboli (pag. 12) | pymupdf diretto | **OK** — elenco lineare (non più intercalato) |
| Tabella 1 esame/prove (pag. 20) | pymupdf diretto | **OK** — matrice ricostruibile (vedi sotto); MD auto ancora ha tabella pdfplumber invertita in coda |
| Annex B Tabella B.1 (pag. 36) | pymupdf diretto | **OK** — allegato **(informative)**; formule `0,25 d` / `0,125 d` / `0,1 d`; `16 (19 e)` |
| Tabella 2 momenti piega boiler pins | — | **GAP** residuo (fuori scope WPQR Mason) |
| Codici ISO 4063 stud | testo 14555 | **GAP** — §9.4 rinvia a 4063 senza elencare 78x |

**Conclusione qualità**: le regole §10.2.8 + Tabella 1 + Annex B (informative) sono usabili per HITL numerico. Non esiste in 14555 una tabella spessore tipo 15614-1 Tabella 7. **Non** usare Annex B come sostituto di §10.2.8.8.

### GAP chiusi in questo 2° passaggio (vs HITL del 1°)

1. §4.1 simboli (assegnazione `C`/`d`/`dw`/`I`/`L`/`P`/`t`/`tw`/…)
2. §3.14 soglia lastra through-deck **&lt; 3 mm**
3. §10.2.8.4 **(b)** / 10.2.8.5 **(c)** — sottogruppo **11.1**
4. Numerazione **10.2.8.11** preriscaldo
5. Tabella **1** completa (conteggi)
6. Annex B: status **informative** (pagina allegato; TOC diceva «normative» — prevale il cartiglio dell’allegato)
7. Annex B: spessore min. = **coefficiente × d** (simbolo corsivo diametro stud; non mm fissi): `0,25 × d` / `0,125 × d` / `0,1 × d` — distinto dalla footnote *(d)* (≤ ~50 ms)
8. Annex B: **16 (19)** mm PC → 19 solo con footnote **(e)** ferrule speciali

---

## Definizioni operative (§3 + §4.1)

| Simbolo / termine | Significato (PDF 2° passaggio) | Path |
|---|---|---|
| **stud** | elemento da unire con stud welding | §3.1 |
| **d** | diametro nominale dello stud (mm) | §3.4 / §4.1 |
| **dw** | *welding diameter*: diametro alla base **prima** della saldatura (mm) | §3.5 / §4.1 |
| **tw** | *welding time*: accensione → spegnimento arco principale (ms o s) | §3.8 / §4.1 |
| **I** | corrente (A) | §4.1 |
| **L** | lift | §3.9 / §4.1 |
| **P** | protrusion | §3.11 / §4.1 |
| **t** | spessore lastra | §4.1 |
| **C / U / E / α** | capacità (mF) / tensione carica (V) / energia (Ws) / angolo piega (°) | §4.1 |
| **CF / SG / NP** | ceramic ferrule / shielding gas / no protection | §4.2 |
| **PA / PC / PE** | posizioni ISO 6947 (flat / horizontal / overhead) | §4.2 |
| **through-deck** | connettori a taglio saldati attraverso lastra sottile **&lt; 3 mm** | §3.14 |

Stud non circolari: la sezione si converte in diametro equivalente (§3.4 / §3.5 Note 2) — **nessuna formula numerica** nel testo.

---

## Range di qualificazione — §10.2.8

Fonte: pymupdf pag. 21–22 (2° passaggio) e JSON/MD `10.2.8.*`.  
Le condizioni **si applicano ciascuna in modo indipendente**. Fuori dai range → nuova prova di procedura.

### Durata e prove di produzione (§10.2.8.1)

| Regola | Path |
|---|---|
| Nessun limite di durata della qualifica se non cambiano le condizioni di qualità e si tiene il registro di sorveglianza produzione (§14.6) | §10.2.8.1 |
| Serve **prova di produzione almeno una volta all’anno** (§14.2), per dipendenza anche dall’operatore | idem |
| Qualsiasi stud con sezione **entro** il range di validità può essere usato per quella prova | idem |
| Produzione sospesa **oltre 1 anno** → confermare la validità con prova di produzione | idem |
| Qualifica secondo §10.2.9 (through-deck in cantiere) valida **fino a cambio parametri** | idem |

### Fabbricante (§10.2.8.2)

Qualifica pWPS del fabbricante valida per officina o cantiere **sotto lo stesso controllo tecnico e di qualità** di quel fabbricante.

### Parametri di saldatura (§10.2.8.3)

La qualifica resta valida per variazioni di parametri **entro le raccomandazioni del fornitore dell’apparecchiatura**.  
**Non** è una banda percentuale fissa (niente ±10 % inventato).

### Materiali simili parent + stud (§10.2.8.4)

| Regola | Stato |
|---|---|
| Prova su parent **gruppo 1 o 2** (ISO/TR 15608) copre acciai con **snervamento specificato uguale o inferiore** | OK |
| La prova copre **tutti i materiali dello stesso gruppo** 15608, con le aggiunte sotto | OK |
| **(a)** Fino a **13 mm** diametro stud (o sezione equivalente): gruppi **8 o 10** coprono gruppo **1** e sottogruppo **2.1**, e viceversa | OK |
| **(b)** Tempo di saldatura specificato **sotto 10 ms**: gruppo **8** copre gruppi **1–6** e sottogruppo **11.1**, e viceversa | OK (2° passaggio: testo continuo) |

### Materiali dissimili parent vs stud (§10.2.8.5)

| Regola | Stato |
|---|---|
| **(a)** «A qualification for specified welding time **beyond 100 ms** is required.» | **GAP interpretazione** (non OCR): frase isolata, **non** elenca coperture automatiche di gruppo. Non inventare una matrice. HITL: conferma se significa «serve prova dedicata, nessuna estensione gruppi» |
| **(b)** Tempo specificato **fino a 100 ms**: gruppo **8 o 10** copre gruppi **1** e sottogruppo **2.1**, e viceversa | OK |
| **(c)** Tempo specificato **sotto 10 ms**: gruppo **8** copre gruppi **1–6** e sottogruppo **11.1**, e viceversa | OK |
| Tenere conto del rischio di incrudimento / *hardening* | nota, non soglia |

### Spessore materiale parent (§10.2.8.6) — diverso da 15614-1

Lo spessore usato nella prova di procedura **vale per tutti gli spessori**, purché la **pWPS** usata in prova si applichi.

**Non** è Tabella 7 di 15614-1 (0,5 t … 2 t). **Non** calcolare range spessore 15614 su un WPQR 14555.

### Lastra through-deck (§10.2.8.7)

La qualifica della lastra **più spessa** usata in produzione copre **tutte le lastre più sottili**.  
Ambito: through-deck stud-welding, non lo spessore del parent strutturale (§10.2.8.6).

### Sezione e forma dello stud (§10.2.8.8) — regola diametro/sezione

| Prova | Copertura |
|---|---|
| **Una** prova di procedura | **Tutte le forme** di stud, ma **solo la sezione di saldatura** usata in prova |
| **Due** prove su sezioni **diverse** | Il **intervallo tra** le due sezioni **e** tutte le forme |

Non c’è moltiplicatore tipo «0,5×D … 2×D» (quello è 15614-1 Tabella 9, **tubo**). Per 14555 il diametro/sezione qualificato è **quello di prova**, oppure la **banda tra due prove**.

### Posizione di saldatura (§10.2.8.9)

Posizioni secondo ISO 6947.

| Tempo di saldatura | Copertura posizioni |
|---|---|
| **tw oltre 100 ms** | **PC** copre **PE** e **PA**, **non** il contrario. **PE** copre **PA**, **non** il contrario. Per PC si possono usare ferrule ceramiche speciali. Through-deck **solo PA**. |
| **tw 100 ms o inferiore** | Qualifica in **una qualsiasi** posizione → valida per **tutte** le posizioni |

### Apparecchiatura (§10.2.8.10)

Cambio di tipo pistola/testa e/o generatore, o di fabbricante dell’apparecchio → la WPS va **verificata** (es. prova di produzione §14.2 oppure certificati di taratura che i dati della WPS qualificata sono rispettati).

### Preriscaldo (§10.2.8.11)

WPS qualificata **senza** preriscaldo vale anche **con** preriscaldo, **non** il contrario.  
Clausola **10.2.8.11** confermata (2° passaggio pymupdf).

### Protezione del bagno (§10.2.8.12)

| Prova | Copre |
|---|---|
| Un metodo specifico (CF / SG / NP) | **Solo** quel metodo |
| **Senza** protezione (NP) | Uso di **gas di protezione (SG)**, **non** il contrario |

Stessa logica per gli **operatori** §6.1 (cambio CF/SG/NP → nuova qualifica; NP copre SG).

---

## Qualifica through-deck in cantiere (§10.2.9) — non è il range §10.2.8

Ambito: costruzioni con carichi **principalmente statici**, headed stud attraverso lamiere profilate **zincate**; **singolo cantiere** e condizioni prevalenti.

| Requisito | Nota |
|---|---|
| pWPS/WPS conformi a Clausola 9 | OK |
| Minimo **10** stud saldati | OK |
| Esame visivo su tutti | OK |
| Bend test **30°** su tutti | OK |
| Validità fino a cambio parametri | §10.2.8.1 |

---

## Qualifica per esperienza precedente (§10.3)

Rinvio a ISO 15611, con limiti 14555:

- stessa **tipologia di apparecchiatura**;
- stesso **tipo e spessore** del parent;
- stesso **diametro** degli stud della produzione su cui si basa l’esperienza.

**Non ammessa** al posto della prova di procedura per saldature di **acciaio** con requisiti di qualità standard o comprehensive (vedi Annex A).

---

## Variabili da registrare in WPS/WPQR (Campi essenziali — Clausola 9)

Elenco **di campi**, non di range. Path: §9.3–9.10.

| Campo | Fonte 14555 | Campo app oggi (STUD-1) |
|---|---|---|
| Processo ISO 4063 | §9.4 | catalogo `weldingProcesses4063.js` **senza** famiglie stud → **STUD-3-B / GAP** |
| Parent: identità, rivestimento, gruppo 15608 | §9.3.1 | `base_material_*` (+ `_2` se due genitori) |
| Spessore parent (o range) | §9.3.2 | `thickness_*` — **non** applicare Tabella 7 15614 |
| Through-deck: spessore/configurazione lastra | §9.3.2 | **non modellato** |
| Posizione ISO 6947 | §9.5.2 | posizione WPQR esistente |
| Designazione stud | §9.6.1 | — |
| Diametro stud / sezione | Annex C form; §10.2.8.8 | `diameter_*` (label contestuale se SW) |
| Ferrule / gas ISO 14175 | §9.7 | — |
| Polarità, corrente, tempo, lift, protrusion, damper | §9.10 a–f | **non modellati** come range 14555 |
| Protezione bagno CF / SG / NP | §9.10 h | — |
| Capacità, tensione di carica (CD) | §9.10 i–j | — |
| Cavi: lunghezza, sezione, disposizione | §9.10 l | — |
| Preriscaldo | §9.11 | — |

Annex C (moduli WPS/WPQR, **informative**) conferma gli stessi campi. **Non** estrarre numeri dal facsimile del modulo.

---

## Annex B — «working range» (limiti di variante, **informative**)

Cartiglio allegato (pag. 36, pymupdf 2° passaggio): **Annex B (informative) — Working range**.  
Titolo Tabella B.1: *Limitations of stud-welding variants **(informative)***.

Questa tabella descrive **finestre di processo tipiche** (diametro × posizione × protezione), **non** sostituisce §10.2.8.8.

| Protezione | Diametro di saldatura `dw` e posizioni | Spessore min. parent |
|---|---|---|
| **CF** (ferrule) | **3–25 mm PA**; **3–20 mm PE**; **3–16 (19ᵉ) mm PC** | **0,25 × d**, ma non meno di **1 mm**ᶜ |
| **SG** (gas) | **3–16 mm PA**; **3–10 mm PC**ᵈ | **0,125 × d**, ma non meno di **1 mm**ᶜ |
| **NP** (nessuna) | **3–10 mm PA**; **3–10 mm tutte le posizioni**ᵈ | **0,1 × d**, ma non meno di circa **0,5 mm** |

Note a piè (pymupdf + render pagina):

- *(a)* il tempo di saldatura **non dovrebbe superare 100 ms** (riga NP);
- *(b)* posizioni ISO 6947;
- *(c)* lo spessore minimo evita il burn-through; altre applicazioni possono richiedere di più;
- *(d)* «provided the welding time does not exceed approximately **50 ms**» (non confondere con il simbolo corsivo *d*);
- *(e)* «with special ceramic ferrules only» (valore **19** in PC).

**Uso prodotto**: solo guida processo / UI informativa. **Non** come range di validità WPQR al posto di §10.2.8.

---

## Tabella 1 — esame e prove sui provini (2° passaggio — OK)

Fonte: render + pymupdf pag. 20 (paginazione norma «12»). Il totale è il numero di stud da saldare/provare; le prove campionano da quel pool (non sommare le celle).

### Con protezione del bagno

| Tipo prova | ≤100 °C 3834-2 `dw≤12` | ≤100 °C 3834-2 `dw>12` | ≤100 °C 3834-3/4 `dw≤12` | ≤100 °C 3834-3/4 `dw>12` | >100 °C tutte 3834, tutti `dw` |
|---|---|---|---|---|---|
| Visivo | All | All | All | All | All |
| Bend | 10 (60°) | 5 (60°) | 10 (60°) | 5 (30°) | 5 (30°) |
| Bend torque (boiler pins) | Not applied | Not applied | Not applied | Not applied | 10 |
| Tensile | — | 5 | — | — | — |
| Radiografico | Not applied | 5 (opz. al posto del tensile) | — | — | — |
| Macro (90°) | — | 2 | — | 2 | 2ᵃ |
| **Totale stud** | **10** | **12** | **10** | **12** | **5 (12ᵃ)** |

### Senza protezione del bagno

| Tipo prova | ≤100 °C 3834-2, tutti `dw` | ≤100 °C 3834-3/4, tutti `dw` |
|---|---|---|
| Visivo | All | All |
| Bend | 20 (60°) | 10 (30°) |
| Bend torque | Not applied | Not applied |
| Tensile | 10 | — |
| Radiografico / Macro | — / — | — / — |
| **Totale stud** | **30** | **10** |

Nota *(a)*: solo quando si saldano boiler pins su tubi destinati a carico di pressione (totale 12 invece di 5 nella colonna >100 °C).

§11.3 (prosa): piega **60°** per 3834-2/3834-3 e applicazioni **≤ 100 °C**; **30°** per 3834-4 oppure stud welding e applicazioni **> 100 °C**.  
Tabella 2 (momenti di piega boiler pins) resta **GAP** / fuori scope WPQR Mason.

---

## Processi ISO 4063 stud — **non in questo testo**

§9.4: la WPS deve indicare il processo **secondo ISO 4063**. Il testo `NORMA_00033` / PDF 14555 **non elenca** i numeri (es. famiglia 78x).  
**Vietato** inventare 783/784/785. Catalogo JS e STUD-3-B restano **dopo HITL** + eventuale estratto 4063.

---

## Campi WPQR da non mischiare con 15614-1

| Tema | 15614-1 (già in app) | 14555 (questo estratto) |
|---|---|---|
| Spessore parent | Tabelle 7/8, Level 1/2 | **Tutti gli spessori** se pWPS applicabile (§10.2.8.6) |
| Diametro | Tabella 9 tubo `≥ 0,5×D` (L2) | Sezione di prova, o **banda tra due prove** (§10.2.8.8) |
| Posizione | impatto/durezza → PA/PF/PC/PE | Soglia **100 ms** (§10.2.8.9) |
| Materiali | Tabelle 5/6 | Gruppi 1/2/8/10 + soglie **13 mm**, **10 ms**, **100 ms** |
| Protezione bagno | — | CF / SG / NP essenziale (§10.2.8.12) |

Caso Mason 001P-21: se il verbale cita **15614-1**, i range restano quelli 15614; **non** applicare in automatico §10.2.8.

---

## Non ancora codificato in JS / non seedare

**Vietato finché HITL non dà OK su residui + STUD-3-B:**

- `weldingQualificationRules*` / mirror backend — nessuna funzione 14555;
- `weldingProcesses4063.js` — nessun codice stud;
- seed VPS `norm_requirements` da questo estratto;
- calcolare in UI/ingest range spessore o diametro «stile 15614» quando `joint_type=SW` e norma 14555;
- usare Annex B (informative) come soglie di validità WPQR al posto di §10.2.8.

**STUD-3-B (dopo HITL), candidati codice solo se confermati:**

1. Sezione stud: una prova → solo quella sezione; due prove → intervallo (§10.2.8.8).
2. Spessore parent: «tutti gli spessori se pWPS applica» (§10.2.8.6) — con flag esplicito, non Tabella 7.
3. Posizione: ramo `tw > 100 ms` vs `tw ≤ 100 ms` (§10.2.8.9).
4. Protezione bagno CF/SG/NP (§10.2.8.12).
5. Materiali: celle OK di §10.2.8.4 / 10.2.8.5 b–c; **non** 10.2.8.5 a finché HITL interpretazione.
6. Through-deck lastra: più spessa copre più sottili (§10.2.8.7); definizione lastra **&lt; 3 mm** (§3.14).

---

## HITL — dubbi residui (dopo 2° passaggio)

1. §10.2.8.5 **(a)** — significato esatto per dissimili con `tw > 100 ms` (frase senza matrice di gruppi).
2. Codici **ISO 4063** da stampare in WPS (assenti da 14555; serve fonte 4063 o HITL Mason).
3. Tabella **2** (boiler pins) — ancora non ricostruita; fuori scope WPQR Mason tipico.

---

## Regole per ingest AI (finché non c’è motorino)

| Campo | Regola |
|---|---|
| Norma sul verbale | Se dichiara 14555 → `standard_reference` 14555; se dichiara 15614-1 (caso Mason) → **non** inferire 14555 |
| Diametro stud | Estrarre il valore **dichiarato**; **non** calcolare `0,5×D` (Tabella 9) |
| Spessore | Estrarre il dichiarato; **non** applicare Tabella 7/8 15614 a uno SW 14555 |
| Sezione / forma | Non inventare un intervallo: una misura in prova = quella sezione (§10.2.8.8) |
| Posizione / `tw` / CF-SG-NP | Estrarre se presenti sul verbale; non defaultare coperture |
| Processi 4063 stud | Non mappare a 78x finché assenti da catalogo/HITL |
