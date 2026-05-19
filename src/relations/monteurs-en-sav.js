// @ts-check
/**
 * Selector pur monteurs-en-sav.
 *
 * Semantique (cf. audit legacy planning-sav.html L.1035-1048 `getMonteursEnSav`) :
 * - Identifie les monteurs (cote Montage) qui ont une etiquette `noir`
 *   (= "SAV bloque") chevauchant la fenetre [rangeStart, rangeEnd].
 * - La UI SAV utilise cette liste pour griser ces monteurs dans sa propre vue
 *   ("Zone monteurs SAV bloques").
 * - Read-only, pas d'event bus, pas d'undo.
 *
 * @typedef {import('../shared/state.js').Etiquette} Etiquette
 */

/**
 * Retourne le Set des `personneId` qui ont au moins une etiquette de type
 * 'noir' chevauchant la plage [rangeStart, rangeEnd] (inclusif).
 *
 * @param {Etiquette[]} etiquettesMontage
 * @param {string}      rangeStart  ISO 'YYYY-MM-DD'
 * @param {string}      rangeEnd    ISO 'YYYY-MM-DD'
 * @returns {Set<string>}
 */
export function getMonteursEnSav(etiquettesMontage, rangeStart, rangeEnd) {
  /** @type {Set<string>} */
  const out = new Set();
  for (const e of etiquettesMontage) {
    if (e.type !== 'noir') continue;
    if (!e.personneId) continue;
    if (!e.dateDebut || !e.dateFin) continue;
    // Overlap inclusif.
    if (e.dateDebut <= rangeEnd && e.dateFin >= rangeStart) {
      out.add(e.personneId);
    }
  }
  return out;
}
