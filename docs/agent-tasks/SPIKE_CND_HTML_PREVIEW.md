# Spike CND-PREVIEW — HTML specchio flag PT

**Stato:** prova HITL 23/08/2026, **usa-e-getta**. Non è produzione.  
**Non tocca:** `NdtReportsPage`, `vtWordExport`, CND-1 / CND-3 / CND-4 codice app.

## Cosa aprire

1. HTML: [`spike-cnd-pt-preview.html`](spike-cnd-pt-preview.html) (doppio clic / apri nel browser). Niente server.
2. Word Mason: `PT-2026.docx` (consegna 23/08). Stesso ordine di sezione, **non** stesse pagine al millimetro.

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
