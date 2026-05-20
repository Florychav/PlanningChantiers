// @ts-check
/**
 * Point d'entree du bundle de la page d'import (J3.8).
 *
 * Remplace le `<script>` inline du legacy `import.html`. esbuild produit
 * `dist/import.js`, charge en `<script type="module">` par `dist/import.html`.
 */
import { createSupabaseClient } from './shared/supabase.js';
import { setupImportUI } from './import/import-ui.js';

setupImportUI(createSupabaseClient());
