// @ts-check
/**
 * Subscription Realtime Supabase avec patch INCREMENTAL.
 *
 * Remplace le pattern legacy (debouncedReload + loadStateFromSupabase complet
 * a chaque event). Au lieu de tout recharger, chaque event postgres_changes
 * applique un patch cible sur le store : INSERT push, UPDATE replace, DELETE
 * splice. Le bus n'est PAS emit (les cascades locales sont deja parties cote
 * emetteur ; rejouer cote receveur risquerait double application).
 *
 * Filtre anti-echo via `originTag` : un client qui ecrit avec un tag X et
 * recoit en retour le meme event ignore la propagation locale.
 *
 * Convention payload Supabase :
 *   { eventType: 'INSERT'|'UPDATE'|'DELETE', new: row, old: row, ... }
 *   row = { id, body: <data> }  (schema actuel Supabase Menetrey).
 * On considere que `body` est directement l'objet metier (etiquette / personne).
 *
 * @typedef {{ etiquettes: any[], etiquettes_sav: any[], personnes: any[], personnes_sav: any[] }} RealtimeStore
 * @typedef {{ originTag?: string, tables?: string[], onPatchApplied?: (info: PatchInfo) => void }} RealtimeOptions
 * @typedef {{ table: string, op: 'insert'|'update'|'delete', id: string, item: any }} PatchInfo
 */

/** Mapping table Supabase -> cle du store. */
const TABLE_TO_KEY = /** @type {const} */ ({
  etiquettes:     'etiquettes',
  etiquettes_sav: 'etiquettes_sav',
  personnes:      'personnes',
  personnes_sav:  'personnes_sav',
});

const DEFAULT_TABLES = ['etiquettes', 'etiquettes_sav', 'personnes', 'personnes_sav'];

/**
 * Souscrit aux 4 tables (par defaut) et applique les patches incrementaux.
 *
 * @param {any} client                   Supabase client (mockable).
 * @param {RealtimeStore} store
 * @param {RealtimeOptions} [opts]
 * @returns {() => void}                 Unsubscribe global.
 */
export function subscribeRealtime(client, store, opts = {}) {
  const tables = opts.tables ?? DEFAULT_TABLES;
  const ownTag = opts.originTag;
  /** @type {any[]} */
  const channels = [];

  for (const table of tables) {
    if (!(table in TABLE_TO_KEY)) continue;
    const ch = client.channel(`realtime:${table}`)
      .on('postgres_changes', { event: '*', schema: 'public', table }, (/** @type {any} */ payload) => {
        const info = applyPatch(store, table, payload, ownTag);
        if (info && opts.onPatchApplied) opts.onPatchApplied(info);
      })
      .subscribe();
    channels.push(ch);
  }

  return () => {
    for (const ch of channels) {
      try { ch.unsubscribe?.(); } catch { /* swallow */ }
    }
  };
}

/**
 * Applique 1 event Supabase au store. Exporte pour test (et eventuel re-use
 * cote sync initial load apres reconnexion).
 *
 * @param {RealtimeStore} store
 * @param {string}        table
 * @param {{ eventType: 'INSERT'|'UPDATE'|'DELETE', new?: any, old?: any }} payload
 * @param {string}        [ownTag]
 * @returns {PatchInfo | null}
 */
export function applyPatch(store, table, payload, ownTag) {
  const key = /** @type {keyof RealtimeStore} */ (
    /** @type {any} */ (TABLE_TO_KEY)[table]
  );
  if (!key) return null;
  const arr = store[key];
  if (!Array.isArray(arr)) return null;

  const ev = payload.eventType;
  const row = payload.new ?? payload.old;
  if (!row) return null;

  // Extraction body : schema actuel = { id, body: <data> }. Fallback row direct.
  const item = row.body ?? row;
  if (!item || typeof item !== 'object') return null;
  const id = item.id ?? row.id;
  if (typeof id !== 'string') return null;

  // Anti-echo originTag. Le tag peut etre dans body.originTag, body.data.originTag,
  // ou (en futur) un champ Postgres dedie.
  const tag = item.originTag ?? item.data?.originTag;
  if (ownTag && typeof tag === 'string' && tag === ownTag) return null;

  if (ev === 'INSERT') {
    if (arr.some((e) => e.id === id)) return null;
    arr.push(item);
    return { table, op: 'insert', id, item };
  }
  if (ev === 'UPDATE') {
    const idx = arr.findIndex((e) => e.id === id);
    if (idx >= 0) arr[idx] = item;
    else arr.push(item);
    return { table, op: 'update', id, item };
  }
  if (ev === 'DELETE') {
    const idx = arr.findIndex((e) => e.id === id);
    if (idx < 0) return null;
    arr.splice(idx, 1);
    return { table, op: 'delete', id, item };
  }
  return null;
}
