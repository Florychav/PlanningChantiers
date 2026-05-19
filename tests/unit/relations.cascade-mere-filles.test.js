// @ts-check
import { describe, it, expect, beforeEach } from 'vitest';
import { Bus } from '../../src/shared/bus.js';
import { UndoStack } from '../../src/shared/undo.js';
import { register, RULE_ID } from '../../src/relations/cascade-mere-filles.js';

function makeStore() {
  return { etiquettes: /** @type {any[]} */ ([]) };
}

describe('cascade-mere-filles', () => {
  /** @type {Bus} */       let bus;
  /** @type {UndoStack} */ let undo;
  /** @type {ReturnType<typeof makeStore>} */ let store;

  beforeEach(() => {
    bus = new Bus();
    undo = new UndoStack();
    store = makeStore();
    register(bus, undo, store);
  });

  it('suppression mere => filles motherLabelId supprimees', () => {
    const M = { id: 'M', type: 'rouge' };
    store.etiquettes.push(M);
    store.etiquettes.push({ id: 'C1', type: 'jaune', motherLabelId: 'M' });
    store.etiquettes.push({ id: 'C2', type: 'gris',  motherLabelId: 'M' });
    store.etiquettes.push({ id: 'X',  type: 'rouge', motherLabelId: 'OTHER' });

    bus.emit('label.deleted', { label: M });

    expect(store.etiquettes.map((e) => e.id).sort()).toEqual(['M', 'X']);
  });

  it('fille avec linkedLabelId => linked supprimee aussi', () => {
    store.etiquettes.push({ id: 'M', type: 'rouge' });
    store.etiquettes.push({ id: 'C', type: 'jaune', motherLabelId: 'M', linkedLabelId: 'L' });
    store.etiquettes.push({ id: 'L', type: 'jaune', linkedFromId: 'C' });

    bus.emit('label.deleted', { label: { id: 'M' } });

    expect(store.etiquettes.map((e) => e.id)).toEqual(['M']); // M reste, C+L supprimees
  });

  it('label sans filles => no-op', () => {
    store.etiquettes.push({ id: 'A', type: 'rouge' });
    bus.emit('label.deleted', { label: { id: 'A' } });
    expect(store.etiquettes).toHaveLength(1);
    expect(undo.canUndo()).toBe(false);
  });

  it('plusieurs niveaux : grand-mere => filles directes seulement (pas petites-filles)', () => {
    // La cascade ne descend qu'a 1 niveau. Si on veut descendre profond, c'est
    // au caller d'emit label.deleted en sequence (ou de propager via ctx).
    store.etiquettes.push({ id: 'GM', type: 'rouge' });
    store.etiquettes.push({ id: 'M',  type: 'rouge', motherLabelId: 'GM' });
    store.etiquettes.push({ id: 'F',  type: 'jaune', motherLabelId: 'M' });

    bus.emit('label.deleted', { label: { id: 'GM' } });

    // M supprime, mais F reste (descend pas en cascade transitive).
    const remaining = store.etiquettes.map((e) => e.id).sort();
    expect(remaining).toEqual(['F', 'GM']);
  });

  it('undo restaure les filles supprimees', () => {
    store.etiquettes.push({ id: 'M', type: 'rouge' });
    store.etiquettes.push({ id: 'C', type: 'jaune', motherLabelId: 'M' });
    bus.emit('label.deleted', { label: { id: 'M' } });
    expect(store.etiquettes.find((e) => e.id === 'C')).toBeUndefined();

    undo.undo();
    expect(store.etiquettes.find((e) => e.id === 'C')).toBeDefined();
  });

  it('redo re-supprime', () => {
    store.etiquettes.push({ id: 'M', type: 'rouge' });
    store.etiquettes.push({ id: 'C', type: 'jaune', motherLabelId: 'M' });
    bus.emit('label.deleted', { label: { id: 'M' } });
    undo.undo();
    undo.redo();
    expect(store.etiquettes.find((e) => e.id === 'C')).toBeUndefined();
  });

  it('anti-cycle : meme ctx 2eme emit ignore', () => {
    store.etiquettes.push({ id: 'M', type: 'rouge' });
    store.etiquettes.push({ id: 'C', type: 'jaune', motherLabelId: 'M' });
    const ctx = {};
    bus.emit('label.deleted', { label: { id: 'M' } }, ctx);
    expect(undo.canUndo()).toBe(true);
    undo.clear();
    bus.emit('label.deleted', { label: { id: 'M' } }, ctx);
    expect(undo.canUndo()).toBe(false);
  });

  it('events sans label ne plante pas', () => {
    expect(() => bus.emit('label.deleted', {})).not.toThrow();
    expect(() => bus.emit('label.deleted', { label: null })).not.toThrow();
  });

  it('RULE_ID stable', () => {
    expect(RULE_ID).toBe('cascade-mere-filles');
  });
});
