# ISO 14555:2025 — Range di validità WPQR stud / prigioniero (riferimento operativo SGQ)

> **Uso**: HITL committente/Mason prima di qualsiasi motorino range; ingest WPQR stud; slice STUD-3-B (codice) **solo dopo OK HITL**.
> **Fonte**: BS EN ISO 14555:2025 "Welding — Arc stud welding of metallic materials". Testo integrale nel Patrimonio Studio — **qui solo tabelle/regole sintetiche**, mai testo normativo copiato.
> **Digitalizzazione**: `docs/Normative/Normative NORMA_00033_ BS EN ISO 14555_2025 Rev. 0.md` (+ `.json`). PDF **non** in Git (indice: `docs/Normative/SOURCE_PDF_INDEX.md`).
> **Modello editoriale**: `docs/reference/ISO-15614-1-range-validita-WPQR.md`.
> **Codice**: **nessuno** in questa slice. Vietato seedare `norm_requirements` e vietato toccare `weldingQualificationRules*` finché l’estratto non è revisionato.

**Non confondere** con ISO 15614-1 (qualifica procedura arco/gas su acciaio: BW/FW, tabelle 7/8/9 spessore/diametro tubo). Lo stud welding 14555 ha **regole di validità diverse** (sezione trasversale del prigioniero, tempo di saldatura `tw`, protezione bagno CF/SG/NP). Il verbale Mason 001P-21 (fillet 135 su prigioniero tubolare, norma dichiarata 15614-1) **non** è automaticamente una qualifica 14555.

## Fonti Markdown (questa slice)

```text
Fonti Markdown:
- Coperte: NORMA_00033 MD+JSON (26/08/2026, #584); modello editoriale ISO-15614-1-range-validita-WPQR.md
- Mancanti / GAP: Tabella 1 (pag. 20, caratteri invertiti pymupdf); Tabella 4.1 simboli intercalati;
  Tabella B.1 celle con footnote intercalate; codici ISO 4063 stud (78x) assenti dal MD
- Si parte su: §10.2.8 (range of qualification) + variabili WPS §9.10 + definizioni §3;
  marcare GAP dove l'OCR è ambiguo; VIETATO inventare soglie
```

## Nota sulla fonte (qualità estrazione)

Digitalizzazione 26/08/2026 (`pdf_to_json`). Qualità **non uniforme**:

| Zona | Motore | Stato |
|---|---|---|
| §10.2.8.1–10.2.8.12 (pag. 21–22) | pdfplumber | **Prosa range di qualifica leggibile** — base di questo estratto |
| Tabella 1 esame/prove (pag. 20) | pymupdf (nota tecnica nel MD) | **GAP**: caratteri invertiti / colonne intercalate — non ricostruire la matrice |
| §4.1 Simboli (pag. 12) | pdfplumber | **GAP**: colonne intercalate (`C`/`d`/`hw`/`I`/`L`/`t` ambigui) — usare §3 |
| Annex B Tabella B.1 (pag. 36) | pdfplumber | **Parziale**: bande diametro/posizione ripetute nel flusso; coefficienti spessore min. con footnote intercalate → **GAP** sulle formule |
| Numerazione §10.2.8.11 | pdfplumber | OCR `10.2.8.1 1 Preheating` (JSON spezza `10.2.8.1` + titolo `1 Preheating`) — contenuto della regola è chiaro |

**Conclusione qualità**: le **regole di validità WPQR** (prosa §10.2.8) sono usabili per HITL. Non esiste in 14555 una tabella spessore tipo 15614-1 Tabella 7. **Non** copiare numeri da Tabella 1 o da celle dubbie di Annex B nel codice.

---

## Definizioni operative (solo §3, non §4.1)

| Simbolo / termine | Significato (MD fonte) | Path |
|---|---|---|
| **stud** | elemento da unire con stud welding | §3.1, MD ~riga 210 |
| **d** | diametro nominale dello stud | §3.4, MD ~riga 210 |
| **dw** | *welding diameter*: diametro alla base **prima** della saldatura | §3.5, MD ~riga 210 |
| **tw** | *welding time*: accensione → spegnimento arco principale | §3.8, MD ~riga 214 |
| **CF / SG / NP** | ceramic ferrule / shielding gas / no protection | §4.2, MD ~riga 228 |
| **PA / PC / PE** | posizioni ISO 6947 (flat / horizontal / overhead) | §4.2, MD ~riga 228 |
| **through-deck** | connettori a taglio saldati attraverso lastra sottile | §3.14, MD ~riga 214 |

Stud non circolari: la sezione si converte in diametro equivalente (§3.4 / §3.5 Note 2) — **nessuna formula numerica** nel MD.

**GAP**: soglia spessore lastra nella definizione through-deck (`o3f.1 le5ss than 3 mm`) — OCR intercalato con i numeri di clausola. **Non usare «3 mm» in codice** senza HITL sul PDF.

**GAP**: Tabella §4.1 (unità e assegnazione `I`/`L`/`t`/`U`/`E`/`α`) — non usare.

---

## Range di qualificazione — §10.2.8

Fonte: MD `### 10.2.8` (~righe 599–667) e JSON `clause_ref` `10.2.8.1` … `10.2.8.12`.  
Le condizioni **si applicano ciascuna in modo indipendente**. Fuori dai range → nuova prova di procedura.

### Durata e prove di produzione (§10.2.8.1)

| Regola | Path |
|---|---|
| Nessun limite di durata della qualifica se non cambiano le condizioni di qualità e si tiene il registro di sorveglianza produzione (§14.6) | MD ~riga 603; JSON `10.2.8.1` |
| Serve **prova di produzione almeno una volta all’anno** (§14.2), per dipendenza anche dall’operatore | idem |
| Qualsiasi stud con sezione **entro** il range di validità può essere usato per quella prova | idem |
| Produzione sospesa **oltre 1 anno** → confermare la validità con prova di produzione | idem |
| Qualifica secondo §10.2.9 (through-deck in cantiere) valida **fino a cambio parametri** | idem |

### Fabbricante (§10.2.8.2)

Qualifica pWPS del fabbricante valida per officina o cantiere **sotto lo stesso controllo tecnico e di qualità** di quel fabbricante. Path: MD ~riga 607; JSON `10.2.8.2`.

### Parametri di saldatura (§10.2.8.3)

La qualifica resta valida per variazioni di parametri **entro le raccomandazioni del fornitore dell’apparecchiatura**. Path: MD ~riga 611; JSON `10.2.8.3`.  
**Non** è una banda percentuale fissa (niente ±10 % inventato).

### Materiali simili parent + stud (§10.2.8.4)

| Regola | Path | Stato |
|---|---|---|
| Prova su parent **gruppo 1 o 2** (ISO/TR 15608) copre acciai con **snervamento specificato uguale o inferiore** | MD ~riga 615; JSON `10.2.8.4` | OK |
| La prova copre **tutti i materiali dello stesso gruppo** 15608, con le aggiunte sotto | idem | OK |
| **(a)** Fino a **13 mm** diametro stud (o sezione equivalente): gruppi **8 o 10** coprono gruppo **1** e sottogruppo **2.1**, e viceversa | MD ~righe 617–619 | OK |
| **(b)** Tempo di saldatura specificato **sotto 10 ms**: gruppo **8** copre gruppi **1–6** e sottogruppo **11.1**, e viceversa | MD ~righe 621–623 (OCR spezza `## 11.1 and vice versa`) | **GAP OCR** sul solo heading; testo consecutivo leggibile |

### Materiali dissimili parent vs stud (§10.2.8.5)

| Regola | Path | Stato |
|---|---|---|
| **(a)** «A qualification for specified welding time **beyond 100 ms** is required.» | MD ~riga 627; JSON `10.2.8.5` | **GAP interpretazione**: frase isolata, **non** elenca coperture automatiche. Non inventare una matrice. HITL: conferma se significa «serve prova dedicata, nessuna estensione gruppi» |
| **(b)** Tempo specificato **fino a 100 ms**: gruppo **8 o 10** copre gruppi **1** e sottogruppo **2.1**, e viceversa | MD ~righe 629–631 | OK (OCR spezza heading `## 2.1`) |
| **(c)** Tempo specificato **sotto 10 ms**: gruppo **8** copre gruppi **1–6** e sottogruppo **11.1**, e viceversa | MD ~righe 633–635 | OK (stesso pattern OCR di 10.2.8.4 b) |
| Tenere conto del rischio di incrudimento / *hardening* | MD ~riga 639 | nota, non soglia |

### Spessore materiale parent (§10.2.8.6) — diverso da 15614-1

Lo spessore usato nella prova di procedura **vale per tutti gli spessori**, purché la **pWPS** usata in prova si applichi. Path: MD ~riga 643; JSON `10.2.8.6`.

**Non** è Tabella 7 di 15614-1 (0,5 t … 2 t). **Non** calcolare range spessore 15614 su un WPQR 14555.

### Lastra through-deck (§10.2.8.7)

La qualifica della lastra **più spessa** usata in produzione copre **tutte le lastre più sottili**. Path: MD ~riga 647; JSON `10.2.8.7`.  
Ambito: through-deck stud-welding, non lo spessore del parent strutturale (§10.2.8.6).

### Sezione e forma dello stud (§10.2.8.8) — regola diametro/sezione

| Prova | Copertura | Path |
|---|---|---|
| **Una** prova di procedura | **Tutte le forme** di stud, ma **solo la sezione di saldatura** usata in prova | MD ~riga 651; JSON `10.2.8.8` |
| **Due** prove su sezioni **diverse** | Il **intervallo tra** le due sezioni **e** tutte le forme | idem |

Non c’è moltiplicatore tipo «0,5×D … 2×D» (quello è 15614-1 Tabella 9, **tubo**). Per 14555 il diametro/sezione qualificato è **quello di prova**, oppure la **banda tra due prove**.

### Posizione di saldatura (§10.2.8.9)

Posizioni secondo ISO 6947. Path: MD ~riga 655; JSON `10.2.8.9`.

| Tempo di saldatura | Copertura posizioni |
|---|---|
| **tw oltre 100 ms** | **PC** copre **PE** e **PA**, **non** il contrario. **PE** copre **PA**, **non** il contrario. Per PC si possono usare ferrule ceramiche speciali. Through-deck **solo PA**. |
| **tw 100 ms o inferiore** | Qualifica in **una qualsiasi** posizione → valida per **tutte** le posizioni |

### Apparecchiatura (§10.2.8.10)

Cambio di tipo pistola/testa e/o generatore, o di fabbricante dell’apparecchio → la WPS va **verificata** (es. prova di produzione §14.2 oppure certificati di taratura che i dati della WPS qualificata sono rispettati). Path: MD ~riga 659; JSON `10.2.8.10`.

### Preriscaldo (§10.2.8.11)

WPS qualificata **senza** preriscaldo vale anche **con** preriscaldo, **non** il contrario. Path: MD ~riga 663 (OCR `10.2.8.1 1`); JSON spezza il ref. **GAP** solo sul numero di clausola.

### Protezione del bagno (§10.2.8.12)

| Prova | Copre | Path |
|---|---|---|
| Un metodo specifico (CF / SG / NP) | **Solo** quel metodo | MD ~riga 667; JSON `10.2.8.12` |
| **Senza** protezione (NP) | Uso di **gas di protezione (SG)**, **non** il contrario | idem |

Stessa logica per gli **operatori** §6.1 (cambio CF/SG/NP → nuova qualifica; NP copre SG). Path: MD ~riga 262.

---

## Qualifica through-deck in cantiere (§10.2.9) — non è il range §10.2.8

Ambito: costruzioni con carichi **principalmente statici**, headed stud attraverso lamiere profilate **zincate**; **singolo cantiere** e condizioni prevalenti.

| Requisito (leggibile) | Path | Nota |
|---|---|---|
| pWPS/WPS conformi a Clausola 9 | MD ~riga 673 | OK |
| Minimo **10** stud saldati | MD ~riga 675 | OK |
| Esame visivo su tutti | MD ~riga 677 | OK |
| Bend test **30°** su tutti | MD ~riga 681 | OK |
| Validità fino a cambio parametri | §10.2.8.1 | OK |

OCR minore: «all stud s», «an all studs» — non cambia i numeri.

---

## Qualifica per esperienza precedente (§10.3)

Rinvio a ISO 15611, con limiti 14555:

- stessa **tipologia di apparecchiatura**;
- stesso **tipo e spessore** del parent;
- stesso **diametro** degli stud della produzione su cui si basa l’esperienza.

**Non ammessa** al posto della prova di procedura per saldature di **acciaio** con requisiti di qualità standard o comprehensive (vedi Annex A). Path: MD ~righe 685–697.

---

## Variabili da registrare in WPS/WPQR (Campi essenziali — Clausola 9)

Elenco **di campi**, non di range. Path: §9.3–9.10, MD ~righe 368–474; JSON `9.10`.

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

Annex C (moduli WPS/WPQR) conferma gli stessi campi (diametro stud, `tw`, corrente, lift, protrusion, capacità, tensione). OCR del modulo è rumoroso; **non** estrarre numeri dal facsimile.

---

## Annex B — «working range» (limiti di variante, **non** range WPQR)

Titolo Tabella B.1 nel MD: *Limitations of stud-welding variants **(informative)***.  
TOC: «Annex B Working range **(normative)**». **GAP HITL**: status normativo dell’allegato.

Questa tabella descrive **finestre di processo tipiche** (diametro × posizione × protezione), **non** sostituisce §10.2.8.8.

Frammenti **ripetuti in modo coerente** nel flusso MD ~righe 1094–1110 (pag. 36):

| Protezione | Diametro di saldatura e posizioni (leggibile nel flusso) | Spessore min. parent (frammento) |
|---|---|---|
| **CF** (ferrule) | **3–25 mm PA**; **3–20 mm PE**; **3–16 (19) mm PC** | «0,25 … but not less than 1 mm» + footnote *d*/*e* |
| **SG** (gas) | **3–16 mm PA**; **3–10 mm PC** | «0,125 … but not less than 1 mm» |
| **NP** (nessuna) | **3–10 mm PA**; **3–10 mm tutte le posizioni** | «0,1 … but not less than approximately 0,5 mm» |

Note a piè **leggibili**:

- *(a)* il tempo di saldatura **non dovrebbe superare 100 ms** (riga NP);
- *(b)* posizioni ISO 6947;
- *(c)* lo spessore minimo evita il burn-through; altre applicazioni possono richiedere di più;
- *(d)* «provided the welding time does not exceed approximately **50 ms**»;
- *(e)* «with special ceramic ferrules only» (associata a PE/PC nel flusso).

**GAP (non codificare)**:

- se 0,25 / 0,125 / 0,1 sono **× dw** oppure millimetri fissi (nel flusso compaiono accanto a `d`);
- significato di **16 (19)** mm in PC;
- se Annex B è vincolante o solo informativa.

---

## Tabella 1 — esame e prove sui provini — **GAP**

Pagina 20: nota tecnica MD «testo ricostruito con motore alternativo» + tabella a caratteri invertiti (JSON/MD ~righe 542–591).

Frammenti nel **testo lineare** (prima della tabella invertita), **non** da usare come matrice chiusa:

- colonne `dw ≤ 12 mm` / `dw > 12 mm` / «All diameters (dw)»;
- applicazioni **≤ 100 °C** vs **> 100 °C** e richiami ISO 3834-2/3/4;
- angoli di piega **60°** e **30°** (allineati a §11.3);
- footnote «Only when welding boiler pins on pipes intended for pressure loading».

**Non ricostruire** i conteggi (10/12/5/20/30) in codice: le colonne sono intercalate. HITL: rileggere Tabella 1 dal PDF.

§11.3 (prosa, pag. 24, più pulita): piega **60°** per 3834-2/3834-3 e applicazioni **≤ 100 °C**; **30°** per 3834-4 oppure stud welding e applicazioni **> 100 °C**. Path: MD ~righe 727–729. Tabella 2 (momenti di piega boiler pins) è **troncata** — **GAP**, fuori dallo scope WPQR Mason.

---

## Processi ISO 4063 stud — **non in questo MD**

§9.4: la WPS deve indicare il processo **secondo ISO 4063**. Il testo `NORMA_00033` **non elenca** i numeri (es. famiglia 78x).  
**Vietato** inventare 783/784/785 in questa slice. Catalogo JS e STUD-3-B restano **dopo HITL** + eventuale estratto 4063.

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

**Vietato in STUD-3-A (questa slice) e finché HITL non dà OK:**

- `weldingQualificationRules*` / mirror backend — nessuna funzione 14555;
- `weldingProcesses4063.js` — nessun codice stud;
- seed VPS `norm_requirements` da questo estratto;
- calcolare in UI/ingest range spessore o diametro «stile 15614» quando `joint_type=SW` e norma 14555;
- usare Tabella 1, Tabella B.1 (formule spessore min.) o §4.1 come soglie prodotto.

**STUD-3-B (dopo HITL), candidati codice solo se confermati:**

1. Sezione stud: una prova → solo quella sezione; due prove → intervallo (§10.2.8.8).
2. Spessore parent: «tutti gli spessori se pWPS applica» (§10.2.8.6) — con flag esplicito, non Tabella 7.
3. Posizione: ramo `tw > 100 ms` vs `tw ≤ 100 ms` (§10.2.8.9).
4. Protezione bagno CF/SG/NP (§10.2.8.12).
5. Materiali: solo le celle **OK** di §10.2.8.4 / 10.2.8.5 b–c; **non** 10.2.8.5 a finché HITL.
6. Through-deck lastra: più spessa copre più sottili (§10.2.8.7).

---

## HITL — da confermare sul PDF prima di STUD-3-B

1. §10.2.8.5 **(a)** — significato esatto per dissimili con `tw > 100 ms`.
2. §10.2.8.4 **(b)** / 10.2.8.5 **(c)** — conferma «sottogruppo 11.1» (OCR heading).
3. Numerazione **10.2.8.11** preriscaldo.
4. Tabella **1** completa (pag. 20).
5. Tabella **B.1**: normativo vs informativo; 0,25×d vs mm; «16 (19)».
6. Definizione through-deck: soglia lastra «&lt; 3 mm» sì/no.
7. Codici **ISO 4063** da stampare in WPS (assenti da `NORMA_00033`).

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
