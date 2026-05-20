# Pré-J3.7 — Rapport (provisionnement base de test)

> Correction Phase 2a — alignement `TESTING.md`. Le seed SQL fixe est
> **annulé** (contredisait la stratégie self-cleanup `__e2e_test__`).
> 2 fichiers livrés, base de test démarrant volontairement vide.

---

## 📦 Livrables

| Fichier | Rôle |
|---|---|
| `supabase/schema-complete.sql` | Schéma complet idempotent pour la base de **test** |
| `supabase/README-test-db.md` | Procédure de provisionnement (projet → schéma → comptes) |

`supabase-schema.sql` (prod) : **non modifié**. ~~`seed-test.sql`~~ : annulé.

> Note de chemin : la consigne disait `Planning/...` ; le repo réel est
> `C:\dev\Planning-web\` (pas de sous-dossier `Planning/`). Les fichiers
> sont donc à la racine du repo : `supabase/` et `PRE_J37_REPORT.md`.

## 🆕 Tables ajoutées vs `supabase-schema.sql`

| Table | Origine | Colonnes |
|---|---|---|
| `personnes_sav` | reconstruite depuis `planning-sav.html` | `id text pk, body jsonb, updated_at, __e2e_test__` |
| `etiquettes_sav` | reconstruite depuis `planning-sav.html` | `id text pk, body jsonb, updated_at, __e2e_test__` |

Reconstruction validée par l'analyse du legacy :
- `loadStateFromSupabase()` lit `personnes`, `personnes_sav`, `etiquettes`,
  `etiquettes_sav`, `ponts` (L.845-850).
- `syncToSupabase()` upserte les lignes au format `{id, body}` (L.928).
- Les 2 tables SAV ont donc la **même forme** que `personnes`/`etiquettes`.

## ✅ Colonnes `__e2e_test__` confirmées

`boolean not null default false` sur les **6 tables métier** :
`personnes`, `etiquettes`, `ponts`, `reunions`, `personnes_sav`,
`etiquettes_sav`. Ajout via `add column if not exists` (idempotent).
`app_users` exclue (table technique, pas métier).

## ✅ Vérifs build / tests / typecheck

| Contrôle | Résultat |
|---|---|
| `npm test` | 320/320 verts (22 fichiers) |
| `npm run typecheck` | OK |
| `npm run build` | OK — `bundle.js` 15.5 KB, `import.js` 206.3 KB |

Aucune régression : les fichiers livrés sont SQL/Markdown, hors chaîne de build.

## 🟡 Points à arbitrer (signalés, hors scope strict)

1. **Policies RLS des tables SAV** — reconstruites en *editor+admin write*
   (le planning SAV synchronise `personnes_sav`/`etiquettes_sav` sous la
   garde `canEdit() = ['editor','admin']`). À confirmer contre les policies
   réelles de la prod si un jour elles sont auditées — sans impact sur la
   base de test, qui est indépendante.
2. **`TESTING.md` vs colonne `__e2e_test__`** — `TESTING.md` décrit encore
   le marqueur en chemin JSON (`body->'data'->>'__e2e_test__'`). Le schéma
   livré utilise une **colonne** dédiée (consigne Phase 2a). Divergence à
   résoudre lors d'une future révision de `TESTING.md` (non incluse dans
   les livrables de cette phase).

## 🚦 Ready for B2

Le provisionnement de la base de test est **prêt à exécuter**. Action
restante côté Flory (accès dashboard Supabase) :

1. Créer le projet Supabase de test.
2. Exécuter `supabase/schema-complete.sql`.
3. Désactiver la confirmation d'email.
4. Créer les 3 comptes (viewer / editor / admin) et ajuster les rôles.

→ Une fois fait, **B2 est levé** et **J3.7** (E2E Playwright) peut démarrer.
Procédure détaillée : `supabase/README-test-db.md`.
