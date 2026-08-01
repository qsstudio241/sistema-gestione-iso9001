# ISO 9712:2022 — Qualifiche personale NDT
# Guida tecnica per ingestione AI e copertura commessa

> Fonte: BS EN ISO 9712:2022 — Non-destructive testing — Qualification and certification of NDT personnel  
> Riferimento implementativo: `backend/src/data/documentTypeSchemas.js` (`cert_ndt`) e `qualificationIngest.service.js`

---

## 1. Campi estratti e colonna DB

| Campo AI (`type_specific_data`) | Colonna DB (`qualifications`) | Note |
|---|---|---|
| `operator_name` | `person_name` | Cognome e nome come sul certificato |
| `certificate_number` | `certificate_number` | Es. `1234/VT/2/CICPND/2022` |
| `ndt_method` | `ndt_method` | VT/MT/PT/UT/RT/ET/AE/TT/ST/LT |
| `certification_level` | `ndt_level` (INT) | 1/2/3 |
| `ndt_sector` | `ndt_sector` | Lettera ISO 9712 Annex A |
| `certification_scheme` | `certification_scheme` | CICPND/PCN/SNT-TC-1A/ASNT/COFREND |
| `scope_detail` | `scope_detail` | PA, TOFD, DR ecc. |
| `issuing_body` | `issuing_body` | Ente certificatore |
| `exam_date` | `exam_date` | Data esame qualifica |
| `expiry_date` | `expiry_date` | Scadenza (normalmente exam_date + 5 anni §9.2) |
| `revalidation_date` | `revalidation_date` | Se già rinnovata |
| (calcolato) | `standard_ref` | Fisso "ISO 9712:2022" |

---

## 2. Validità e scadenziario (ISO 9712 §9)

| Clausola | Regola |
|---|---|
| §9.2 | Durata certificato: **5 anni** dalla data di emissione |
| §9.3 | Rinnovo: altri 5 anni se continuità impiego + visita medica visiva confermata |
| §9.4 | Ricertificazione (nuovo esame): se il rinnovo §9.3 non è applicabile |
| Allerta scadenzario | `expiry_date` (campo primario) — 60gg urgente, 30gg critico |

---

## 3. Metodi NDT riconosciuti (ISO 9712 §3 + practice)

| Codice | Nome | Applicazione tipica saldatura/ISO 3834 |
|---|---|---|
| VT | Esame visivo | Obbligatorio ISO 3834-2 §10.2 — tutti i giunti |
| MT | Magnetoscopia | Acciaio ferromagnetico — rilevazione cricche superficiali |
| PT | Liquidi penetranti | Materiali non magnetici (acciaio inox, alluminio) |
| UT | Ultrasuoni | Difetti interni, spessori, giunti testa-a-testa |
| RT | Radiografia | Qualità interna giunti critici, pressione |
| ET | Correnti indotte | Tubi, superfici metalliche, rilevazione discontinuità |
| AE | Emissione acustica | Monitoraggio strutturale, prove in carico |
| TT | Test di tenuta | Leak testing |
| ST | Stress/deformazione | Strain gauging |
| LT | Leak testing | Alternativo a TT in alcune normative |

---

## 4. Settori industriali — Annex A ISO 9712

Usati per rispondere a **"ho la copertura NDT per questa commessa?"** durante il riesame ISO 3834.

| Codice | Settore | Rilevante per |
|---|---|---|
| `w` | Welded products — Prodotti saldati | **ISO 3834 §8.2** — ispezione giunti saldati |
| `p` | Wrought products — Laminati/forgiati | Materiali base semi-lavorati |
| `t` | Tubular products — Tubi | Manifold, scambiatori |
| `s` | Castings — Getti | Valvole, pompe |
| `c` | Composites | Materiali compositi |
| `r` | Rail — Ferroviario | Infrastrutture rotaia |
| `a` | Aerospace — Aerospaziale | Strutture aeree |
| `m` | Manufacture — Forgiati | Componenti meccanici |

**Regola di copertura** (implementata in `caseExtractedCoverage.service.js`):  
Personale con qualifica NDT `ndt_sector='w'` copre le ispezioni richieste su commesse con `process_type` saldatura. Livello 2 richiesto per interpretazione autonoma dei risultati (ISO 9712 §5.3.2).

---

## 5. Schemi di certificazione riconosciuti

| Schema | Paese/Area | Accreditamento |
|---|---|---|
| CICPND | Italia | Accredia ISO 17024 |
| PCN | UK | TWI |
| COFREND | Francia | COFRAC |
| SNT-TC-1A | USA | ASNT |
| ASNT | USA | — |
| BINDT | UK | — |
| NORDTEST | Scandinavia | — |
| DGZfP | Germania | DAkkS |

---

## 6. Domanda riesame requisiti (ISO 3834 §8.2)

> «Ho le coperture del personale NDT per eseguire questa commessa?»

Dati necessari dalla DB:
```sql
SELECT q.person_name, q.ndt_method, q.ndt_level, q.ndt_sector,
       q.certification_scheme, q.expiry_date, q.revalidation_date,
       q.scope_detail, c.name AS company
FROM qualifications q
JOIN companies c ON c.id = q.company_id
WHERE q.qualification_type LIKE '%NDT%'
  AND q.company_id = @companyId
  AND q.status = 'valida'
  AND q.expiry_date > GETDATE()
ORDER BY q.ndt_method, q.ndt_level DESC;
```

Logica di match commessa → personale:
1. `ndt_sector = 'w'` oppure settore pertinente al tipo lavorazione
2. `ndt_level >= 2` (interpretazione autonoma risultati)
3. `expiry_date > data commessa`
4. Metodo richiesto dalla norma/contratto (es. UT obbligatorio per giunti BW §1.0 EN 13480)

---

## 7. Configurazione ingest AI

File aggiornati:
- `backend/src/data/documentTypeSchemas.js` — prompt AI arricchito con settori/schemi
- `app/src/data/documentTypeSchemas.js` — schema form revisione allineato  
- `backend/src/services/qualificationIngest.service.js` — `ndt_sector`/`certification_scheme` persistiti
- `backend/src/services/ingestStaging.service.js` — `cert_ndt` aggiunto a `QUALIFICATION_DOC_TYPES`
- `backend/src/controllers/qualifications.controller.js` — `cert_ndt` in `UPLOAD_BATCH_DOC_TYPES`
- `app/src/components/QualificationUploadButton.jsx` — opzione NDT nel menu upload
