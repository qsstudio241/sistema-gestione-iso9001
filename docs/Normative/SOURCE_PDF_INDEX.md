# Indice PDF sorgente delle norme (fuori Git)

> **Perché questo file esiste**: i PDF delle norme UNI/ISO sono protetti da copyright e
> **non devono mai essere committati** su Git (vedi `.gitignore`, pattern `*.pdf`).
> Questo indice elenca solo **nomi file e percorso atteso**, senza contenuto — serve
> da mappa stabile tra "cosa ho digitalizzato in `docs/Normative/*.md`" e "dove sta
> il PDF originale sul disco/cloud personale del committente", per evitare la
> dispersione (Downloads, Desktop, OneDrive, drive di rete) che in passato ha causato
> la perdita di alcuni PDF sorgente.

## Convenzione cartella locale (proposta — da adottare una volta)

Un'**unica cartella radice**, fuori dal repo Git, con sottocartelle per famiglia norma.
Va bene qualunque percorso stabile il committente scelga (locale o OneDrive, purché
sincronizzato/backuppato) — l'importante è **uno solo**, non più copie sparse.

Esempio di struttura consigliata (adattare la radice `<NORME_PDF_ROOT>` al percorso
reale scelto, es. `C:\NormeISO_PDF\` oppure una cartella dentro OneDrive):

```
<NORME_PDF_ROOT>\
  ISO-9001-14001-45001\      # norme sistema di gestione
  ISO-3834-saldatura\         # requisiti qualità saldatura (serie 3834)
  ISO-96xx-patentini\         # qualifiche saldatori/operatori (9606, 14732, 9712...)
  ISO-156xx-WPS-WPQR\         # WPS/WPQR (15609, 15614...)
  ISO-consumabili-parametri\  # gas (14175), fili (14341), temperature (13916)...
  EN-10204-certificati\       # 10204, 10168, 10474, 404, 6929, facsimile MTC
  EN-10025-acciai-strutturali\ # 10025-2 (e in seguito 10025-1/3…, 10210, 10219)
  altre-norme\                # ASME, DIN, quaderni tecnici, ecc.
```

## Stato attuale (verificato 30/07/2026)

| Norma | File `.md`/`.json` in `docs/Normative/` | PDF sorgente atteso | Note |
|---|---|---|---|
| ISO 9001:2015 | `UNI EN ISO 9001_2015 Rev. 0.md` | `ISO-9001-14001-45001\UNI EN ISO 9001_2015.pdf` | Da recuperare se non più disponibile |
| ISO 45001:2018 | `Normative NORMA_00002_...md` | `ISO-9001-14001-45001\UNI ISO 45001_2018.pdf` | |
| ISO 14001:2015 | `Normative NORMA_00003_...md` | `ISO-9001-14001-45001\UNI EN ISO 14001_2015.pdf` | |
| ISO 3834-1:2021 | `Normative NORMA_00005_...md` | `ISO-3834-saldatura\UNI EN ISO 3834-1_2021.pdf` | |
| ISO 3834-5:2021 | `Normative NORMA_00008_...md` | `ISO-3834-saldatura\UNI EN ISO 3834-5_2021.pdf` | |
| ISO 3834-3:2021 | `Normative NORMA_00009_...md` | `ISO-3834-saldatura\UNI EN ISO 3834-3_2021.pdf` | |
| ISO 3834-2:2006 | `Normative NORMA_00010_...md` | `ISO-3834-saldatura\UNI EN ISO 3834-2_2006.pdf` | Edizione 2006, non 2021 — PDF 2021 non reperito all'epoca dell'import |
| ISO 3834-4:2006 | `Normative NORMA_00011_...md` | `ISO-3834-saldatura\UNI EN ISO 3834-4_2006.pdf` | Idem |
| ISO 14175:2008 | `Normative NORMA_00012_...md/.json` | `ISO-consumabili-parametri\UNI EN ISO 14175_2008.pdf` | |
| ISO 13916:2025 | `Normative NORMA_00013_...md/.json` | `ISO-consumabili-parametri\BS EN ISO 13916_2025.pdf` | |
| ISO 15609-1:2019 | `Normative NORMA_00014_...md/.json` | `ISO-156xx-WPS-WPQR\BS EN ISO 15609-1_2019.pdf` | |
| ISO 15609-2:2019 | `Normative NORMA_00015_...md/.json` | `ISO-156xx-WPS-WPQR\BS EN ISO 15609-2_2019.pdf` | |
| ISO 14341:2020 | `Normative NORMA_00016_...md/.json` | `ISO-consumabili-parametri\UNI EN ISO 14341_2020.pdf` | |
| ISO 9606-1:2017 | `Normative NORMA_00018_...md/.json` | `ISO-96xx-patentini\BS EN ISO 9606-1_2017.pdf` | Numero 00017 saltato (collisione due agenti paralleli, sessione 26/07/2026) |
| ISO 15614-1:2017 | `Normative NORMA_00019_...md/.json` | `ISO-156xx-WPS-WPQR\BS EN ISO 15614-1_2017.pdf` | |
| UNI EN 10168:2005 | `Normative NORMA_00020_...md/.json` | `EN-10204-certificati\UNI EN 10168 Ed.2005 steel docs.pdf` | Digitalizzato 16/08/2026 |
| EN 10168:2004 (EN) | `Normative NORMA_00021_...md/.json` | `EN-10204-certificati\EN 10168 steel docs.pdf` | Stessa norma, testo BSI inglese |
| UNI EN 10204:2005 | `Normative NORMA_00022_...md/.json` | `EN-10204-certificati\EN 10204 Ed 2005 (Commented).pdf` | Edizione commentata UNI |
| ISO 10474:2013 | `Normative NORMA_00023_...md/.json` | `EN-10204-certificati\ISO 10474 - 2013.pdf` | Equivalente acciaio di EN 10204 |
| ISO 6929:2013 | `Normative NORMA_00024_...md/.json` | `EN-10204-certificati\ISO 6929-2013.pdf` | Vocabolario forme prodotto |
| ISO 404:2013+A1:2022 | `Normative NORMA_00025_...md/.json` | `EN-10204-certificati\BS ISO 404-2013 + A1-2022.pdf` | Due PDF identici in consegna; uno solo convertito |
| Facsimile MTC 3.1/3.2 | `MTC_Type_3.1_FAC_SIMILE.md/.json` | `EN-10204-certificati\MTC Type 3.1 FAC SIMILE.pdf` | Filename 3.1, contenuto 3.2 |
| EN 10025-2:2019 | `Normative NORMA_00026_...md/.json` | `EN-10025-acciai-strutturali\BS EN 10025-2-2019.pdf` | Soglie S235–S500; estratto `docs/reference/EN-10025-2-acciai-strutturali.md` |
| EN 10210-1:2006 | `Normative NORMA_00027_...md/.json` | `EN-10025-acciai-strutturali\BS EN 10210-1-2006.pdf` | Hollow a caldo; estratto `docs/reference/EN-10210-1-sezioni-cave.md` (17/08/2026) |
| EN 10219-1 | *(nessun `.md` — traccia)* | `EN-10025-acciai-strutturali\EN 10219-1.pdf` | Tubi/hollow a freddo |
| ISO 9712:2012 | *(nessun `.md` ancora — backlog RC-7)* | `ISO-96xx-patentini\UNI EN ISO 9712_2012.pdf` | **PDF era committato per errore in Git — vedi nota sotto** |
| ISO 19011:2018 | *(nessun `.md` ancora)* | `ISO-96xx-patentini\UNI EN ISO 19011_2018_ITA.pdf` | **PDF era committato per errore in Git — vedi nota sotto** |

## Nota — 3 PDF rimossi dal tracking Git (30/07/2026, fix reale applicato 07/08/2026)

`UNI EN ISO 9712 (2012).pdf` e `UNI EN ISO 19011 ITA (2018).pdf` erano committati per
errore in questa cartella dal 15/05/2026 (repo **pubblico** su GitHub — esposizione
copyright reale, non solo teorica).

**Errore di processo scoperto il 07/08/2026**: il commit del 30/07/2026 (`466ce9c`)
dichiarava nel messaggio "rimossi dal tracking Git (`git rm --cached`)" ma il diff
reale del commit **non conteneva nessuna rimozione file** (solo documentazione
aggiunta) — i 2 PDF erano rimasti tracciati in `main` per oltre una settimana. Causa
radice: `.gitignore` alla radice del repo **non conteneva mai** una regola `*.pdf`
(solo `docs/Normative/.cursorignore` la conteneva, ma quel file blocca solo
l'indicizzazione di Cursor, **non** il tracking Git — i due meccanismi erano stati
confusi). Trovato in questa stessa sessione anche un **terzo PDF copyright** tracciato
per errore dal 19/05/2026: `app/src/tests/fixtures/BS EN ISO 9606-1 (2017).pdf`
(fixture di test mai effettivamente letta a runtime da nessun test — solo il codice
norma compare come stringa di metadati attesi in `importNormCommit.test.js`,
`normUploadButton.test.jsx`, `uploadNormaE2E.test.js`).

**Fix reale applicato il 07/08/2026**: `git rm --cached` sui 3 file (restano
fisicamente su disco come non versionati) + nuova regola in `.gitignore` root
(`docs/Normative/*.pdf` e `app/src/tests/fixtures/*.pdf`) per bloccare davvero
futuri commit accidentali. **Azione richiesta al committente**: spostare questi 3
file dalla cartella locale del repo alla cartella `<NORME_PDF_ROOT>` scelta (vedi
sopra), poi eventualmente cancellarli in locale (Git non li traccia più, nessun
comando Git necessario). La **storia Git** del repo contiene ancora questi 3 file nei
commit precedenti al 07/08/2026: una pulizia completa della storia (`git filter-repo`
+ force-push) è un'operazione invasiva separata, proposta ma non eseguita in questa
sessione — vedi `docs/reference/PROPOSTA_STORAGE_NORME_VPS.md`.

## Come aggiornare questo indice

Quando si digitalizza una nuova norma con `pdf_to_json`:
1. Aggiungere una riga alla tabella sopra con norma, file `.md`/`.json` prodotto, e
   percorso atteso del PDF sorgente nella cartella family-based.
2. Non serve copiare qui il PDF né il suo contenuto: solo il nome file e la posizione.

**Vigore:** il convertitore **non** verifica se la norma è ancora in vigore (solo estrazione testo). Il job settimanale sul registro documenti dei clienti non copre questi Markdown. Backlog (giorno 1 del mese, superadmin): riga in [PROJECT_ROADMAP § Backlog parcheggiato](../PROJECT_ROADMAP.md#backlog-parcheggiato-task-futuri--fonte-unica).
