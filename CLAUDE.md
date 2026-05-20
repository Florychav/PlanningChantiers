# CLAUDE.md — Planning Menétrey (refonte ESM bundle)

> Mémoire de contexte projet. À jour fin J3.10 — **J3 figé** (2026-05-20).
> Rapport de clôture : `J3_REPORT.md`.
> Pour l'historique pre-refonte : voir l'archive `Archive planning/OneDrive-pre-bascule-2026-05-18/CLAUDE.md` (hors repo).

## 🏗️ Architecture actuelle

- Repo : `Florychav/PlanningChantiers` sur GitHub
- Branche refonte : `refonte/esm-bundle` (pushed, à jour)
- Branche défaut prod : `Master` (GitHub Pages auto-deploy — **ne pas pusher** sans validation finale)
- Tag rollback : `legacy-pre-refonte` (sur commit `7febc70`, état pre-refonte)
- Working dir local : `/c/dev/Planning-web/` (HORS OneDrive)

### Layout repo
```
/c/dev/Planning-web/
├─ src/                       Bundle ESM (entry: src/main.js, ~14 KB minifié)
│  ├─ shared/                 bus, undo, theme, state, dates, ids, contrast,
│  │                          realtime, export-pdf, export-excel
│  └─ relations/              11 règles : verrou-noir, gris-installation,
│                             jaune-protocoleur, fusion-etiquettes,
│                             cascade-mere-filles, mere-filles-drag-sync,
│                             jaune-auto-j2, lignes-communes (sel),
│                             monteurs-en-sav (sel), noir-travaux-sav, _utils
├─ tests/unit/                20 fichiers, 292 tests verts
├─ tests/integration/         (vide — J3+)
├─ tests/e2e/                 (vide — J3.7 Playwright, bloqué B2)
├─ dist/                      bundle.js + chunks dynamiques + .map (commités)
├─ scripts/                   copy-static, verify-deps, check-wcag
├─ planning-montage.html      Legacy actif (+80 lignes A13 theme exception)
├─ planning-sav.html          Legacy actif (+80 lignes A13)
├─ index.html, index-sav.html, import.html, planning.json, supabase-schema.sql  Legacy intacts
├─ J1_REPORT.md, J2_4_REPORT.md
├─ TESTING.md, TODO.md, README.md, CLAUDE.md
├─ esbuild.config.mjs (splitting:true), vitest.config.mjs, playwright.config.mjs, tsconfig.json
└─ package.json, package-lock.json (commités)
```

## 🎯 Stack
- Bundle : esbuild v0.28 (ESM, ES2020, sourcemap linked, **code splitting actif**)
- Tests : Vitest v4 (unit + jsdom) — Playwright prévu J3.7
- Type-check : tsc --noEmit + checkJs (JSDoc)
- Backend : Supabase (Postgres + Auth + Realtime)
- Deps runtime : @supabase/supabase-js, html2canvas, jspdf v4 (dyn import),
  exceljs v4 (dyn import, ex-xlsx CVE)
- **npm audit : 0 vulnérabilités** (post J3.1)

## ✅ État (J2 fermé, J3 partiel)

| Jour | Statut | Commit head |
|---|---|---|
| J1 scaffold | ✅ | `ab7d21a` |
| J2.1 Bus relations + 17 tests | ✅ | `5187c92` |
| J2.2 Undo skeleton + 27 tests | ✅ | `dedcb76` |
| J2.3 3 règles + utils + 61 tests | ✅ | `daa7791` |
| J2.4 Toggle thème (5 commits) | ✅ | `1d4808b` |
| **J3.1** dette sécu (deps bumps, 0 CVE) | ✅ | `916e873` |
| **J3.2** fériés FR/GE 2025-2027 + 33 tests | ✅ | `a95b572` |
| **J3.3** dynamic imports jspdf/exceljs + splitting | ✅ | `a70aec0` |
| **J3.4** 8 règles métier (7 sous-commits) | ✅ | `1120a22` (last) |
| **J3.5** Realtime patch incrémental + 19 tests | ✅ | `d3ecbb0` |
| **J3.6** contrast.js + pickTextColor + 17 tests | ✅ | `48381be` |
| **J3.9** storage event live sync thème | ✅ | `21c2d68` |
| **J3.10** Rapport `J3_REPORT.md` + freeze J3 | ✅ | (ce commit) |
| **J3.7** Playwright E2E | 🟡 **bloqué B2** | — |
| **J3.8** Migration `import.html` vers bundle | ⏳ **reporté — validation périmètre PM** | — |

**Total : 292 tests verts. Bundle initial ~15.6 KB. 0 CVE. J3 figé (voir `J3_REPORT.md`).**

## 🧠 Règles métier ESM (11 règles)

| Règle | Fichier | Type | Origine audit |
|---|---|---|---|
| verrou-noir | `src/relations/verrou-noir.js` | reactive | montage L.2932 |
| gris-installation | `gris-installation.js` | reactive | montage L.2826 |
| jaune-protocoleur | `jaune-protocoleur.js` | reactive (cascade) | montage L.2857 |
| fusion-etiquettes | `fusion-etiquettes.js` | reactive | montage L.2700 |
| cascade-mere-filles | `cascade-mere-filles.js` | reactive (delete) | montage L.2897 |
| mere-filles-drag-sync | `mere-filles-drag-sync.js` | reactive (moved) | montage L.1876 |
| jaune-auto-j2 | `jaune-auto-j2.js` | reactive (cascade) | montage L.2666 |
| lignes-communes | `lignes-communes.js` | **selector pur** | sav L.1011 |
| monteurs-en-sav | `monteurs-en-sav.js` | **selector pur** | sav L.1035 |
| noir-travaux-sav | `noir-travaux-sav.js` | reactive cross-planning | sav L.2038 |

**Hors scope J3.4 (annoncé) :**
- `gris-auto` (création auto gris monteur lors d'un rouge/bleu/violet) — nécessite UI confirm + sélection équipe. À faire avec bundlage UI legacy.
- Cascade transitive mère→filles→petites-filles (cascade descend 1 niveau).

**Anti-cycle commun** : `ctx.visited:Set<labelId:ruleId>` via `_utils.js`.

## 🎨 Toggle thème (J2.4 + J3.9)
- Source de vérité ESM : `src/shared/theme.js` (16 tests : 12 J2.4 + 4 J3.9)
- API : `getTheme`, `setTheme`, `toggleTheme`, `subscribeTheme`, `applyStoredTheme`, `setupStorageSync`
- Source de vérité legacy : boot snippet `<head>` + handlers + dialog HTML5 + storage event listener (J3.9)
- Clé localStorage : `planning.theme` ('dark'|'light', défaut 'dark')
- Synchro Montage <-> SAV : **live cross-onglet/iframe** via storage event (J3.9), pas de reload requis
- Exception A13 scope-locked theme-only : ~80 lignes/fichier (sous 100), aucune modif JS métier
- WCAG AA : `npm run check:wcag` 14/14 OK
- Q9 distinguabilité : tokens borders dédiés + `.label-block { border-width:2px }` mode light. Snapshot Vitest.
- **Texte adaptatif labels mode light** : utility `src/shared/contrast.js` `pickTextColor(bgHex)` prêt à brancher au render layer (J4+).

## ⚡ Realtime (J3.5)
- `src/shared/realtime.js` : `subscribeRealtime(client, store, opts)` + `applyPatch(store, table, payload, ownTag)` exporté
- INSERT push / UPDATE replace / DELETE splice — pas de reload complet
- Anti-écho via `originTag` (cherche dans `body.originTag` et `body.data.originTag`)
- **Pas d'emit bus** sur patch : les cascades sont parties côté émetteur, replay = double application
- Callback `onPatchApplied` pour observability sans couplage bus

## 📅 Calendrier fériés (J3.2)
- `src/shared/dates.js` étendu : `FERIES_INFO` (Frozen, 42 entrées 2025-2027)
- API : `isHoliday(iso, canton?)`, `getHolidayInfo(iso)`, `isWorkingDayExcludingHolidays(d, canton?)`, `addBusinessDaysSkippingHolidays(iso, n, canton?)`
- Année hors plage = lève (force extension explicite)
- `addBusinessDays` ancien (lun-ven seul) **préservé** — J2.3 règles continuent avec cette sémantique. Réévaluation par règle si besoin.

## 🔐 Constantes Supabase (NE PAS CHANGER)
```
SUPABASE_URL = 'https://nnkthgxbcslkhkdayjvg.supabase.co'
SUPABASE_KEY = 'sb_publishable_zX0P2GxSqIlh3Lqb_-PtCw_ydCahuhp'
```
Dupliquées dans 3 fichiers legacy (montage + SAV + import.html). À factoriser quand UI legacy bundlée.

## 📐 Conventions code
- JSDoc + `// @ts-check` en tête de chaque module ESM
- Tests Vitest dans `tests/unit/`
- IDs : `generateId()` (crypto.randomUUID + fallback)
- Commits conventionnels : `feat(j3.X):`, `chore(...):`, `docs(...):`, `fix(...):`
- 1 chantier = 1 commit atomique (sauf granularité explicite demandée comme J2.4 ou J3.4.x)
- Dynamic imports pour les grosses libs (jspdf, exceljs) — chunks séparés

## 🚀 Workflow
- Refonte : commits sur `refonte/esm-bundle`, push libre (ne déploie pas Pages)
- Push sur `Master` = INTERDIT jusqu'à validation bascule finale
- Avant bascule : tag + revue PM + tests E2E verts
- Rollback d'urgence : `git checkout legacy-pre-refonte -- planning-*.html index*.html import.html`

## 📌 Méthodologie active
AGENTS.md (autonomie + sub-agents + isoler-confirmer-2-fois + format rapport ✅/❌/🟡). Auto-mode activé. PM demande enchaînement auto si pas de blocker → STOP uniquement sur B2 (Supabase test account) ou gros chantier J3.8.

## ⛔ Blockers actifs

| ID | Item | Action |
|---|---|---|
| **B2** | Compte Supabase `test-refonte@menetrey.local` à créer | Dashboard Supabase, role editor, voir TESTING.md. Bloque J3.7 E2E. |
| **B6** | 4 captures écran J2.4 (Montage/SAV × dark/clair) | Mode op dans `J2_4_REPORT.md`. Bloque clôture officielle J2 visuelle. |

## 🛣️ Prochaines étapes (proposition)

| # | Item | Effort | Bloqué ? |
|---|---|---|---|
| J3.7 | Compte Supabase + E2E Playwright | ~2h | **B2 Flory** |
| J3.8 | Migration `import.html` vers bundle | 1-2j | Validation scope PM |
| J3.10 | Rapport `J3_REPORT.md` + freeze J3 | 30 min | — |
| J4 | Bascule UI legacy → bundle (vrai render layer) | 3-5j | Validation scope PM |

**Reprise post-/clear** : lire ce fichier + `J3_REPORT.md` + `TODO.md`. État repo : `git log --oneline -25` depuis `refonte/esm-bundle`. **J3 figé** — prochaine décision : débloquer B2 (→ J3.7 E2E) et trancher le périmètre J3.8 (migration `import.html`, à faire seul ou couplé à J4).
