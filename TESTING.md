# Tests — Planning Menetrey (refonte ESM)

## Niveaux

| Niveau | Outil | Localisation | Lancer |
|---|---|---|---|
| Unit (helpers purs) | Vitest | `tests/unit/` | `npm test` |
| Integration | Vitest + jsdom | `tests/integration/` | `npm test` |
| E2E | Playwright | `tests/e2e/` | `npm run test:e2e` |

## Convention `@ts-check`

Tout module ESM commence par `// @ts-check`. Le type-check passe via `npm run typecheck` (utilise le `tsconfig.json` racine, `checkJs: true`, `noEmit: true`). Aucun build TS, c'est juste de l'aide IDE + CI.

## Compte Supabase de test (E2E)

- **Email** : `test-refonte@menetrey.local`
- **Role** : `editor` (jamais `admin` — garde-fou pour ne pas pouvoir corrompre l'equipe en cas de bug E2E)
- **Marqueur de purge** : chaque donnee creee par les tests E2E porte `data.__e2e_test__ = true` dans le `body` JSON
- **Purge manuelle** :
  ```sql
  -- A executer regulierement par admin pour nettoyer la base de test
  delete from public.etiquettes      where body->'data'->>'__e2e_test__' = 'true';
  delete from public.etiquettes_sav  where body->'data'->>'__e2e_test__' = 'true';
  delete from public.personnes       where body->'data'->>'__e2e_test__' = 'true';
  delete from public.personnes_sav   where body->'data'->>'__e2e_test__' = 'true';
  ```

### Statut J1
Le compte n'a pas encore ete cree (necessite acces dashboard Supabase). Voir `J1_REPORT.md`.

## Couverture cible avant bascule sur main

- 100% des 11 regles metier cartographiees (voir audits J0)
- Chaque regle a un scenario equivalent exectube en `legacy` (HTML existant) ET en `new` (ESM bundle) pendant la migration, avec comparaison d'etat
- >=80% lignes sur `src/shared/` et `src/relations/`

## Fixtures

`tests/fixtures/` contient des etats JSON reproductibles. Convention :
- `etat-vide.json` — base sans aucune etiquette
- `etat-rouge-monteur.json` — un rouge cree, etat juste apres
- etc.

Toute nouvelle fixture est documentee en commentaire d'en-tete (que represente-t-elle, quelle regle elle sert a tester).
