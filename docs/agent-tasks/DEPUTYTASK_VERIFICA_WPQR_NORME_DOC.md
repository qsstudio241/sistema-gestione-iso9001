# DEPUTYTASK_VERIFICA_WPQR_NORME_DOC — WV-2: estratto operativo «dati di prova WPQR» (Annex B / A / C ↔ clausole ↔ campi) + stati backlog

**Stato:** CHIUSO — TEST OK (08/10/2026; PR draft `cursor/wv-2-norme-doc-wpqr-064b`, rischio Basso, solo documentazione)  
**Aperto:** 07/10/2026  
**Piano:** [`PLAN_VERIFICA_WPQR_SLICES.md`](PLAN_VERIFICA_WPQR_SLICES.md) § 2 (modello dati) · § 4 (inventario norme) · § 5 (regole) · § 6.3 WV-2  
**Dipende da:** nessuna (onda 1)  
**Rischio:** **Basso** — solo documentazione. È però il **prerequisito normativo** di WV-5a/WV-5b (pack) e di WV-4 (schema AI): la qualità delle citazioni conta.  
**Stream:** `DEPUTYTASK_VERIFICA_WPQR_*.md` (non riusare per altri epic)  
**Branch suggerito:** `cursor/wv-2-norme-doc-<suffisso>`  
**Contesto consigliato:** default/basso

---

## Obiettivo (una slice = un risultato verificabile)

Due risultati documentali, nessun codice:

1. **Nuovo** `docs/reference/WPQR-dati-prova-pagina-2-estratto.md`: per ciascuna norma (ISO 15614-1 Annex B, ISO 15614-2 Annex A, ISO 14555 Annex C; ISO 15613 solo come rinvio) elenca **le righe del modulo WPQR** (pag. 1 «Test piece / Range of qualification», pag. 2 «Record of weld test» con tabella passate, pag. 3 esiti), la **clausola «shall»** che le richiede (15614-1 §9, 15614-2 §9, 14555 §10.4, 15613 §10 + gli elementi di ISO 15609-1 §4.4.8–4.4.17 e §4.5.1–4.5.5), la **riga marcata `*` («if required»)**, il **campo previsto** (piano § 2.2–2.3) e i **GAP**. Costruito **solo** da `docs/Normative/` (`NORMA_00043`, `NORMA_00031`, `NORMA_00033`, `NORMA_00045`, `NORMA_00014`) e dagli estratti già in `docs/reference/`.
2. **Aggiornamento di stato** in `docs/reference/NORME_MANCANTI_BACKLOG.md` per le sole righe WPQR aggiunte dal charting (campione WPQR reali; §8.4.7/Tab. 3/Tab. 7 L1; ISO/TR 18491 + 17671-1; edizioni legacy): stati/note, mai nuove soglie.

## Gate norme (dichiarato)

Slice interamente norm-touching (documentale).

- **Coperte:** 15614-1:2017+A1:2019 (`NORMA_00043`: §9, §8.3.2/8.3.3, §8.4.1–8.4.11, §8.5.2.3, §8.5.6, Annex B, Tab. 1/2/3), 15614-2:2025 (`NORMA_00031`: §9, Annex A, §8.4.4–8.4.9), 14555:2025 (`NORMA_00033`: §10.2.8.x, §10.4, Annex C), 15613:2025 (`NORMA_00045` §8, §10), 15609-1:2019 (`NORMA_00014` §4.4–4.5).
- **Mancanti:** ISO/TR 18491 e ISO/TR 17671-1; Tab. 7 colonna Level 1 (cifre troncate); attribuzione L1/L2 della frase §8.4.7 sul limite inferiore per durezza e note di Tab. 3 (colonne intercalate nel Markdown); edizioni legacy.
- **Si parte su:** tutto ciò che è leggibile. **Non** inventare soglie né attribuzioni di livello: ogni dubbio resta **GAP dichiarato** e rimanda alla richiesta HITL del piano (§ 4.1).

## Checklist dato ↔ norma ↔ UI ↔ API

| Dato | Clausola / fonte MD | UI | API / persistenza |
|------|---------------------|----|-------------------|
| Righe Annex B/A/C ↔ campo previsto (colonne `wpqr_test_runs` + testata) | 15614-1 §9 + Annex B; 15614-2 §9 + Annex A; 14555 §10.4 + Annex C; 15609-1 §4.4.x/§4.5.x | — (input per WV-4/WV-6a) | — (doc) |
| Elementi 15609-1 richiesti nella WPQR via §9 ma **assenti da Annex B** (portata gas, ugello, tungsteno, distanza tubo di contatto) | 15609-1 §4.5.2–4.5.5 | — | gruppo B opzionale (piano D3) |
| GAP e blocchi | piano § 3–4 | — | `NORME_MANCANTI_BACKLOG.md` |

## File previsti

- *Nuovo* `docs/reference/WPQR-dati-prova-pagina-2-estratto.md`
- *Modificato* `docs/reference/NORME_MANCANTI_BACKLOG.md` (**solo** stati/note delle righe WPQR del charting)
- Solo lettura: `docs/Normative/**` (le cinque norme sopra), `docs/reference/ISO-15614-1-range-validita-WPQR.md`, `ISO-15614-2-range-validita-WPQR.md`, `ISO-14555-2025-range-validita-WPQR.md`, `ISO-15609-WPS-contenuto.md`, `ISO-15613-qualifica-pre-produzione.md`, `docs/gap-reports/GAP_WPQR_ESTENSIONI_ANNEX_B_2026-08-07.md`

## Cosa NON toccare

Qualsiasi `.js/.jsx/.json`, `docs/Normative/**`, gli altri `docs/reference/*` (si **cita**, non si riscrive), `PLAN_*`, `GUIDA_CONSOLIDATA.md`, `PROJECT_ROADMAP.md`, `PROJECT_CONTEXT.md`.

## Cosa fare

1. Aprire il Markdown di ciascuna norma e **ricontrollare ogni clausola** citata nel piano (§ 2.1, § 4, § 5). Se una clausola del piano non corrisponde al testo, correggere **nell'estratto** e segnalarlo nel body PR (il piano non si modifica in questa slice).
2. Tabella per norma: *riga del modulo* · *pagina (1/2/3)* · *obbligatoria o `*`* · *clausola «shall»* · *campo previsto* · *stato fonte* (leggibile / GAP).
3. Sezione «Parametri richiesti via §9 ma non in Annex B» (15609-1 §4.5.x) e sezione «Cosa non è nel modulo» (nessun valore numerico di prova ricavabile da Annex B se non quelli della tabella passate).
4. Sezione «Ambiguità di lettura» con i tre punti noti (§8.4.7 L1/L2, Tab. 3, Tab. 7 L1) **senza risolverli**; rimando alle richieste HITL del piano.
5. Backlog: portare le righe WPQR del charting allo stato corretto (`da_richiedere` resta tale finché non arriva il materiale); nessuna riga cancellata.

## Test L1

Comandi: `node backend/scripts/check-utf8-encoding.js` · `node backend/scripts/check-harness-boot.js` (nessun path nuovo in `PROJECT_CONTEXT.md`, deve restare verde).

- UTF-8 senza BOM; accenti corretti; nessun U+FFFD.
- Ogni link relativo del nuovo file esiste.

## Rielaborazioni (Registro)

**Esenzione dichiarata:** solo documentazione; nessun campo, nessuna colonna.

## DoD

- [x] `WPQR-dati-prova-pagina-2-estratto.md` con una sezione per 15614-1 (Annex B), 15614-2 (Annex A), 14555 (Annex C) e il rinvio 15613
- [x] Ogni clausola citata verificata aprendo il Markdown; nessuna soglia inventata; GAP dichiarati con rimando HITL
- [x] Backlog: stati/note aggiornati senza cancellare righe
- [x] `check-utf8-encoding.js` e `check-harness-boot.js` verdi; **nessun file di codice** nel diff
- [x] Branch allineato a `origin/main` prima di push/PR

## HITL

Nessuno bloccante (la slice **documenta** i blocchi). Se per una clausola serve il PDF → riga nel backlog + blocco «Richiesta norma» (`HANDOFF_TEMPLATE.md`), non una regola.

## Comando di avvio

`Leggi docs/agent-tasks/DEPUTYTASK_VERIFICA_WPQR_NORME_DOC.md ed eseguilo. Chiudi con TEST OK o FIX NON APPLICABILI.`

## Handoff

_(vuoto: slice chiusa)_

**Esito (08/10/2026):** creato `docs/reference/WPQR-dati-prova-pagina-2-estratto.md` (15614-1 Annex B, 15614-2 Annex A, 14555 Annex C, rinvio 15613, elementi 15609-1 §4.4–4.5); `NORME_MANCANTI_BACKLOG.md`: note WV-2 sulle 4 righe WPQR + 2 righe nuove (ISO/TR 17671-2/-4; conferma pagine modulo 14555 Annex C / 15614-2 Annex A). `check-utf8-encoding.js` e `check-harness-boot.js` verdi; nessun file di codice. GAP/HITL: vedi § 7 dell'estratto (GAP-1…8).
