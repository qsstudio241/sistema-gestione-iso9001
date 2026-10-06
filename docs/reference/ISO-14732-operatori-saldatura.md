# ISO 14732:2025 — Qualifica operatori/preparatori di saldatura meccanizzata e automatica (riferimento operativo SGQ)

> **Uso**: assistente AI, ingest `qualifica_14732`, alert scadenze, **verifica qualifiche vs norma** (parte A completezza / parte B correttezza, VQ-11 in [`PLAN_VERIFICA_QUALIFICHE_NORMA_SLICES.md`](../agent-tasks/PLAN_VERIFICA_QUALIFICHE_NORMA_SLICES.md)).
> **Fonte**: testo integrale **BS EN ISO 14732:2025** (= EN ISO 14732:2025 = ISO 14732:2025, terza edizione 2025-06; BSI 31/07/2025, *incorporating corrigendum October 2025*; **sostituisce** BS EN ISO 14732:2013) digitalizzato in [`docs/Normative/Normative NORMA_00046_ BS EN ISO 14732_2025 Rev. 1.md`](../Normative/Normative%20NORMA_00046_%20BS%20EN%20ISO%2014732_2025%20Rev.%201.md) (+ `.json`). Qui **solo sintesi operativa e numerazione 2025**; il testo normativo letterale sta in NORMA_00046. Il codice UNI nazionale non compare nel PDF: non assumerlo.
> **Stato di leggibilità** (colonna «Stato»): **L** = testo integrale leggibile e verificato riga per riga (pymupdf + rendering per l'Annex C); **I** = informativo (non vincolante); **N** = normativo. Tutte le clausole 1-8 e gli Annex A-C sono **L**: nessun GAP di leggibilità. La norma **non contiene tabelle numeriche né soglie dimensionali**: nessun valore va dedotto oltre quanto scritto qui.
> **Cataloghi collegati**: `weldingProcesses4063.js` (processo, ISO 4063:2023 — **il gruppo a due cifre è la variabile**), `weldingPositions6947.js` (posizione: ISO 6947 nella 2025 è solo in Bibliography), `weldingQualificationRules9606.js` (regole saldatori manuali, per confronto).
> **Estratto precedente**: questo file era l'estratto della **edizione 2013** (OCR 28/28): vedi nota in fondo e § Differenze 2013 → 2025.

## Scopo e differenza da ISO 9606

ISO 14732 qualifica **operatori di saldatura** (*welding operator*: controlla o regola un parametro di saldatura in meccanizzata/automatica, §3.3) e **preparatori** (*weld setter*: imposta l'unità di saldatura, §3.4) per saldatura **meccanizzata** (§3.1: parametri mantenuti da mezzi meccanici/elettronici, regolazione manuale durante la saldatura possibile) o **automatica** (§3.2: nessun intervento dell'operatore durante il processo). Non è la capacità manuale del saldatore (ISO 9606-1..5) né la procedura (ISO 15614). **Non si applica** a chi non controlla/regola parametri e non partecipa al setup (§1). Solo materiali metallici; friction stir e friction stir spot rinviano a ISO 25239-3 e ISO 18785-3 (§1).

## §4 Qualificazione

| Clausola | Regola (sintesi) | Tipo | Stato |
|---|---|---|---|
| 4.1 | Qualifica e rivalidazione secondo la norma. L'operatore/preparatore segue una istruzione di lavoro basata su pWPS/WPS secondo ISO 15609-1/-2/-3/-4/-5/-6 (o ISO 14555 per stud) | N | L |
| 4.1 | Il metodo di qualifica va **integrato da una prova di conoscenza funzionale dell'unità di saldatura** (Annex A), soddisfatta **e documentata**; la prova di conoscenza tecnologica (Annex B) è facoltativa | N | L |
| 4.1 | Se una **procedura** meccanizzata/automatica è qualificata secondo ISO 15613 o ISO 15614-1/-2/-5/-6/-7/-8/-11/-12/-13/-14, l'operatore/preparatore che ha eseguito la prova è **anche qualificato** ISO 14732 e **deve** essere emesso un certificato | N | L |
| 4.1 | Per altri processi i requisiti di qualifica vanno specificati | N | L |
| 4.2 | **Saldatura per fusione** (arco e fascio): prove e criteri su provini secondo uno di 4 metodi. **Metodo 1** giunti testa/angolo secondo ISO 9606-1/-2/-3/-4/-5 (acciai/Al/Cu/Ni/Ti-Zr). **Metodo 2** tubo-piastra tubiera ISO 15614-8: solo prova visiva, superficiale (MT/PT), macrografica. **Metodo 3** riporto ISO 15614-7: solo visiva, superficiale, piegatura **o** macrografica. **Metodo 4** provini di pre-produzione o produzione: prove e criteri secondo Metodo 1, 2 o 3 | N | L |
| 4.3 | **Saldatura a resistenza**: provini secondo ISO 15614-12 (punto/rullo/proiezione), ISO 15614-13 (pressione di testa/scintillio) o ISO 15613 (pre-produzione). Prove e criteri **da specificare**, includendo **almeno** esame visivo e **un** metodo distruttivo | N | L |
| 4.4 | **Stud (prigionieri ad arco)**: prove secondo ISO 14555 | N | L |

## §5 Variabili e campo di qualificazione (richiedono nuova qualifica se cambiano)

Principio: sono **cambi di configurazione**, non range dimensionali (a differenza di ISO 9606-1: niente spessore/diametro/gruppo materiale/posizione in tabelle). Applicabili «quando pertinenti al processo». Un cambio di variabile essenziale oltre i limiti richiede nuova prova e nuovo certificato (§7).

### 5.1 Saldatura meccanizzata

| Rif. | Cambio che richiede riqualifica | Stato |
|---|---|---|
| 5.1 a) | **Gruppo processo (2 cifre, ISO 4063:2023)**; sottogruppo (3 cifre) o varianti nello stesso gruppo **non** richiedono riqualifica. Eccezioni che la richiedono: a)1) da TIG **autogeno (142)** a TIG con apporto (141, 143, 145, 146, 147); a)2) da SAW **a nastro (122, 126)** a SAW con filo pieno/tubolare (121, 123, 124, 125) o viceversa | L |
| 5.1 b) | Da controllo visivo diretto a remoto e viceversa | L |
| 5.1 c) | **Eliminazione** dell'inseguimento automatico del giunto | L |
| 5.1 d) | **Eliminazione** del controllo automatico della lunghezza d'arco | L |
| 5.1 e) | Cambio dell'**unità di saldatura** (§3.7) **solo** se incide sul modo di eseguire il setup e/o di inserire i parametri | L |
| 5.1 f) | Da tecnica **mono-passata per lato a multi-passata per lato** (non viceversa) | L |
| 5.1 g) | Per saldatura **orbitale**: da una sola posizione a **più posizioni** (non viceversa) | L |
| 5.1 h) | **Eliminazione** del backing (supporto al rovescio) | L |
| 5.1 i) | **Eliminazione** degli inserti consumabili | L |

Refuso del testo ufficiale: in 5.1 a)2 compare «sold wire» (nel 5.2 a)2 «solid wire»); senso inteso = filo pieno.

### 5.2 Saldatura automatica

| Rif. | Cambio che richiede riqualifica | Stato |
|---|---|---|
| 5.2 a) | Gruppo processo (2 cifre) con le stesse eccezioni 142→141/143/145/146/147 e SAW nastro↔filo | L |
| 5.2 b) | **Solo per i weld setter** (fusione): da mono-passata a multi-passata per lato (non viceversa) | L |
| 5.2 c) | Cambio dell'unità di saldatura solo se incide su setup/inserimento parametri | L |

Nel 5.2 **non** sono elencati: sensore di giunto/d'arco, controllo visivo, backing, inserti, posizioni.

## §6 Validità, conferma, rivalidazione

| Clausola | Regola | Stato |
|---|---|---|
| 6.1 | La qualifica **decorre dalla data di saldatura del/i provino/i**, se le prove sono state eseguite e i risultati accettabili. La validità può essere estesa secondo 6.3. **Il metodo scelto (6.3 a, b o c) va dichiarato sul certificato all'emissione** | L |
| 6.2 | **Conferma ogni 6 mesi** (responsabile delle attività di saldatura, esaminatore o organismo): l'operatore/preparatore ha lavorato con successo nel proprio campo di qualifica; **altrimenti la qualifica diventa non valida**. Vale per **tutte** le opzioni di 6.3 | L |
| 6.3 a) | **Nuova prova di qualifica ogni 6 anni** | L |
| 6.3 b) | **Ogni 3 anni**: 2 saldature di produzione eseguite negli **ultimi 6 mesi** del periodo di validità, esaminate con RT **o** UT **o** prova distruttiva. Se non tecnicamente possibile: altri metodi NDT volumetrici o prova di produzione (es. tenuta) «secondo la norma applicativa». Risultati verificati da esaminatore/organismo; criteri secondo clausola 4; saldatura nel campo di qualifica. **Rivalida per altri 3 anni** | L |
| 6.3 c) | Il certificato è valido **finché confermato ogni 6 mesi (6.2)** e se **tutte** le condizioni: stesso fabbricante per cui si è qualificato e che risponde della fabbricazione; requisiti ISO 3834-2 o ISO 3834-3 del fabbricante **dimostrati da verifica**; il fabbricante ha **documentato** saldature di qualità accettabile secondo le norme applicative | L |
| 6.4 | **Revoca**: motivo specifico di dubbio sulla capacità di eseguire saldature conformi → revocate le qualifiche a supporto di quella saldatura; le altre non messe in dubbio restano valide | L |

**Cosa non c'è**: nessun intervallo massimo di interruzione espresso in giorni/mesi diverso dai 6 mesi di 6.2, nessuna definizione numerica di «ragionevole continuità» (Introduction, informativa).

## §7 Certificato e §8 Documentazione

| Clausola | Regola | Stato |
|---|---|---|
| 7 | Se i criteri della clausola 4 sono soddisfatti, esaminatore/organismo conferma il superamento; **se una prova prescritta fallisce, nessun certificato**. Sul certificato vanno registrati: **identificazione pWPS/WPS seguita, variabili usate per la prova, campo di qualificazione**. Emesso sotto **responsabilità esclusiva** di esaminatore/organismo. Cambio di variabile essenziale oltre i limiti → nuova prova e nuovo certificato | N / L |
| 8 | Certificati, rapporti/registrazioni delle prove di saldatura e **rivalidazioni** conservati a fascicolo | N / L |

## Annex A (normativo) — Conoscenza funzionale dell'unità di saldatura

Obbligatoria, da soddisfare e **documentare** (§4.1). Contenuti: A.2 sequenze/procedure e influenza dei parametri; A.3 verifica conformità preparazione del giunto alla WPS e pulizia dei lembi; A.4 riconoscimento imperfezioni visive del processo; A.5 conoscenza del proprio campo di qualifica; A.6 (dove applicabile) programmazione (limitata alla gestione della prova, anche con modulo pre-programmato caricato dall'operatore), sistema di controllo e segnali, sistema di movimento, apparecchiature ausiliarie, attrezzature e setup, parametri e regolazioni entro la procedura, sicurezza, procedure start-stop. Stato **L**.

## Annex B (informativo) — Conoscenza della tecnologia di saldatura

Test **raccomandato ma non obbligatorio**; alcuni paesi lo richiedono; se eseguito va **registrato sul certificato**. Metodi: test scritto a scelta multipla, domande orali su schema scritto, test al computer, dimostrazione/osservazione con criteri scritti. Ambiti B.2: attrezzature (arco, fascio, pressione, resistenza), processi (114/13/14/15, 12, 51, 52, 4, 2, 72), materiali base, consumabili, sicurezza, esame visivo. Stato **L / I**.

## Annex C (informativo) — Esempio di certificato (campi)

Modulo d'esempio (non obbligatorio nel layout): riferimento pWPS/WPS del fabbricante · esaminatore/organismo e n. riferimento · foto (se richiesta) · nome · **ruolo** (welding operator e/o weld setter) · identificazione e metodo di identificazione · datore di lavoro · norma/codice di prova · **riferimento della prova di conoscenza funzionale** · conoscenza tecnologica (accettabile/non provata) · tabella **Variables × Test piece × Range of qualification**: comuni (processo — clausola 4; attrezzatura 3.8; unità di saldatura 3.7), meccanizzata (controllo visivo/remoto, inseguimento giunto, controllo lunghezza d'arco, mono/multi-passata, posizione orbitale singola/multipla, backing, inserto consumabile), automatica (mono/multi-passata) · **base della qualifica** (4.2 Metodo 1/2/3/4, 4.3 resistenza, 4.4 stud) · n. documento dei risultati (WPQR o altro) · nome/data/firma · data di saldatura del provino · luogo · **validità fino a** · righe **Requalification 6.3 a) / Revalidation 6.3 b) / Revalidation 6.3 c) – valid until** · tabella di rivalidazione triennale (data, firma, ruolo) · tabella di **conferma semestrale** 6.2 (data, firma, ruolo; 5 righe). Stato **L / I**. **Nel modulo 2025 non compaiono** data/luogo di nascita né la posizione ISO 6947 come riga autonoma.

## Annex ZA / ZB (EN, informativi) — Direttive UE

- **ZA.1 (PED 2014/68/UE, req. 3.1.2 par. 3-5)**: clausole 4, 5, 6.1, 6.3 a), 6.3 b), 7 danno presunzione di conformità; per attrezzature a pressione in **categorie II, III, IV** esaminatore/organismo = **terza parte competente**; la **via di rivalidazione 6.3 c) non è ammessa** per prodotti di categorie II, III, IV.
- **ZB.1 (recipienti semplici a pressione 2014/29/UE, req. 3.2 par. 2)**: clausole 4, 5, 6.1, 6.3 a), 6.3 b), 7; per saldature su parti in pressione l'esaminatore/organismo è un **organismo notificato**.
- ZA.2: mappa edizioni dei riferimenti normativi (es. ISO 9606-1 → EN ISO 9606-1:2017; ISO 4063:2023 → EN ISO 4063:2023). Stato **L**.

## Regole per l'estrazione AI (ingest `qualifica_14732`)

| Campo | Regola |
|---|---|
| `confirmation_interval_months` | Sempre **6** (§6.2, uguale a ISO 9606-1) |
| Metodo di rivalidazione (6.3 a/b/c) | **Non assumere un default**: va dichiarato sul certificato (§6.1); leggere dal documento, se assente `null` + warning. Intervalli: **a)** 6 anni, **b)** 3 anni con 2 saldature controllate, **c)** indefinita se confermata. **Mai** riusare 3/2 anni di ISO 9606-1 |
| `welding_type` (automatico vs meccanizzato) | Determina quali variabili si applicano (§5.1 vs §5.2); estrarre se dichiarato, altrimenti null |
| Ruolo (operatore / preparatore) | Distinzione **nuova nel certificato 2025** (Annex C «Role»): estrarre se presente; la regola 5.2 b) vale solo per i weld setter |
| Processo | Variabile essenziale è il **gruppo a 2 cifre** ISO 4063:2023 (con eccezioni 142↔141/143…, SAW nastro↔filo); sottogruppi/varianti non cambiano il campo |
| Posizioni di saldatura | Nel 2025 sono variabile solo come **orbitale singola → multipla** (5.1 g). Estrarre comunque se presenti, ma **non** applicare tabelle posizione di ISO 9606-1 |
| Metodo di qualificazione | 2025: **Metodo 1** (ISO 9606-x), **2** (ISO 15614-8), **3** (ISO 15614-7), **4** (pre-produzione/produzione); **4.3** resistenza; **4.4** stud. Nei certificati 2013 le categorie erano diverse (vedi sotto): se il documento indica «ISO 15614 / 15613 / 9606 / prova di produzione» mappare con cautela, non forzare |
| Conoscenza funzionale (Annex A) | Obbligatoria: estrarre il riferimento della prova se presente; assenza = finding di completezza (non di correttezza) |

## Differenze 2013 → 2025

Confronto fra **questo estratto nella versione 2013** (OCR, sintesi: il testo integrale 2013 **non** è in repo) e il testo integrale 2025. Ciò che l'estratto 2013 non riportava è marcato «non confrontabile».

| Tema | 2013 (estratto precedente) | 2025 | Esito |
|---|---|---|---|
| **Numerazione** | §4.1 metodi a-d; §4.2.1/4.2.2/4.2.3 variabili; §5 validità (5.1-5.3); Annex A/B/C | §4.1 generale, §4.2 fusione (Metodi 1-4), §4.3 resistenza, §4.4 stud; **§5.1/5.2 variabili (nuova clausola 5)**; **§6.1-6.4 validità**; §7 certificato; §8 documentazione; Annex A/B/C | **Rinumerare tutti i riferimenti** (`§4.2.2/4.2.3` → `5.2/5.1`; `§5` → `§6`; `§5.1` metodo sul certificato → `§6.1`) |
| **Metodi di qualifica** | a) ISO 15614; b) ISO 15613; c) provino ISO 9606; d) prova di produzione | Metodo 1 = ISO 9606-x; 2 = ISO 15614-8 (tubo-piastra, prove ridotte); 3 = ISO 15614-7 (riporto, prove ridotte); 4 = pre-produzione/produzione. Procedura qualificata ISO 15613/15614-x ⇒ operatore anche qualificato **e certificato obbligatorio** (§4.1) | **Cambiato**: non c'è più la mappa a/b/c/d; l'enum `qualification_method` dell'ingest (`iso_15614`/`iso_15613`/`iso_9606`/`production_test`) non coincide con i Metodi 1-4 |
| **Resistenza** | Estratto: «punto/prigionieri restano su ISO 14555» | **Resistenza = §4.3** (ISO 15614-12/-13, ISO 15613; almeno visiva + una distruttiva); **solo stud = §4.4 → ISO 14555** | **Smentito** per la saldatura a punto: non è più su ISO 14555 |
| **Variabile «processo»** | «Processo di saldatura (eccetto varianti nel processo 13)» | **Gruppo a 2 cifre ISO 4063:2023**; sottogruppi/varianti no; eccezioni 142↔141/143/145/146/147 e SAW nastro 122/126 ↔ 121/123/124/125 | **Cambiato** (riferimento al processo 13 sparito) |
| **Automatica — sensori** | Con/senza sensore d'arco e/o di giunto (entrambe le direzioni) | §5.2 **non** elenca sensori | **Cambiato**: non più variabile per l'automatica |
| **Automatica — mono/multi-passata** | Da mono a multi-passata (non viceversa) per l'operatore automatico | §5.2 b) **solo weld setter** (fusione) | **Ristretto** |
| **Unità di saldatura** | «Tipo di unità (incluso sistema di controllo robot)» | Cambio unità **solo se** incide su setup / inserimento parametri (5.1 e, 5.2 c) | **Ristretto** |
| **Meccanizzata — posizioni** | Aggiunta di posizioni non qualificate secondo ISO 9606-1 (rinvio a ISO 6947) | Solo **orbitale: singola → multiple** (5.1 g); ISO 6947 solo in Bibliography | **Cambiato** |
| **Meccanizzata — altre** | Visivo diretto/remoto, lunghezza d'arco, inseguimento giunto, mono→multi, backing, inserti | Invariate nella sostanza (5.1 b-d, f, h, i) | Invariato |
| **Conferma periodica** | Ogni 6 mesi (= 9606-1) | Ogni 6 mesi, **§6.2**, esplicitamente applicabile a **tutte** le opzioni 6.3 | Invariato (chiarito) |
| **Validità/rivalidazione 6 vs 3 anni** | a) 6 anni; b) 3 anni con RT/UT o distruttiva su 2 saldature negli ultimi 6 mesi; c) indefinita con le 4 condizioni | **Identico**: a) 6 anni; b) 3 anni, 2 saldature, RT/UT/distruttiva, +3 anni; c) indefinita con conferma 6.2 e 3 condizioni | **Invariato**: «6 anni / 3 anni» **non** è una novità 2025 (è la differenza da ISO 9606-1) |
| **6.3 b) — alternativa** | Non riportata nell'estratto | Se RT/UT/distruttiva non possibili: altri NDT volumetrici o prova di produzione (es. tenuta) «secondo la norma applicativa» | **Non confrontabile** (possibile precisazione 2025) |
| **Annex ZA/ZB (UE)** | Non nell'estratto | PED cat. II-IV: terza parte competente e **6.3 c) non ammessa**; SPVD: organismo notificato | **Non confrontabile**; da considerare per il campo prodotto |
| **Metodo di rivalidazione sul certificato** | §5.1: da dichiarare | §6.1: da dichiarare all'emissione | Invariato |
| **Certificato (Annex C)** | Anagrafica con data/luogo di nascita, posizione ISO 6947, tipo unità, sensori | Ruolo operatore/preparatore, metodo di identificazione, datore di lavoro, rif. prova funzionale, conoscenza tecnologica, tabella Test piece × Range, basi 4.2-4.4, righe 6.3 a/b/c, tabelle rivalidazione 3 anni e conferma 6 mesi; **niente data/luogo di nascita né riga posizione** | **Cambiato** |
| **Riferimenti normativi** | Includeva ISO 857-1, ISO 14731, ISO 10447, ISO 6947, ISO 15609-1/-3/-4/-5 | Aggiunti ISO 15609-2 (gas), -6 (laser-arco), ISO 15614-12 (punto), ISO 4063:2023 **datata**; ISO 6947 e ISO 10447 passano in **Bibliography**; ISO 857-1 e ISO 14731 **non compaiono più** | **Cambiato** |
| **Ambito** | Non si applica a chi carica/scarica | Escluso chi non controlla/regola parametri e non partecipa al setup; solo metalli; FSW → ISO 25239-3 / ISO 18785-3 | Precisato |
| **Conoscenza funzionale / tecnologica** | Annex A obbligatorio, Annex B facoltativo | Idem (Introduction: «functional knowledge test is mandatory»; §4.1; Annex B «not mandatory») | Invariato |
| **Revoca** | Revoca delle qualifiche in dubbio, le altre restano | §6.4 idem | Invariato |

## GAP

- **Testo 2025**: nessun GAP di leggibilità; nessuna tabella numerica nel corpo ISO (la norma non ha range dimensionali).
- **Norme richiamate non in repo** (servono per verificare i Metodi 1-4 e 4.3 sul contenuto della prova, non per le regole di 14732): ISO 9606-3/-4/-5 (Metodo 1 per Cu/Ni/Ti-Zr), ISO 15614-5/-6/-7/-8/-11/-12/-13/-14. In repo: ISO 9606-1 (`NORMA_00018`), ISO 9606-2 (`NORMA_00032`), ISO 15614-1/-2 (`NORMA_00019`/`00031`/`00043`), ISO 15613 (`NORMA_00045`), ISO 14555 (`NORMA_00033`), ISO 4063:2023 (`NORMA_00044`), ISO 3834-2/-3.
- **«Norma applicativa»** (6.3 b: alternative NDT, criteri di accettazione, 6.3 c: «application standards»): non definita da ISO 14732; dipende dal prodotto/norma di fabbricazione.
- **Categoria PED / recipiente semplice** (Annex ZA/ZB): non è un dato del certificato; servirebbe il contesto prodotto per applicare «6.3 c) non ammessa».
- **Edizione 2013 integrale** non in repo: le differenze sono confrontate con l'estratto OCR 2013, non con il testo integrale; le righe «non confrontabile» restano tali. Certificati emessi sotto la 2013 (validi fino a scadenza) vanno letti con la 2013, di cui il repo ha solo l'estratto.
- **Codice UNI nazionale** (UNI EN ISO 14732:2025): assente nel PDF.

## Nota sulla fonte precedente (edizione 2013)

Fino al 06/10/2026 questo file era l'estratto operativo di **UNI EN ISO 14732:2013** (seconda edizione, sostituiva ISO 14732:1998/EN 1418:1997), ricavato da una scansione con OCR locale Tesseract 5.4 (28/28 pagine con testo utile; nessuna perdita tecnica). Il PDF 2013 non è in Git (copyright). La numerazione di clausole 2013 (§4.1, §4.2.2/§4.2.3, §5, Annex A-C) **non** è più quella corrente: per i certificati rilasciati sotto la 2013 si usi la tabella «Differenze 2013 → 2025» per tradurre i riferimenti. Il 06/10/2026 era stata prodotta (PR #717) un'anteprima iTeh di 4 pagine della 2025 come `NORMA_00046 Rev. 0`, sostituita dalla `Rev. 1` integrale.
