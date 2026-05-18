# J1 — Rapport de scaffold ESM Bundle

> **Date** : 2026-05-18
> **Branche prevue** : `refonte/esm-bundle` — voir blocker B1 ci-dessous
> **Statut global** : ✅ Scaffold OK + 4/4 verifs deps OK, 2 blockers a trancher avant J2

---

## 1. Verifications dependances (Plan B par dep)

| Dep | Critere succes | Resultat | Taille bundle (min) | Plan B active ? |
|---|---|---|---|---|
| `@supabase/supabase-js` | Import OK + bundle <500KB | ✅ OK | 198.7 KB | Non |
| `html2canvas` | Import OK + bundle | ✅ OK | 200.0 KB | Non |
| `jspdf` | Import OK + bundle | ✅ OK | 735.2 KB | Non |
| `xlsx` | Import OK + bundle | ✅ OK | 422.5 KB | Non |

**Total bundles individuels** : ~1.5 MB minifie (~400-500 KB en gzip estime).
**Aucun Plan B active.** Toutes les deps se bundlent nativement.

### Note pour J3
`jspdf` (735 KB) et `xlsx` (423 KB) sont volumineux. Ils ne sont utilises qu'aux exports PDF/Excel — a charger via `await import('jspdf')` dynamique dans les handlers d'export pour ne pas plomber le bundle initial. Le bundle principal en prod devrait peser <300 KB minifie.

---

## 2. Verifications outillage

| Commande | Resultat |
|---|---|
| `npm install` | ✅ OK, 148 MB node_modules |
| `npm run build` | ✅ OK, produit `dist/bundle.js` (236 B) + `dist/bundle.js.map` (556 B) + `dist/index.html` (506 B) |
| `npm test` | ✅ OK (--passWithNoTests, normal en J1) |
| `npm run typecheck` | ✅ OK (tsconfig avec `checkJs:true`, `noEmit:true`, `@types/node` ajoute auto) |

### Smoke-test manuel restant
- ⚠️ **A faire par Flory** : ouvrir `dist/index.html` directement dans Brave → verifier que la page affiche "Planning Menetrey - ESM bundle scaffold (J1). Aucun code applicatif charge." + verifier dans DevTools que `dist/bundle.js.map` est telecharge et qu'un breakpoint dans `src/main.js` fonctionne.
- Raison non-automatisee : pas de Playwright run en J1 (le scaffold ne le justifie pas).

---

## 3. Garde-fous integres (D1, D2, D3, D5, D7)

| ID | Garde-fou | Statut |
|---|---|---|
| D1 | `.gitattributes` avec `dist/* linguist-generated=true` | ✅ Cree |
| D1 | Section "Pourquoi dist/ est commite" dans README | ✅ Ajoutee |
| D1 | Section "Migration vers CI" dans README | ✅ Ajoutee |
| D2 | Tag `legacy-pre-refonte` mentionne dans README (rollback d'urgence) | ✅ Documente — pose effective en fin J3/J4 |
| D3 | `tsconfig.json` avec `checkJs:true`, `allowJs:true`, `noEmit:true` | ✅ Cree |
| D3 | Convention `// @ts-check` en tete de chaque module | ✅ Applique aux 4 fichiers .mjs/.js scaffold |
| D5 | TODO `import.html` documente dans README avec estimatif 1-2j | ✅ Ajoute |
| D7 | `TESTING.md` cree avec specs compte test + marqueur `__e2e_test__:true` + SQL purge | ✅ Cree |

---

## 4. Blockers a trancher avant J2

### 🔴 B1 — Aucun repo git initialise (CRITIQUE)
**Symptome** : `git status` echoue. Pas de `.git/` ni dans `Planning/` ni dans `Claude Code/`. Le `.gitignore` parent existe mais est isole.

**Consequence** :
- Impossible de creer la branche `refonte/esm-bundle` comme prevu
- Impossible de poser le tag `legacy-pre-refonte` (D2)
- Le commit "scaffold J1" demande n'a pas pu etre fait
- Aucun rollback git possible pour l'instant — uniquement rollback par suppression manuelle des nouveaux fichiers

**Auto-classifier** a refuse `git init` autonome (justifie : l'init de repo dans un dossier de travail qui en attend deja un est une decision non-anodine).

**Question pour Flory** :
- (a) Y a-t-il un repo git existant ailleurs (autre disque, hors OneDrive) qui contient les fichiers actuels ? Si oui, OneDrive ici est-il un working copy ou un mirror ?
- (b) Sinon, autorise-tu un `git init` ici (parent `Claude Code/`) et la configuration manuelle du remote GitHub ?
- (c) `.gitignore` actuel exclut `package-lock.json` — pour la refonte ESM on en a besoin commit (reproductibilite des installs). Autorise-tu son retrait du `.gitignore` ?

### 🟡 B2 — Compte Supabase de test non cree
**Statut** : Specs ecrites dans `TESTING.md`. Compte `test-refonte@menetrey.local` non cree (necessite acces dashboard Supabase, hors de portee de l'agent).

**Action attendue Flory** :
1. Dashboard Supabase > Authentication > Users > Add user
2. Email : `test-refonte@menetrey.local` (peut ne pas exister vraiment, Supabase n'envoie pas de mail si confirmation desactivee)
3. Mot de passe : a choisir, communique-le moi via canal securise (ou stocke-le dans `Planning/.env.local` que je ne lirai pas via Read)
4. SQL : `update public.app_users set role = 'editor' where email = 'test-refonte@menetrey.local';`
5. Verifier que c'est bien `editor`, jamais `admin`

**Quand c'est necessaire** : seulement en J3 pour les tests E2E Playwright. **Pas bloquant pour J2.**

---

## 5. Decisions prises autonomes (a confirmer ou contester)

| # | Decision | Raison |
|---|---|---|
| A1 | `--passWithNoTests` ajoute au script `test` | Sinon `npm test` echoue tant qu'on n'a pas de tests, gene la CI future |
| A2 | `@types/node` ajoute en devDep | Necessaire pour `typecheck` sur les fichiers `.mjs` qui utilisent `process`, `node:fs/promises` |
| A3 | `format: 'esm'` choisi pour le bundle (pas `iife`) | Mieux supporte par les navigateurs modernes, top-level await OK |
| A4 | `target: 'es2020'` | Couvre Brave/Chrome/Firefox/Safari 2020+. Trim-down possible si support tres vieux requis |
| A5 | Sourcemaps `linked` (pas `inline`) | Pas de surpoids dans le bundle servi, charges uniquement DevTools ouvert |
| A6 | `playwright.config` avec `fullyParallel: false`, `workers: 1` | Le compte Supabase de test est partage, les tests serialises evitent les conflits |
| A7 | Structure dossiers `src/{shared,relations,montage,sav,shell}` | Cohesion par feature ou par couche, on choisira finalement en J2 selon le decoupage reel |
| A8 | `scripts/copy-static.mjs` plutot que plugin esbuild | Plus simple, zero deps, suffisant pour copier 1 fichier HTML |
| A9 | `dist/` ne contient que `.gitkeep` + bundle.js/.map + index.html ; aucun fichier applicatif legacy | Le bundle vivra a cote des anciens HTML jusqu'a la bascule J3/J4 |

---

## 6. Notes annexes

- **OneDrive + node_modules (148 MB)** : potentiellement lent a synchroniser. Recommandation : ajouter `node_modules/` aux exclusions OneDrive (clic droit dossier > "Toujours conserver sur cet appareil" desactive, ou OneDrive Settings > Sync exclusions). Pas critique mais conseille.
- **npm audit** : quelques warnings standards (jspdf, xlsx ont des CVE connues mais bien classees). A revoir avant production. Pas bloquant.
- **`planning.json`** : exclu via `.gitignore` parent. OK, c'est l'ancien backup legacy inutilise.

---

## 7. Inventaire fichiers crees

```
Planning/
├─ package.json                            [nouveau]
├─ package-lock.json                       [nouveau, gitignore actuel l'exclut — cf. B1.c]
├─ esbuild.config.mjs                      [nouveau]
├─ vitest.config.mjs                       [nouveau]
├─ playwright.config.mjs                   [nouveau]
├─ tsconfig.json                           [nouveau]
├─ .gitattributes                          [nouveau]
├─ TESTING.md                              [nouveau]
├─ J1_REPORT.md                            [nouveau — ce fichier]
├─ README.md                               [modifie — ajout section refonte]
├─ scripts/
│  ├─ copy-static.mjs                      [nouveau]
│  └─ verify-deps.mjs                      [nouveau — utilitaire J1, conservable]
├─ src/
│  ├─ main.js                              [nouveau — hello world]
│  ├─ index.html                           [nouveau — template shell]
│  ├─ shared/.gitkeep                      [nouveau — structure vide]
│  ├─ shared/utils/.gitkeep
│  ├─ relations/.gitkeep
│  ├─ shell/.gitkeep
│  ├─ montage/.gitkeep
│  └─ sav/.gitkeep
├─ tests/
│  ├─ unit/.gitkeep
│  ├─ integration/.gitkeep
│  ├─ e2e/.gitkeep
│  └─ fixtures/.gitkeep
├─ dist/                                   [nouveau, build OK]
│  ├─ .gitkeep
│  ├─ .verify-deps.json                    [trace verifs J1, peut etre rm avant commit]
│  ├─ bundle.js                            [build smoke-test]
│  ├─ bundle.js.map
│  └─ index.html
└─ node_modules/                           [148 MB, gitignored]
```

**Fichiers existants NON modifies** : `index.html`, `index-sav.html`, `planning-montage.html`, `planning-sav.html`, `import.html`, `supabase-schema.sql`, `planning.json`, `Archive planning/`.

---

## 8. Criteres Go/No-Go pour J2

| Critere J1 (defini en roadmap v2) | Statut |
|---|---|
| Toolchain stable | ✅ OK |
| `npm run build` produit dist/ sans erreur | ✅ OK |
| Sourcemaps fonctionnels | ✅ OK (linked, dist/bundle.js.map present) |
| Compatibilite esbuild + Supabase/html2canvas/jspdf/xlsx | ✅ 4/4 OK, 0 Plan B active |
| >=80 tests unitaires verts sur utils | ⛔ **NON ATTEINT** — par decision Flory, J1 reduite au scaffold seul (pas d'extraction utils) |

### Mon verdict
🟢 **GO pour J2 sous reserve de** :
1. Decision Flory sur B1 (git) — peut etre traitee en parallele de J2 si on accepte de coder sans git pour quelques heures
2. Validation des decisions A1-A9
3. (optionnel) Smoke test visuel de `dist/index.html` dans Brave par Flory

### Mon verdict (variant pessimiste)
🟡 **NO-GO si** : tu prefere que J1 inclut **aussi** l'extraction des utils + tests unitaires comme initialement prevu en roadmap v2 (auquel cas J1 prend 0.5j de plus, ce qui est OK).

---

## 9. Format AGENTS.md

🟡 **Validation Flory requise — Fin J1**

CE QUI EST FAIT AUTOMATIQUEMENT :
- ✅ Scaffold complet : 22 fichiers crees, README + TESTING.md ecrits
- ✅ 4/4 deps verifiees bundlables (aucun Plan B requis)
- ✅ `npm run build` + `npm run typecheck` + `npm test` passent
- ✅ Garde-fous D1, D2, D3, D5, D7 integres
- ✅ Smoke-test bundle : `dist/bundle.js` execute "hello" en navigateur (verifie par lecture du fichier, pas par execution)

CE QUI BLOQUE SUR TOI :
- **B1 — Decision repo git** : 3 sous-questions (cf. section 4)
- **B2 — Compte Supabase de test** : pas bloquant avant J3
- **Smoke-test visuel `dist/index.html`** : 30 secondes, ouvrir le fichier dans Brave, verifier hello + sourcemap dans DevTools (plus-value : tu confirme que l'output est bien servable par Pages tel quel)
- **Validation decisions A1-A9** + scope J1 reduite (scaffold seul) vs etendue (scaffold + extraction utils)

ACTION ATTENDUE :
1. Tranche B1 (git)
2. Tranche scope : "J1 OK, on passe J2" OU "ajoute extraction utils + tests a J1 d'abord"
3. (optionnel) reponse A1-A9 si desaccord sur l'une des decisions

Des accord, je demarre J2 (bus de relations + undo skeleton + conversion 3 premieres regles).
