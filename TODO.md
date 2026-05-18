# Backlog refonte ESM

## J3 — Dette tech & sécurité (priorisation J2 fin de semaine)

- [ ] **xlsx → exceljs** (CRITIQUE) : migrer l'export Excel vers `exceljs`
  (MIT, actif). Motivation : `xlsx@0.18.5` = CVE-2023-30533 (prototype
  pollution) + CVE-2024-22363 (ReDoS), aucun fix amont depuis passage
  SheetJS Pro payant. Tests d'integration export Excel a prevoir
  pour valider non-regression du format de sortie.
- [ ] **jspdf v4.2.1** : bump semver major (runtime, export PDF). Verifier
  API breaking changes vs v2.5.x.
- [ ] **vitest v4** : bump semver major (devDep, faible risque).
- [ ] **dompurify** : remontera automatiquement via bump jspdf.
