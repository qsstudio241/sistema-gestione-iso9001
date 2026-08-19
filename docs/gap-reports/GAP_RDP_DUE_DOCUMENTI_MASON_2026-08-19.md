# Due documenti Mason chiamati RDP — non sono lo stesso prodotto

**Data:** 19/08/2026  
**Fonti in git:** [`docs/reference/mason-rdp/`](../reference/mason-rdp/)  
**HITL:** chiusa 19/08 pomeriggio — menu spento, Word da Audit id 6, id 7 solo rinomina UI.

Mason usa **RDP** come codice di serie dei verbali di visita (`RDP_MSN-AAMMGG-NN`). Non significa «rapporto di prova di laboratorio». I due file lo dimostrano.

---

## Cosa sono i due Word

| | `RDP_MSN-260127-01` | `RDP_MSN-260223-01` |
|---|---|---|
| Titolo interno | **CHECK LIST VISITA ISPETTIVA – PROGETTO SALDATURA MANITOU** | Resoconto stato commessa / cicli produttivi FVS |
| Struttura | Intestazione visita + sezioni + quesito + evidenze + **voto 1–6** + media | Testo libero + elenco spedizioni + **foto in campo** |
| Sezioni | Gestione qualità, Controllo documentale, Ispezione in campo, Controlli post-saldatura | Stabilimenti Mozzecane / Erbè, cicli AA–AC, LA–LC |
| Esito | Scala 1 NC Grave … 6 Conforme+ (media finale 4,45) | Nessun punteggio |
| Tecnico | Melotto Mirko | Mason Andrea, Abbenante Francesco |
| Già in app? | **Sì, quasi identico** nello standard Audit **ISO 3834-2** (id 6) | **No** |

Il file 27/01 **non** è un rapporto con «valore atteso / valore misurato». È una visita ispettiva a domande, come un audit di seconda parte sul fornitore.

---

## Dove l’app ha spezzato lo stesso nome in tre posti

```
Mason dice «RDP»
        │
        ├─ 1. Audit → standard ISO_3834_2 (id 6)
        │     «Audit Fornitori in Campo»
        │     22 domande = il file 27/01   ← posto giusto per quel Word
        │
        ├─ 2. Audit → standard RDP_MSN (id 7)
        │     etichetta «RDP Mason - Audit di Sistema Saldatura»
        │     36 domande sulle clausole ISO 3834-2
        │     (altra cosa: audit di sistema, non la check list Manitou)
        │
        └─ 3. Menu Saldatura → /saldatura/rdp  (RDPModule)
              etichetta «RDP - Rapporto di Prova»
              tabelle rdp_reports / prove con valore atteso-misurato
              stesso file 27/01 citato come template  ← duplicato sbagliato
```

ADR-009 diceva: RDP = specializzazione di checklist, `document_type=rdp`, stesso motore audit. Poi lo slice di luglio ha fatto **tabelle dedicate** stile NDT «per non copiare IndexedDB». Risultato: due motori, un solo nome, il Word 27/01 attaccato al motore sbagliato.

ISO-4 («copia il Word Mason nel modulo RDP») **non va eseguita così**. Genererebbe un terzo export dal modulo prove, mentre la check list vive già in Audit.

---

## Verifica codice + produzione (19/08, pomeriggio)

I due pezzi **non si parlano**. Zero import, zero FK, zero `document_type='rdp'` usato.

### 1. Audit — dove si «aggancia» RDP

All’apertura di un **nuovo Audit** (`AuditSelector`) si possono spuntare, tra gli altri:

| Checkbox (etichetta UI) | Standard DB | Cosa contiene | Produzione (oggi) |
|---|---|---|---|
| ISO 3834-2 - Audit Fornitori in Campo | `ISO_3834_2` id **6** | Le **22 domande del Word 27/01** | **6** audit |
| Audit di Sistema Saldatura (ISO 3834-2) | `RDP_MSN` id **7** | **36 domande sulle clausole** della norma (non il Word 27/01) | **3** audit |

Menu: **Audit** in alto (non sotto Saldatura). Motore: checklist + C/NC + Word `ISO3834-audit-report.docx`.  
Su tutti gli audit in produzione `document_type` è `'audit'` (41 righe). **Nessun** audit è `'rdp'`.

### 2. Saldatura — modulo RDP

Menu **Saldatura → RDP - Rapporto di Prova** → `/saldatura/rdp` → `RDPModule.jsx`.  
Licenza `saldatura`. Tabelle `rdp_reports` / `rdp_sections` / `rdp_tests`. Form: visita + «prove» valore atteso/misurato + foto. **Non legge gli audit.**

Produzione:

| Oggetto | Conteggio |
|---|---|
| Rapporti RDP non cancellati | **0** |
| Rapporti (incluso soft-delete) | 1 vuoto |
| Prove / foto | **0** |

Il dashboard 3834 **non** ha un link a questo modulo.

### 3. Laboratorio vero

Menu **CND → Verbali CND (VT/MT/PT/UT)**. Quello è il rapporto di prova tecnica. Non va toccato.

---

## Togliere RDP da Saldatura?

**Sì, toglierlo dal menu.** Non è corretto come «Rapporto di Prova». Mason non lo usa (zero record vivi). Tenerlo visibile continua a confondere.

**Non cancellare subito** tabelle e codice: servono se scegliamo di riusarli per il **resoconto visita** (file 23/02). Nascondere ≠ distruggere.

Standard Audit `RDP_MSN` (id 7): **non eliminare** (3 audit già aperti). Solo **rinominare** in UI, togliendo la parola RDP.

---

## Cosa manca rispetto ai due file

1. **Scala 1–6** del 27/01 vs pulsanti C/NC/OSS dell’audit. Anche se le domande coincidono, l’export «come Mason» non è un copia-incolla del verbale ISO 9001.
2. **Campi di testa** del 27/01 (scopo visita, tipo elemento saldato, disegno cliente, ispettore Mason / cliente) — oggi più completi nel modulo Saldatura, ma quel modulo è vuoto.
3. **Foto per quesito** — l’audit le ha come allegati.
4. **Resoconto tipo 23/02** — non esiste come tipo documento.

---

## Come procedere (proposta, da confermare)

1. **Nascondere** Saldatura → RDP dal menu (zero dati in produzione). Non drop tabelle.
2. **Rinominare** in Audit lo standard id 7 (niente «RDP» in etichetta).
3. **Word del 27/01** → export dell’Audit **ISO 3834-2** (id 6). Non dal modulo Saldatura.
4. Eventuale **resoconto 23/02**: solo dopo, e solo se serve un secondo tipo visita (testo + foto).

---

## Decisione (confermata 19/08/2026 pomeriggio)

| Scelta | Esito |
|---|---|
| Menu Saldatura → RDP | **Spento.** Route `/saldatura/rdp` resta; tabelle `rdp_*` non droppate. |
| Output Word | **A** — check list 27/01 dal modulo **Audit ISO 3834-2** (id 6). Resoconto 23/02 **parcheggiato**. |
| Audit id 7 | **Rinominato in UI** (niente «RDP»). Codice DB `RDP_MSN` invariato (3 audit aperti). |
| Scala 1–6 | **Non in questa slice** (ISO-4b). Oggi l’app usa C/NC/OSS. |
| CND | **Non toccato.** |

Roadmap: ISO-4 = Word da Audit; ISO-5 Welding Book invariata; ISO-7 `project_id` su `rdp_reports` resta in DB; ISO-13 tipo `rdp` = codice verbale, non il modulo prove. Dettaglio slice: [`PLAN_3834_SLICES.md`](../agent-tasks/PLAN_3834_SLICES.md).
