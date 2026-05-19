// @ts-check
/**
 * Regle cascade-mere-filles (suppression).
 *
 * Semantique (cf. audit legacy planning-montage.html L.2897-2922 `deleteLabel`) :
 * - A la suppression d'une etiquette, toutes les filles directes (etiquettes
 *   avec `motherLabelId === mother.id`) doivent etre supprimees aussi.
 * - Pour chaque fille qui possede un `linkedLabelId` (typiquement une jaune
 *   ayant declenche une linked Protocoleur via jaune-protocoleur), supprimer
 *   aussi la linked.
 * - Idempotent. La suppression de la mere elle-meme est attendue (event
 *   `label.deleted` emis par le caller AVANT cet evt — la regle ne supprime
 *   QUE les filles + leurs linked, jamais la mere).
 *
 * Le cas symetrique (mere=jaune source, suppression cascade sa linked) est
 * deja gere par `jaune-protocoleur`.
 *
 * @typedef {import('../shared/state.js').Etiquette} Etiquette
 */

import { state } from '../shared/state.js';
import { ensureCtx, shouldSkip } from './_utils.js';

export const RULE_ID = 'cascade-mere-filles';

/**
 * @param {{ on: (type: string, fn: (e: any) => void) => () => void }} bus
 * @param {{ push: (a: any) => void }} undo
 * @param {{ etiquettes: Etiquette[] }} [store=state]
 * @returns {() => void}
 */
export function register(bus, undo, store = state) {
  /** @param {any} event */
  function onLabelDeleted(event) {
    const label = /** @type {Etiquette | undefined} */ (event?.payload?.label);
    if (!label) return;
    const ctx = ensureCtx(event.ctx);
    if (shouldSkip(ctx, RULE_ID, label.id)) return;

    const children = store.etiquettes.filter((e) => e.motherLabelId === label.id);
    if (children.length === 0) return;

    /** @type {Set<string>} */
    const toRemoveIds = new Set();
    for (const c of children) {
      toRemoveIds.add(c.id);
      if (c.linkedLabelId) toRemoveIds.add(c.linkedLabelId);
    }

    /** @type {Etiquette[]} */
    const removed = [];
    for (const id of toRemoveIds) {
      const idx = store.etiquettes.findIndex((e) => e.id === id);
      if (idx >= 0) {
        removed.push(store.etiquettes[idx]);
        store.etiquettes.splice(idx, 1);
      }
    }

    undo.push({
      revert: () => {
        for (const r of removed) {
          if (!store.etiquettes.some((e) => e.id === r.id)) {
            store.etiquettes.push(r);
          }
        }
      },
      redo: () => {
        for (const id of toRemoveIds) {
          const idx = store.etiquettes.findIndex((e) => e.id === id);
          if (idx >= 0) store.etiquettes.splice(idx, 1);
        }
      },
      description: `cascade-mere-filles: ${removed.length} cascade from ${label.id}`,
      domain: 'label',
      affectedIds: [label.id, ...toRemoveIds],
    });
  }

  return bus.on('label.deleted', onLabelDeleted);
}
