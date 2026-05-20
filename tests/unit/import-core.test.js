// @ts-check
import { describe, it, expect } from 'vitest';
import {
  norm,
  personKey,
  extractCollections,
  chunkArray,
  buildImportPlan,
} from '../../src/import/import-core.js';

/** Generateur d'id deterministe pour les tests. */
function makeGenId() {
  let n = 0;
  return () => `gen-${++n}`;
}

describe('import-core — norm()', () => {
  it('trim + minuscules + suppression des accents', () => {
    expect(norm('  ÉÀÇ  ')).toBe('eac');
    expect(norm('Crémieux')).toBe('cremieux');
  });

  it('tolere null / undefined / nombre', () => {
    expect(norm(null)).toBe('');
    expect(norm(undefined)).toBe('');
    expect(norm(123)).toBe('123');
  });
});

describe('import-core — personKey()', () => {
  it('combine prenom et nom normalises', () => {
    expect(personKey({ prenom: 'Jean', nom: 'Dupé' })).toBe('jean|dupe');
  });

  it('deux variantes accentuees/casse produisent la meme cle', () => {
    expect(personKey({ prenom: 'José', nom: 'PEREZ' })).toBe(
      personKey({ prenom: 'jose', nom: 'perez' }),
    );
  });

  it('tolere un objet vide', () => {
    expect(personKey({})).toBe('|');
    expect(personKey(null)).toBe('|');
  });
});

describe('import-core — extractCollections()', () => {
  it('extrait les 4 collections', () => {
    const c = extractCollections({
      personnes: [{ id: 'p1' }],
      etiquettes: [{ id: 'e1' }, { id: 'e2' }],
      ponts: [{ id: 'po1' }],
      reunions: [],
    });
    expect(c.personnes).toHaveLength(1);
    expect(c.etiquettes).toHaveLength(2);
    expect(c.ponts).toHaveLength(1);
    expect(c.reunions).toHaveLength(0);
  });

  it('remplace toute valeur non-tableau par []', () => {
    const c = extractCollections({ personnes: 'oops', etiquettes: null });
    expect(c.personnes).toEqual([]);
    expect(c.etiquettes).toEqual([]);
    expect(c.ponts).toEqual([]);
    expect(c.reunions).toEqual([]);
  });

  it('tolere null / objet vide', () => {
    expect(extractCollections(null).personnes).toEqual([]);
    expect(extractCollections({}).reunions).toEqual([]);
  });
});

describe('import-core — chunkArray()', () => {
  it('decoupe en lots de taille fixe', () => {
    expect(chunkArray([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it('tableau plus petit que la taille = un seul lot', () => {
    expect(chunkArray([1, 2], 5)).toEqual([[1, 2]]);
  });

  it('tableau vide = aucun lot', () => {
    expect(chunkArray([], 3)).toEqual([]);
  });

  it('leve si size <= 0 ou non entier', () => {
    expect(() => chunkArray([1], 0)).toThrow();
    expect(() => chunkArray([1], -2)).toThrow();
    expect(() => chunkArray([1], 1.5)).toThrow();
  });
});

describe('import-core — buildImportPlan() personnes', () => {
  it('insere les personnes nouvelles avec un id genere', () => {
    const plan = buildImportPlan(
      { personnes: [{ id: 'old-1', prenom: 'Anne', nom: 'Martin' }] },
      [],
      makeGenId(),
    );
    expect(plan.counts.personnesNew).toBe(1);
    expect(plan.counts.personnesSkip).toBe(0);
    expect(plan.idMap['old-1']).toBe('gen-1');
    expect(plan.personnesToInsert[0]).toMatchObject({ id: 'gen-1', prenom: 'Anne' });
    expect(plan.personnesInsertRows[0]).toEqual({
      id: 'gen-1',
      body: { id: 'gen-1', prenom: 'Anne', nom: 'Martin' },
    });
  });

  it('ignore une personne deja en base (meme prenom+nom normalises)', () => {
    const plan = buildImportPlan(
      { personnes: [{ id: 'old-1', prenom: 'José', nom: 'PEREZ' }] },
      [{ id: 'db-uuid-9', prenom: 'jose', nom: 'perez' }],
      makeGenId(),
    );
    expect(plan.counts.personnesNew).toBe(0);
    expect(plan.counts.personnesSkip).toBe(1);
    expect(plan.idMap['old-1']).toBe('db-uuid-9');
    expect(plan.personnesToInsert).toHaveLength(0);
    expect(plan.personnesSkipped[0].existing.id).toBe('db-uuid-9');
  });
});

describe('import-core — buildImportPlan() etiquettes', () => {
  it('remappe personneId et conserve un id existant', () => {
    const plan = buildImportPlan(
      {
        personnes: [{ id: 'old-1', prenom: 'Anne', nom: 'Martin' }],
        etiquettes: [{ id: 'etq-1', personneId: 'old-1', type: 'rouge' }],
      },
      [],
      makeGenId(),
    );
    expect(plan.counts.etiquettes).toBe(1);
    expect(plan.etqRows[0].id).toBe('etq-1');
    expect(plan.etqRows[0].body.personneId).toBe('gen-1');
    expect(plan.etqRows[0].body.type).toBe('rouge');
  });

  it('genere un id pour une etiquette sans id', () => {
    const plan = buildImportPlan(
      {
        personnes: [{ id: 'old-1', prenom: 'Anne', nom: 'Martin' }],
        etiquettes: [{ personneId: 'old-1', type: 'bleu' }],
      },
      [],
      makeGenId(),
    );
    // gen-1 = personne, gen-2 = etiquette sans id
    expect(plan.etqRows[0].id).toBe('gen-2');
  });

  it('ecarte les etiquettes orphelines (personne introuvable)', () => {
    const plan = buildImportPlan(
      {
        personnes: [{ id: 'old-1', prenom: 'Anne', nom: 'Martin' }],
        etiquettes: [
          { id: 'etq-1', personneId: 'old-1' },
          { id: 'etq-2', personneId: 'fantome' },
        ],
      },
      [],
      makeGenId(),
    );
    expect(plan.counts.etiquettes).toBe(1);
    expect(plan.counts.orphanEtiquettes).toBe(1);
    expect(plan.orphanEtiquettes[0].id).toBe('etq-2');
  });
});

describe('import-core — buildImportPlan() ponts & reunions', () => {
  it('ponts : aucun remap, tous conserves', () => {
    const plan = buildImportPlan(
      { ponts: [{ id: 'po-1', date: '2026-05-01' }, { date: '2026-12-24' }] },
      [],
      makeGenId(),
    );
    expect(plan.counts.ponts).toBe(2);
    expect(plan.pontRows[0].id).toBe('po-1');
    expect(plan.pontRows[1].id).toBe('gen-1'); // pont sans id
  });

  it('reunions : remap des ids de personnes, orphelins filtres', () => {
    const plan = buildImportPlan(
      {
        personnes: [
          { id: 'old-1', prenom: 'Anne', nom: 'Martin' },
          { id: 'old-2', prenom: 'Bob', nom: 'Durand' },
        ],
        reunions: [
          { id: 'reu-1', personnes: ['old-1', 'fantome', 'old-2'] },
        ],
      },
      [],
      makeGenId(),
    );
    expect(plan.counts.reunions).toBe(1);
    // old-1 -> gen-1, old-2 -> gen-2, fantome filtre
    expect(plan.reuRows[0].body.personnes).toEqual(['gen-1', 'gen-2']);
  });
});
