// @ts-check
/**
 * Helpers pour relations. Anti-cycle via `visited:Set<labelId:ruleId>` sur
 * le `ctx` partage entre handlers d'une meme cascade (decide Q4 J2.3).
 *
 * Usage standard dans un handler :
 *   const ctx = ensureCtx(event.ctx);
 *   if (shouldSkip(ctx, RULE_ID, label.id)) return;
 *   // mutation + undo.push(...)
 *   // les ré-emits doivent passer le meme `ctx` pour propager visited.
 */

/**
 * @typedef {{ visited: Set<string>, [k: string]: any }} RelationCtx
 */

/**
 * Assure que `ctx` a une Set visited. Mutation in-place si l'objet existe deja,
 * sinon retourne un nouveau ctx. Toujours retourne un objet exploitable.
 * @param {any} [ctx]
 * @returns {RelationCtx}
 */
export function ensureCtx(ctx) {
  if (!ctx || typeof ctx !== 'object') return { visited: new Set() };
  if (!(ctx.visited instanceof Set)) ctx.visited = new Set();
  return /** @type {RelationCtx} */ (ctx);
}

/**
 * Vrai si (labelId, ruleId) deja traite dans cette cascade. Marque comme
 * traite si pas encore et retourne false (le handler doit s'executer).
 * @param {RelationCtx} ctx
 * @param {string} ruleId
 * @param {string} labelId
 * @returns {boolean}
 */
export function shouldSkip(ctx, ruleId, labelId) {
  const key = `${labelId}:${ruleId}`;
  if (ctx.visited.has(key)) return true;
  ctx.visited.add(key);
  return false;
}
