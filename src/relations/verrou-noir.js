// @ts-check
/**
 * Regle verrou-noir.
 *
 * Semantique (cf. audit legacy planning-montage.html L.2900, 2932-2933) :
 * - Une etiquette de type 'noir' doit avoir `verrouille = true` (lock).
 * - Si une etiquette passe a un autre type, `verrouille` doit redevenir false
 *   (delock).
 * - Suppression d'un 'noir' verrouille : refusee aux non-admins. Cette
 *   validation est exposee via `shouldAllowDelete(label, user)` — la UI legacy
 *   l'appelle AVANT d'emettre `label.deleted`.
 *
 * Reagit aux events bus : `label.created`, `label.updated`.
 *
 * @typedef {import('../shared/state.js').Etiquette} Etiquette
 */

import { ensureCtx, shouldSkip } from './_utils.js';

export const RULE_ID = 'verrou-noir';

/**
 * Branche les handlers sur le bus. Retourne un unsubscribe global.
 * @param {{ on: (type: string, fn: (e: any) => void) => () => void }} bus
 * @param {{ push: (a: any) => void }} undo
 * @returns {() => void}
 */
export function register(bus, undo) {
  /** @param {any} event */
  function onChange(event) {
    const label = event?.payload?.label;
    if (!label || typeof label !== 'object') return;
    const ctx = ensureCtx(event.ctx);
    if (shouldSkip(ctx, RULE_ID, label.id)) return;

    const isNoir = label.type === 'noir';
    const wasLocked = label.verrouille === true;

    if (isNoir && !wasLocked) {
      label.verrouille = true;
      undo.push({
        revert: () => { label.verrouille = false; },
        redo:   () => { label.verrouille = true; },
        description: `verrou-noir: lock ${label.id}`,
        domain: 'label',
        affectedIds: [label.id],
      });
    } else if (!isNoir && wasLocked) {
      label.verrouille = false;
      undo.push({
        revert: () => { label.verrouille = true; },
        redo:   () => { label.verrouille = false; },
        description: `verrou-noir: unlock ${label.id}`,
        domain: 'label',
        affectedIds: [label.id],
      });
    }
  }

  const off1 = bus.on('label.created', onChange);
  const off2 = bus.on('label.updated', onChange);
  return () => { off1(); off2(); };
}

/**
 * Validation pre-suppression. La UI legacy (et future) doit appeler ceci AVANT
 * d'emettre `label.deleted` sur le bus.
 *
 * @param {Etiquette} label
 * @param {{ role?: string } | null | undefined} user
 * @returns {boolean}
 */
export function shouldAllowDelete(label, user) {
  if (!label || label.type !== 'noir') return true;
  if (label.verrouille !== true) return true;
  return user?.role === 'admin';
}
