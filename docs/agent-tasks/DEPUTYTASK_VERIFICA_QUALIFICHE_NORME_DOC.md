# DEPUTYTASK_VERIFICA_QUALIFICHE_NORME_DOC — VQ-3: estratto operativo ISO 9606-2 + allineamento estratto 9606-1 (§5.2, Annex A) + stati backlog

**Stato:** CHIUSO — TEST OK (06/10/2026, mergiata [#719](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/719))  
**Aperto:** 06/10/2026  
**Piano:** [`PLAN_VERIFICA_QUALIFICHE_NORMA_SLICES.md`](PLAN_VERIFICA_QUALIFICHE_NORMA_SLICES.md) § 3 (inventario norme) · § 6.3 VQ-3  
**Dipende da:** nessuna (onda 1)  
**Rischio:** **Basso** — solo documentazione. È però il **prerequisito normativo** di VQ-6 (equivalenze §5.2) e VQ-10 (9606-2): la qualità delle citazioni conta.  
**Stream:** `DEPUTYTASK_VERIFICA_QUALIFICHE_*.md` (non riusare per altri epic)  
**Branch suggerito:** `cursor/vq-3-norme-doc-<suffisso>`  
**Contesto consigliato:** default/basso

---

## Obiettivo (una slice = un risultato verificabile)

Tre risultati documentali, nessun codice:

1. **Nuovo** `docs/reference/ISO-9606-2-range-validita-patentino.md`: estratto operativo della ISO 9606-2:2004 sul modello di quello 9606-1 (Tab. 2–8, §9, Annex A, differenze rispetto a 9606-1), costruito **solo** da `docs/Normative/` (`NORMA_00032` e collegati). Ogni dubbio di lettura/ricostruzione da glifi è dichiarato come **GAP**, non risolto a memoria.
2. **Allineamento** di `docs/reference/ISO-9606-1-range-validita-patentino.md`: (a) §5.2 — l'estratto e il prompt omettono che **141/143/145 qualificano anche 142** (il testo `NORMA_00018` §5.2 lo dice); correggere l'estratto citando il paragrafo; (b) aggiungere la tabella «campi Annex A: modellati / non modellati» (8 voci non modellate: corrente/polarità, job knowledge, riferimento WPS, prove eseguite, metodo di rivalidazione, prova d'angolo supplementare, …: verificarle sul testo Annex A); (c) stato di Tab. 3/4/5/11/12 («×» da confermare a glifo).
3. **Aggiornamento di stato** in `docs/reference/NORME_MANCANTI_BACKLOG.md` per le sole righe dell'epic (stati/note; le righe nuove sono già nel PR di charting).

## Gate norme (dichiarato)

Slice interamente norm-touching (documentale).

- **Coperte:** ISO 9606-1:2017 (`NORMA_00018` + estratto) · ISO 9606-2:2004 (`NORMA_00032`: tabelle 2–8, §9, Annex A leggibili; **nessun** estratto in `docs/reference`) · ISO 4063:2023 (`NORMA_00044`) · ISO 14175:2008 (`NORMA_00012`).
- **Mancanti (da dichiarare come GAP nell'estratto, non inventare):** gruppi Al 21–26 di ISO/TR 15608 e CR ISO 15608 (Tab. 2 di 9606-2 usa i gruppi di materiale) · eventuali celle di tabella non leggibili da glifo · 9606-3/-4/-5 (fuori scope).
- **Si parte su:** trascrivere ciò che il Markdown mostra, con numero di paragrafo/tabella e riferimento `NORMA_00xxx`; ciò che non si legge con certezza va in una sezione «GAP / da confermare con il PDF».

## Checklist dato ↔ norma ↔ UI ↔ API

Nessun campo di prodotto nuovo in questa slice. Tabella di lavoro per le clausole che il resto dell'epic consumerà:

| Dato (oggi/futuro) | Clausola / fonte MD | UI | API / persistenza |
|--------------------|---------------------|----|-------------------|
| Spessore materiale `t` (BW) — range qualificato 9606-2 | 9606-2:2004 Tab. 3 (t ≤ 6: 0,5t–2t; t > 6: ≥ 6) · **da riconfermare sul testo** | VQ-10 | VQ-10 (nessuna ora) |
| Spessore FW | 9606-2:2004 Tab. 5 (t < 3: t–3; t ≥ 3: ≥ 3) · **da riconfermare** | VQ-10 | idem |
| Posizioni (matrice a 10 colonne) | 9606-2:2004 tabella posizioni · **da riconfermare** | VQ-10 | idem |
| Validità / conferma / prolungamento | 9606-2:2004 §9 · **da riconfermare** | VQ-10 | idem |
| Processi equivalenti | 9606-1:2017 §5.2 (141/143/145 → 141/142/143/145) | VQ-6 | VQ-6 |

I valori numerici sopra sono quelli annotati nel piano di charting: la slice li **ricontrolla** sul testo e li conferma o li corregge; se non si leggono, li marca GAP.

## File previsti

- *Nuovo* `docs/reference/ISO-9606-2-range-validita-patentino.md`
- *Modificato* `docs/reference/ISO-9606-1-range-validita-patentino.md` (§5.2, tabella campi Annex A, stato Tab. 3/4/5/11/12)
- *Modificato* `docs/reference/NORME_MANCANTI_BACKLOG.md` (**solo** stati/note delle righe dell'epic)
- Solo lettura: `docs/Normative/**` (`NORMA_00018`, `NORMA_00032`, `NORMA_00044`, `NORMA_00012`), `docs/reference/MATERIAL-COMPLIANCE-NORME-SINTESI.md` § Inventario fonti, `docs/reference/AUDIT_NORME_QUALIFICHE_PDF_2026-10-04.md`

## Cosa NON toccare

Qualsiasi `.js` / `.jsx` / `.json`, `docs/Normative/**`, `PLAN_*`, `docs/GUIDA_CONSOLIDATA.md`, `docs/PROJECT_ROADMAP.md`, `PROJECT_CONTEXT.md`, `docs/reference/DATABASE.md`.

## Cosa fare

1. Allineare Git; leggere in `docs/Normative/` solo i file delle norme elencate (con `offset`/`limit`, mai interi).
2. Scrivere l'estratto 9606-2 con lo **stesso schema** dell'estratto 9606-1 (sezioni parallele per facilitare il confronto): ambito, variabili essenziali, tabelle (spessore BW/FW, diametro, posizioni, materiali di apporto), validità e conferma (§9), campi del certificato (Annex A), **differenze da 9606-1** (spessore `t` del materiale invece di `s` depositato per BW, matrice posizioni, gruppi materiale, BW qualifica FW §5.4 b). Ogni riga: clausola + `NORMA_00032` + stato di leggibilità (`leggibile` | `ricostruita da glifi` | `GAP`).
3. Correggere §5.2 dell'estratto 9606-1 e dichiarare nel documento la **discordanza trovata** (estratto e prompt AI vs testo ufficiale), così VQ-6 allinea il codice.
4. Rileggere anche il resto dei punti dell'estratto 9606-1 citati dalla verifica (Annex A, §9) e annotare ogni altra divergenza; non correggere a memoria.
5. Backlog: aggiornare stato e note delle righe (ISO 14732, 9606-1 Tab. 3/4/5/11/12, EN 287-1, TR 15608/CR 15608, ISO 6947, 9606-3/-4/-5) in base a ciò che l'estratto 9606-2 ha chiarito; mantenere i blocchi HITL del piano.

## Test / verifiche

- `node backend/scripts/check-utf8-encoding.js` (0 issue) e `node backend/scripts/check-harness-boot.js` (path in backtick esistenti).
- Revisione incrociata: ogni numero nuovo ha un riferimento a paragrafo/tabella e a `NORMA_00xxx`; nessuna soglia senza fonte.
- `git diff --stat origin/main` contiene **solo** file `docs/reference/**`.

## Rielaborazioni (Registro)

**Esenzione dichiarata:** nessun campo AI-estraibile, nessuna colonna.

## DoD

- [ ] `ISO-9606-2-range-validita-patentino.md` creato, con riferimenti `NORMA_00032` e sezione GAP
- [ ] Estratto 9606-1: §5.2 corretto (141/143/145 → 142) con citazione; tabella campi Annex A modellati/non modellati; stato Tab. 3/4/5/11/12
- [ ] Backlog: stati/note aggiornati senza rimuovere i blocchi HITL
- [ ] Nessuna soglia/clausola inventata; dubbi dichiarati come GAP
- [ ] UTF-8 senza BOM, accenti corretti; `check-utf8-encoding.js` e `check-harness-boot.js` OK
- [ ] Nessun file di codice nel diff
- [ ] Branch allineato a `origin/main` prima di push/PR; PR docs (Basso): `bugbot run` non necessario se il diff è solo `docs/reference/**` (dichiararlo nel body PR)

## HITL

Se `NORMA_00032` non permette di leggere con certezza una tabella: **non** indovinare; marcare GAP e lasciare la richiesta al committente nel backlog (già previste nel piano § 3.1 richieste 4 e 5).

## Comando di avvio

`Leggi docs/agent-tasks/DEPUTYTASK_VERIFICA_QUALIFICHE_NORME_DOC.md ed eseguilo. Chiudi con TEST OK o FIX NON APPLICABILI.`

## Handoff

_(vuoto)_
