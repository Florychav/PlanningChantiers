// @ts-check
/**
 * Regle noir-travaux-sav (cross-planning SAV -> Montage).
 *
 * Semantique (cf. audit legacy planning-sav.html L.2038-2058
 * `updateNoirTravauxSav`) :
 * - Quand une etiquette SAV de type 'estMonteurZone' liee a un noir Montage
 *   (`etiquetteNoirId`) est creee / modifiee / deplacee / supprimee, le
 *   champ `data.travaux_sav` du noir Montage doit etre re-calcule a partir
 *   de TOUTES les SAV monteur-zone qui ciblent ce noir.
 * - Le re-calcul est IDEMPOTENT (from-scratch a chaque appel). Pas de risque
 *   d'over-cumul.
 * - Pour 'sav.label.moved' avec changement d'etiquetteNoirId, le caller doit
 *   passer `prevEtiquetteNoirId` dans le payload pour qu'on recompute les
 *   DEUX noirs (l'ancien et le nouveau). Sinon, seul le courant est traite.
 *
 * Events ecoutes : `sav.label.created`, `sav.label.updated`,
 *   `sav.label.deleted`, `sav.label.moved`.
 *
 * @typedef {import('../shared/state.js').Etiquette} Etiquette
 */

import { state } from '../shared/state.js';
import { ensureCtx, shouldSkip } from './_utils.js';

export const RULE_ID = 'noir-travaux-sav';

/**
 * @param {any} a
 * @param {any} b
 * @returns {boolean}
 */
function shallowEqualIds(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i]?.id !== b[i]?.id) return false;
  }
  return true;
}

/**
 * @param {{ on: (type: string, fn: (e: any) => void) => () => void }} bus
 * @param {{ push: (a: any) => void }} undo
 * @param {{ etiquettes: Etiquette[], etiquettes_sav: Etiquette[] }} [store=state]
 * @returns {() => void}
 */
export function register(bus, undo, store = state) {
  /**
   * Recompute travaux_sav pour un noir donne. Retourne {noir, prev, next} si
   * changement effectif, null sinon.
   * @param {string} noirId
   */
  function recompute(noirId) {
    const noir = store.etiquettes.find((e) => e.id === noirId && e.type === 'noir');
    if (!noir) return null;
    const noirAny = /** @type {any} */ (noir);
    if (!noirAny.data) noirAny.data = {};
    const prev = noirAny.data.travaux_sav;
    const next = store.etiquettes_sav.filter(
      (s) => /** @type {any} */ (s).estMonteurZone && /** @type {any} */ (s).etiquetteNoirId === noirId,
    );
    if (Array.isArray(prev) && shallowEqualIds(prev, next)) return null;
    noirAny.data.travaux_sav = next;
    return { noir: noirAny, prev, next };
  }

  /** @param {any} event */
  function onSavChange(event) {
    const label = /** @type {Etiquette | undefined} */ (event?.payload?.label);
    if (!label) return;
    const labelAny = /** @type {any} */ (label);
    // Filtre semantique : seules les SAV monteur-zone declenchent un recompute
    // (legacy fait pareil au site d'appel d'updateNoirTravauxSav). Si on a un
    // prevEtiquetteNoirId, on l'accepte meme sans estMonteurZone car le label
    // courant a pu PERDRE estMonteurZone (cas modification de type).
    const hasPrev = typeof event.payload?.prevEtiquetteNoirId === 'string';
    if (!labelAny.estMonteurZone && !hasPrev) return;
    const ctx = ensureCtx(event.ctx);
    if (shouldSkip(ctx, RULE_ID, label.id)) return;

    /** @type {Set<string>} */
    const targets = new Set();
    if (labelAny.estMonteurZone && labelAny.etiquetteNoirId) targets.add(labelAny.etiquetteNoirId);
    if (hasPrev) targets.add(event.payload.prevEtiquetteNoirId);

    /** @type {{ noir: any, prev: any, next: any }[]} */
    const applied = [];
    for (const id of targets) {
      const r = recompute(id);
      if (r) applied.push(r);
    }
    if (applied.length === 0) return;

    undo.push({
      revert: () => {
        for (const a of applied) a.noir.data.travaux_sav = a.prev;
      },
      redo: () => {
        for (const a of applied) a.noir.data.travaux_sav = a.next;
      },
      description: `noir-travaux-sav: recompute ${applied.length} noir(s)`,
      domain: 'label',
      affectedIds: [...targets, label.id],
    });
  }

  const offs = [
    bus.on('sav.label.created', onSavChange),
    bus.on('sav.label.updated', onSavChange),
    bus.on('sav.label.deleted', onSavChange),
    bus.on('sav.label.moved',   onSavChange),
  ];
  return () => offs.forEach((f) => f());
}
