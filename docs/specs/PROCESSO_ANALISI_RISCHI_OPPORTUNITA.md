# Processo — Analisi rischi e opportunità

> Ricostruzione 14/08/2026: HLS §6.1 + Quaderno Conforma 9001:2015 (§6.1) + template studio **M03-R00**.
> Foglio: [`templates/M03-R00-analisi-rischi-opportunita.xlsx`](templates/M03-R00-analisi-rischi-opportunita.xlsx)
> Mapping campi: [`M03_ANALISI_RISCHI_OPPORTUNITA.md`](M03_ANALISI_RISCHI_OPPORTUNITA.md)
> Piano: [`../agent-tasks/PLAN_RISCHI_OPPORTUNITA_OBIETTIVI_SLICES.md`](../agent-tasks/PLAN_RISCHI_OPPORTUNITA_OBIETTIVI_SLICES.md)

Il prodotto è **questo documento di analisi** (informazione documentata §7.5), non quattro anagrafiche. Una riga del foglio = una valutazione. Il metodo di pesatura (qui P×G) è del documento.

---

## 1. Cosa si sta facendo

Non si «tiene un registro rischi». Si **pianifica il sistema** (§6): considerando contesto e parti, si determinano rischi e opportunità per (9001 §6.1.1):

- a) assicurare i risultati attesi del SGQ;
- b) accrescere gli effetti desiderati;
- c) prevenire o ridurre gli effetti indesiderati;
- d) conseguire il miglioramento.

Poi si pianificano le azioni, **come le si integrano nei processi (§4.4)** e **come se ne valuta l’efficacia** (§6.1.2). Senza il b1 (integrazione) la matrice è un elenco.

Il Quaderno Conforma 9001 lo dice in cinque verbi, dopo la classificazione:

1. analizzare e classificare (gravità delle conseguenze);
2. pianificare le azioni (eliminare e/o mitigare — e le altre opzioni della nota 1);
3. **mettere in atto** tali azioni;
4. controllarne l’efficacia;
5. apprendere dall’esperienza.

---

## 2. Da dove arrivano le righe (non un foglio vuoto)

Input da **monitorare e riesaminare**, non da compilare una tantum:

| Fonte | Clausola | Cosa porta sulla riga |
|-------|----------|------------------------|
| Fattori interni/esterni | §4.1 | colonna Contesto |
| Parti e requisiti rilevanti | §4.2 | colonna Parti interessate |
| Processi del SGQ | §4.4 | Elemento valutato (spesso un processo) |
| Cliente / cogente / nuovo mercato | §5.1.2, Quaderno 3 | nuove righe o riesame |
| Modifiche al sistema | §6.3 | riesame P/G o nuova riga |
| NC, audit, reclami, prestazioni | §9.1, §10.2 | nuove minacce o inefficacia delle azioni |
| Riesame precedente | §9.3 | aggiornamento / residuo |

14001 aggiunge due **inventari di dominio** che *generano* rischi, e non stanno su questo foglio: aspetti significativi (§6.1.2) e obblighi di conformità (§6.1.3). Stesso discorso per pericoli 45001 e per il DVR. Il D.Lgs. 152/06 alimenta gli obblighi, non la riga M03.

---

## 3. Il processo sulla matrice M03

Si legge **da sinistra a destra**. Le celle unite in A/B/D = stesso elemento o stesso contesto su più valutazioni.

```
Elemento
  → Contesto (§4.1)
  → Parti (§4.2)
  → Azioni attuali (controlli già in atto)
  → P × G = R → Livello          ← rischio *attuale*
  → Ulteriori azioni + Resp. + Temp.
  → Aggiornamento                ← efficacia
  → P × G = R → Livello residuo  ← dopo le ulteriori azioni
```

| Passo | Cosa fa il valutatore | Colonna M03 | Campo `risks` | Norma / Quaderno |
|-------|----------------------|-------------|---------------|------------------|
| 0 | Apre / crea il **documento** (codice, rev, data) | testata B1 / E1 | meta ingest/export (ROO-15) | §7.5 |
| 1 | Sceglie **cosa** valuta (processo, commessa, obbligo, cambiamento…) | A Elemento valutato | `evaluated_element` | §4.4 come oggetto |
| 2 | Scrive i fattori rilevanti per *questa* riga | B Contesto | `context_text` | §4.1 |
| 3 | Scrive le parti e i requisiti rilevanti per *questa* riga | C Parti interessate | `interested_parties_text` | §4.2 |
| 4 | **Identifica** l’evento (minaccia o opportunità). In M03 il titolo della riga è il rischio; in Excel non c’è colonna «titolo» | (titolo app) | `title` + `nature` | §6.1.1 |
| 5 | Elenca i **controlli già in atto** | D Azioni attuali | `current_actions` | prima di pesare |
| 6 | **Analizza** probabilità e gravità *con* quei controlli | E P, F G | `probability`, `impact` | Quaderno: indici G e P |
| 7 | Lo strumento **calcola** R e il livello | G R, H Livello | `score`, `score_level` | R = P×G (metodo `pxg`) |
| 8 | **Valuta**: rispetto al criterio dell’organizzazione, si accetta o si tratta? | (implicito; enum `treatment` in app) | `treatment` | §6.1.2 nota 1 |
| 9 | Se si tratta: **pianifica** ulteriori azioni, chi, quando | I, J, K | `further_actions`, `responsible`, `review_date` (Temp. distinta = ROO-7) | §6.1.2 a |
| 10 | **Attua** le azioni **nei processi** (istruzione, controllo, competenza…) — non solo le scrive | fuori foglio; il foglio ne tiene traccia | (ROO-14 opz. Piano Azioni) | §6.1.2 b)1 + Quaderno «mettere in atto» |
| 11 | **Valuta l’efficacia** | L Aggiornamento | `effectiveness_note` (ROO-7) | §6.1.2 b)2 |
| 12 | Rivaluta P e G **dopo** le ulteriori azioni | M–P residuo | `residual_probability` / `residual_impact` / `residual_score` | stesso metodo |
| 13 | **Apprende**: riesame, obiettivi, nuova riga se il contesto è cambiato | input §9.3 / §6.2 | tab obiettivi | Quaderno «apprendere» |

P e G in M03 arrivano a **4**; l’app oggi è 1–3 (ROO-13). Il livello nel draft osservato: 1–3 basso, 4–8 medio; soglia Alto non compare nel file.

---

## 4. Quando si ripete (il ciclo)

Una riga non è «chiusa per sempre». Il Quaderno 3 elenca i trigger di riesame:

- nuovo esito di 4.1 / 4.2;
- clienti o parti;
- requisiti cogenti;
- processi ridefiniti;
- ogni altra necessità (nuovo mercato, nuovo cliente, modifica sostanziale).

In foglio: si aggiorna L e il blocco residuo, o si aggiunge una riga sotto lo stesso elemento.

In app la riga `risks` è lo stato **corrente**. Gli aggiornamenti significativi (P/G, residuo, nota, azioni) si **storicizzano** in `risk_reviews` (interrogabile). Non si crea un secondo `risk_id` per il riesame. Mappa: [PLAN §7](../agent-tasks/PLAN_RISCHI_OPPORTUNITA_OBIETTIVI_SLICES.md).

---

## 5. Cosa non è questo processo

| Cosa | Perché è fuori |
|------|----------------|
| DVR (81/08) | Inventario pericoli/rischi SSL; può *generare* righe, non si sostituisce |
| Registro aspetti 14001 §6.1.2 | Inventario di dominio |
| Obblighi / D.Lgs. 152/06 | Inventario 14001 §6.1.3 |
| ISO 37001 / 231 | Altro dominio (corruzione), stesso HLS |
| Tab obiettivi da sola | Processo §6.2: *usa* i R/O, non li pesa |
| Cataloghi 4.1/4.2 | Anagrafiche di riuso; i testi restano **sulla riga** |

Altri fogli (SWOT, FMEA HSE) sono **lo stesso processo**, altro metodo di pesatura (`swot_signed`, `fmea_gpr`).

---

## 6. Cosa deve fare lo strumento

La superficie di lavoro è la **matrice** (stesso ordine delle colonne), non una card per volta. L’ingest Excel (ROO-6) scrive nelle stesse colonne.

Obblighi minimi dello strumento:

- una riga = una valutazione, raggruppata per elemento;
- P×G calcolato, non editabile come R;
- azioni attuali **prima** del voto; ulteriori azioni **dopo**;
- residuo e aggiornamento visibili (efficacia);
- non inventare rischi; non unificare FMEA e SWOT nello stesso form.

Il valutatore decide elemento, testi, P, G, se l’azione basta e se è stata attuata nel processo.
