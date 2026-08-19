# Due documenti Mason chiamati RDP — non sono lo stesso prodotto

**Data:** 19/08/2026  
**Fonti in git:** [`docs/reference/mason-rdp/`](../reference/mason-rdp/)  
**HITL:** sì — non implementare ISO-4 Word sul modulo RDP finché non si sceglie sotto.

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

## Cosa manca rispetto ai due file (non è solo il Word)

1. **Scala 1–6** del 27/01 vs pulsanti C/NC/OSS dell’audit. Anche se le domande coincidono, l’export «come Mason» non è un copia-incolla del verbale ISO 9001.
2. **Campi di testa** del 27/01 (scopo visita, tipo elemento saldato, disegno cliente, ispettore Mason / ispettore cliente) — il modulo RDP li ha; l’audit li ha in forma generica.
3. **Foto per quesito** — richieste nel 27/01; l’audit le ha come allegati; RDPModule le obbliga per «prova».
4. **Resoconto tipo 23/02** — oggi non c’è un tipo documento «visita di avanzamento + foto». Non è né checklist né NDT.

Il verbale NDT (`/saldatura` CND) resta un terzo oggetto, corretto: è la prova tecnica (VT/MT/…), non la visita ispettiva Mason.

---

## Come procedere (proposta, da confermare)

Non spegnere nulla in produzione prima della scelta. Ordine consigliato:

1. **Word del 27/01** → export dell’**Audit ISO 3834-2 (fornitori in campo)**, layout Mason (quesito / evidenza / voto / media). Non dal menu `/saldatura/rdp`.
2. **Standard Audit `RDP_MSN` (id 7)** → rinominare in UI («Audit sistema ISO 3834» o simile) così non compete con il codice verbale Mason. Non è il file 27/01.
3. **Menu `/saldatura/rdp`** → o lo si allinea al **resoconto visita** (file 23/02: testo + foto + commessa, già collegata con ISO-7), o lo si nasconde e si riusa l’audit. Non restare «rapporto di prova da laboratorio»: quello è il modulo NDT.
4. **ISO-5** Word Welding Book resta indipendente (IOF di fabbricazione, non visita Mason).

---

## Decisione da prendere (una sola)

Quale output vuoi per primo?

- **A** — Word della check list visita (come il 27/01), dallo standard Audit ISO 3834-2  
- **B** — Resoconto visita + foto (come il 23/02), nel modulo oggi chiamato RDP  
- **C** — Tutti e due, in quest’ordine: prima A poi B  

Fino a quella scelta, ISO-4 resta **aperta come architettura**, non come «manca il file».
