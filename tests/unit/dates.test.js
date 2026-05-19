// @ts-check
import { describe, it, expect } from 'vitest';
import {
  parseISODate,
  formatISODate,
  isWorkingDay,
  addBusinessDays,
  businessDaysBetween,
} from '../../src/shared/dates.js';

describe('parseISODate / formatISODate', () => {
  it('round-trip preserve la date UTC', () => {
    const d = parseISODate('2026-05-19');
    expect(formatISODate(d)).toBe('2026-05-19');
  });

  it('parse rejette les formats invalides', () => {
    expect(() => parseISODate('19/05/2026')).toThrow();
    expect(() => parseISODate('2026-5-9')).toThrow();
    expect(() => parseISODate('not a date')).toThrow();
  });

  it('format pad les mois/jours', () => {
    expect(formatISODate(new Date(Date.UTC(2026, 0, 5)))).toBe('2026-01-05');
  });
});

describe('isWorkingDay', () => {
  it('lundi-vendredi = true', () => {
    // 2026-05-18 = lundi
    for (let i = 0; i < 5; i++) {
      const d = parseISODate('2026-05-18');
      d.setUTCDate(d.getUTCDate() + i);
      expect(isWorkingDay(d)).toBe(true);
    }
  });

  it('samedi-dimanche = false', () => {
    // 2026-05-23 = samedi, 2026-05-24 = dimanche
    expect(isWorkingDay(parseISODate('2026-05-23'))).toBe(false);
    expect(isWorkingDay(parseISODate('2026-05-24'))).toBe(false);
  });
});

describe('addBusinessDays', () => {
  it('n=0 retourne la date telle quelle (meme si we)', () => {
    expect(addBusinessDays('2026-05-23', 0)).toBe('2026-05-23');
  });

  it('n=1 sur lundi -> mardi', () => {
    expect(addBusinessDays('2026-05-18', 1)).toBe('2026-05-19');
  });

  it('n=1 sur vendredi -> lundi suivant', () => {
    // 2026-05-22 = vendredi -> 2026-05-25 = lundi
    expect(addBusinessDays('2026-05-22', 1)).toBe('2026-05-25');
  });

  it('n=5 sur lundi -> lundi suivant', () => {
    expect(addBusinessDays('2026-05-18', 5)).toBe('2026-05-25');
  });

  it('n negatif recule en sautant le we', () => {
    expect(addBusinessDays('2026-05-25', -1)).toBe('2026-05-22'); // lundi -> vendredi
    expect(addBusinessDays('2026-05-19', -1)).toBe('2026-05-18');
  });

  it('partir d\'un samedi puis +1 = lundi suivant', () => {
    expect(addBusinessDays('2026-05-23', 1)).toBe('2026-05-25');
  });
});

describe('businessDaysBetween', () => {
  it('meme jour ouvre = 1', () => {
    expect(businessDaysBetween('2026-05-19', '2026-05-19')).toBe(1);
  });

  it('lundi -> vendredi = 5', () => {
    expect(businessDaysBetween('2026-05-18', '2026-05-22')).toBe(5);
  });

  it('lundi -> lundi suivant = 6 (skip we)', () => {
    expect(businessDaysBetween('2026-05-18', '2026-05-25')).toBe(6);
  });

  it('weekend pur = 0', () => {
    expect(businessDaysBetween('2026-05-23', '2026-05-24')).toBe(0);
  });

  it('a > b retourne 0', () => {
    expect(businessDaysBetween('2026-05-25', '2026-05-18')).toBe(0);
  });
});
