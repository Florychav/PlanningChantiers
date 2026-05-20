// @ts-check
/**
 * Client Supabase factorise pour le bundle ESM.
 *
 * J3.8 : premier consommateur = la page d'import bundlee. Les constantes
 * etaient dupliquees dans 3 HTML legacy (montage, sav, import) ; cette
 * factorisation les unifie cote bundle. Les pages legacy non encore
 * bundlees conservent leur copie CDN jusqu'a leur propre migration.
 *
 * SUPABASE_KEY est une cle *publishable* (anon, exposee cote client par
 * design) — ce n'est pas un secret. La securite repose sur les Row Level
 * Security policies Postgres, pas sur le secret de la cle.
 */
import { createClient } from '@supabase/supabase-js';

/** URL du projet Supabase Menetrey. */
export const SUPABASE_URL = 'https://nnkthgxbcslkhkdayjvg.supabase.co';

/** Cle publishable (anon) — exposee cote client par design, pas un secret. */
export const SUPABASE_KEY = 'sb_publishable_zX0P2GxSqIlh3Lqb_-PtCw_ydCahuhp';

/**
 * Cree un client Supabase configure (persistSession + autoRefreshToken,
 * pour partager la session avec les pages planning).
 *
 * @param {Record<string, any>} [opts] - surcharges passees a createClient.
 * @returns {import('@supabase/supabase-js').SupabaseClient}
 */
export function createSupabaseClient(opts = {}) {
  return createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true },
    ...opts,
  });
}
