// @ts-check
/**
 * Selector pur lignes-communes (SAV).
 *
 * Semantique (cf. audit legacy planning-sav.html L.1011-1021 `getLignesCommunes`) :
 * - Une "ligne commune" est une personne qui apparait a la fois dans les
 *   equipes Montage et SAV. Match par prenom+nom normalises (NFD + suppression
 *   diacritiques + lowercase, pour tolerer accents/majuscules differents
 *   entre les deux saisies).
 * - Lecture seule, derive a chaque appel. Pas d'effet de bord, pas d'undo,
 *   pas d'event bus. La UI legacy / view layer appelle ceci au render.
 *
 * @typedef {import('../shared/state.js').Personne} Personne
 */

/**
 * Normalise un prenom ou nom : trim + lowercase + NFD + suppression
 * diacritiques. Utile pour matcher 'Florent' vs 'florent' vs 'flòrent'.
 * @param {string | undefined} s
 * @returns {string}
 */
export function normalizeName(s) {
  if (!s) return '';
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase();
}

/**
 * Cle de match : prenom|nom normalises.
 * @param {Personne} p
 * @returns {string}
 */
function matchKey(p) {
  return `${normalizeName(p.prenom)}|${normalizeName(p.nom)}`;
}

/**
 * @typedef {Object} LigneCommune
 * @property {Personne} montage  - L'entree cote Montage.
 * @property {Personne} sav      - L'entree correspondante cote SAV.
 */

/**
 * Retourne les paires (personne Montage, personne SAV) qui sont la meme
 * personne (match prenom+nom normalises). L'ordre est celui de
 * `personnesMontage`.
 *
 * @param {Personne[]} personnesMontage
 * @param {Personne[]} personnesSav
 * @returns {LigneCommune[]}
 */
export function getLignesCommunes(personnesMontage, personnesSav) {
  /** @type {Map<string, Personne>} */
  const savByKey = new Map();
  for (const ps of personnesSav) {
    const k = matchKey(ps);
    if (k !== '|') savByKey.set(k, ps);
  }
  /** @type {LigneCommune[]} */
  const out = [];
  for (const pm of personnesMontage) {
    const k = matchKey(pm);
    if (k === '|') continue;
    const ps = savByKey.get(k);
    if (ps) out.push({ montage: pm, sav: ps });
  }
  return out;
}
