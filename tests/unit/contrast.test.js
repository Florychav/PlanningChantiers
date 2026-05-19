// @ts-check
import { describe, it, expect } from 'vitest';
import {
  hexToRgb,
  relativeLuminance,
  contrastRatio,
  pickTextColor,
  TEXT_ON_LIGHT,
  TEXT_ON_DARK,
} from '../../src/shared/contrast.js';

describe('hexToRgb', () => {
  it('parse #rrggbb', () => {
    expect(hexToRgb('#000000')).toEqual([0, 0, 0]);
    expect(hexToRgb('#FFFFFF')).toEqual([255, 255, 255]);
    expect(hexToRgb('#FF0080')).toEqual([255, 0, 128]);
  });

  it('parse #rgb (forme courte)', () => {
    expect(hexToRgb('#000')).toEqual([0, 0, 0]);
    expect(hexToRgb('#fff')).toEqual([255, 255, 255]);
    expect(hexToRgb('#f0a')).toEqual([255, 0, 170]);
  });

  it('insensible casse', () => {
    expect(hexToRgb('#abcdef')).toEqual(hexToRgb('#ABCDEF'));
  });

  it('rejette formats invalides', () => {
    expect(() => hexToRgb('123456')).toThrow();
    expect(() => hexToRgb('#zzz')).toThrow();
    expect(() => hexToRgb('#1234')).toThrow();
  });
});

describe('relativeLuminance', () => {
  it('noir = 0, blanc = 1', () => {
    expect(relativeLuminance('#000000')).toBe(0);
    expect(relativeLuminance('#FFFFFF')).toBeCloseTo(1, 5);
  });

  it('gris medium ~0.21', () => {
    // #808080 = 50% gris : luminance ~0.215
    expect(relativeLuminance('#808080')).toBeGreaterThan(0.18);
    expect(relativeLuminance('#808080')).toBeLessThan(0.25);
  });

  it('jaune vif (#FBBF24) > 0.5', () => {
    expect(relativeLuminance('#FBBF24')).toBeGreaterThan(0.5);
  });
});

describe('contrastRatio', () => {
  it('noir/blanc = 21', () => {
    expect(contrastRatio('#000', '#FFF')).toBeCloseTo(21, 0);
  });

  it('symmetrique', () => {
    expect(contrastRatio('#123', '#abc')).toBeCloseTo(contrastRatio('#abc', '#123'), 4);
  });

  it('couleur identique = 1', () => {
    expect(contrastRatio('#888', '#888')).toBe(1);
  });
});

describe('pickTextColor', () => {
  it('fond blanc => texte sombre', () => {
    expect(pickTextColor('#FFFFFF')).toBe(TEXT_ON_LIGHT);
  });

  it('fond noir => texte clair', () => {
    expect(pickTextColor('#000000')).toBe(TEXT_ON_DARK);
  });

  it('fond noir-lbl (#1F2937 mode light) => texte clair', () => {
    expect(pickTextColor('#1F2937')).toBe(TEXT_ON_DARK);
  });

  it('fond jaune vif (#FBBF24) => texte sombre (luminance > 0.6)', () => {
    expect(pickTextColor('#FBBF24')).toBe(TEXT_ON_LIGHT);
  });

  it('fond gris medium (#9CA3AF) => texte sombre (zone limite, contraste max)', () => {
    expect(pickTextColor('#9CA3AF')).toBe(TEXT_ON_LIGHT);
  });

  it('choix toujours = max contraste possible parmi {LIGHT, DARK}', () => {
    // Note : certaines couleurs (vert/rouge medium-saturated) n'atteignent
    // pas AA 4.5 avec ni LIGHT ni DARK. pickTextColor maximise le contraste
    // mais ne peut pas faire mieux que le meilleur des deux. Le test verifie
    // qu'on ne choisit JAMAIS pire que l'alternative.
    const palette = ['#FFFFFF', '#000000', '#1F2937', '#FBBF24', '#9CA3AF', '#3B82F6', '#10B981', '#EF4444'];
    for (const bg of palette) {
      const txt = pickTextColor(bg);
      const chosen = contrastRatio(txt, bg);
      const alt = txt === TEXT_ON_LIGHT
        ? contrastRatio(TEXT_ON_DARK, bg)
        : contrastRatio(TEXT_ON_LIGHT, bg);
      expect(chosen, `bg=${bg} (chosen=${txt})`).toBeGreaterThanOrEqual(alt);
    }
  });

  it('AA 4.5 atteint sur les fonds metier du theme light', () => {
    // verrou-noir / jaune-protocoleur / gris-installation en mode clair.
    const businessBgs = ['#1F2937', '#FBBF24', '#9CA3AF'];
    for (const bg of businessBgs) {
      const ratio = contrastRatio(pickTextColor(bg), bg);
      expect(ratio, `bg=${bg}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('forme courte hex acceptee', () => {
    expect(pickTextColor('#fff')).toBe(TEXT_ON_LIGHT);
    expect(pickTextColor('#000')).toBe(TEXT_ON_DARK);
  });
});
