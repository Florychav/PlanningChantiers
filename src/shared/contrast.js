// @ts-check
/**
 * Helpers contrast/luminance WCAG. Reutilises par check-wcag (script CLI)
 * et par le futur render layer pour decider la couleur de texte des labels
 * en fonction de leur fond (J3.6 - texte adaptatif labels mode light).
 */

const HEX_RE = /^#([0-9a-f]{6})$/i;
const HEX3_RE = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i;

/**
 * Parse '#rrggbb' ou '#rgb' vers [r, g, b] (0-255).
 * @param {string} hex
 * @returns {[number, number, number]}
 */
export function hexToRgb(hex) {
  const m6 = HEX_RE.exec(hex);
  if (m6) {
    const n = parseInt(m6[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const m3 = HEX3_RE.exec(hex);
  if (m3) {
    return [
      parseInt(m3[1] + m3[1], 16),
      parseInt(m3[2] + m3[2], 16),
      parseInt(m3[3] + m3[3], 16),
    ];
  }
  throw new Error(`hexToRgb: format invalide '${hex}'`);
}

/**
 * Luminance relative WCAG (0 = noir, 1 = blanc).
 * @param {string} hex
 * @returns {number}
 */
export function relativeLuminance(hex) {
  const [r, g, b] = hexToRgb(hex).map((c) => {
    const cs = c / 255;
    return cs <= 0.03928 ? cs / 12.92 : Math.pow((cs + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Ratio de contraste WCAG entre deux couleurs hex (1.0 a 21.0).
 * @param {string} fg
 * @param {string} bg
 * @returns {number}
 */
export function contrastRatio(fg, bg) {
  const l1 = relativeLuminance(fg);
  const l2 = relativeLuminance(bg);
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

/** Couleur de texte par defaut sur fond clair. */
export const TEXT_ON_LIGHT = '#111827';
/** Couleur de texte par defaut sur fond sombre. */
export const TEXT_ON_DARK = '#FFFFFF';

/**
 * Choisit la meilleure couleur de texte (TEXT_ON_LIGHT vs TEXT_ON_DARK) selon
 * la luminance du fond. Resout le pb "label jaune en mode light avec texte
 * blanc illisible" (cf. J2.4 / A18) sans calcul de palette manuelle.
 *
 * Seuil 0.5 = inflexion classique (luminance perceptuelle). Pour les couleurs
 * limites (luminance ~0.45-0.55), on prefere la couleur qui maximise le
 * ratio de contraste.
 *
 * @param {string} bgHex  fond '#rrggbb' ou '#rgb'.
 * @returns {string}      hex texte ('#111827' ou '#FFFFFF').
 */
export function pickTextColor(bgHex) {
  // Toujours la couleur qui maximise le contraste WCAG. Plus fiable qu'un
  // seuil de luminance (qui faisait des erreurs sur gris medium ~0.36).
  return contrastRatio(TEXT_ON_LIGHT, bgHex) >= contrastRatio(TEXT_ON_DARK, bgHex)
    ? TEXT_ON_LIGHT
    : TEXT_ON_DARK;
}
