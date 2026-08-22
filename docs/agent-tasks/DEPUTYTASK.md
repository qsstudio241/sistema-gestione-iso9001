# DEPUTYTASK — IA-15: duplicati e edizioni (stessa famiglia in NORME)

**Stato:** APERTO  
**Aperto:** 22/08/2026  
**Piano:** [`PLAN_INGEST_ARCHIVIO_SLICES.md`](PLAN_INGEST_ARCHIVIO_SLICES.md) (IA-15; follow-up IA-12)  
**Rischio:** Medio — estende `checkNormDuplicate` + ingest cartella; UPDATE additivo `validity_status`; niente schema/auth/sync.  
**Branch:** `cursor/ingest-norme-duplicati-edizione-d492`  
**Precedente slot:** IA-12 CHIUSO [#524](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/524) / [#525](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/525)

## Perché

Ingest dalla cartella deve confrontare i PDF **già in quella cartella 2.3** (stessa azienda). L’utente può tenere un’edizione **obsoleta**; non deve ottenere un **duplicato** (stessa famiglia + stesso anno). Un’edizione **più recente** diventa vigente e quella precedente passa a non vigente.

## File previsti

- `backend/src/services/standardCodeNormalizer.service.js` (`normFamilyKey`)
- `backend/src/services/standardCodeNormalizer.service.test.js`
- `backend/src/services/normIngest.service.js` (`checkNormDuplicate` esteso, supersede)
- `backend/src/services/normIngest.service.test.js`
- `backend/src/controllers/normUpload.controller.js` (scope company/folder su extract)
- `backend/src/controllers/normUpload.controller.test.js`
- `app/src/components/NormUploadButton.jsx` (warning lista risultati + AiDisclaimer)
- `app/src/tests/normUploadButton.test.jsx`
- `docs/agent-tasks/DEPUTYTASK.md`

## Cosa NON toccare

- `importJobs.controller.js` / Screening / posa 2.3
- contractReview, smoke #530
- GUIDA / roadmap (eventuale parallelo: solo questo brief)
- `auth.middleware`, `syncService`, migrazioni SQL, CASCADE
- Material Compliance, Qualifiche, WPQR

## Slice (minimo verificabile)

1. Stessa famiglia + stesso anno (o stesso `standard_code` normalizzato) → `duplicate`, niente secondo documento.
2. Stessa famiglia + anno **più vecchio** di un vigente → non auto-commit come vigente; `pending_review` + warning italiano; `validity_status` non vigente. Non cancellare.
3. Stessa famiglia + anno **più nuovo** → ingest vigente; i precedenti in cartella/azienda → `superata`.
4. UI: lista risultati ingest già esistente + testo warning. Niente look nuovo.

## Acceptance

- `UNI EN 10168` ≡ `EN 10168` (togli UNI, tieni EN/ISO/IEC + numero).
- Due PDF stesso anno → una sola riga `duplicate`.
- PDF più vecchio con vigente più recente → warning «Esiste già un’edizione più recente…»; non due vigente.
- PDF più nuovo → vecchio `superata`.
