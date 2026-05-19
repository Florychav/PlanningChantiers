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

## J3.x — Suite (proposition d'ordre)

- [ ] **Fériés FR/GE dans `src/shared/dates.js`** : extraction calendrier
  legacy + tests fixtures dédiés.
- [ ] **Dynamic imports `jspdf` / `exceljs`** : charge à la demande dans
  les handlers d'export, bundle initial < 10 KB.
- [ ] **8 règles métier restantes** : cascade mère-filles, jaune-auto-J+2,
  fusion-etiquettes-consecutives, getMonteursEnSav, updateNoirTravauxSav,
  lignes communes Menétrey/Burgy (sync bidirectionnelle), etc.
- [ ] **Patch incrémental Realtime** : remplace le reload complet legacy.
  Suppose `originTag` + `updated_at` (cf. plan v2).
- [ ] **Compte Supabase test** `test-refonte@menetrey.local` (B2 Flory).
- [ ] **E2E Playwright** : 3-5 scénarios couvrant les règles converties.
- [ ] **Texte adaptatif labels mode light** : couleur de texte calculée
  selon luminance du fond (limite J2.4 documentée).
- [ ] **Migration `import.html`** vers bundle (~1-2j).
- [ ] **Storage event listener live** pour propagation thème
  cross-onglet/iframe sans reload (limite J2.4 / A19).
- [ ] **Bus 'theme-changed' relayé au legacy** quand UI legacy bundle.
