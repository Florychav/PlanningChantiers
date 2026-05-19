// @ts-check
import { describe, it, expect } from 'vitest';
import { normalizeName, getLignesCommunes } from '../../src/relations/lignes-communes.js';
import { getMonteursEnSav } from '../../src/relations/monteurs-en-sav.js';

describe('normalizeName', () => {
  it('lowercase + trim + diacritiques retires', () => {
    expect(normalizeName('  Florent  ')).toBe('florent');
    expect(normalizeName('FlOrEnT')).toBe('florent');
    expect(normalizeName('Flòrent')).toBe('florent');
    expect(normalizeName('Éric')).toBe('eric');
    expect(normalizeName('Münir')).toBe('munir');
  });

  it('undefined / vide => ""', () => {
    expect(normalizeName(undefined)).toBe('');
    expect(normalizeName('')).toBe('');
  });
});

describe('getLignesCommunes', () => {
  it('match prenom+nom egales', () => {
    const montage = [
      { id: 'm1', prenom: 'Florent', nom: 'Chavanon' },
      { id: 'm2', prenom: 'Alice',   nom: 'Dupont' },
    ];
    const sav = [
      { id: 's1', prenom: 'Florent', nom: 'Chavanon' },
    ];
    const r = getLignesCommunes(montage, sav);
    expect(r).toHaveLength(1);
    expect(r[0].montage.id).toBe('m1');
    expect(r[0].sav.id).toBe('s1');
  });

  it('insensible casse + accents', () => {
    const montage = [{ id: 'm1', prenom: 'Éric',   nom: 'Müller' }];
    const sav     = [{ id: 's1', prenom: 'eric',   nom: 'muller' }];
    expect(getLignesCommunes(montage, sav)).toHaveLength(1);
  });

  it('non-match si prenom OU nom different', () => {
    const montage = [{ id: 'm1', prenom: 'Florent', nom: 'Chavanon' }];
    expect(getLignesCommunes(montage, [{ id: 's1', prenom: 'Florent', nom: 'Autre' }])).toHaveLength(0);
    expect(getLignesCommunes(montage, [{ id: 's2', prenom: 'Autre',   nom: 'Chavanon' }])).toHaveLength(0);
  });

  it('ignore les personnes sans prenom ET sans nom', () => {
    const montage = [{ id: 'm1' }];
    const sav     = [{ id: 's1' }];
    expect(getLignesCommunes(montage, sav)).toHaveLength(0);
  });

  it('plusieurs lignes communes preservent l\'ordre de personnesMontage', () => {
    const montage = [
      { id: 'm1', prenom: 'Alice', nom: 'A' },
      { id: 'm2', prenom: 'Bob',   nom: 'B' },
      { id: 'm3', prenom: 'Carol', nom: 'C' },
    ];
    const sav = [
      { id: 's3', prenom: 'Carol', nom: 'C' },
      { id: 's1', prenom: 'Alice', nom: 'A' },
    ];
    const r = getLignesCommunes(montage, sav);
    expect(r.map((x) => x.montage.id)).toEqual(['m1', 'm3']);
  });

  it('vide si aucune cote sav', () => {
    expect(getLignesCommunes([{ id: 'a', prenom: 'X', nom: 'Y' }], [])).toEqual([]);
  });
});

describe('getMonteursEnSav', () => {
  it('retourne les personneId avec noir chevauchant la fenetre', () => {
    const etiq = [
      { id: 'a', type: 'noir', personneId: 'P1', dateDebut: '2026-05-18', dateFin: '2026-05-20' },
      { id: 'b', type: 'noir', personneId: 'P2', dateDebut: '2026-05-25', dateFin: '2026-05-27' },
      { id: 'c', type: 'rouge', personneId: 'P3', dateDebut: '2026-05-19', dateFin: '2026-05-19' },
    ];
    const r = getMonteursEnSav(etiq, '2026-05-19', '2026-05-22');
    expect(r).toEqual(new Set(['P1'])); // P2 hors fenetre, P3 pas noir
  });

  it('overlap inclusif (borne identique = match)', () => {
    const etiq = [{ id: 'a', type: 'noir', personneId: 'P1', dateDebut: '2026-05-20', dateFin: '2026-05-20' }];
    expect(getMonteursEnSav(etiq, '2026-05-18', '2026-05-20')).toEqual(new Set(['P1']));
    expect(getMonteursEnSav(etiq, '2026-05-20', '2026-05-22')).toEqual(new Set(['P1']));
  });

  it('aucun match si label hors fenetre', () => {
    const etiq = [{ id: 'a', type: 'noir', personneId: 'P1', dateDebut: '2026-05-18', dateFin: '2026-05-18' }];
    expect(getMonteursEnSav(etiq, '2026-05-19', '2026-05-22')).toEqual(new Set());
  });

  it('plusieurs personnes', () => {
    const etiq = [
      { type: 'noir', personneId: 'P1', dateDebut: '2026-05-18', dateFin: '2026-05-22' },
      { type: 'noir', personneId: 'P2', dateDebut: '2026-05-19', dateFin: '2026-05-19' },
      { type: 'noir', personneId: 'P3', dateDebut: '2026-04-01', dateFin: '2026-04-01' },
    ];
    expect(getMonteursEnSav(etiq, '2026-05-18', '2026-05-22')).toEqual(new Set(['P1', 'P2']));
  });

  it('ignore labels sans personneId / dates manquantes', () => {
    const etiq = [
      { type: 'noir', dateDebut: '2026-05-18', dateFin: '2026-05-22' },
      { type: 'noir', personneId: 'P1', dateDebut: '2026-05-18' }, // pas de dateFin
    ];
    expect(getMonteursEnSav(etiq, '2026-05-18', '2026-05-22')).toEqual(new Set());
  });
});
