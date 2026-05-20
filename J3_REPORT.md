# J3 — Rapport (dette sécu, 8 règles métier, Realtime, contraste) — freeze J3

> 14 commits pushés sur `refonte/esm-bundle`, **292/292 tests verts**, typecheck OK, build OK, WCAG 14/14 OK, 0 CVE. Périmètre dev J3 figé : seuls **J3.7** (E2E Playwright) et **J3.8** (migration `import.html`) sont reportés — voir Go/No-Go.

---

## ✅ État global

| Item | Statut |
|---|---|
| J3.1 — Dette sécu : bumps deps + élimination CVE (8 → 0) | ✅ |
| J3.2 — Calendrier fériés FR/GE 2025-2027 dans `dates.js` | ✅ |
| J3.3 — Dynamic imports `jspdf`/`exceljs` + code splitting esbuild | ✅ |
| J3.4 — 8 règles métier ESM converties (7 sous-commits) | ✅ |
| J3.5 — Realtime patch incrémental (plus de reload complet) | ✅ |
| J3.6 — `contrast.js` + `pickTextColor` + factorisation `check-wcag` | ✅ |
| J3.9 — Sync live thème cross-onglet/iframe (storage event) | ✅ |
| 292 tests Vitest + typecheck + build (3/3 verts) | ✅ |
| Diff legacy `git diff legacy-pre-refonte..HEAD` < 100 lignes/fichier | ✅ ~84 lignes/fichier |
| `import.html` intact (diff vide vs tag) | ✅ |
| J3.7 — Playwright E2E | 🟡 **bloqué B2** |
| J3.8 — Migration `import.html` vers bundle | ⏳ **reporté — validation périmètre PM** |

## 📦 Inventaire par sous-jour

| Sous-jour | Commit | Livré | Tests ajoutés |
|---|---|---|---|
| J3.1 | `916e873` | xlsx→exceljs, jspdf v4, vitest v4, esbuild v0.28 ; npm audit 8→0 | — |
| J3.2 | `a95b572` | `FERIES_INFO` 42 entrées + API `isHoliday`/`getHolidayInfo`/`addBusinessDaysSkippingHolidays` | +33 |
| J3.3 | `a70aec0` | dynamic imports `jspdf`/`exceljs`, `splitting:true`, bundle initial ~15.6 KB | +6 |
| J3.4.1 | `6165bc5` | règle `fusion-etiquettes` + branchement | +14 |
| J3.4.2 | `feb7367` | règle `cascade-mere-filles` (delete) | +9 |
| J3.4.3 | `f2560ad` | règle `mere-filles-drag-sync` (moved) | +12 |
| J3.4.4 | `189f64f` | règle `jaune-auto-j2` (cascade) | +11 |
| J3.4.5+6 | `0e7581d`/`c81df11` | sélecteurs purs `lignes-communes` + `monteurs-en-sav` | +13 |
| J3.4.7 | `1120a22` | règle `noir-travaux-sav` cross-planning | +13 |
| J3.5 | `d3ecbb0` | `realtime.js` : `subscribeRealtime` + `applyPatch` incrémental | +19 |
| J3.6 | `48381be` | `contrast.js` : `pickTextColor`/ratio WCAG, factorisation `check-wcag` | +18 |
| J3.9 | `21c2d68` | storage event listener live (module + 2 HTML legacy) | +13 |

**Total : 14 commits J3 (dont 1 docs `a1b1300`), 140 → 292 tests (+152). 5565 insertions / 1500 suppressions vs clôture J2.**

## 🧠 Règles métier — 11/11 converties en ESM

`verrou-noir`, `gris-installation`, `jaune-protocoleur` (J2.3) + `fusion-etiquettes`, `cascade-mere-filles`, `mere-filles-drag-sync`, `jaune-auto-j2`, `lignes-communes` (sélecteur pur), `monteurs-en-sav` (sélecteur pur), `noir-travaux-sav` (J3.4). Anti-cycle commun via `ctx.visited:Set<labelId:ruleId>`.

**Hors scope J3.4 (annoncé, non régressé) :**
- `gris-auto` (création auto gris monteur sur rouge/bleu/violet) — nécessite UI confirm + sélection équipe. À traiter au bundlage UI legacy.
- Cascade transitive mère→filles→petites-filles (la cascade descend 1 niveau).

## 📊 Bundle, tests, build

| Mesure | Valeur |
|---|---|
| `dist/bundle.js` (entrée initiale) | 15.6 KB |
| Chunks dynamiques | jspdf / exceljs / html2canvas chargés à la demande |
| Tests Vitest | 292 verts (20 fichiers) |
| `tsc --noEmit` | OK |
| `npm run build` | OK |
| `npm run check:wcag` | 14/14 OK |
| `npm audit` | 0 vulnérabilité |

## 🧠 Décisions J3 (suite A22)

| # | Décision | Justification |
|---|---|---|
| **A23** | `addBusinessDays` legacy (lun-ven seul) **préservé** à côté de `addBusinessDaysSkippingHolidays` | Les règles J2.3 reposent sur la sémantique lun-ven. Réévaluation règle par règle si besoin, pas de changement silencieux. |
| **A24** | Année hors plage 2025-2027 dans `dates.js` → **lève une erreur** | Force une extension explicite du calendrier fériés plutôt qu'un calcul faux silencieux. |
| **A25** | `lignes-communes` et `monteurs-en-sav` = **sélecteurs purs**, pas des règles réactives | Ce sont des dérivations d'état (lecture), pas des cascades. Évite des emits bus inutiles. |
| **A26** | Realtime `applyPatch` **n'émet pas sur le bus** | Les cascades sont déjà parties côté émetteur ; rejouer = double application. Callback `onPatchApplied` pour l'observabilité sans couplage. |
| **A27** | Anti-écho Realtime via `originTag` (cherché dans `body.originTag` et `body.data.originTag`) | Évite qu'un client réapplique son propre patch. |
| **A28** | `pickTextColor` (`contrast.js`) **non branché au rendu** en J3 | Le render layer legacy n'est pas encore bundlé. Branchement prévu J4 (bascule UI). |
| **A29** | J3.9 storage event = **+2 lignes/fichier legacy** sous l'exception A13 | Lève la limite A19 (synchro par reload) sans toucher le JS métier. Diff legacy total ~84 lignes/fichier (< 100). |

## ⛔ Blockers actifs

| ID | Titre | Statut | Action |
|---|---|---|---|
| **B2** | Compte Supabase `test-refonte@menetrey.local` | 🟡 **Ouvert** | Dashboard Supabase, rôle editor (voir `TESTING.md`). Bloque J3.7 E2E. |
| **B6** | 4 captures écran J2.4 (Montage/SAV × dark/clair) | 🟡 **Ouvert** | Mode opératoire dans `J2_4_REPORT.md`. Clôture visuelle J2. |

## 🚦 Go/No-Go — freeze J3

🟢 **J3 figé** : périmètre dev livré et vert. Reste reporté :
1. **J3.7** — E2E Playwright (3-5 scénarios sur règles converties) — **bloqué B2**.
2. **J3.8** — Migration `import.html` vers bundle (~1-2j) — **demande validation de périmètre PM** avant lancement.

🛣️ **Suite proposée**
- Débloquer **B2** (création compte test, ~5 min) → enchaîner **J3.7**.
- Trancher le périmètre **J3.8** (migration `import.html`) : maintenant, ou avec **J4** (bascule UI legacy → bundle, vrai render layer + branchement `pickTextColor`).

## 🎯 Lecture < 2 min ?
Oui. Sinon, dis-le-moi, je condense la prochaine fois.
