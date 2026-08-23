# Spike CND-PREVIEW — HTML specchio flag PT

**Stato:** prova HITL 23/08/2026, **usa-e-getta**. Non è produzione.  
**Non tocca:** `NdtReportsPage`, `vtWordExport`, CND-1 / CND-3 / CND-4 codice app.

## Cosa aprire

**Non è l’app.** `/cnd/verbali` su Netlify non cambia: questo file sta in `docs/`, non nella PWA.

**Non usare Simple Browser di Cursor, né la pagina GitHub.** Lì l’HTML è sorgente: pagina bianca o checkbox «Pretty-print». GitHub `raw` arriva come `text/plain` (Chrome mostra il codice, non il foglio). Design Mode **non** modifica il Word Mason.

1. **Chrome / Edge / Firefox** — un clic, senza server locale:
   [Anteprima HTML PT (htmlpreview)](https://htmlpreview.github.io/?https://github.com/qsstudio241/sistema-gestione-iso9001/blob/main/docs/agent-tasks/spike-cnd-pt-preview.html)
2. Devi vedere il titolo **RAPPORTO D'ESAME LIQUIDI PENETRANTI**, classe **PT**, e i flag Mason (accettazione, superficie, pulizia, applicazione, griglia difetti).
3. Word Mason: `PT-2026.docx` (consegna 23/08). Stesso ordine di sezione, **non** stesse pagine al millimetro.
4. Alternativa sul PC: scarica [`spike-cnd-pt-preview.html`](spike-cnd-pt-preview.html) e fai doppio clic (apre `file://…`).

## Cosa confrontare

| Nel Word | Nell’HTML | Cosa chiedere |
|----------|-----------|----------------|
| Testata (oggetto, cliente, ordine, commessa, materiale, disegno) | stessi campi | Mancano voci? |
| Accettazione L1/L2/L3 | radio esclusivi | Stesso significato dei checkbox Word? |
| Superficie / applicazione | radio | Un valore solo, come da piano |
| Pulizia | checkbox (nel Word molatura **e** spazzolatura sono entrambi ☑) | È multi-scelta nel foglio reale? |
| Consumabili + lotti, lux, °C, % | campi testo con esempi del modello | Nomi prodotti ok? |
| Griglia difetti sì/NA + A/NA/S | stessa griglia; 502–515 solo NA | Codici giusti? |
| SI/NO finale, tre nomi, date | sì; **niente** firma grafica | Basta così? |

Non confrontare: logo, millimetri, salto pagina, bilingue riga-per-riga, intestazione/piè Word.

## Gate abort / successo

**Abort** (doppio lavoro): per ogni ritocco al foglio Mason servirebbero **due** interventi (placeholder Word **e** markup HTML), **due** tabelle difetti, **due** blocchi bilingue. Allora: **cancellare** questo HTML e la riga `CND-PREVIEW` nel piano; resta solo itera Word — «stampo, verifico, ti dico cosa cambiare».

**Successo** (preview utile): l’HTML serve solo a **vedere i flag/dati** (stessi gruppi del Word), non a stampare. Allora si può, più avanti, un riepilogo leggero in-app. **Non** HTML→PDF come pipeline. Il certificato resta Word (CND-4). PDF = stampa/export dal Word compilato.

## Prossimo passo (invariato)

**CND-4** — Template report scope `cnd`, upload `.docx` Mason, placeholder semantici. Brief: [`DEPUTYTASK2.md`](DEPUTYTASK2.md). Questa prova **non** lo sostituisce.
