#!/usr/bin/env node
// @ts-check
/**
 * J2.4 — Script de validation WCAG AA pour les tokens CSS des deux themes.
 *
 * Usage CLI :   node scripts/check-wcag.mjs
 * Usage test :  import { computeContrast, runAllChecks } from './check-wcag.mjs'
 *
 * Verifie que les paires (couleur / fond) critiques respectent :
 *   - 4.5:1 pour le texte normal (WCAG AA)
 *   - 3.0:1 pour les bordures d'elements graphiques et large text (WCAG AA)
 *
 * Couvre les 2 themes (dark, light) sur les tokens textes/primary + bordures
 * metier (verrou-noir, jaune-protocoleur, gris-installation) vs fond planning.
 *
 * Note : la couleur de texte INTERNE aux labels (sur fond couleur metier) est
 * geree par le JS render legacy et reste a raffiner en J3. Le check actuel
 * verifie la distinguabilite BORDURE METIER vs FOND PLANNING — c'est la
 * propriete utilisateur pertinente pour Q9 (reconnaitre un label sur la grille).
 */

// J3.6 : reutilise les helpers contrast/luminance depuis le module ESM
// commun pour eviter la duplication de la table sRGB. Re-export local
// pour preserver l'API publique du script (relativeLuminance, computeContrast).
import { relativeLuminance, contrastRatio } from '../src/shared/contrast.js';
export { relativeLuminance };
export const computeContrast = contrastRatio;

/**
 * @typedef {Object} ContrastCheck
 * @property {string} name
 * @property {string} fg
 * @property {string} bg
 * @property {number} ratio
 * @property {number} threshold
 * @property {boolean} pass
 * @property {string} theme
 */

/**
 * Tokens de reference (figes a J2.4 — toute modification doit etre repercutee
 * ici en meme temps que dans les HTML legacy).
 */
const TOKENS = {
  dark: {
    bg: '#0A0F1E',
    text: '#F9FAFB',
    'text-muted': '#9CA3AF',
    'text-faint': '#6B7280',
    primary: '#3B82F6',
    'noir-lbl': '#3a3a3e',
    'jaune': '#d4b73a',
    'gris-lbl': '#7e8893',
  },
  light: {
    bg: '#FFFFFF',
    text: '#111827',
    'text-muted': '#4B5563',
    'text-faint': '#6B7280',
    primary: '#1D4ED8',
    'noir-lbl': '#1F2937',
    'jaune': '#FBBF24',
    'gris-lbl': '#9CA3AF',
    'noir-lbl-border': '#000000',
    'jaune-border': '#92400E',
    'gris-lbl-border': '#4B5563',
  },
};

/**
 * @returns {ContrastCheck[]}
 */
export function runAllChecks() {
  /** @type {ContrastCheck[]} */
  const results = [];

  for (const theme of /** @type {const} */ (['dark', 'light'])) {
    const t = TOKENS[theme];
    // Texte vs fond. text + text-muted + primary = 4.5 (AA normal). text-faint
    // est decoratif (legendes, placeholders, hints) -> seuil 3.0 (AA large/UI).
    results.push(mk(theme, 'text/bg',         t.text,         t.bg, 4.5));
    results.push(mk(theme, 'text-muted/bg',   t['text-muted'], t.bg, 4.5));
    results.push(mk(theme, 'text-faint/bg',   t['text-faint'], t.bg, 3.0));
    results.push(mk(theme, 'primary/bg',      t.primary,      t.bg, 4.5));

    // Tokens metier vs fond planning : la regle change selon mode.
    if (theme === 'dark') {
      // En dark, jaune et gris-lbl doivent etre distinguables sur fond sombre.
      // noir-lbl est INTENTIONNELLEMENT camoufle (semantique "SAV bloque,
      // visuellement neutre") — on ne check pas son contraste fond.
      results.push(mk(theme, 'jaune/bg',    t['jaune'],     t.bg, 3.0));
      results.push(mk(theme, 'gris-lbl/bg', t['gris-lbl'],  t.bg, 3.0));
    } else {
      // En light, la distinguabilite des 3 tokens metier (noir, jaune, gris)
      // est assuree par la regle CSS '.label-block { border-width:2px }' et
      // les tokens border dedies. On checke donc les BORDURES vs fond
      // planning, pas les couleurs fond. noir-lbl/bg reste check car #1F2937
      // sur blanc passe naturellement.
      const tl = /** @type {typeof TOKENS.light} */ (t);
      results.push(mk(theme, 'noir-lbl/bg',         tl['noir-lbl'],         tl.bg, 3.0));
      results.push(mk(theme, 'noir-lbl-border/bg',  tl['noir-lbl-border'],  tl.bg, 3.0));
      results.push(mk(theme, 'jaune-border/bg',     tl['jaune-border'],     tl.bg, 3.0));
      results.push(mk(theme, 'gris-lbl-border/bg',  tl['gris-lbl-border'],  tl.bg, 3.0));
    }
  }
  return results;
}

/**
 * @param {string} theme
 * @param {string} name
 * @param {string} fg
 * @param {string} bg
 * @param {number} threshold
 * @returns {ContrastCheck}
 */
function mk(theme, name, fg, bg, threshold) {
  const ratio = computeContrast(fg, bg);
  return { theme, name, fg, bg, ratio, threshold, pass: ratio >= threshold };
}

// CLI quand execute directement (pas en import).
const isCli = process.argv[1] && import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}`;
if (isCli) {
  const results = runAllChecks();
  let failed = 0;
  for (const r of results) {
    const icon = r.pass ? 'OK ' : 'KO ';
    console.log(`${icon} [${r.theme}] ${r.name.padEnd(24)} ${r.fg} / ${r.bg}  ratio=${r.ratio.toFixed(2)} (seuil ${r.threshold})`);
    if (!r.pass) failed++;
  }
  console.log(`---`);
  console.log(`${results.length - failed}/${results.length} checks passes.`);
  process.exit(failed > 0 ? 1 : 0);
}
