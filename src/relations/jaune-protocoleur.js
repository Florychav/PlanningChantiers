// @ts-check
/**
 * Regle jaune-protocoleur.
 *
 * Semantique (cf. audit legacy planning-montage.html L.2857
 * `createLinkedJauneOnProtocoleur`) :
 * - A la creation d'une etiquette 'jaune' (qui n'est pas elle-meme une linked),
 *   chercher une personne libre dans le groupe 'Protocoleur/TS' et creer une
 *   jaune LIEE de 1 jour sur la dateFin de la jaune source.
 * - Liens bidirectionnels : `linked.linkedFromId = source.id` et
 *   `source.linkedLabelId = linked.id`.
 * - A l'update de la jaune source : resync la linked sur la nouvelle dateFin.
 * - A la suppression de la jaune source : cascade delete de la linked.
 * - Si aucun Protocoleur/TS disponible : no-op silencieux (la UI legacy fait
 *   pareil — cf. audit).
 *
 * @typedef {import('../shared/state.js').Etiquette} Etiquette
 * @typedef {import('../shared/state.js').Personne}  Personne
 */

import { state } from '../shared/state.js';
import { generateId } from '../shared/ids.js';
import { ensureCtx, shouldSkip } from './_utils.js';

export const RULE_ID = 'jaune-protocoleur';
export const PROTOCOLEUR_GROUP = 'Protocoleur/TS';

/**
 * @param {Personne} p
 * @returns {boolean}
 */
function isProtocoleur(p) {
  return p.groupe === PROTOCOLEUR_GROUP;
}

/**
 * Une personne est occupee a `iso` si elle a deja une etiquette dont
 * [dateDebut, dateFin] contient iso. Cas tres simplifie J2.3.
 * @param {{ etiquettes: Etiquette[] }} store
 * @param {string} personneId
 * @param {string} iso
 */
function isPersonOccupied(store, personneId, iso) {
  return store.etiquettes.some((e) =>
    e.personneId === personneId
    && typeof e.dateDebut === 'string'
    && typeof e.dateFin === 'string'
    && e.dateDebut <= iso
    && iso <= e.dateFin
  );
}

/**
 * @param {{ on: (type: string, fn: (e: any) => void) => () => void }} bus
 * @param {{ push: (a: any) => void }} undo
 * @param {{ etiquettes: Etiquette[], personnes: Personne[] }} [store=state]
 * @returns {() => void}
 */
export function register(bus, undo, store = state) {
  /** @param {any} event */
  function onJauneCreated(event) {
    const label = /** @type {Etiquette | undefined} */ (event?.payload?.label);
    if (!label || label.type !== 'jaune') return;
    if (label.linkedFromId) return;     // c'est deja une linked, pas une source
    if (label.linkedLabelId) return;    // deja une linked attachee, no-op idempotent
    if (!label.dateFin) return;
    const ctx = ensureCtx(event.ctx);
    if (shouldSkip(ctx, RULE_ID, label.id)) return;

    const protocoleur = store.personnes.find(
      (p) => isProtocoleur(p) && !isPersonOccupied(store, p.id, /** @type {string} */ (label.dateFin)),
    );
    if (!protocoleur) return;

    /** @type {Etiquette} */
    const linked = {
      id: generateId(),
      type: 'jaune',
      personneId: protocoleur.id,
      dateDebut: label.dateFin,
      dateFin: label.dateFin,
      linkedFromId: label.id,
    };
    store.etiquettes.push(linked);
    label.linkedLabelId = linked.id;

    undo.push({
      revert: () => {
        const i = store.etiquettes.findIndex((e) => e.id === linked.id);
        if (i >= 0) store.etiquettes.splice(i, 1);
        delete label.linkedLabelId;
      },
      redo: () => {
        if (!store.etiquettes.some((e) => e.id === linked.id)) {
          store.etiquettes.push(linked);
        }
        label.linkedLabelId = linked.id;
      },
      description: `jaune-protocoleur: create linked for ${label.id}`,
      domain: 'label',
      affectedIds: [label.id, linked.id],
    });
  }

  /** @param {any} event */
  function onJauneUpdated(event) {
    const label = /** @type {Etiquette | undefined} */ (event?.payload?.label);
    if (!label || label.type !== 'jaune') return;
    if (!label.linkedLabelId) return;
    if (!label.dateFin) return;
    const ctx = ensureCtx(event.ctx);
    if (shouldSkip(ctx, RULE_ID, label.id)) return;

    const linked = store.etiquettes.find((e) => e.id === label.linkedLabelId);
    if (!linked) return;
    if (linked.dateDebut === label.dateFin && linked.dateFin === label.dateFin) return;

    const prevStart = linked.dateDebut;
    const prevEnd = linked.dateFin;
    const newDate = label.dateFin;
    linked.dateDebut = newDate;
    linked.dateFin = newDate;

    undo.push({
      revert: () => {
        linked.dateDebut = prevStart;
        linked.dateFin = prevEnd;
      },
      redo: () => {
        linked.dateDebut = newDate;
        linked.dateFin = newDate;
      },
      description: `jaune-protocoleur: resync linked ${linked.id}`,
      domain: 'label',
      affectedIds: [linked.id],
    });
  }

  /** @param {any} event */
  function onJauneDeleted(event) {
    const label = /** @type {Etiquette | undefined} */ (event?.payload?.label);
    if (!label || label.type !== 'jaune') return;
    if (!label.linkedLabelId) return;
    const ctx = ensureCtx(event.ctx);
    if (shouldSkip(ctx, RULE_ID, label.id)) return;

    const linkedId = label.linkedLabelId;
    const linkedIdx = store.etiquettes.findIndex((e) => e.id === linkedId);
    if (linkedIdx < 0) return;
    const [linked] = store.etiquettes.splice(linkedIdx, 1);

    undo.push({
      revert: () => {
        if (!store.etiquettes.some((e) => e.id === linked.id)) {
          store.etiquettes.push(linked);
        }
      },
      redo: () => {
        const i = store.etiquettes.findIndex((e) => e.id === linkedId);
        if (i >= 0) store.etiquettes.splice(i, 1);
      },
      description: `jaune-protocoleur: cascade delete linked ${linkedId}`,
      domain: 'label',
      affectedIds: [linkedId],
    });
  }

  const off1 = bus.on('label.created', onJauneCreated);
  const off2 = bus.on('label.updated', onJauneUpdated);
  const off3 = bus.on('label.deleted', onJauneDeleted);
  return () => { off1(); off2(); off3(); };
}
