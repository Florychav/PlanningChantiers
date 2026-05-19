// @ts-check
/**
 * Regle gris-installation.
 *
 * Semantique (cf. audit legacy planning-montage.html L.2826
 * `syncGrisDebutFromInstallation`) :
 * - Quand une etiquette de type rouge/bleu/violet (`PRINCIPAL_TYPES`) est creee
 *   ou modifiee avec un `numeroInstallation`, toutes les etiquettes 'gris'
 *   SANS `motherLabelId` qui partagent ce numero doivent etre alignees sur la
 *   date de debut du principal.
 * - La duree business-days du gris est preservee : on recalcule dateFin a
 *   partir de la nouvelle dateDebut + duree.
 * - Les gris AVEC `motherLabelId` sont SKIPPED (geres par la cascade
 *   mere-filles, hors scope J2.3).
 *
 * @typedef {import('../shared/state.js').Etiquette} Etiquette
 */

import { state } from '../shared/state.js';
import { addBusinessDays, businessDaysBetween } from '../shared/dates.js';
import { ensureCtx, shouldSkip } from './_utils.js';

export const RULE_ID = 'gris-installation';
export const PRINCIPAL_TYPES = ['rouge', 'bleu', 'violet'];

/**
 * @param {{ on: (type: string, fn: (e: any) => void) => () => void }} bus
 * @param {{ push: (a: any) => void }} undo
 * @param {{ etiquettes: Etiquette[] }} [store=state]
 * @returns {() => void}
 */
export function register(bus, undo, store = state) {
  /** @param {any} event */
  function onPrincipalChange(event) {
    const label = event?.payload?.label;
    if (!label || typeof label !== 'object') return;
    if (!PRINCIPAL_TYPES.includes(label.type)) return;
    if (!label.numeroInstallation || !label.dateDebut) return;
    const ctx = ensureCtx(event.ctx);
    if (shouldSkip(ctx, RULE_ID, label.id)) return;

    const newStart = label.dateDebut;
    const orphanGris = store.etiquettes.filter((e) =>
      e.type === 'gris'
      && !e.motherLabelId
      && e.numeroInstallation === label.numeroInstallation
      && e.dateDebut !== newStart
    );

    for (const g of orphanGris) {
      const prevStart = g.dateDebut;
      const prevEnd = g.dateFin;
      if (!prevStart || !prevEnd) continue;
      const duration = businessDaysBetween(prevStart, prevEnd);
      // duration jours ouvrables OU 1 si tout sur le meme jour ouvre.
      // addBusinessDays(start, duration-1) place dateFin au dernier jour ouvre.
      const newEnd = duration > 0 ? addBusinessDays(newStart, duration - 1) : newStart;
      g.dateDebut = newStart;
      g.dateFin = newEnd;

      const capturedG = g;
      const capturedPrevStart = prevStart;
      const capturedPrevEnd = prevEnd;
      const capturedNewStart = newStart;
      const capturedNewEnd = newEnd;
      undo.push({
        revert: () => {
          capturedG.dateDebut = capturedPrevStart;
          capturedG.dateFin = capturedPrevEnd;
        },
        redo: () => {
          capturedG.dateDebut = capturedNewStart;
          capturedG.dateFin = capturedNewEnd;
        },
        description: `gris-installation: align ${g.id} on ${label.id}`,
        domain: 'label',
        affectedIds: [g.id, label.id],
      });
    }
  }

  const off1 = bus.on('label.created', onPrincipalChange);
  const off2 = bus.on('label.updated', onPrincipalChange);
  return () => { off1(); off2(); };
}
