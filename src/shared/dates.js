// @ts-check
/**
 * Helpers dates ISO 'YYYY-MM-DD' + calendrier des feries cantonaux suisses
 * (Fribourg FR et Geneve GE).
 *
 * Jours ouvrables = lundi-vendredi par defaut (`isWorkingDay`).
 * Pour exclure aussi les feries : `isWorkingDayExcludingHolidays` ou
 * `addBusinessDaysSkippingHolidays`.
 *
 * J3.2 : calendrier 2025-2027 extrait du legacy planning-montage.html L.747-793.
 * Sources : legislation cantonale FR (loi sur le repos hebdomadaire et les
 * jours feries) et GE (loi sur les jours feries du 3 nov. 1951, art. 1).
 * Quand le calendrier 2028+ devient necessaire, etendre FERIES_INFO.
 */

/**
 * @typedef {Object} HolidayInfo
 * @property {string} nom      - Nom officiel ('Noel', 'Fete-Dieu', etc.).
 * @property {string} cantons  - 'FR + GE' | 'FR' | 'GE' (format legacy preserve).
 */

/**
 * Calendrier feries 2025-2027 FR/GE (extrait legacy planning-montage.html).
 * Cles : 'YYYY-MM-DD' UTC. Valeurs : { nom, cantons }.
 *
 * Regles verifiees vs legacy :
 *  - 1er mai (Fete du Travail)              : GE uniquement
 *  - 26 decembre (Saint-Etienne)            : FR uniquement
 *  - Fete-Dieu (jeudi 60j apres Paques)     : FR uniquement
 *  - 31 decembre (Restauration Republique)  : GE uniquement
 *  - Assomption 15 aout, Toussaint 1er nov  : FR uniquement
 *  - Jeune genevois (jeudi suivant 1er dim. de septembre) : GE uniquement
 *
 * @type {Readonly<Record<string, HolidayInfo>>}
 */
export const FERIES_INFO = Object.freeze({
  // ─── 2025 ───
  '2025-01-01': { nom: 'Nouvel An',                     cantons: 'FR + GE' },
  '2025-04-18': { nom: 'Vendredi Saint',                cantons: 'FR + GE' },
  '2025-04-21': { nom: 'Lundi de Paques',               cantons: 'FR + GE' },
  '2025-05-01': { nom: 'Fete du Travail',               cantons: 'GE' },
  '2025-05-29': { nom: 'Ascension',                     cantons: 'FR + GE' },
  '2025-06-09': { nom: 'Lundi de Pentecote',            cantons: 'FR + GE' },
  '2025-06-19': { nom: 'Fete-Dieu',                     cantons: 'FR' },
  '2025-08-01': { nom: 'Fete Nationale',                cantons: 'FR + GE' },
  '2025-08-15': { nom: 'Assomption',                    cantons: 'FR' },
  '2025-09-11': { nom: 'Jeune genevois',                cantons: 'GE' },
  '2025-11-01': { nom: 'Toussaint',                     cantons: 'FR' },
  '2025-12-25': { nom: 'Noel',                          cantons: 'FR + GE' },
  '2025-12-26': { nom: 'Saint-Etienne',                 cantons: 'FR' },
  '2025-12-31': { nom: 'Restauration de la Republique', cantons: 'GE' },
  // ─── 2026 ───
  '2026-01-01': { nom: 'Nouvel An',                     cantons: 'FR + GE' },
  '2026-04-03': { nom: 'Vendredi Saint',                cantons: 'FR + GE' },
  '2026-04-06': { nom: 'Lundi de Paques',               cantons: 'FR + GE' },
  '2026-05-01': { nom: 'Fete du Travail',               cantons: 'GE' },
  '2026-05-14': { nom: 'Ascension',                     cantons: 'FR + GE' },
  '2026-05-25': { nom: 'Lundi de Pentecote',            cantons: 'FR + GE' },
  '2026-06-04': { nom: 'Fete-Dieu',                     cantons: 'FR' },
  '2026-08-01': { nom: 'Fete Nationale',                cantons: 'FR + GE' },
  '2026-08-15': { nom: 'Assomption',                    cantons: 'FR' },
  '2026-09-10': { nom: 'Jeune genevois',                cantons: 'GE' },
  '2026-11-01': { nom: 'Toussaint',                     cantons: 'FR' },
  '2026-12-25': { nom: 'Noel',                          cantons: 'FR + GE' },
  '2026-12-26': { nom: 'Saint-Etienne',                 cantons: 'FR' },
  '2026-12-31': { nom: 'Restauration de la Republique', cantons: 'GE' },
  // ─── 2027 ───
  '2027-01-01': { nom: 'Nouvel An',                     cantons: 'FR + GE' },
  '2027-03-26': { nom: 'Vendredi Saint',                cantons: 'FR + GE' },
  '2027-03-29': { nom: 'Lundi de Paques',               cantons: 'FR + GE' },
  '2027-05-01': { nom: 'Fete du Travail',               cantons: 'GE' },
  '2027-05-06': { nom: 'Ascension',                     cantons: 'FR + GE' },
  '2027-05-17': { nom: 'Lundi de Pentecote',            cantons: 'FR + GE' },
  '2027-05-27': { nom: 'Fete-Dieu',                     cantons: 'FR' },
  '2027-08-01': { nom: 'Fete Nationale',                cantons: 'FR + GE' },
  '2027-08-15': { nom: 'Assomption',                    cantons: 'FR' },
  '2027-09-09': { nom: 'Jeune genevois',                cantons: 'GE' },
  '2027-11-01': { nom: 'Toussaint',                     cantons: 'FR' },
  '2027-12-25': { nom: 'Noel',                          cantons: 'FR + GE' },
  '2027-12-26': { nom: 'Saint-Etienne',                 cantons: 'FR' },
  '2027-12-31': { nom: 'Restauration de la Republique', cantons: 'GE' },
});

/** Annee min couverte par FERIES_INFO. Au-dela, l'API leve. */
export const FERIES_MIN_YEAR = 2025;
/** Annee max couverte. */
export const FERIES_MAX_YEAR = 2027;

/**
 * Vrai si la date est dans le calendrier des feries (au moins un canton).
 * Si `canton` precise, vrai SEULEMENT si la date est feriee dans ce canton.
 * Leve si l'annee est hors de FERIES_MIN_YEAR..FERIES_MAX_YEAR (forcer le
 * developpeur a etendre le calendrier plutot que de retourner silencieusement
 * false sur une plage non couverte).
 *
 * @param {string} iso
 * @param {'FR' | 'GE'} [canton]
 * @returns {boolean}
 */
export function isHoliday(iso, canton) {
  guardYearCovered(iso);
  const info = FERIES_INFO[iso];
  if (!info) return false;
  if (!canton) return true;
  return info.cantons.includes(canton);
}

/**
 * Retourne le HolidayInfo si la date est feriee (au moins un canton), sinon
 * undefined. Leve si annee hors couverture.
 * @param {string} iso
 * @returns {HolidayInfo | undefined}
 */
export function getHolidayInfo(iso) {
  guardYearCovered(iso);
  return FERIES_INFO[iso];
}

/**
 * Vrai si la date est un jour ouvre ET non feriee. Si `canton` precise,
 * la date est consideree feriee SEULEMENT si feriee dans ce canton (utile
 * pour decompte selon le canton d'execution du chantier).
 *
 * @param {Date} d
 * @param {'FR' | 'GE'} [canton]
 * @returns {boolean}
 */
export function isWorkingDayExcludingHolidays(d, canton) {
  if (!isWorkingDay(d)) return false;
  return !isHoliday(formatISODate(d), canton);
}

/**
 * Ajoute n jours ouvres en sautant aussi les feries. Si `canton` precise,
 * sont feries seulement ceux du canton (le reste compte comme jour ouvre).
 *
 * @param {string} iso
 * @param {number} n
 * @param {'FR' | 'GE'} [canton]
 * @returns {string}
 */
export function addBusinessDaysSkippingHolidays(iso, n, canton) {
  if (n === 0) return iso;
  const d = parseISODate(iso);
  const step = n > 0 ? 1 : -1;
  let remaining = Math.abs(n);
  while (remaining > 0) {
    d.setUTCDate(d.getUTCDate() + step);
    if (isWorkingDayExcludingHolidays(d, canton)) remaining--;
  }
  return formatISODate(d);
}

/**
 * @param {string} iso
 * @throws si l'annee n'est pas couverte par FERIES_INFO.
 */
function guardYearCovered(iso) {
  const y = Number(iso.slice(0, 4));
  if (y < FERIES_MIN_YEAR || y > FERIES_MAX_YEAR) {
    throw new Error(
      `dates.js: annee ${y} hors calendrier feries (${FERIES_MIN_YEAR}-${FERIES_MAX_YEAR}). `
      + `Etendre FERIES_INFO avant d'utiliser une plage plus large.`,
    );
  }
}

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
