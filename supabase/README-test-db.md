# Base Supabase de test — procédure de provisionnement

> Met en place la base de **test** de la refonte ESM (blocker **B2**).
> Cible : un projet Supabase **dédié**, distinct de la prod. Le schéma prod
> (`supabase-schema.sql`) n'est pas touché.

---

## 0. Périmètre

- Ce dossier provisionne une base **vide** prête pour les tests E2E (J3.7).
- Les **données** de test ne sont **pas** seedées ici : voir `TESTING.md`.
  Chaque test E2E crée ses propres lignes (marqueur `__e2e_test__`) puis les
  purge — pattern self-cleanup. La base démarre donc volontairement vide.
- `schema-complete.sql` est **idempotent** : ré-exécutable sans erreur.

## 1. Créer le projet Supabase

1. Dashboard Supabase → **New project**.
2. Nom : ex. `planning-menetrey-test`. Choisir une région proche (eu-central).
3. Noter le mot de passe Postgres généré (gestionnaire de mots de passe).
4. Attendre la fin du provisionnement (~2 min).

## 2. Exécuter le schéma

1. Projet de test → **SQL Editor** → **New query**.
2. Coller le contenu de `supabase/schema-complete.sql`.
3. **Run**. Résultat attendu : `Success. No rows returned`.
4. **Table Editor** → vérifier la présence des 7 tables :
   `app_users`, `personnes`, `etiquettes`, `ponts`, `reunions`,
   `personnes_sav`, `etiquettes_sav`.
5. Vérifier que les 6 tables métier ont bien la colonne `__e2e_test__`
   (booléen, défaut `false`).

## 3. Désactiver la confirmation d'email

Les comptes de test doivent se connecter sans clic sur un lien.

1. **Authentication** → **Sign In / Providers** → **Email**.
2. Décocher **Confirm email** (ou « Enable email confirmations »).
3. Enregistrer.

## 4. Créer les 3 comptes de test

Un compte par rôle, pour couvrir les règles métier dépendantes du rôle
(verrou noir, mode lecture seule, etc.).

1. **Authentication** → **Users** → **Add user** → **Create new user**.
2. Créer les 3 comptes (cocher *Auto Confirm User*) :

   | Email                              | Rôle visé |
   |------------------------------------|-----------|
   | `test-refonte@menetrey.local`      | editor    |
   | `test-refonte-viewer@menetrey.local` | viewer  |
   | `test-refonte-admin@menetrey.local`  | admin   |

   > L'email `test-refonte@menetrey.local` (editor) est celui fixé par
   > `TESTING.md`. Les deux autres complètent la couverture des rôles.

3. À la création, le trigger `on_auth_user_created` insère chaque compte
   dans `public.app_users` avec le rôle `viewer` par défaut.
4. SQL Editor → ajuster les rôles editor et admin :

   ```sql
   update public.app_users set role = 'editor'
     where email = 'test-refonte@menetrey.local';
   update public.app_users set role = 'admin'
     where email = 'test-refonte-admin@menetrey.local';
   -- test-refonte-viewer@ reste 'viewer' (défaut).
   ```

5. Vérifier : `select email, role from public.app_users;` → 3 lignes,
   un rôle distinct chacune.

## 5. Récupérer les clés du projet de test

**Project Settings** → **API** : noter `Project URL` et la clé `anon`
(publishable). Elles serviront à configurer le runner E2E (J3.7) — la
config E2E pointera vers ce projet de test, jamais vers la prod.

---

## Stratégie des données de test

Décrite dans **`TESTING.md`** (§ « Compte Supabase de test »). En résumé :

- Toute donnée créée par un test E2E porte le marqueur `__e2e_test__`.
- Chaque test nettoie ce qu'il a créé (self-cleanup).
- La base n'est jamais seedée à l'avance — elle reste vide entre deux runs.

Le marqueur est porté par la **colonne** `__e2e_test__` (booléen) ajoutée
par `schema-complete.sql` sur les 6 tables métier. Le code de test insère
ses lignes avec `__e2e_test__: true`.

## Reset complet de la base de test

Pour repartir d'une base propre (purge de tout résidu de test) :

```sql
-- Ordre : étiquettes avant personnes (références logiques dans body).
delete from public.etiquettes      where __e2e_test__ = true;
delete from public.etiquettes_sav  where __e2e_test__ = true;
delete from public.reunions        where __e2e_test__ = true;
delete from public.ponts           where __e2e_test__ = true;
delete from public.personnes       where __e2e_test__ = true;
delete from public.personnes_sav   where __e2e_test__ = true;
```

> Sur la base de test, toutes les lignes devraient porter `__e2e_test__ =
> true`. Pour un nettoyage total inconditionnel : remplacer la clause
> `where` par `truncate table public.<table>;` — **uniquement** sur la
> base de test, jamais sur la prod.
