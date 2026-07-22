# Backup database e utilizzo del branch

---

## 1. Backup del database

### Come eseguire il backup

Dalla root del progetto:

```powershell
node backend/scripts/backup-db.js
```

### Cosa fa lo script

1. **Schema** (opzionale): tenta di eseguire `database/scripts/export-schema.ps1` per esportare la struttura delle tabelle in un file `.sql`. Se fallisce (es. versione PowerShell), continua comunque.

2. **Dati**: esporta tutte le tabelle critiche in file JSON nella cartella `database/backups/data_YYYYMMDDTHHmmss/`:
   - organizations, users, standards, checklist_sections, checklist_questions
   - audits, audit_standards, audit_responses
   - attachments, non_conformities, pending_issues, ecc.

3. **Manifest**: crea `_manifest.json` con timestamp, database e conteggio righe.

### Dove sono i backup

- Cartella: `database/backups/`
- I backup **non** vengono committati su Git (la cartella è in `.gitignore` per dati sensibili).

### Quando fare il backup

- Prima di eseguire migration (es. Phase 1 della roadmap)
- Prima di modifiche strutturali al DB

### Export schema manuale

```powershell
cd database/scripts
.\export-schema.ps1 -OutputFile "..\backups\schema_manual.sql"
```

**Nota (fix 15/03/2026)**: Lo script `export-schema.ps1` è stato corretto per evitare errori di parsing in alcune versioni/configurazioni PowerShell:
- `Get-Date -Format "..."` sostituito con `(Get-Date).ToString('...')`
- Here-string `@"..."@` sostituiti con array + concatenazione (header) e `@'...'@` (query SQL)
- Emoji e `[brackets]` rimossi da Write-Host (causavano errori)

---

## 2. Utilizzo del branch

### Cos’è un branch

Un **branch** è una copia parallela del codice su cui lavorare senza toccare `main`. Tutte le modifiche della roadmap (template report, checklist personalizzate) vengono fatte sul branch `feature/report-templates-and-custom-checklists`.

### Comandi principali

| Azione | Comando |
|--------|---------|
| Vedere su quale branch sei | `git branch` |
| Passare al branch della roadmap | `git checkout feature/report-templates-and-custom-checklists` |
| Tornare a main | `git checkout main` |
| Creare un nuovo branch (se serve) | `git checkout -b nome-branch` |

### Flusso di lavoro tipico

1. **Iniziare a lavorare**: `git checkout feature/report-templates-and-custom-checklists`
2. **Fare modifiche** (Phase 1, 2, …)
3. **Salvare**: `git add .` → `git commit -m "Phase 1: migration report_templates"`
4. **Se qualcosa va storto**: `git checkout main` per tornare al codice stabile (e, se serve, `git branch -D feature/...` per eliminare il branch)

### Push su GitHub (opzionale)

Per salvare il branch sul repository remoto:

```powershell
git push -u origin feature/report-templates-and-custom-checklists
```

Così il branch è disponibile anche su GitHub e puoi riprenderlo da un altro PC.

### Riepilogo branch attuale

- **main**: codice stabile, produzione
- **feature/report-templates-and-custom-checklists**: sviluppo roadmap (Phase 0 completata)

---

## 3. Netlify e deploy: quando gli operatori vedono le nuove funzionalità

### Comportamento attuale

**Netlify fa deploy automatico solo dal branch `main`.**

- Push su `main` → Netlify esegue build e deploy → gli operatori vedono l’aggiornamento in 2–3 minuti
- Push su un branch di feature (es. `feature/report-templates-and-custom-checklists`) → **nessun deploy** su produzione

**Per testare modifiche UI/feature senza toccare `main`**: apri una **Pull Request** dal branch — Netlify crea un **Deploy Preview** su URL tipo `deploy-preview-N--systemgest.netlify.app`. Procedura completa: [Workflow branch → preview → merge](GUIDA_CONSOLIDATA.md#workflow-sviluppo-branch--preview--merge) in `GUIDA_CONSOLIDATA.md`.

### Flusso per mettere in produzione le nuove funzionalità

1. **Sviluppo sul branch feature** (locale):
   ```powershell
   git checkout feature/report-templates-and-custom-checklists
   # ... lavori, commit ...
   ```

2. **Quando sei pronto per la produzione**:
   ```powershell
   git checkout main
   git merge feature/report-templates-and-custom-checklists
   git push origin main
   ```

3. Netlify rileva il push su `main` e fa il deploy automatico.

### Riepilogo

| Dove lavori | Cosa vede Netlify / gli operatori |
|-------------|-----------------------------------|
| Branch `feature/...` (locale) | Nessun deploy; serve merge su `main` |
| Branch `main` (dopo merge + push) | Deploy automatico; operatori vedono le novità |

**Non serve cambiare la configurazione Netlify**: continua a usare `main` come branch di produzione. Le modifiche vanno fatte sul branch feature e poi unite a `main` quando sono pronte.

---

*Riferimento: ROADMAP_TEMPLATE_E_CHECKLIST_PERSONALIZZATE.md, docs/REFERENCE.md*
