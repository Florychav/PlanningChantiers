// @ts-check
/**
 * Regle jaune-auto-j2.
 *
 * Semantique (cf. audit legacy planning-montage.html L.2735-2770) :
 * - A la creation d'une etiquette principale (rouge/bleu/violet), si la duree
 *   ouvrable > 2 :
 *     - raccourcit la mere de 2 jours (duree principale = dureeOuvr - 2).
 *     - cree une jaune AUTO de 2 jours ouvres place juste apres la mere
 *       raccourcie (1 jour ouvre apres la nouvelle dateFin).
 * - Si dureeOuvr <= 2 :
 *     - jaune AUTO sur les memes dates que la mere (pas de raccourcissement).
 * - La jaune cree a : type='jaune', personneId = mere.personneId,
 *   motherLabelId = mere.id, numeroInstallation = mere.numeroInstallation,
 *   creePar = 'AUTO'.
 * - Convention de dates : label [debut..fin] = fin est inclusif. duree =
 *   businessDaysBetween(debut, fin). debut + (duree-1) jours ouvres = fin.
 *
 * NOTE J3.4.4 squelette : ne gere PAS le gris-auto (logique de selection
 * Monteur libre/equipe/hors-equipe + confirm UI). Ce gris-auto fera l'objet
 * d'une regle J3.4.x ulterieure quand l'UI legacy basculera dans le bundle.
 *
 * Apres creation de la jaune, on re-emit 'label.created' sur la jaune avec
 * le meme ctx — declenche jaune-protocoleur pour la linked Protocoleur/TS.
 *
 * @typedef {import('../shared/state.js').Etiquette} Etiquette
 */

import { state } from '../shared/state.js';
import { addBusinessDays, businessDaysBetween } from '../shared/dates.js';
import { generateId } from '../shared/ids.js';
import { ensureCtx, shouldSkip } from './_utils.js';

export const RULE_ID = 'jaune-auto-j2';
export const PRINCIPAL_TYPES = ['rouge', 'bleu', 'violet'];
export const JAUNE_AUTO_DURATION = 2;

/**
 * @param {{ on: (type: string, fn: (e: any) => void) => () => void, emit: (type: string, payload?: any, ctx?: any) => void }} bus
 * @param {{ push: (a: any) => void }} undo
 * @param {{ etiquettes: Etiquette[] }} [store=state]
 * @returns {() => void}
 */
export function register(bus, undo, store = state) {
  /** @param {any} event */
  function onPrincipalCreated(event) {
    const label = /** @type {Etiquette | undefined} */ (event?.payload?.label);
    if (!label || !PRINCIPAL_TYPES.includes(label.type)) return;
    if (!label.dateDebut || !label.dateFin || !label.personneId) return;
    const ctx = ensureCtx(event.ctx);
    if (shouldSkip(ctx, RULE_ID, label.id)) return;

    // Captures locales (necessaires pour fermer la closure undo/redo
    // sans perdre la narrowing TypeScript sur label.dateDebut|undefined).
    const debut = label.dateDebut;
    const fin   = label.dateFin;
    const dureeOuvr = businessDaysBetween(debut, fin);
    if (dureeOuvr < 1) return;

    const prevDateFin = fin;
    let jauneStart;
    let jauneEnd;

    if (dureeOuvr > JAUNE_AUTO_DURATION) {
      const principalDuree = dureeOuvr - JAUNE_AUTO_DURATION;
      const newPrincipalEnd = addBusinessDays(debut, principalDuree - 1);
      label.dateFin = newPrincipalEnd;
      jauneStart = addBusinessDays(newPrincipalEnd, 1);
      jauneEnd   = addBusinessDays(jauneStart, JAUNE_AUTO_DURATION - 1);
    } else {
      jauneStart = debut;
      jauneEnd   = fin;
    }

    /** @type {Etiquette} */
    const jaune = {
      id: generateId(),
      type: 'jaune',
      personneId: label.personneId,
      dateDebut: jauneStart,
      dateFin: jauneEnd,
      motherLabelId: label.id,
      numeroInstallation: label.numeroInstallation,
    };
    store.etiquettes.push(jaune);

    undo.push({
      revert: () => {
        label.dateFin = prevDateFin;
        const idx = store.etiquettes.findIndex((e) => e.id === jaune.id);
        if (idx >= 0) store.etiquettes.splice(idx, 1);
      },
      redo: () => {
        if (dureeOuvr > JAUNE_AUTO_DURATION) {
          const principalDuree = dureeOuvr - JAUNE_AUTO_DURATION;
          label.dateFin = addBusinessDays(debut, principalDuree - 1);
        }
        if (!store.etiquettes.some((e) => e.id === jaune.id)) {
          store.etiquettes.push(jaune);
        }
      },
      description: `jaune-auto-j2: jaune ${jaune.id} pour ${label.id} (dureeOuvr=${dureeOuvr})`,
      domain: 'label',
      affectedIds: [label.id, jaune.id],
    });

    // Cascade : permet a jaune-protocoleur de creer la linked Protocoleur.
    // Le ctx visited contient deja 'label.id:jaune-auto-j2' donc on n'aura
    // pas de re-entrance sur la mere. Le re-emit cible la jaune (id distinct),
    // donc jaune-protocoleur la traitera normalement.
    bus.emit('label.created', { label: jaune }, ctx);
  }

  return bus.on('label.created', onPrincipalCreated);
}
