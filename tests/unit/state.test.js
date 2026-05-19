// @ts-check
import { describe, it, expect, beforeEach } from 'vitest';
import { state, resetState, findEtiquette, findPersonne } from '../../src/shared/state.js';

describe('state', () => {
  beforeEach(() => resetState());

  it('expose etiquettes et personnes initialement vides apres reset', () => {
    expect(state.etiquettes).toEqual([]);
    expect(state.personnes).toEqual([]);
  });

  it('findEtiquette retourne l\'instance par id', () => {
    state.etiquettes.push({ id: 'a', type: 'rouge' });
    state.etiquettes.push({ id: 'b', type: 'bleu' });
    expect(findEtiquette('b')?.type).toBe('bleu');
    expect(findEtiquette('zzz')).toBeUndefined();
  });

  it('findPersonne retourne l\'instance par id', () => {
    state.personnes.push({ id: 'p1', prenom: 'Flory', groupe: 'Monteur' });
    expect(findPersonne('p1')?.prenom).toBe('Flory');
    expect(findPersonne('zzz')).toBeUndefined();
  });

  it('resetState() vide les deux collections', () => {
    state.etiquettes.push({ id: 'a', type: 'rouge' });
    state.personnes.push({ id: 'p', prenom: 'X' });
    resetState();
    expect(state.etiquettes).toEqual([]);
    expect(state.personnes).toEqual([]);
  });
});
