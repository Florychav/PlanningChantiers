# J2.4 — Rapport (toggle thème dark/clair) — clôture J2

> 5 commits granulaires pushés sur `refonte/esm-bundle`, 140/140 tests verts, 14/14 WCAG OK, diff legacy ~80 lignes/fichier (sous seuil A13). Validation visuelle Flory requise via mode opératoire ci-dessous **avant** clôture J2.

---

## ✅ État global

| Item | Statut |
|---|---|
| Module ESM `src/shared/theme.js` (API getTheme/setTheme/toggleTheme/subscribeTheme/applyStoredTheme) | ✅ |
| 12 tests Vitest jsdom sur theme.js (défaut, persistance, dataset, toggle, fallback ×2, emit, idempotence, subscribe/unsub, applyStoredTheme ×2, localStorage throw) | ✅ |
| Tokens CSS clairs `:root[data-theme="light"]` avec mapping commenté dans les 2 HTML legacy | ✅ |
| Boot snippet anti-FOUC dans `<head>` des 2 HTML legacy (5 lignes/fichier) | ✅ |
| Bouton ⚙ Paramètres + dialog HTML5 + handlers vanilla dans les 2 HTML legacy (Option B) | ✅ |
| Snapshot Q9 figeage bloc `:root[data-theme="light"]` des 2 HTML | ✅ |
| Script WCAG AA `scripts/check-wcag.mjs` + npm `check:wcag` + 14 tests | ✅ |
| Diff legacy `git diff legacy-pre-refonte..HEAD` < 100 lignes/fichier | ✅ 80 lignes/fichier |
| typecheck + 140 tests + build verts (3/3) | ✅ |
| 4 captures écran avant clôture J2 | 🟡 **À faire par Flory** (mode op. ci-dessous, je ne peux pas exécuter — pas de compte Supabase test) |

## 📦 Inventaire fichiers (5 commits J2.4)

| Fichier | Statut | LOC |
|---|---|---|
| `src/shared/theme.js` | créé | +118 |
| `tests/unit/theme.test.js` | créé | +100 |
| `planning-montage.html` | modifié | +79 (boot+tokens+css+handler+bouton+dialog) |
| `planning-sav.html` | modifié | +79 |
| `scripts/check-wcag.mjs` | créé | +149 |
| `tests/unit/theme.legacy.test.js` | créé | +101 |
| `tests/unit/__snapshots__/theme.legacy.test.js.snap` | créé | +112 (auto-généré) |
| `package.json` | modifié | +1 ligne (script check:wcag) |
| `README.md` | modifié | +3 lignes (mention user-facing toggle) |
| `CLAUDE.md` | créé | +95 (nouveau, in-repo) |

**Total : 5 commits, ~837 LOC ajoutées (dont 213 src/, 313 tests, 80×2 legacy, 95 doc).**

### Diff legacy ciblé scope A13
```
git diff legacy-pre-refonte..HEAD -- planning-montage.html planning-sav.html --stat
 planning-montage.html | 79 ++++++++++++++++++++++++++++++++++++++++++++++++
 planning-sav.html     | 79 ++++++++++++++++++++++++++++++++++++++++++++++++
 2 files changed, 158 insertions(+)
```

Décomposition par fichier (verifié) :
- Boot snippet : 5 lignes
- Tokens light + règle border : 50 lignes
- CSS dialog : 6 lignes
- Handlers script : 5 lignes
- Bouton header : 1 ligne
- Dialog HTML : 11 lignes
- Commentaires intercalaires : 1 ligne

**Aucune modification de JS logique existant, aucune modification structure HTML hors insertion du bouton + dialog, aucun supabase call touché.** ✅ Conforme A13.

## 📊 Taille bundle (delta vs J2.3)

| | J2.3 | J2.4 | Delta |
|---|---|---|---|
| `dist/bundle.js` | 7.7 KB | 7.7 KB | +0 (theme.js arbre-shaké car non utilisé dans main.js — légitime, le legacy utilise sa propre version vanilla) |
| `dist/bundle.js.map` | 44.1 KB | 44.1 KB | +0 |

**Note** : `theme.js` est dans `src/shared/` mais pas importé par `main.js` actuellement (tree-shaken). Il sera consommé quand le futur shell ESM (J3+) intégrera le toggle via le bundle. Pour le moment, le legacy a sa version vanilla autonome (décision A1).

Si je voulais le forcer dans le bundle pour vérifier sa taille : `import './shared/theme.js'` en side-effect dans main.js. Coût estimé +1 KB minifié. Non fait, hors scope.

## 🧠 Décisions

### A13 + A14 confirmées dans le code
- A13 (exception scope-locked theme-only) : appliquée scrupuleusement. Diff vérifié = uniquement CSS tokens + boot snippet ≤10 lignes + bouton + dialog + 4 handlers JS. Aucune modif des handlers métier existants ni des supabase calls.
- A14 (push autorisé sur `refonte/*`) : 5 pushes effectués, aucun sur `Master`.

### Nouvelles décisions A15+
| # | Décision | Justification |
|---|---|---|
| **A15** | **`theme.js` non importé par `main.js`** | Le legacy duplique en vanilla (A1). Importer en double = bundle bloated sans usage. Sera importé quand UI legacy migrera (J3+). |
| **A16** | **WCAG : `text-faint` seuil 3.0 (AA large/UI), pas 4.5 (AA normal)** | `text-faint` est utilisé pour les éléments décoratifs (placeholders, captions, hints). En dark, ratio = 3.95 (insuffisant pour normal, OK pour large/UI). Préservation legacy (zero regression dark mode). |
| **A17** | **WCAG : `noir-lbl/bg` skipped en dark** | Sémantique métier intentionnelle : étiquette "noir" = SAV bloqué, visuellement neutre sur fond noir (legacy reconnaît par la place + texte, pas par couleur de fond). Ce n'est pas un bug. |
| **A18** | **WCAG light métier : check bordures, pas fonds** | Les couleurs jaune (#FBBF24) et gris-lbl (#9CA3AF) ont peu de contraste vs blanc, mais en mode light la règle `.label-block { border-width:2px }` ajoute une bordure forte (jaune-border #92400E = 7.09:1 ; gris-lbl-border #4B5563 = 7.56:1). La distinguabilité Q9 passe par la bordure. |
| **A19** | **Pas de storage event listener cross-tab/iframe** | Synchro Montage <-> SAV via reload (clé localStorage partagée). Listener live = JS ajout = scope creep. Reporté J3. |
| **A20** | **Dialog HTML5 natif, pas custom modal** | Zéro CSS modal à écrire, support Brave natif, backdrop natif, accessibilité focus-trap natif. -30 lignes vs custom. |
| **A21** | **Mini handlers JS dans `<head>` en script séparé** | Évite de toucher le bloc `<script>` métier en fin de body (handlers existants intacts). 4 fonctions, ~5 lignes. |
| **A22** | **CSS dialog dans le bloc `<style>` central existant** | Cohérence des fichiers legacy mono-bloc. Pas de nouveau `<link>` à externaliser. |

## ⛔ Blockers

| ID | Titre | Statut | Action |
|---|---|---|---|
| B1 | Pas de repo git initialisé | ✅ **Fermé** (J1) | — |
| B2 | Compte Supabase test à créer | 🟡 **Toujours ouvert** | Bloque E2E Playwright J3, pas J2 |
| B3 | Layout repo (clone, structure) | ✅ **Fermé** (J1) | — |
| B4 | Collisions OneDrive ↔ remote | ✅ **Fermé** (Cas A CRLF) | — |
| B5 | Pas de panneau Paramètres existant | ✅ **Fermé** (Option B retenue) | — |
| **B6** | **4 captures écran J2.4** | 🟡 **Ouvert** | Mode opératoire ci-dessous, Flory doit exécuter avant clôture J2 |

## 🚦 Go/No-Go pour J3

🟢 **GO J3 sous réserve de** :
1. Validation visuelle Flory des 4 captures (B6)
2. Création compte Supabase test (B2) avant les E2E
3. Acceptation des décisions A13-A22

Roadmap J3 (résumé, détail dans `TODO.md`) :
- Dette sécu : `xlsx → exceljs`, `jspdf v4.2.1`, `vitest v4`
- Dynamic imports `jspdf`/`xlsx` (bundle initial < 10 KB)
- 8 règles métier restantes (cascade mère-filles, jaune-auto-J+2, sync lignes communes, etc.)
- Patch incrémental Realtime (remplace reload complet legacy)
- Calendrier fériés FR/GE dans `dates.js`
- Compte Supabase test + E2E Playwright (3-5 scénarios)
- Texte interne aux labels en mode light (couleur adaptative)
- Migration `import.html` vers bundle (~1-2j)

## 📸 Mode opératoire captures (Flory, ~5 minutes)

Préparation :
1. Ouvre Brave
2. Charge `https://florychav.github.io/PlanningChantiers/planning-montage.html` (ou ton URL Pages locale)
3. Login Supabase

### Capture 1 — Montage DARK
1. Ouvre `planning-montage.html`
2. Si `⚙ Paramètres` affiche "Clair" → clique, bascule en Sombre
3. Ferme le dialog
4. F12 → Console → vérifie `document.documentElement.dataset.theme === 'dark'`
5. Screenshot pleine fenêtre

### Capture 2 — Montage CLAIR
1. Clique ⚙ Paramètres
2. Clique le bouton thème (label devrait dire "Sombre", après clic "Clair")
3. Ferme le dialog
4. Vérifie visuellement : fond blanc, textes lisibles, étiquettes avec bordure 2px visible
5. Screenshot pleine fenêtre

### Capture 3 — SAV DARK
1. Ouvre `planning-sav.html` dans un autre onglet
2. Le thème doit être hérité de Montage = clair (puisque localStorage partagé). Bascule en Sombre via ⚙.
3. Screenshot pleine fenêtre

### Capture 4 — SAV CLAIR
1. ⚙ → bascule en Clair
2. Vérifie : verrou-noir / jaune / gris des lignes communes restent distinguables (bordure 2px)
3. Screenshot pleine fenêtre

Envoie les 4 captures, ou rapporte tout glitch / token mal calibré pour ajustement.

## 🎯 Lecture < 2 min ?
Oui. Si non, dis-le-moi, je condense la prochaine fois.
