# Backlog refonte ESM

## J3.1 — Dette tech & sécurité ✅ (2026-05-19)

- [x] **xlsx → exceljs** : npm dep migrée vers `exceljs@4.4.0` (MIT, actif).
  CVE xlsx (prototype pollution + ReDoS) éliminée côté bundle ESM.
  Legacy HTML utilise toujours `XLSX` via CDN (à migrer quand UI legacy
  passe au bundle, cf. J3.x dynamic import + rewrite export Excel ESM).
- [x] **jspdf v4.2.1** : npm dep bumpée (semver major). dompurify
  transitive aussi remontée. Pas d'import jspdf dans le bundle pour
  l'instant (chargé via CDN par le legacy), donc pas de breaking
  change applicatif visible J3.1.
- [x] **vitest v4.1.6** + **@vitest/coverage-v8 v4** : devDep bumpée
  sans changement de config nécessaire. 140/140 tests verts.
- [x] **esbuild v0.28** : devDep bumpée pour fermer la dernière CVE
  modérée (dev server). Build OK.
- [x] **dompurify** : remontée automatiquement via bump jspdf.
- [x] **npm audit** : 0 vulnérabilités (était 8 avant J3.1).

## J3.2-J3.10 — Livré ✅ (2026-05-20, J3 figé — voir `J3_REPORT.md`)

- [x] **Fériés FR/GE dans `src/shared/dates.js`** : `FERIES_INFO` 2025-2027 + tests.
- [x] **Dynamic imports `jspdf` / `exceljs`** + code splitting esbuild (bundle ~15.6 KB).
- [x] **8 règles métier restantes** : 11/11 règles converties en ESM.
- [x] **Patch incrémental Realtime** : `realtime.js` `applyPatch` + `originTag`.
- [x] **`contrast.js` + `pickTextColor`** : utilitaire prêt (branchement render layer J4+).
- [x] **Storage event listener live** thème cross-onglet/iframe (J3.9).
- [x] **Rapport `J3_REPORT.md` + freeze J3** (J3.10).

## Reste à faire (post-J3)

- [ ] **Compte Supabase test** `test-refonte@menetrey.local` (B2 Flory) — bloque l'E2E.
- [ ] **J3.7 — E2E Playwright** : 3-5 scénarios couvrant les règles converties.
- [ ] **J3.8 — Migration `import.html`** vers bundle (~1-2j) — validation périmètre PM.
- [ ] **Texte adaptatif labels mode light** : brancher `pickTextColor` au render layer (J4).
- [ ] **Bus 'theme-changed' relayé au legacy** quand UI legacy bundlée.
- [ ] **J4 — Bascule UI legacy → bundle** (vrai render layer) — validation périmètre PM.
