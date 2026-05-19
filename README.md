# Planning Chantier — Ascenseurs Menétrey SA

Application web monofichier (`index.html`) pour la gestion du planning des chantiers, déployée sur GitHub Pages avec stockage Supabase et synchronisation temps réel.

> ⚙️ **Refonte ESM bundle en cours** — voir section [Refonte ESM (work in progress)](#refonte-esm-work-in-progress) en bas de ce README. La version monofichier ci-dessous reste la version de production sur `main` jusqu'à la bascule.

## Architecture

- **Frontend** : `index.html` (HTML/CSS/JS vanilla, aucune build), hébergé sur GitHub Pages.
- **Backend** : Supabase (Postgres + Auth + Realtime).
- **Auth** : Email/mot de passe — comptes créés depuis le dashboard Supabase.
- **Permissions** (3 rôles via `app_users.role`) :
  - `viewer` : lecture seule
  - `editor` : peut créer/modifier/supprimer étiquettes, ponts, réunions
  - `admin` : tout + gestion de l'équipe + déverrouillage SAV

## Déploiement initial

### 1. Supabase — schéma

Dans **SQL Editor**, exécuter le script `supabase-schema.sql` (ou voir le bloc SQL fourni). Il crée :
- 4 tables (`personnes`, `etiquettes`, `ponts`, `reunions`)
- Une table `app_users` (rôles)
- Trigger d'auto-création du rôle `viewer` à chaque inscription
- Politiques RLS (Row Level Security)
- Activation de Realtime sur les 4 tables

### 2. Premier compte admin

```sql
-- Après avoir créé ton compte via Authentication > Users > Add user
update public.app_users set role = 'admin' where email = 'TON_EMAIL@example.com';
```

### 3. Authentication settings

Dans **Authentication > Settings** :
- Désactive **"Enable email confirmations"** si tu veux que les comptes soient utilisables immédiatement.
- Optionnel : restreins les domaines autorisés.

### 4. Import d'un planning existant (optionnel)

Si tu as un fichier `planning.json` issu de la version locale précédente :

1. Ouvre `import.html` (`https://TON_USER.github.io/TON_REPO/import.html` après déploiement, ou en local).
2. Connecte-toi avec un compte **editor** ou **admin**.
3. Sélectionne ton fichier `planning.json` → un résumé s'affiche.
4. Clique sur **"Importer dans Supabase"** :
   - Les personnes existantes (même prénom + nom) sont **dédupliquées** automatiquement.
   - Les nouvelles personnes reçoivent un **UUID**.
   - Les `personneId` des étiquettes / réunions sont remappés vers les nouveaux UUIDs.
   - Les étiquettes orphelines (personne introuvable) sont ignorées.
5. La progression et le détail s'affichent ligne par ligne.

### 5. GitHub Pages

```bash
git init
git add .
git commit -m "Planning Menétrey + Supabase"
git branch -M main
git remote add origin git@github.com:TON_USER/TON_REPO.git
git push -u origin main
```

Sur GitHub : **Settings > Pages > Source : main / root**.
Le site est dispo à `https://TON_USER.github.io/TON_REPO/`.

## Gestion des accès

### Créer un utilisateur

1. **Authentication > Users > Add user** (avec email + mot de passe)
2. Le trigger crée automatiquement une entrée `app_users` avec rôle `viewer`
3. Pour promouvoir : `update public.app_users set role = 'editor' where email = '...'`

### Modifier un rôle

```sql
update public.app_users set role = 'editor' where email = 'jean@example.com';
update public.app_users set role = 'admin'  where email = 'florent@example.com';
update public.app_users set role = 'viewer' where email = 'visiteur@example.com';
```

### Supprimer un utilisateur

Via le dashboard Supabase : **Authentication > Users > [...] > Delete user**. La ligne `app_users` est supprimée en cascade.

## Thème (clair / sombre)

Bouton **⚙ Paramètres** dans le header de Montage et SAV ouvre un panneau où le thème peut basculer entre sombre (défaut) et clair. Le choix est mémorisé dans le navigateur (`localStorage.planning.theme`) et partagé entre les deux vues : passer en clair sur Montage puis ouvrir SAV applique le clair au prochain chargement.

## Synchronisation temps réel

- Toute modification est poussée à Supabase (debounce 200 ms après le dernier changement).
- Les autres utilisateurs connectés voient les changements en ~250 ms (debounce realtime).
- L'indicateur dans l'en-tête : 🟢 Synchronisé · 🟡 Synchro… · 🔴 Erreur sync.

## Configuration

Les clés Supabase sont en clair dans `index.html` (lignes ~510-512). La clé `sb_publishable_*` est conçue pour être publique — la sécurité repose sur les politiques RLS.

## Développement local

```bash
# Servir avec n'importe quel serveur HTTP statique
python -m http.server 8000
# puis ouvrir http://localhost:8000
```

L'API Supabase fonctionne aussi en local (CORS autorisé par défaut).

---

## Refonte ESM (work in progress)

> **Branche dédiée** : `refonte/esm-bundle` (à créer — cf. blocker git documenté dans `J1_REPORT.md`).
> **Objectif** : remplacer les iframes par un bundle ESM unique, bus de relations centralisé, undo atomique, vrais tests.

### Structure (post-J1 scaffold)

```
Planning/
├─ src/                  # Code applicatif ESM (entry: src/main.js)
│  ├─ shared/            # Bus, supabase, undo, utils purs
│  ├─ relations/         # 1 règle métier = 1 fichier
│  ├─ montage/, sav/     # View layers
│  └─ shell/             # Tabs, auth, recherche
├─ tests/                # unit (Vitest), integration (jsdom), e2e (Playwright)
├─ dist/                 # ⚠️ versionné — voir "Pourquoi dist/ est commité" ci-dessous
├─ legacy/               # Anciens fichiers HTML (créé à la bascule)
├─ esbuild.config.mjs    # Build (linked sourcemaps, ES2020, minify)
├─ vitest.config.mjs
├─ playwright.config.mjs
├─ tsconfig.json         # checkJs + allowJs, noEmit (type-check IDE/CI uniquement)
└─ package.json
```

### Pourquoi `dist/` est commité

GitHub Pages sert directement le repo sans étape de build. Pour éviter une infra CI au démarrage, le bundle produit (`dist/bundle.js`, `dist/bundle.js.map`, `dist/index.html`) est versionné via `npm run build` avant chaque push. Le `.gitattributes` marque ces fichiers `linguist-generated=true` pour exclure des stats GitHub.

### Migration vers CI (futur)

Une fois la refonte stabilisée, migrer vers un build automatique :
- **Option A** : GitHub Action sur push `main` → build → commit dans branche `gh-pages` → Pages source = `gh-pages`.
- **Option B** : Pages-from-Actions (workflow `actions/deploy-pages`).
- Bénéfice : `dist/` peut alors être `.gitignore`-d.

### Workflow dev

```bash
cd Planning
npm install               # premier setup
npm run build             # produit dist/
npm run preview           # http://localhost:3000
npm test                  # unit + integration
npm run test:e2e          # Playwright (compte Supabase test requis — cf. TESTING.md)
npm run typecheck         # vérif types via JSDoc + checkJs
```

### Rollback d'urgence

Avant la bascule sur `main`, un tag `legacy-pre-refonte` sera posé sur le commit de l'état actuel (4 fichiers HTML). Pour rollback :

```bash
git checkout legacy-pre-refonte -- Planning/index.html Planning/index-sav.html Planning/planning-montage.html Planning/planning-sav.html
git commit -m "rollback: revert to pre-refonte state"
git push
```

Les anciens HTML restent aussi disponibles dans `Planning/legacy/` pendant 2 semaines après la bascule.

### TODO post-bascule

- **Migration `import.html` vers le bundle ESM** : aujourd'hui hors scope refonte. Estimation grossière : **1-2 jours** (extraction logique d'import, intégration au shell, tests E2E import). À planifier après stabilisation du bundle principal.

### Tests

Voir [`TESTING.md`](./TESTING.md).

