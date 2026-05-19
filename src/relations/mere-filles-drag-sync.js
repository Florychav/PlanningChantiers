// @ts-check
/**
 * Regle mere-filles-drag-sync.
 *
 * Semantique (cf. audit legacy planning-montage.html L.1893-1914) :
 * - A `label.moved` (drag ou edition de dates), si le label deplace est une
 *   mere (au moins 1 etiquette a `motherLabelId === label.id`), propager :
 *   - filles `manuallyMoved` : intactes (l'utilisateur les a deja repositionnees)
 *   - filles 'jaune' SANS linkedFromId (= jaune source) : recolees J+2 ouvrables
 *     apres la nouvelle dateFin de la mere (1 jour).
 *   - filles 'gris' : recolees a la nouvelle dateDebut de la mere, duree
 *     business-days preservee.
 *   - autres types : non touches (drag manuel suppose).
 *
 * Le caller doit avoir mute les dates de la mere AVANT d'emit `label.moved`.
 * Convention : `label.manuallyMoved = true` doit etre pose par le caller si
 *   l'utilisateur drag un enfant directement — la regle ne pose pas ce flag
 *   automatiquement (separation des responsabilites).
 *
 * @typedef {import('../shared/state.js').Etiquette} Etiquette
 */

import { state } from '../shared/state.js';
import { addBusinessDays, businessDaysBetween } from '../shared/dates.js';
import { ensureCtx, shouldSkip } from './_utils.js';

export const RULE_ID = 'mere-filles-drag-sync';

/**
 * @param {{ on: (type: string, fn: (e: any) => void) => () => void }} bus
 * @param {{ push: (a: any) => void }} undo
 * @param {{ etiquettes: Etiquette[] }} [store=state]
 * @returns {() => void}
 */
export function register(bus, undo, store = state) {
  /** @param {any} event */
  function onMoved(event) {
    const label = /** @type {Etiquette | undefined} */ (event?.payload?.label);
    if (!label || !label.dateDebut || !label.dateFin) return;
    const ctx = ensureCtx(event.ctx);
    if (shouldSkip(ctx, RULE_ID, label.id)) return;

    const children = store.etiquettes.filter((e) => e.motherLabelId === label.id);
    if (children.length === 0) return;

    /** @type {{ child: Etiquette, prev: { dateDebut: string, dateFin: string } }[]} */
    const applied = [];

    for (const child of children) {
      if (child.manuallyMoved === true) continue;
      if (!child.dateDebut || !child.dateFin) continue;

      let newDebut = child.dateDebut;
      let newFin   = child.dateFin;

      if (child.type === 'jaune' && !child.linkedFromId) {
        // Jaune source : J+2 ouvrables apres fin mere, 1 jour.
        const target = addBusinessDays(label.dateFin, 2);
        newDebut = target;
        newFin   = target;
      } else if (child.type === 'gris') {
        // Gris : meme dateDebut que mere, duree business-days preservee.
        const duration = businessDaysBetween(child.dateDebut, child.dateFin);
        newDebut = label.dateDebut;
        newFin   = duration > 0 ? addBusinessDays(newDebut, duration - 1) : newDebut;
      } else {
        // Autres types : pas touche.
        continue;
      }

      if (newDebut === child.dateDebut && newFin === child.dateFin) continue;

      applied.push({ child, prev: { dateDebut: child.dateDebut, dateFin: child.dateFin } });
      child.dateDebut = newDebut;
      child.dateFin   = newFin;
    }

    if (applied.length === 0) return;

    const snapshot = applied.map(({ child, prev }) => ({
      child, prev, next: { dateDebut: child.dateDebut, dateFin: child.dateFin },
    }));

    undo.push({
      revert: () => {
        for (const { child, prev } of snapshot) {
          child.dateDebut = prev.dateDebut;
          child.dateFin   = prev.dateFin;
        }
      },
      redo: () => {
        for (const { child, next } of snapshot) {
          child.dateDebut = next.dateDebut;
          child.dateFin   = next.dateFin;
        }
      },
      description: `mere-filles-drag-sync: ${applied.length} filles depuis ${label.id}`,
      domain: 'label',
      affectedIds: [label.id, ...snapshot.map((s) => s.child.id)],
    });
  }

  return bus.on('label.moved', onMoved);
}
