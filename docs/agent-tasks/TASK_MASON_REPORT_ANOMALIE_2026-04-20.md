# Task deputy — anomalie report Mason (Audit 2026-04 MANITOU)

> **Stato**: FIX APPLICATI (sessione 21 aprile 2026) — pronti per deploy frontend (Netlify push `main`).  
> Smoke manuale pendente: Mason deve ri-generare il report con l'app aggiornata.  
> Audit 2026-04 non più presente nel DB (creato prima del fix tenant) — Mason deve compilare un nuovo audit ISO 3834 per verificare tutti i punti.

> Creato: 20 aprile 2026  
> Priorità: alta (blocco primo rilascio report cliente)  
> Ambito: export Word audit ISO 3834 + mapping campi UI/DB + smoke completo.

---

## 1) Contesto e segnalazioni cliente

Cliente Mason segnala, su audit `2026-04` (MANITOU ITALIA SRL), che nel report Word:

1. foto non embeddate (solo link);
2. in intestazione compaiono `PR04.04` e `N/D` poco chiari;
3. dati fornitore incompleti (atteso: ragione sociale + indirizzo);
4. manca data visita ispettiva;
5. non è chiaro dove inserire disegni/specifiche di riferimento;
6. non compaiono correttamente ispettore principale e ispettore affiancante.

---

## 2) Obiettivo task

Conseguire un export Word affidabile e comprensibile per uso reale cliente, senza perdere dati esistenti:

- correggere i mapping errati;
- chiarire i fallback non desiderati (`PRxx.04`, `N/D`) quando i dati sono disponibili;
- garantire compatibilità multi-device (dati persistiti e riletti dal DB);
- chiudere con smoke test end-to-end e output univoco.

---

## 3) Vincoli non negoziabili

1. **Diff minimo**: modificare solo i punti necessari a risolvere i 6 sintomi.
2. **No segreti** in codice/doc/commit.
3. **Nessuna migrazione DB distruttiva**.
4. Se il fix tocca backend: ricordare che il VPS è **copia file** (non clone Git) e usare `backend/scripts/deploy-controllers-to-vps.ps1` + restart `sgq-backend`.
5. Aggiornare documentazione operativa solo dove serve (`docs/GUIDA_CONSOLIDATA.md` / roadmap se cambia procedura).

---

## 4) Perimetro tecnico atteso

### Frontend/export (obbligatorio)

- `app/src/components/ExportPanel.jsx`
- `app/src/utils/wordExport.js`
- `app/src/utils/wordExportHelpers.js`
- eventuali test in `app/src/tests/` legati a placeholder/mapping export.

### Template Word (se necessario)

- `app/public/templates/ISO3834-audit-report.docx`  
  (solo se il problema è nel template e non risolvibile da mapping codice).

### Backend (solo se necessario)

- controller/servizi audit/sync se emerge mismatch persistenza `metadata.auditDate` vs `generalData.auditDate` o campi ispettori/fornitore.

---

## 5) Piano di lavoro richiesto al deputy

1. Riprodurre i 6 sintomi su audit di test equivalente (ISO 3834).
2. Mappare per ogni sintomo: **causa root** (codice o template).
3. Applicare fix minimi, con priorità:
   - correttezza dati prima dell’estetica;
   - retrocompatibilità con audit già esistenti.
4. Aggiungere/aggiornare test automatici dove il pattern esiste già.
5. Eseguire smoke completo (sezione 7).
6. Produrre esito univoco (sezione 8).

---

## 6) Criteri di accettazione funzionale

- [ ] Le immagini jpg/png/gif appaiono embeddate nel DOCX quando disponibili; fallback a link solo per formati non supportati.
- [ ] `PRxx.04` non è mostrato come valore “opaco” senza contesto (o viene sostituito da campo più significativo, secondo template).
- [ ] `N/D` non compare per ispettore quando il dato è presente in audit.
- [ ] La data visita è valorizzata correttamente (anche se inserita in `generalData`).
- [ ] Disegni/specifiche confluiscono in campo report chiaro e facilmente compilabile in UI.
- [ ] Ispettore principale + affiancante risultano coerenti nel report (campo singolo + partecipanti, o soluzione equivalente documentata).
- [ ] Nessuna regressione su export standard non coinvolti.

---

## 7) Smoke test obbligatorio (con loop)

## Regola di chiusura

Applicare ciclo **`review -> fix -> smoke`** fino a esito positivo completo.

### Smoke minimo

- [ ] L1 app: `cd app` -> `NODE_ENV=test` -> `npm run test:run` -> `npm run build`
- [ ] Generazione report Word su audit test ISO 3834 con:
  - almeno 1 immagine supportata;
  - data visita compilata;
  - documenti di riferimento compilati;
  - ispettore + partecipanti compilati.
- [ ] Verifica manuale DOCX:
  - immagini visibili;
  - intestazione coerente;
  - dati fornitore completi secondo mapping deciso;
  - data visita presente;
  - disegni/specifiche presenti;
  - ispettori presenti.

### Se backend toccato

- [ ] Deploy VPS file aggiornati + restart servizio.
- [ ] Smoke API/report post-deploy (non solo locale).

---

## 8) Output finale obbligatorio (univoco)

Il deputy deve chiudere con **una sola** delle due forme:

- `TEST OK`
- `FIX NON APPLICABILI: <elenco puntuale + motivo + prossimo passo>`

Se rimane anche un solo punto critico senza fix applicabile, non usare `TEST OK`.

---

## 9) Evidenze richieste nella consegna

- elenco file toccati;
- tabella sintomo -> causa -> fix;
- test eseguiti (comando + esito);
- eventuali limiti residui espliciti;
- commit/PR di riferimento.

---

## 10) Prompt pronto per Agents Window

```text
Segui rigorosamente `docs/agent-tasks/TASK_MASON_REPORT_ANOMALIE_2026-04-20.md`.

Obiettivo: risolvere le anomalie report Mason su audit ISO 3834 (foto non embeddate, intestazione PR/N-D, data visita, dati fornitore, disegni/specifiche, ispettori), con fix minimi e senza regressioni.

Vincoli:
- no segreti
- diff minimo
- loop obbligatorio review -> fix -> smoke fino a chiusura reale
- output finale univoco: `TEST OK` oppure `FIX NON APPLICABILI: ...`

Consegna finale:
1) tabella sintomo -> causa -> fix
2) file modificati
3) test/smoke eseguiti con esito
4) output univoco obbligatorio
```

