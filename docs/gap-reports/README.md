# Gap reports

Output persistente delle gap analysis normative (prompt in `docs/agent-tasks/GAP_ANALYSIS_PROMPTS.md`).

## Convenzione nomi

| Pattern | Contenuto |
|---------|-----------|
| `GAP_AUDIT_9001_YYYY-MM-DD.md` | Audit ISO 9001 clausole 4-10 |
| `GAP_NC_YYYY-MM-DD.md` | Modulo NC §10.2 |
| `GAP_AUDIT_14001_YYYY-MM-DD.md` | Audit ISO 14001 |
| `GAP_AUDIT_45001_YYYY-MM-DD.md` | Audit ISO 45001 |
| `GAP_RDP_3834_YYYY-MM-DD.md` | RDP / ISO 3834 Mason (06/08: sintesi moduli; 15/08: vista per processi §5–18 + piano slice) |
| `GAP_SAL_YYYY-MM-DD.md` | SAL Camellini |
| `GAP_REGISTRO_NORME_YYYY-MM-DD.md` | Registro norme e documenti |
| `GAP_RBAC_SAAS_YYYY-MM-DD.md` | RBAC / multi-tenant |
| `GAP_EXPORT_WORD_YYYY-MM-DD.md` | Export Word / reportistica |
| `GAP_SYNC_YYYY-MM-DD.md` | Sync offline / multi-device |
| `GAP_STRUTTURA_YYYY-MM-DD.md` | Visione d'insieme (coordinatore) |
| `GAP_NORM_FIDELITY_STRATEGICA_YYYY-MM-DD.md` | Loop fonti → skill → moduli (harness + runtime AI) |
| `GAP_CONSOLIDATO_YYYY-MM-DD.md` | Merge finale di tutti i report |

I file possono essere versionati su Git per tracciare l'evoluzione della conformità nel tempo.
