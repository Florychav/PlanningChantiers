// @ts-check
import { describe, it, expect } from 'vitest';
import {
  FERIES_INFO,
  FERIES_MIN_YEAR,
  FERIES_MAX_YEAR,
  isHoliday,
  getHolidayInfo,
  isWorkingDayExcludingHolidays,
  addBusinessDaysSkippingHolidays,
  parseISODate,
} from '../../src/shared/dates.js';

describe('FERIES_INFO — contenu calendrier', () => {
  it('couvre 2025, 2026, 2027 (14 feries par an)', () => {
    for (const year of [2025, 2026, 2027]) {
      const keys = Object.keys(FERIES_INFO).filter((k) => k.startsWith(String(year)));
      expect(keys.length, `${year}`).toBe(14);
    }
    expect(Object.keys(FERIES_INFO).length).toBe(42);
  });

  it('FERIES_MIN_YEAR/MAX_YEAR coherents', () => {
    expect(FERIES_MIN_YEAR).toBe(2025);
    expect(FERIES_MAX_YEAR).toBe(2027);
  });

  it('est gele (Object.freeze)', () => {
    expect(Object.isFrozen(FERIES_INFO)).toBe(true);
  });

  it('regles cantonales : 1er mai = GE seul', () => {
    expect(FERIES_INFO['2026-05-01'].cantons).toBe('GE');
  });

  it('regles cantonales : 26 dec = FR seul', () => {
    expect(FERIES_INFO['2026-12-26'].cantons).toBe('FR');
  });

  it('regles cantonales : Fete-Dieu = FR seul', () => {
    expect(FERIES_INFO['2026-06-04'].cantons).toBe('FR');
    expect(FERIES_INFO['2026-06-04'].nom).toContain('Fete-Dieu');
  });

  it('regles cantonales : Restauration de la Republique 31/12 = GE seul', () => {
    expect(FERIES_INFO['2026-12-31'].cantons).toBe('GE');
  });

  it('regles cantonales : Assomption, Toussaint = FR seul', () => {
    expect(FERIES_INFO['2026-08-15'].cantons).toBe('FR');
    expect(FERIES_INFO['2026-11-01'].cantons).toBe('FR');
  });

  it('regles cantonales : Jeune genevois = GE seul', () => {
    expect(FERIES_INFO['2026-09-10'].cantons).toBe('GE');
  });

  it('feries communs : Nouvel An, Vendredi Saint, Paques, Ascension, Pentecote, 1er aout, Noel = FR + GE', () => {
    const communs = ['2026-01-01', '2026-04-03', '2026-04-06', '2026-05-14', '2026-05-25', '2026-08-01', '2026-12-25'];
    for (const k of communs) {
      expect(FERIES_INFO[k].cantons, k).toBe('FR + GE');
    }
  });
});

describe('isHoliday', () => {
  it('vrai pour un ferie commun', () => {
    expect(isHoliday('2026-01-01')).toBe(true);
  });

  it('vrai pour un ferie GE quand pas de filtre', () => {
    expect(isHoliday('2026-05-01')).toBe(true);
  });

  it('faux pour un jour normal', () => {
    expect(isHoliday('2026-05-19')).toBe(false);
  });

  it('filtre canton FR : 1er mai = false (GE seul)', () => {
    expect(isHoliday('2026-05-01', 'FR')).toBe(false);
    expect(isHoliday('2026-05-01', 'GE')).toBe(true);
  });

  it('filtre canton GE : 26 dec = false (FR seul)', () => {
    expect(isHoliday('2026-12-26', 'GE')).toBe(false);
    expect(isHoliday('2026-12-26', 'FR')).toBe(true);
  });

  it('filtre canton FR : Nouvel An = true (commun)', () => {
    expect(isHoliday('2026-01-01', 'FR')).toBe(true);
    expect(isHoliday('2026-01-01', 'GE')).toBe(true);
  });

  it('leve sur annee hors plage', () => {
    expect(() => isHoliday('2024-12-31')).toThrow(/hors calendrier feries/);
    expect(() => isHoliday('2028-01-01')).toThrow(/hors calendrier feries/);
  });
});

describe('getHolidayInfo', () => {
  it('retourne le HolidayInfo si ferie', () => {
    const info = getHolidayInfo('2026-06-04');
    expect(info?.nom).toContain('Fete-Dieu');
    expect(info?.cantons).toBe('FR');
  });

  it('retourne undefined si pas ferie', () => {
    expect(getHolidayInfo('2026-05-19')).toBeUndefined();
  });

  it('leve sur annee hors plage', () => {
    expect(() => getHolidayInfo('2030-01-01')).toThrow();
  });
});

describe('isWorkingDayExcludingHolidays', () => {
  it('un mardi normal = true', () => {
    expect(isWorkingDayExcludingHolidays(parseISODate('2026-05-19'))).toBe(true);
  });

  it('un samedi = false', () => {
    expect(isWorkingDayExcludingHolidays(parseISODate('2026-05-23'))).toBe(false);
  });

  it('Noel 2026 (vendredi) = false (ferie commun)', () => {
    expect(isWorkingDayExcludingHolidays(parseISODate('2026-12-25'))).toBe(false);
  });

  it('1er mai 2026 (vendredi) sans canton = false (GE le marque ferie)', () => {
    expect(isWorkingDayExcludingHolidays(parseISODate('2026-05-01'))).toBe(false);
  });

  it('1er mai 2026 filtre FR = true (pas ferie pour FR)', () => {
    expect(isWorkingDayExcludingHolidays(parseISODate('2026-05-01'), 'FR')).toBe(true);
  });

  it('1er mai 2026 filtre GE = false (ferie pour GE)', () => {
    expect(isWorkingDayExcludingHolidays(parseISODate('2026-05-01'), 'GE')).toBe(false);
  });

  it('26 dec 2026 (samedi) = false (samedi de toute facon)', () => {
    expect(isWorkingDayExcludingHolidays(parseISODate('2026-12-26'))).toBe(false);
  });
});

describe('addBusinessDaysSkippingHolidays', () => {
  it('n=0 retourne la date telle quelle', () => {
    expect(addBusinessDaysSkippingHolidays('2026-05-19', 0)).toBe('2026-05-19');
  });

  it('mardi 2026-05-12 +2 jours ouvres = jeudi 2026-05-14 SANS canton ... mais 14 = Ascension (commun), donc skipe au vendredi 15', () => {
    // mardi -> mercredi (+1) -> jeudi 14 Ascension SKIP -> vendredi 15 (+2)
    expect(addBusinessDaysSkippingHolidays('2026-05-12', 2)).toBe('2026-05-15');
  });

  it('+1 jour ouvre depuis jeudi 30 avril 2026 (workdays-only J2.3 donne vendredi 1 mai, mais 1er mai est GE => SKIP, donc lundi 4 mai)', () => {
    expect(addBusinessDaysSkippingHolidays('2026-04-30', 1)).toBe('2026-05-04');
  });

  it('+1 jour avec filtre FR (1er mai non ferie pour FR) => vendredi 1er mai', () => {
    expect(addBusinessDaysSkippingHolidays('2026-04-30', 1, 'FR')).toBe('2026-05-01');
  });

  it('cumul WE + ferie : depuis vendredi 24 dec 2026, +1 jour ouvre = 28 dec (lundi). 25 (sam) = noel ferie + WE, 26 (dim) = WE + St Etienne FR, 27 (lun) = ? -- en fait Noel 2026 c\'est vendredi 25', () => {
    // 2026-12-25 = vendredi (Noel, commun). 2026-12-26 = samedi (St-Etienne FR).
    // Depuis jeudi 24 dec, +1 jour = on cherche le prochain ouvre non-ferie.
    // Vendredi 25 = ferie commun SKIP. Samedi 26 = WE. Dimanche 27 = WE. Lundi 28 = OK.
    expect(addBusinessDaysSkippingHolidays('2026-12-24', 1)).toBe('2026-12-28');
  });

  it('-1 jour ouvre depuis lundi 4 mai 2026 sans canton = jeudi 30 avril (1er mai GE skip + we)', () => {
    expect(addBusinessDaysSkippingHolidays('2026-05-04', -1)).toBe('2026-04-30');
  });
});
