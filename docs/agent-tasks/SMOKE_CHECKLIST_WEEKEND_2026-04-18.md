# Smoke checklist — weekend 18 aprile 2026

> Riferimento: [`WEEKEND_RUN_2026-04-18.md`](WEEKEND_RUN_2026-04-18.md)  
> **Punti 1–3 e verifiche ripetibili dall’agente**: Netlify **Deploy Preview** della PR + esito **GitHub Actions** (`CI app (Pull Request)`).  
> **Punto 0**: smoke **manuale su produzione** (stesso utente, mobile + desktop); compilare tabella sotto con data e note **anonimizzate** (niente nomi aziende, URL interni, credenziali).

---

## Esito CI e preview (da compilare dopo apertura PR)

| Voce | Valore |
|------|--------|
| URL Deploy Preview Netlify | _incollare dopo generazione preview_ |
| Workflow CI | `.github/workflows/ci-app-pr.yml` |
| Esito CI (main check) | ☐ OK / ☐ KO |
| Commit testato (SHA breve) | |
| Data/ora esecuzione CI | |

### Verifica locale (agente, pre-push)

Eseguita in workspace su branch `chore/weekend-smoke-2026-04-18` prima dell’apertura PR (2026-04-18).

| Comando (directory `app/`) | Esito |
|-----------------------------|-------|
| `NODE_ENV=test` → `npm run test:run` | ☑ OK — 27 test Vitest (inclusi `wordExport.riepilogo` per AP / NV / N.A.) |
| `npm run build` | ☑ OK |

---

## Punto 0 — Lista audit (produzione — **manuale**)

**Ambiente**: produzione (frontend Netlify + API pubblica).  
**Dispositivi**: stesso account utente su **telefono** e **desktop**.  
**Dataset**: elenco audit **>50** voci se disponibile.

| # | Passo | OK / KO | Data (gg/mm/aaaa) | Note (anonimizzate) |
|---|--------|---------|-------------------|---------------------|
| 0.1 | Login produzione | | | |
| 0.2 | Aprire lista audit: scroll fluido (nessun blocco evidente) | | | |
| 0.3 | Filtri/ricerca se usati abitualmente: nessun errore bloccante | | | |
| 0.4 | Aprire un audit a caso dalla lista: caricamento OK | | | |
| 0.5 | Ripetere 0.2–0.4 su **secondo dispositivo** (mobile **o** desktop) | | | |
| 0.6 | Console browser: nessun errore **rosso** ricorrente sulla lista | | | |

---

## Punto 1 — Export Word: verificatore + titoli (Deploy Preview)

Eseguire su **preview PR** (o produzione se preferite), stesso flusso export da pannello audit.

| # | Passo | OK / KO | Data | Note |
|---|--------|---------|------|------|
| 1.1 | Aprire audit con verificatore valorizzato in UI; **Export Word** | | | Nome nel DOCX = atteso (non «Non specificato» se l’utente è noto) |
| 1.2 | Controllare **titoli** e sommario: nessuna sequenza tipo `â€¦` / mojibake | | | |

**Copertura automatica in CI**: test unitari su tabella riepilogo e placeholder; **non** sostituiscono apertura reale del DOCX in Word.

---

## Punto 2 — Export Word: NV / N.A. / `[LOGO]` (Deploy Preview)

| # | Passo | OK / KO | Data | Note |
|---|--------|---------|------|------|
| 2.1 | Audit con almeno una risposta **NV** e una **N.A.**: colonne distinte in tabella riepilogo Word | | | |
| 2.2 | Azienda con logo in anagrafica: placeholder **`[LOGO]`** sostituito da immagine nel DOCX | | | |

---

## Punto 3 — Export Word: pending issues + riga **AP** (Deploy Preview)

| # | Passo | OK / KO | Data | Note |
|---|--------|---------|------|------|
| 3.1 | Audit con rilievi pendenti da tab **Rilievi pendenti**: testo/tabella coerente in Word | | | |
| 3.2 | Riga **AP** (Azioni pendenti): con pending **aperti** → evidenziazione su colonna **NC**; senza pending aperti → **X** su **CONF** (comportamento documentato) | | | |

**Copertura automatica in CI**: `app/src/tests/wordExport.riepilogo.test.js` (`buildRileviSummaryOoxml`).

---

## Punto 4 — Flusso 2 (SAL / Sopralluoghi)

**Stato**: **N/A** per questa PR (stretch del brief; nessuna implementazione massiva).

---

## Definition of Done (brief)

- [ ] Punti 0–3 eseguiti con esito e evidenza (questo file + descrizione PR).
- [ ] CI verde sulla PR prima del merge.
- [ ] Punto 4 esplicitato come N/A (sopra).
- [ ] Nessun segreto in repository, checklist o PR.
