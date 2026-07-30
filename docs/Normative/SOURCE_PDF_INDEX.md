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
| ISO 9712:2012 | *(nessun `.md` ancora — backlog RC-7)* | `ISO-96xx-patentini\UNI EN ISO 9712_2012.pdf` | **PDF era committato per errore in Git — vedi nota sotto** |
| ISO 19011:2018 | *(nessun `.md` ancora)* | `ISO-96xx-patentini\UNI EN ISO 19011_2018_ITA.pdf` | **PDF era committato per errore in Git — vedi nota sotto** |

## Nota — 2 PDF rimossi dal tracking Git (30/07/2026)

`UNI EN ISO 9712 (2012).pdf` e `UNI EN ISO 19011 ITA (2018).pdf` erano committati per
errore in questa cartella dal 15/05/2026 (repo **pubblico** su GitHub — esposizione
copyright reale, non solo teorica). Sono stati rimossi dal tracking Git (`git rm
--cached`, restano fisicamente su disco come file non versionati). **Azione richiesta
al committente**: spostare questi 2 file dalla cartella locale del repo alla cartella
`<NORME_PDF_ROOT>` scelta (vedi sopra), poi eventualmente cancellarli da
`docs/Normative/` in locale (Git non li traccia più, quindi non serve nessun comando
Git per questo). La **storia Git** del repo contiene ancora questi 2 file nei commit
precedenti al 30/07/2026: una pulizia completa della storia (`git filter-repo` +
force-push) è un'operazione invasiva separata, proposta ma non eseguita in questa
sessione — vedi `docs/reference/PROPOSTA_STORAGE_NORME_VPS.md`.

## Come aggiornare questo indice

Quando si digitalizza una nuova norma con `pdf_to_json`:
1. Aggiungere una riga alla tabella sopra con norma, file `.md`/`.json` prodotto, e
   percorso atteso del PDF sorgente nella cartella family-based.
2. Non serve copiare qui il PDF né il suo contenuto: solo il nome file e la posizione.
