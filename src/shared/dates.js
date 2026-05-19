// @ts-check
/**
 * Helpers dates ISO 'YYYY-MM-DD'. Jours ouvrables = lundi-vendredi.
 *
 * NOTE J2.3 : feries (FR/GE) volontairement non geres ici — viendront en J3
 * avec extraction du calendrier legacy + tests fixtures dedies. addBusinessDays
 * en J2.3 = lun-ven seulement, suffisant pour gris-installation et
 * jaune-protocoleur dans la version squelette.
 */

/**
 * Parse 'YYYY-MM-DD' vers un Date a 00:00 UTC.
 * @param {string} iso
 * @returns {Date}
 */
export function parseISODate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) throw new Error(`parseISODate: format invalide '${iso}'`);
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

/**
 * Formate un Date vers 'YYYY-MM-DD' UTC.
 * @param {Date} d
 * @returns {string}
 */
export function formatISODate(d) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * @param {Date} d
 * @returns {boolean} true si lun-ven (UTC).
 */
export function isWorkingDay(d) {
  const wd = d.getUTCDay();
  return wd >= 1 && wd <= 5;
}

/**
 * Ajoute n jours ouvrables a la date ISO. n peut etre 0 (retourne tel quel
 * meme si non-ouvre) ou negatif (recule).
 * @param {string} iso
 * @param {number} n
 * @returns {string}
 */
export function addBusinessDays(iso, n) {
  const d = parseISODate(iso);
  if (n === 0) return iso;
  const step = n > 0 ? 1 : -1;
  let remaining = Math.abs(n);
  while (remaining > 0) {
    d.setUTCDate(d.getUTCDate() + step);
    if (isWorkingDay(d)) remaining--;
  }
  return formatISODate(d);
}

/**
 * Compte les jours ouvrables entre deux dates ISO (inclusif des extremites
 * si ce sont des jours ouvres). isoA <= isoB ; sinon retourne 0.
 * @param {string} isoA
 * @param {string} isoB
 * @returns {number}
 */
export function businessDaysBetween(isoA, isoB) {
  const a = parseISODate(isoA);
  const b = parseISODate(isoB);
  if (a > b) return 0;
  let count = 0;
  const d = new Date(a);
  while (d <= b) {
    if (isWorkingDay(d)) count++;
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return count;
}
