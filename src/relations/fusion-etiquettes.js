// @ts-check
/**
 * Regle fusion-etiquettes-consecutives.
 *
 * Semantique (cf. audit legacy planning-montage.html L.2700-2711) :
 * - A la creation ou modification d'une etiquette, chercher les etiquettes
 *   existantes qui partagent : meme personneId, meme type, meme couleurHex
 *   (si type='autre'), meme numeroInstallation (si type a ce champ).
 * - Si l'une des candidates chevauche OU est consecutive (jour ouvrable
 *   suivant/precedent), etendre les dates de la nouvelle pour absorber la
 *   candidate, puis la SUPPRIMER de l'etat.
 * - Idempotent : si rien a fusionner, no-op.
 *
 * @typedef {import('../shared/state.js').Etiquette} Etiquette
 */

import { state } from '../shared/state.js';
import { addBusinessDays } from '../shared/dates.js';
import { ensureCtx, shouldSkip } from './_utils.js';

export const RULE_ID = 'fusion-etiquettes';

/** Types qui portent un numeroInstallation et l'utilisent pour la fusion. */
export const TYPES_AVEC_INSTALLATION = ['rouge', 'bleu', 'violet', 'gris', 'noir', 'rose'];

/**
 * Deux etiquettes sont fusionnables si meme perso + meme type + meme couleur
 * (autre) + meme installation (types concernes).
 * @param {Etiquette} a
 * @param {Etiquette} b
 * @returns {boolean}
 */
function isMergeable(a, b) {
  if (a.id === b.id) return false;
  if (a.personneId !== b.personneId) return false;
  if (a.type !== b.type) return false;
  if (a.type === 'autre') {
    if ((/** @type {any} */ (a).couleurHex ?? '') !== (/** @type {any} */ (b).couleurHex ?? '')) return false;
  }
  if (TYPES_AVEC_INSTALLATION.includes(a.type)) {
    if ((a.numeroInstallation ?? '') !== (b.numeroInstallation ?? '')) return false;
  }
  return true;
}

/**
 * @param {string} aDebut
 * @param {string} aFin
 * @param {string} bDebut
 * @param {string} bFin
 * @returns {boolean}
 */
function overlapOrConsecutive(aDebut, aFin, bDebut, bFin) {
  // Overlap inclusif (memes bornes ok).
  if (aDebut <= bFin && aFin >= bDebut) return true;
  // Consecutif jour ouvrable : fin de A + 1 jour ouvre = debut de B, ou vice-versa.
  if (addBusinessDays(aFin, 1) === bDebut) return true;
  if (addBusinessDays(bFin, 1) === aDebut) return true;
  return false;
}

/**
 * @param {{ on: (type: string, fn: (e: any) => void) => () => void }} bus
 * @param {{ push: (a: any) => void }} undo
 * @param {{ etiquettes: Etiquette[] }} [store=state]
 * @returns {() => void}
 */
export function register(bus, undo, store = state) {
  /** @param {any} event */
  function tryMerge(event) {
    const label = /** @type {Etiquette | undefined} */ (event?.payload?.label);
    if (!label || !label.dateDebut || !label.dateFin) return;
    const ctx = ensureCtx(event.ctx);
    if (shouldSkip(ctx, RULE_ID, label.id)) return;

    // Le label doit etre present dans le store pour qu'on puisse fusionner ses
    // doublons (sinon on est sur un evt 'created' avant le push — on absorbe
    // quand meme, le label restera).
    let mDebut = label.dateDebut;
    let mFin = label.dateFin;
    const candidates = store.etiquettes.filter((e) => isMergeable(label, e));
    const merged = /** @type {{ label: Etiquette }[]} */ ([]);

    // Fusion en chaine : on re-itere tant qu'on absorbe quelque chose, car
    // l'extension des bornes peut rendre eligible une candidate ignoree au
    // tour precedent (cas A-B-C ou C absorbe B puis devient eligible pour A).
    let absorbed = true;
    while (absorbed) {
      absorbed = false;
      for (let i = candidates.length - 1; i >= 0; i--) {
        const c = candidates[i];
        if (!c.dateDebut || !c.dateFin) { candidates.splice(i, 1); continue; }
        if (overlapOrConsecutive(mDebut, mFin, c.dateDebut, c.dateFin)) {
          if (c.dateDebut < mDebut) mDebut = c.dateDebut;
          if (c.dateFin   > mFin)   mFin   = c.dateFin;
          merged.push({ label: c });
          candidates.splice(i, 1);
          absorbed = true;
        }
      }
    }

    if (merged.length === 0) return;

    const prevDebut = label.dateDebut;
    const prevFin   = label.dateFin;
    label.dateDebut = mDebut;
    label.dateFin   = mFin;
    for (const m of merged) {
      const idx = store.etiquettes.findIndex((e) => e.id === m.label.id);
      if (idx >= 0) store.etiquettes.splice(idx, 1);
    }

    const mergedIds = merged.map((m) => m.label.id);
    undo.push({
      revert: () => {
        label.dateDebut = prevDebut;
        label.dateFin   = prevFin;
        for (const m of merged) {
          if (!store.etiquettes.some((e) => e.id === m.label.id)) {
            store.etiquettes.push(m.label);
          }
        }
      },
      redo: () => {
        label.dateDebut = mDebut;
        label.dateFin   = mFin;
        for (const id of mergedIds) {
          const idx = store.etiquettes.findIndex((e) => e.id === id);
          if (idx >= 0) store.etiquettes.splice(idx, 1);
        }
      },
      description: `fusion-etiquettes: ${label.id} absorbe ${merged.length}`,
      domain: 'label',
      affectedIds: [label.id, ...mergedIds],
    });
  }

  const off1 = bus.on('label.created', tryMerge);
  const off2 = bus.on('label.updated', tryMerge);
  return () => { off1(); off2(); };
}
