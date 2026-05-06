# Planning Chantier — Ascenseurs Menétrey SA

Application web monofichier (`index.html`) pour la gestion du planning des chantiers, déployée sur GitHub Pages avec stockage Supabase et synchronisation temps réel.

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
