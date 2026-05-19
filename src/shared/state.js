// @ts-check
/**
 * Store global mute, instance unique partagee par toutes les relations.
 *
 * Forme minimale J2.3 : `etiquettes`, `personnes`. La forme complete (ponts,
 * reunions, app_users, etc.) arrive en J3 avec l'integration view layer.
 *
 * Convention : les relations mutent directement `state.etiquettes[i].xxx`
 * et pushent un UndoableAction avec le revert qui restaure le prev.
 * Pas de setters auto-emit (cf. Q1 J2.3 — pattern A vanilla, coherent legacy).
 *
 * @typedef {Object} Personne
 * @property {string} id
 * @property {string} [prenom]
 * @property {string} [nom]
 * @property {string} [groupe]     - ex. 'Protocoleur/TS', 'Monteur', etc.
 * @property {string} [role]
 *
 * @typedef {Object} Etiquette
 * @property {string}  id
 * @property {string}  type                 - 'rouge'|'bleu'|'violet'|'jaune'|'gris'|'noir'|'rose'|'autre'
 * @property {string}  [personneId]
 * @property {string}  [dateDebut]          - ISO 'YYYY-MM-DD'
 * @property {string}  [dateFin]            - ISO 'YYYY-MM-DD'
 * @property {string}  [numeroInstallation]
 * @property {string}  [motherLabelId]
 * @property {string}  [linkedLabelId]
 * @property {string}  [linkedFromId]
 * @property {boolean} [verrouille]
 * @property {string}  [intitule]
 * @property {string}  [adresse]
 * @property {boolean} [manuallyMoved]
 */

/** @type {{ etiquettes: Etiquette[], personnes: Personne[] }} */
export const state = {
  etiquettes: [],
  personnes: [],
};

/** Reset complet — utile pour tests. */
export function resetState() {
  state.etiquettes.length = 0;
  state.personnes.length = 0;
}

/**
 * Lookup par id.
 * @param {string} id
 * @returns {Etiquette | undefined}
 */
export function findEtiquette(id) {
  return state.etiquettes.find((e) => e.id === id);
}

/**
 * Lookup personne par id.
 * @param {string} id
 * @returns {Personne | undefined}
 */
export function findPersonne(id) {
  return state.personnes.find((p) => p.id === id);
}
