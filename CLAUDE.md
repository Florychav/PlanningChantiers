# CLAUDE.md — Planning Menétrey (refonte ESM bundle)

> Mémoire de contexte projet. À jour fin J2.4 (2026-05-19).
> Pour l'historique pre-refonte (legacy iframes, Batchfrigo design, etc.) : voir l'archive `Archive planning/OneDrive-pre-bascule-2026-05-18/CLAUDE.md` (hors repo).

## 🏗️ Architecture actuelle

- Repo : `Florychav/PlanningChantiers` sur GitHub
- Branche refonte : `refonte/esm-bundle` (pushed)
- Branche défaut prod : `Master` (GitHub Pages auto-deploy — **ne pas pusher** sans validation finale)
- Tag rollback : `legacy-pre-refonte` (sur commit `7febc70`, état pre-refonte)
- Working dir local : `/c/dev/Planning-web/` (HORS OneDrive)

### Layout repo
```
/c/dev/Planning-web/
├─ src/                       Bundle ESM (entry: src/main.js)
│  ├─ shared/                 bus.js, undo.js, theme.js, state.js, dates.js, ids.js
│  └─ relations/              verrou-noir.js, gris-installation.js, jaune-protocoleur.js, _utils.js
├─ tests/unit/                10 fichiers de tests, 140 tests verts
├─ tests/integration/         (vide — J3)
├─ tests/e2e/                 (vide — J3 Playwright)
├─ tests/fixtures/            (vide — J3)
├─ dist/                      bundle.js + .map + index.html (committed, servi par Pages)
├─ scripts/                   copy-static.mjs, verify-deps.mjs, check-wcag.mjs
├─ planning-montage.html      Legacy actif (3960 l. + 80 J2.4 theme exception A13)
├─ planning-sav.html          Legacy actif (2974 l. + 80 J2.4 theme exception A13)
├─ index.html, index-sav.html, import.html, planning.json, supabase-schema.sql  Legacy intacts
├─ J1_REPORT.md, J2_4_REPORT.md  Rapports d'étapes
├─ TESTING.md, TODO.md, README.md
├─ esbuild.config.mjs, vitest.config.mjs, playwright.config.mjs, tsconfig.json
└─ package.json, package-lock.json (committés)
```

## 🎯 Stack
- Bundle : esbuild (ESM, ES2020, sourcemap linked)
- Tests : Vitest (unit + jsdom) — Playwright prévu J3
- Type-check : tsc --noEmit + checkJs (JSDoc)
- Backend : Supabase (Postgres + Auth + Realtime)
- Dépendances runtime : @supabase/supabase-js, html2canvas, jspdf, xlsx (dynamic import prévu J3)

## ✅ État J2 (fermé fin J2.4)

| Item | Statut | Commit |
|---|---|---|
| J1 scaffold (toolchain, configs, dist/) | ✅ | `ab7d21a` |
| J2.1 Bus relations + 17 tests | ✅ | `5187c92` |
| J2.2 Undo skeleton + 27 tests | ✅ | `dedcb76` |
| J2.3 3 règles métier + utils + 61 tests | ✅ | `daa7791` |
| J2.4 Toggle thème (ESM + legacy A13) + 23 tests | ✅ | `be1039b`+`a439943`+`7e98313`+`8210ee3`+`d585420` |

**Total : 140 tests verts. Bundle 7.7 KB minifié. 7 commits sur refonte/esm-bundle.**

## ⚠️ Règles métier critiques (squelette J2.3)
- `verrou-noir` : `label.type=noir` => `verrouille:true`. `shouldAllowDelete()` pour validation pre-suppression.
- `gris-installation` : sync `dateDebut` des gris orphelins (sans `motherLabelId`) partageant `numeroInstallation` avec rouge/bleu/violet. Durée business-days préservée.
- `jaune-protocoleur` : création jaune monteur => linked jaune sur Protocoleur/TS libre (1 jour, dateFin). Resync update, cascade delete.
- Anti-cycle commun : `ctx.visited:Set<labelId:ruleId>` via `_utils.js`.
- 8 règles legacy restantes à convertir en J3 (cascade mère-filles, jaune-auto-J+2, sync lignes communes Menétrey/Burgy, getMonteursEnSav, updateNoirTravauxSav, fusion-etiquettes-consecutives, etc.).

## 🎨 Toggle thème (J2.4)
- Source de vérité ESM : `src/shared/theme.js` (12 tests)
- Source de vérité legacy : boot snippet `<head>` + `function toggleTheme()` + dialog HTML5
- Clé localStorage : `planning.theme` ('dark'|'light', défaut 'dark')
- Application : `document.documentElement.dataset.theme`
- Synchro Montage <-> SAV : via localStorage (reload-propage)
- Exception A13 scope-locked theme-only : ~80 lignes/fichier ajoutées dans les 2 HTML legacy, **aucune modif JS logique métier**
- WCAG AA validé par `npm run check:wcag` (14/14 checks pass)
- Q9 distinguabilité noir/jaune/gris en clair : tokens borders dédiés + règle `:root[data-theme="light"] .label-block { border-width:2px }`. Figeage snapshot Vitest.

## 🚧 Backlog J3
Détaillé dans `TODO.md`. Highlights :
- Dette sécu : `xlsx` → `exceljs` (CVE non patché upstream), bump `jspdf v4.2.1`, bump `vitest v4`
- Dynamic imports `jspdf`/`xlsx` (charge à la demande, réduit bundle initial)
- E2E Playwright avec compte Supabase `test-refonte@menetrey.local` (B2 en suspens)
- 8 règles métier restantes à convertir
- Patch incrémental Realtime
- Calendrier fériés FR/GE dans `dates.js`
- Texte interne aux labels en mode light (couleur adaptative selon bg) — limite J2.4 documentée
- Feature flags `legacy/new` par règle (quand UI legacy branchée sur ESM)
- Migration `import.html` vers bundle (~1-2j)
- Storage event listener live pour propagation thème cross-onglet/iframe sans reload

## 🔐 Constantes Supabase (NE PAS CHANGER)
```
SUPABASE_URL = 'https://nnkthgxbcslkhkdayjvg.supabase.co'
SUPABASE_KEY = 'sb_publishable_zX0P2GxSqIlh3Lqb_-PtCw_ydCahuhp'
```
Dupliquées dans 3 fichiers legacy (montage + SAV + import.html). À factoriser quand la UI legacy sera bundlée (J3+).

## 📐 Conventions code
- JSDoc + `// @ts-check` en tête de chaque module ESM
- Tests Vitest dans `tests/unit/` (et `tests/integration/` jsdom à venir)
- IDs : `generateId()` (crypto.randomUUID + fallback)
- Logs : `console.log` pour smoke main.js (sera remplacé par ring buffer J3)
- Commits conventionnels : `feat(j2.X):`, `chore(...):`, `docs(...):`, `test(...):`
- 1 chantier = 1 commit atomique (J2.X = 1 commit, sauf si commits granulaires demandés explicitement par PM comme J2.4)

## 🚀 Workflow
- Refonte : commits sur `refonte/esm-bundle`, push libre (ne déploie pas Pages)
- Push sur `Master` = INTERDIT jusqu'à validation bascule finale (déploie auto Pages)
- Avant bascule : tag confirmation + revue PM + tests E2E verts
- Rollback d'urgence : `git checkout legacy-pre-refonte -- planning-*.html index*.html import.html`

## 📌 Méthodologie active
AGENTS.md (autonomie + sub-agents + isoler-confirmer-2-fois + format rapport ✅/❌/🟡). Auto-mode activé.
