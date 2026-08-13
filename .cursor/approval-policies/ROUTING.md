- product: Documentazione / governance agente
  boundary: "docs/**,.cursor/rules/**,AGENTS.md"
  policies:
    - docs/APPROVAL_POLICY.md
    - .cursor/rules/APPROVAL_POLICY.md

- product: Frontend
  boundary: "app/src/**"
  policies:
    - app/src/APPROVAL_POLICY.md

- product: Backend controller/service/middleware
  boundary: "backend/src/**"
  policies:
    - backend/src/APPROVAL_POLICY.md

- product: Migrazioni DB
  boundary: "database/migrations/**"
  policies:
    - database/migrations/APPROVAL_POLICY.md

- product: Script deploy/VPS e CI/CD
  boundary: "backend/scripts/deploy-**,backend/scripts/run-migration-*-vps.js,.github/workflows/**,database/scripts/**"
  policies:
    - "Mai approvazione automatica: tocca produzione, VPS o pipeline CI/CD. Sempre Request Reviewers, anche per diff di 1 riga."

- product: Default (qualunque path non elencato sopra)
  boundary: "**"
  policies:
    - APPROVAL_POLICY.md
