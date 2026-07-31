# DEPUTYTASK3 — Registro obblighi legali SICUREZZA (D.Lgs. 81/08) — contenuto P0

**Stato:** CHIUSO — TEST OK (integrato in PR #317; template LEG_SICUREZZA_81, 29 capitoli)
**Nota N5:** revisione umana contenuto resta aperta (ADR-019 D6) — non bloccante per chiusura brief tecnico.
**Priorità:** **P0** — deliverable principale richiesto dal committente in questa iniziativa
**Branch base:** `main`
**Creato da:** Lead 28/07/2026
**Spec:** [ADR-019](../adr/ADR-019-registro-obblighi-legali-ambiente-sicurezza.md) — leggere §1, §2 (D1, D2), §6 (D6, vincolante) prima di iniziare

> **Allineamento Git (autonomo)**: prima di leggere questo brief eseguire `git fetch origin main` e `git pull origin main`. **Non** chiedere al committente di farlo.

---

## Contesto (leggere prima)

Questo slice **non dipende dal codice** di DEPUTYTASK1/2 per essere iniziato (è autoria di contenuto/dati), ma il template finale è **utilizzabile in audit reale** solo dopo che DEPUTYTASK1 (colonne DB) e DEPUTYTASK2 (rendering FE) sono mergiati. Lavorare in parallelo è corretto; il test end-to-end finale va fatto dopo l'integrazione.

Esiste già un modulo analogo per l'**ambiente** (D.Lgs. 152/06) da usare come riferimento di stile/struttura:

| Ambiente (esistente, da copiare come pattern) | Sicurezza (da creare in questo slice) |
|---|---|
| `app/src/data/checklistTemplates.js` → `ISO_14001_LEGISLATIVO_TEMPLATE` (`standardCode: LEG_AMBIENTE_152`) | Nuovo export `ISO_45001_LEGISLATIVO_TEMPLATE` (`standardCode: LEG_SICUREZZA_81`) — **stesso file**, nuovo blocco |
| `backend/src/data/legislativoAmbientaleTemplate.js` (`LEGISLATIVO_AMBIENTALE_TEMPLATE`, marker `[SGQ_TEMPLATE:LEG_AMBIENTE_152]`) | Nuovo file `backend/src/data/legislativoSicurezzaTemplate.js` (`LEGISLATIVO_SICUREZZA_TEMPLATE`, marker `[SGQ_TEMPLATE:LEG_SICUREZZA_81]`) |
| `backend/scripts/buildLegislativoAmbientaleTemplate.js` (rigenera il file sopra da `checklistTemplates.js`) | Nuovo script `backend/scripts/buildLegislativoSicurezzaTemplate.js`, stesso pattern |
| `customChecklist.service.js` → `findSeededLegislativoAmbientale` / `seedLegislativoAmbientaleChecklist` | Nuove funzioni gemelle `findSeededLegislativoSicurezza` / `seedLegislativoSicurezzaChecklist` (stesso file, stesso pattern — **copiare, non generalizzare con parametri in questo slice**: la generalizzazione è un refactor successivo, non bloccante) |

**Novità rispetto al pattern ambiente**: ogni **capitolo** diventa una **sezione** con `reference_text`/`linked_legislation` popolati (vedi ADR-019 §2, §5) e le **sotto-domande a/b/c** diventano **item** con `response_type: "legal_check"` (vedi DEPUTYTASK2 Slice A/B) — il template ambiente esistente resta a livello di solo-capitolo (granularità sotto-domanda per l'ambiente è **P2**, fuori da questo slice).

## Vincolo non negoziabile (ADR-019 D6)

- **Fonte**: i due documenti fomiti dal committente (`Matrice 14001-45001 Grantini [compilata].pdf`, pag. 28-46 — capitoli sicurezza; eventualmente `Matrice Certiquality [vuota].docx` se esteso a sicurezza in una revisione futura del template). **Se questi file non sono disponibili in questa sessione**, richiederli esplicitamente al committente prima di scrivere contenuto — non improvvisare.
- **Non trascrivere**: nome/indirizzo del cliente terzo (SAVECO Italia Srl), "Evidenze Raccolte" specifiche di quell'azienda, "Risultanze" del loro audit. Trascrivere **solo**: titolo capitolo, elenco leggi/decreti/regolamenti (colonna "Rif. Legislativi principali"), sotto-domande a)/b)/c)… con il loro testo.
- **Se una sotto-domanda o un riferimento normativo non è verificabile con certezza dalla fonte**, ometterlo e segnalarlo come nota nel PR/commit ("gap documentale: capitolo N, verificare fonte") — non inventare un articolo di legge plausibile.

## Elenco capitoli sicurezza attesi (scaffold — titoli verificati, struttura non client-specific)

Questi titoli sono già stati estratti e verificati (non contengono dati del cliente terzo). Il **contenuto** di ciascuno (riferimenti di legge + sotto-domande) va invece preso dalla fonte come da vincolo sopra.

```
1.  DATORE DI LAVORO, DELEGA DI FUNZIONI, DIRIGENTI E PREPOSTI
2.  SERVIZIO PREVENZIONE E PROTEZIONE (RSPP, ASPP) E RLS
3.  LAVORATORI
4.  MEDICO COMPETENTE E SORVEGLIANZA SANITARIA
5.  FORMAZIONE, INFORMAZIONE E ADDESTRAMENTO DEI LAVORATORI
6.  GESTIONE DEGLI INFORTUNI
7.  RIUNIONE PERIODICA
8.  VALUTAZIONE GENERALE DEI RISCHI LAVORATIVI
9.  RISCHI AGENTI BIOLOGICI
10. RISCHI MOVIMENTAZIONE MANUALE DEI CARICHI
11. RISCHI TRAINO/SPINTA, TRASPORTO IN PIANO
12. POSTURE INCONGRUE
13. RISCHI MOVIMENTI RIPETITIVI CON SOVRACCARICO ARTI SUPERIORI
14. ATTREZZATURE MUNITE DI VIDEOTERMINALI
15. RISCHIO ATMOSFERE ESPLOSIVE
16. RISCHIO ELETTRICO, ELETTROSTATICO, FULMINAZIONE
17. RISCHIO STRESS LAVORO CORRELATO
18. RISCHIO LAVORATRICI IN STATO DI GRAVIDANZA
19. RISCHIO LAVORO NOTTURNO
20. RISCHIO LUOGHI ELEVATI CON PERICOLO DI CADUTA
21. LUOGHI DI LAVORO
22. APPROVVIGIONAMENTO ACQUA CONSUMO UMANO
23. MACCHINE / ATTREZZATURE DI LAVORO
24. MEZZI DI SOLLEVAMENTO
25. APPARECCHI A PRESSIONE
26. CANTIERI TEMPORANEI E MOBILI
27. DPI E RELATIVA GESTIONE
28. AMBITI NORMATI DIVERSAMENTE (settori speciali: portuale, estrattivo, ferroviario, forestale, esplosivi, lavoro in sotterraneo, cassoni ad aria compressa, impianti telefonici — valutare se singolo capitolo "non applicabile" per la maggior parte delle aziende, o da omettere in v1 se nessun cliente attuale rientra in questi settori: **decisione di prodotto, chiedere al committente se dubbio**)
```

Non includere "GESTIONE DEI RILIEVI" come capitolo — è la sezione di chiusura/riepilogo del report Grantini, non un capitolo di merito (equivalente concettuale già gestito dal modulo NC/registro rilievi esistente — non duplicare).

## Slice — Costruzione template + seed

**File previsti:**

1. `app/src/data/checklistTemplates.js` — nuovo export `ISO_45001_LEGISLATIVO_TEMPLATE` (`standardId: 3`, `standardCode: "LEG_SICUREZZA_81"`), sezioni = capitoli sopra, ciascuna con `referenceText` (nuovo campo sul modello sezione FE, stringa lunga) e `linkedLegislation` (stringa formato SAL, es. `"D.Lgs. 81/2008 art.18; art.19"` — solo se l'articolo è identificabile con certezza dalla fonte, altrimenti omettere il campo), items = sotto-domande con `responseType: "legal_check"`.
2. `backend/src/data/legislativoSicurezzaTemplate.js` — generato (non scritto a mano) da:
3. `backend/scripts/buildLegislativoSicurezzaTemplate.js` — copiare `buildLegislativoAmbientaleTemplate.js`, adattare marker e import.
4. `backend/src/services/customChecklist.service.js` — aggiungere `LEG_SICUREZZA_TEMPLATE_MARKER`, `findSeededLegislativoSicurezza`, `seedLegislativoSicurezzaChecklist` (copia di `findSeededLegislativoAmbientale`/`seedLegislativoAmbientaleChecklist`, import di `LEGISLATIVO_SICUREZZA_TEMPLATE`, passando anche `reference_text`/`linked_legislation` a `createSection` — **richiede che DEPUTYTASK1 sia già mergiato**; se non lo è ancora, sviluppare fino al punto 3 e fermarsi, segnalando la dipendenza).
5. Endpoint/route per seedare (stesso pattern di quello ambientale — verificare nome esatto endpoint esistente con `grep -rn "seedLegislativoAmbientale" backend/src/controllers backend/src/routes` prima di duplicare).

**DoD:**
- Jest: seed idempotente (secondo run non duplica), sezioni con `reference_text` popolato per almeno l'80% dei capitoli (il resto può essere gap documentale segnalato).
- Vitest: nuovo template presente in `checklistTemplates.js`, struttura valida (ogni sezione ha `code` univoco, ogni item ha `code` univoco nella sezione).
- Smoke manuale (computerUse) **dopo** che DEPUTYTASK1+2 sono mergiati: seedare il template su un'organizzazione di test, apriree un audit, verificare che compaia il blocco `reference_text` e che le sotto-domande rispondano con SI/NO/NA.

**Test L1 mirato:**
```bash
cd app && NODE_ENV=test npx vitest run src/tests/customChecklistTemplates.test.js
cd backend && npx jest customChecklist --silent
```

---

## Verifica di chiusura (gate)

Full Vitest + `npm run build` solo se questo è l'ultimo slice del gate "P0 completo" (dopo 1+2+3). Se DEPUTYTASK1/2 non sono ancora mergiati, chiudere questo slice con **TEST OK (parziale)** indicando esplicitamente cosa resta da integrare.

Chiudere con **TEST OK** o **FIX NON APPLICABILI** (es. "fonte pag. 28-46 non disponibile in questa sessione — richiedere al committente").

---

## Comando deputy

```
Leggi docs/agent-tasks/DEPUTYTASK3.md ed eseguilo. Chiudi con TEST OK o FIX NON APPLICABILI.
```
