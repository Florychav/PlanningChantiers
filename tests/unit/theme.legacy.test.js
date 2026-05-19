// @ts-check
/**
 * J2.4 — Verification figeage Q9 + WCAG AA Q8 sur les blocs CSS legacy.
 *
 * Snapshot Q9 : extrait le bloc `:root[data-theme="light"]` de chaque HTML
 * legacy et le fige via toMatchSnapshot. Toute modification non concertee
 * (intentionnelle ou regression) casse le build.
 *
 * WCAG Q8 : delegue a scripts/check-wcag.mjs et asserte que tous les checks
 * passent (dark + light, texte/fond + bordures metier/fond planning).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { runAllChecks } from '../../scripts/check-wcag.mjs';

const MONTAGE = 'planning-montage.html';
const SAV     = 'planning-sav.html';

/**
 * Extrait le bloc CSS demarrant a `:root[data-theme="light"]{` jusqu'au `}`
 * matchant (premier niveau de braces).
 * @param {string} src
 * @returns {string}
 */
function extractLightBlock(src) {
  const start = src.indexOf(':root[data-theme="light"]{');
  if (start < 0) throw new Error('bloc light introuvable');
  let i = src.indexOf('{', start);
  let depth = 1;
  i++;
  while (i < src.length && depth > 0) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') depth--;
    i++;
  }
  return src.slice(start, i);
}

describe('Q9 — figeage bloc :root[data-theme="light"]', () => {
  it('planning-montage.html : bloc light fige', () => {
    const src = readFileSync(MONTAGE, 'utf-8');
    const block = extractLightBlock(src);
    expect(block).toMatchSnapshot();
  });

  it('planning-sav.html : bloc light fige', () => {
    const src = readFileSync(SAV, 'utf-8');
    const block = extractLightBlock(src);
    expect(block).toMatchSnapshot();
  });

  it('planning-montage.html : regle .label-block border 2px en mode light presente', () => {
    const src = readFileSync(MONTAGE, 'utf-8');
    expect(src).toContain(':root[data-theme="light"] .label-block{');
    expect(src).toContain('border-width:2px;');
  });

  it('planning-sav.html : regle .label-block border 2px en mode light presente', () => {
    const src = readFileSync(SAV, 'utf-8');
    expect(src).toContain(':root[data-theme="light"] .label-block{');
    expect(src).toContain('border-width:2px;');
  });
});

describe('Q8 — WCAG AA scripte', () => {
  const results = runAllChecks();

  it('au moins 14 checks executes (dark + light + bordures)', () => {
    expect(results.length).toBeGreaterThanOrEqual(14);
  });

  for (const r of results) {
    it(`[${r.theme}] ${r.name} : ratio ${r.ratio.toFixed(2)} >= ${r.threshold}`, () => {
      expect(r.pass).toBe(true);
    });
  }
});

describe('J2.4 — boot snippet present dans legacy', () => {
  it('planning-montage.html : boot snippet anti-FOUC present', () => {
    const src = readFileSync(MONTAGE, 'utf-8');
    expect(src).toContain("J2.4 boot theme");
    expect(src).toContain("localStorage.getItem('planning.theme')");
    expect(src).toContain("document.documentElement.dataset.theme");
  });

  it('planning-sav.html : boot snippet anti-FOUC present', () => {
    const src = readFileSync(SAV, 'utf-8');
    expect(src).toContain("J2.4 boot theme");
    expect(src).toContain("localStorage.getItem('planning.theme')");
    expect(src).toContain("document.documentElement.dataset.theme");
  });
});

describe('J2.4 — panneau Parametres present dans legacy', () => {
  it('planning-montage.html : bouton + dialog + handlers presents', () => {
    const src = readFileSync(MONTAGE, 'utf-8');
    expect(src).toContain('onclick="openSettings()"');
    expect(src).toContain('id="settings-dialog"');
    expect(src).toContain('function toggleTheme()');
    expect(src).toContain('id="theme-label"');
  });

  it('planning-sav.html : bouton + dialog + handlers presents', () => {
    const src = readFileSync(SAV, 'utf-8');
    expect(src).toContain('onclick="openSettings()"');
    expect(src).toContain('id="settings-dialog"');
    expect(src).toContain('function toggleTheme()');
    expect(src).toContain('id="theme-label"');
  });
});
