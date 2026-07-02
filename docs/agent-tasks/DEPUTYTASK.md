# DEPUTYTASK — Welding Book ISO 3834 (Fase 0 scaffold)

> **Creato**: 02/07/2026  
> **Stato**: IN CORSO — Fase 0 su branch `cursor/welding-book-adr-scaffold-5344`  
> **ADR**: [`docs/adr/ADR-016-welding-book-e-modulo-strumenti.md`](../adr/ADR-016-welding-book-e-modulo-strumenti.md)

---

## Obiettivo Fase 0

Scaffold Welding Book (IOF) + ADR architettura. Migrazione 110, API CRUD, pagina lista/form bozza.

## Passi manuali post-merge (desktop / VPS)

1. **Migrazione DB** (prima del deploy backend):
   ```powershell
   .\backend\scripts\run-on-vps.ps1 -Script backend\scripts\run-migration-110-vps.js
   ```
   Oppure da SQL locale con `database.json`.

2. **Deploy backend**:
   ```powershell
   .\backend\scripts\deploy-controllers-to-vps.ps1
   ```

3. **Frontend**: merge su `main` → build Netlify automatica.

4. **Licenza**: org Mason deve avere `saldatura` in `licensed_modules`. Picker attrezzature: `cnd` oppure `strumenti` (o solo `saldatura` in lettura).

## Slice successive (Fase 1+)

- Select WPS/WPQR da anagrafica
- Foto cordone per riga
- Export Word IOF
- Modulo licenza `strumenti` + menu `/attrezzature`
- Foto attrezzatura in anagrafica (mobile)

---

## Chiusura

_(da aggiornare a TEST OK)_
