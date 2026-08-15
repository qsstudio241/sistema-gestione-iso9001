# Piano slice — Rischi, Opportunità e Obiettivi

> **Destinazione**: il modulo è il **documento di analisi rischi/opportunità** (HLS §6.1), valido per 9001 / 14001 / 45001 / SGI. Una riga = una valutazione. Il **metodo di pesatura** (P×G, FMEA G×P×Rilev, SWOT con G con segno) è del documento, non del prodotto. L'ingest accetta più layout (M03, SWOT, FMEA HSE). Non sostituisce DVR né registro aspetti. Obiettivi §6.2 = tab collegato.
> **Spec**: [PROCESSO](../specs/PROCESSO_ANALISI_RISCHI_OPPORTUNITA.md) · [M03 mapping](../specs/M03_ANALISI_RISCHI_OPPORTUNITA.md) · template [M03-R00](../specs/templates/M03-R00-analisi-rischi-opportunita.xlsx)
> **Norma**: [9001:2015](../Normative/UNI%20EN%20ISO%209001_2015%20Rev.%200.md) · [14001:2015](../Normative/Normative%20NORMA_00003_%20UNI%20EN%20ISO%2014001_2015%20Rev.%200.md) §6.1 · [45001:2018](../Normative/Normative%20NORMA_00002_%20UNI%20ISO%2045001_2018%20Rev.%200.md) §6.1
> **Brief attivo**: [DEPUTYTASK_RISCHI_ROO.md](DEPUTYTASK_RISCHI_ROO.md) (ROO-8 APERTO — picker catalogo 4.1/4.2 → testi della riga)
> **Draft studio**: M03 rev.00, 19/06/2026, foglio `Analisi Rischio`, autore Marco Camellini

**Correzione di rotta (14/08/2026)**: la prima mappa partiva dai quattro tab già in app e chiedeva come «chiudere la catena» con FK. Quella premessa **inficia** l'analisi: il processo non è CRUD di registri. Questa mappa parte dal **processo ISO**, poi dal **CRUD che serve a quel processo**, poi dal **gap** sul codice attuale.

---

## 1. Processo ISO (cosa deve succedere)

Ordine della norma, non dell'app:

1. **§4.1** — Determinare i fattori interni/esterni rilevanti per finalità e indirizzo strategico; **monitorare e riesaminare** quelle informazioni.
2. **§4.2** — Determinare le parti interessate rilevanti e i loro requisiti; **monitorare e riesaminare**.
3. **§6.1.1** — Nel pianificare il SGQ, *considerando* 4.1 e 4.2, **determinare** rischi **e** opportunità per: assicurare i risultati, accrescere gli effetti desiderati, prevenire/ridurre gli indesiderati, migliorare.
4. **§6.1.2** — **Pianificare le azioni** per affrontarli; come **integrarle nei processi**; come **valutarne l'efficacia**. Azioni **proporzionate**. Trattamento rischio ≠ opportunità (note 1–2).
5. **§6.2** — Obiettivi per la qualità (misurabili, coerenti con la politica, monitorati, comunicati) + piano cosa/risorse/chi/quando/come si valuta. Informazioni documentate.
6. **§9.3** — Il riesame usa rischi/opportunità e il grado di raggiungimento degli obiettivi come input.

La norma **non** chiede quattro anagrafiche. Chiede un **ragionamento documentato** che parte dal contesto e arriva ad azioni valutate. Il Quaderno 3: risk-based thinking = processo decisionale, non un elenco.

## 2. Processo operativo M03 (come lo fa lo studio)

Il file `M03-R00` è **una sola matrice**, non quattro fogli. Una valutazione = una riga (o un gruppo di righe sotto lo stesso *elemento*, celle unite in colonna A).

```
Elemento valutato
    → Contesto (§4.1, testo sulla riga)
    → Parti interessate (§4.2, testo sulla riga)
    → Azioni attuali di mitigazione (controlli già in atto)
    → P × G = R → Livello          (rischio attuale)
    → Possibili ulteriori azioni + Resp. + Temp.   (§6.1.2)
    → Aggiornamento                (riesame / efficacia)
    → P × G = R → Livello residuo
```

Intestazione documento: titolo «ANALISI RISCHI E OPPORTUNITA'», codice **M03 / rev.00 / 19/06/2026**. Informazione documentata (§7.5), non un record isolato.

Nel draft caricato le colonne testo sono vuote (template); i punteggi ci sono. **P e G arrivano a 4** (la app oggi accetta solo 1–3). Livello osservato: R 1–3 → Basso, R 4–8 → Medio; soglia Alto non compare nel file (nebbia).

Non c'è colonna «opportunità» né tab obiettivi: il titolo li nomina, il foglio è una **analisi di rischio con residuo**. `nature` e §6.2 restano estensioni ISO, non il centro M03.

## 3. CRUD necessario (dal processo, non dall'app)

**Entità primaria — riga di analisi** (oggi si riusa `risks`, non si inventa una quinta tabella):

| Campo processo | Ruolo |
|----------------|--------|
| `elemento_valutato` | Raggruppamento (stesso testo su più righe se in Excel è una cella unita) |
| `contesto` (testo) | §4.1 sulla riga |
| `parti_interessate` (testo) | §4.2 sulla riga |
| `azioni_attuali` | Controlli già in atto |
| `p`, `g`, `r`, `livello` | Rischio attuale (R = P×G) |
| `ulteriori_azioni`, `responsabile`, `tempistica` | Piano §6.1.2 |
| `aggiornamento` | Efficacia / riesame |
| `p_residuo`, `g_residuo`, `r_residuo`, `livello_residuo` | Dopo le ulteriori azioni |
| `nature` | `risk` \| `opportunity` (ISO 6.1; default `risk` in ingest) |
| `company_id`, `organization_id` | Ambito |
| meta documento | codice M03, rev, data (ingest / export) |

**Entità secondarie** (non la home):

- Cataloghi `context_factors` / `interested_parties` — utili per riuso e «monitorare 4.1/4.2», *opzionali* come picker verso i testi della riga.
- `objectives` — processo §6.2 distinto; tab a parte; FK verso una riga di analisi = slice successiva.
- Piano Azioni NC — *opzionale*: M03 tiene le ulteriori azioni **sulla riga**. Portarle in NC è un extra, non il processo.

**Ingest** (quando l'azienda ha già un file): detect del **layout** (M03 / SWOT-COSBEN / FMEA-HSE) → dry-run → upsert. Un solo motore, più detector. I file cliente pieni di dati **non** si versionano nel repo (solo template vuoti).

## 5. Tre draft a confronto (14/08/2026, secondo parere)

| | M03-R00 (studio) | COSBEN 2025-02 | Pagani HSE 2026-01 |
|--|------------------|----------------|---------------------|
| Sistemi | 9001 (implicito) | 9001 / business | **45001 + 14001** (due fogli, stesso modulo QLT-MOD09) |
| Metodo | P×G (1–4), livello | SWOT S/W/O/T; G **con segno** (−3…+3) | FMEA: G×P×**Rilevabilità** = IPR (1–5) |
| Contesto/parti | colonne sulla riga | parte + fattore sulla riga | solo nelle *Istruzioni*, non in colonna |
| Residuo | P×G residuo | PR/GR/RR + % riduzione | secondo blocco G/P/R/IPR |
| Azioni | sulla riga | sulla riga + aggiornamenti anno | **foglio piano** separato (status, owner, budget, verifica) |
| Processo | elemento valutato | elemento + parte | processo/fase obbligatorio |
| Cosa non è | — | non è DVR | **non è DVR** né registro aspetti 6.1.2 |

**Decisione di prodotto (Lead, da norme HLS):** un modulo, più *documenti di analisi* per azienda, ciascuno con `standard_ids` + `method`. Non tre app. Non un form unico che pretenda di essere insieme M03, SWOT e FMEA.

**Tre strati ISO (non confonderli):**

1. Contesto e parti (4.1/4.2) — comuni HLS.
2. Inventari di dominio che *generano* rischi: aspetti 14001 §6.1.2, obblighi 14001 §6.1.3; pericoli 45001 §6.1.2.1, requisiti legali 45001 §6.1.3. **Fuori da questo modulo** (DVR / aspetti / registro obblighi già in prodotto).
3. Analisi R/O + azioni + efficacia (6.1.1 / 6.1.4) — **questo è il prodotto**.

45001 §6.1.2.2: metodologia e criteri li definisce l'organizzazione e li documenta. Quindi la scala 1–3 attuale **non può restare l'unica**.

## 4. Gap vs modulo attuale

| Processo M03 / ISO | App oggi | Gap |
|--------------------|----------|-----|
| Una riga = elemento + contesto + parti + azioni + score + residuo | Griglia M03 su tab Analisi; cataloghi/obiettivi restano tab secondari | Superficie OK; ingest e scala 1–4 aperti |
| Contesto e parti **sulla riga** | Enum `context` + tabelle catalogo separate, **senza** testo di analisi | Cataloghi senza processo |
| Azioni attuali vs ulteriori | Un solo `treatment_desc` + enum `treatment` | Manca il prima/dopo |
| P×G attuale **e** residuo | `probability`/`impact` + `residual_*` (CHECK 1–3) | Residuo c'è (ROO-5); **scala incompatibile con M03 (1–4)** = ROO-13 |
| Resp. + Temp. + Aggiornamento | `responsible` + `review_date` + `effectiveness_note` | Temp. riusa `review_date` (niente `action_due_date`) |
| Elemento valutato (gruppo) | `title` = titolo del rischio | Manca il raggruppamento |
| Informazione documentata M03/rev/data | Nessuna | Manca |
| Ingest Excel esistente | Nessuno | Manca (ROO-6) |
| Opportunità | `nature` c'è; trattamenti restano da rischio | Parziale |
| Obiettivi §6.2 | Tab con KPI | C'è, ma **non è M03**; non collegato alla riga |
| Input §9.3 | Riesame già legge `risks` | Tiene se la riga resta su `risks` |

La vecchia ROO-4 (FK catalogo → rischio) **non è più la prima slice**: aggiungeva giunti tra silos, non il processo.

## Fuori scope

- Nuova chiave licenza (resta `rischi`).
- Generazione AI di rischi.
- Modulo KPI §9.1.
- Offline/sync (ADR-008).
- Sostituire il Piano Azioni NC.
- Sovrascrivere `DEPUTYTASK.md` (profilo azienda).
- Sostituire il DVR (D.Lgs. 81/2008) o il registro aspetti ambientali 14001 §6.1.2.
- Versionare in Git gli Excel cliente pieni di dati (solo template vuoti).
- Un unico form che unifica FMEA e SWOT.

## 6. Integrazione SWOT e parti interessate (15/08/2026)

Non sono due moduli da affiancare all’analisi. Sono **due ingressi dello stesso processo** (HLS: 4.1/4.2 → 6.1). La UI resta **una matrice** + form riga. Niente quarto tab «SWOT», niente tab «Parti» come home.

### Parti interessate (§4.2)

| Strato | Dove vive | Ruolo |
|--------|-----------|--------|
| Catalogo da **monitorare e riesaminare** | tab Contesto → `interested_parties` (già c’è, mig. 124) | Anagrafica: nome, relazione, requisiti. Non è la valutazione. |
| Testo **sulla riga di analisi** | colonna/form `interested_parties_text` (già c’è, ROO-4; ingest ROO-6c) | Quali parti e requisiti contano *per questa* valutazione. Una riga è valida anche senza catalogo. |

Oggi i due strati **non si parlano**: il form ha solo textarea; il tab è CRUD isolato. L’integrazione UI è un **picker** sul form (stesso gesto di «Cerca nel registro»): scegli dal catalogo dell’ambito → si **accoda** nome + requisiti nel testo. Nessuna FK obbligatoria. Stesso gesto per i fattori §4.1 → `context_text`.

### SWOT (metodo, non registro)

| Strato | Dove vive | Ruolo |
|--------|-----------|--------|
| Quadrante S/W/O/T + G **con segno** | stessa riga `risks`, metodo documento `swot_signed` (COSBEN) | Pesatura alternativa a P×G. S/W interni, O/T esterni; O ≈ opportunità, T ≈ rischio; S/W restano quadrante, non un terzo `nature`. |
| Parti e fattore | già previsti sulla riga COSBEN | Stessi campi testo 4.1/4.2; il picker ROO-8 serve anche qui. |

Oggi il detector **avvisa** se il foglio sembra SWOT/FMEA e mappa comunque come P×G (il segno si perde; CHECK `impact` è 1–5). Native SWOT **non** entra finché non esiste `method` (ROO-15) e un posto per il segno (non si mette −3 in `impact`).

Ordine: **prima il ponte catalogo→riga (ROO-8)**, poi metodo documento (ROO-15), poi detector SWOT (ROO-6b-S). FMEA HSE è lo stesso schema, mapping diverso (ROO-6b-F).

## Non ancora specificato

- Soglie Basso/Medio/Alto del solo M03 (osservato Basso ≤3, Medio 4–8; Pagani usa fasce IPR 1–16 / 18–36 / 40–125).
- Ulteriori azioni: solo sulla riga, o anche copia nel Piano Azioni (Pagani ha il foglio piano: è il modello più maturo per ROO-14).
- Export: ristampa del layout originale vs layout SGQ unico.
- Se e quando collegare una riga di analisi a un aspetto / obbligo / pericolo già in altri moduli.
- Dove vive `method` (testata documento vs colonna su ogni riga) — si chiude in ROO-15, non in ROO-8.

## Decisioni già prese

- Si **riusa** `risks` come riga di analisi (niente quinta tabella).
- Cataloghi 4.1/4.2 e tab obiettivi **restano**; non sono la destinazione.
- Ambito: `useCompanyScope()` (PR #401). Non reintrodurre selettore di pagina.
- Ingest = detect **per layout** → dry-run → insert (v1). Primo detector: M03. SWOT e FMEA HSE dopo `method` (ROO-15).
- **SWOT e parti (15/08/2026):** catalogo 4.2 ≠ testo riga; UI = picker che scrive testo. SWOT = metodo della stessa matrice, non un tab. Vedi §6.
- Multi-standard: **stesso modulo**, tag `standard_ids` (9001/14001/45001) + flag SGI come ADR-009. Due documenti (SSL + Ambiente) come Pagani = due analisi, stesso schema.
- Metodo di pesatura = proprietà del documento (`pxg` \| `fmea_gpr` \| `swot_signed`), non colonna fissa 1–3.
- Layer aspetti/pericoli/DVR **non** si implementa qui.
- ROO-1…3 (PR #279) restano in `main` come fondazione tecnica (`nature`, tabelle catalogo, `source_risk_id`), reinterpretate.
- Numerazione migrazioni: prossimo libero in `database/migrations/` al momento; non riservare.
- **P×G (ROO-4, 14/08/2026):** `R = probability × impact`. CHECK DB e API restano **1–3** (R in 1–9). G=4 (draft M03) e 1–5 (FMEA) → **400**, non 500 dal CHECK. Livelli UI invariati: 1–3 basso, 4–6 medio, 7–9 alto. Stats `high_priority` resta **≥6** (incoerenza nota, non toccata). Scala 1–4/1–5 = ROO-13.
- **Processo ricostruito (14/08/2026):** [PROCESSO_ANALISI_RISCHI_OPPORTUNITA.md](../specs/PROCESSO_ANALISI_RISCHI_OPPORTUNITA.md) — Quaderno 3 Conforma + colonne M03. Superficie di lavoro = matrice `SgqDataGrid`, click riga → form (non inline edit).
- **Residuo + aggiornamento (ROO-5, 14/08/2026):** `residual_probability` / `residual_impact` (NULL o 1–3) + `effectiveness_note`. API decora `residual_score` / `residual_score_level` solo se entrambi i fattori residui ci sono. Tab home = «Analisi». Scala 1–4 resta ROO-13.

## Mappa slice

| Slice | Tema | Perimetro | Dipende da | Tipo |
|-------|------|-----------|------------|------|
| ROO-1…3 | `nature`, cataloghi, link NC | già in `main` | — | FATTO |
| **ROO-4** | **Riga M03 sul record `risks`** (elemento, contesto testo, parti testo, azioni attuali, ulteriori azioni) | migrazione 146 + controller + form/card `RisksPage` + util `riskScore` | — | FATTO |
| **ROO-5** | **Score residuo + griglia M03 + aggiornamento** | migrazione 147 + `SgqDataGrid` + form residuo; **non** allargare 1–4 | ROO-4 | FATTO |
| **ROO-6** | **Ingest Excel M03** | detect → dry-run → insert (non overwrite); G=4 skip; SWOT/FMEA rifiutati | ROO-5 | FATTO |
| **ROO-6c** | **Mapping colonne HITL** | scelta foglio + corrispondenza campi SGQ; peso BASSO/MEDIO/ALTO; split Rischi/Opportunità; SWOT non blocca più il file | ROO-6 | FATTO |
| ROO-6b | Detector SWOT+FMEA (riga unica, troppo spessa) | — | — | spezzata in 6b-S / 6b-F |
| **ROO-8** | **Picker catalogo 4.1/4.2 → testi riga** | `RiskForm` + API cataloghi già esistenti; accoda testo, no FK | ROO-4 | FATTO |
| ROO-15 | Documento di analisi: `standard_ids` + `method` + posto per G con segno | testata o colonne riga; HITL se testata ≠ riga | ROO-4 | AFK |
| ROO-6b-S | Detector + UI SWOT (`swot_quadrant`, G con segno) | `excelRisksM03Detector` + griglia/form; stesso guscio ingest | ROO-8, ROO-15 | AFK |
| ROO-6b-F | Detector FMEA HSE (G×P×Rilev) | stesso motore, mapping diversi | ROO-15 | AFK |
| ROO-7 | Tempistica distinta da `review_date` | nuovo `action_due_date` se serve; nota efficacia già in ROO-5 | ROO-5 | AFK |
| ROO-9 | Copy: home = «Analisi rischi e opportunità» (tab già «Analisi») | titolo pagina / sidebar | ROO-5 | AFK |
| ROO-10 | Obiettivi §6.2: piano 6.2.2 + FK opz. alla riga | `objectives` | ROO-4 | AFK |
| ROO-11 | Hardening RBAC/stats | controller objectives/risks | — | AFK |
| ROO-12 | Export / ristampa M03 | Excel o Word | ROO-5, ROO-6 | HITL formato |
| **ROO-13** | **Scala P/G per azienda** | `companies.risk_pg_max` 3\|4\|5; CHECK risks 1–5; set prima ingest/primo rischio | ROO-6c | FATTO |
| ROO-14 | Copia ulteriori azioni → Piano Azioni (modello Pagani: foglio piano) | `source_risk_id` già c'è | HITL | HITL |

## ROO-4 — prima slice (dettaglio)

Vedi [DEPUTYTASK_RISCHI_ROO.md](DEPUTYTASK_RISCHI_ROO.md).

**Hello world**: una riga in UI con elemento, contesto, parti, azioni attuali, ulteriori azioni — lo stesso ordine del foglio M03. P/G restano quelli di oggi (1–3) fino a ROO-5/13.

**DoD ROO-4 (chiuso 14/08/2026):** migration `146_risks_m03_line.sql` (5 colonne opzionali); API create/update/list/getOne; form ordine M03; preview `R = P × G` + livello; G=4/P=5 → 400; fallback lettura `further_actions || treatment_desc`. Test L1 Jest + Vitest + build.

## Qualità / vincoli deputy

- Una sessione = una slice. Handoff se non chiude.
- Context default/basso. Non rileggere GUIDA intera.
- Migrazioni solo in `database/migrations/` (root), idempotenti.
- UI: riuso `RisksPage.css` / design system.
- Encoding UTF-8 senza BOM.
