// @ts-check
import { describe, it, expect } from 'vitest';
import { generateId } from '../../src/shared/ids.js';

describe('generateId', () => {
  it('retourne une string non-vide', () => {
    const id = generateId();
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
  });

  it('produit des ids uniques sur 1000 iterations', () => {
    const set = new Set();
    for (let i = 0; i < 1000; i++) set.add(generateId());
    expect(set.size).toBe(1000);
  });
});
