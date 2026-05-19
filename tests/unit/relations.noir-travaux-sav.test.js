// @ts-check
import { describe, it, expect, beforeEach } from 'vitest';
import { Bus } from '../../src/shared/bus.js';
import { UndoStack } from '../../src/shared/undo.js';
import { register, RULE_ID } from '../../src/relations/noir-travaux-sav.js';

function makeStore() {
  return {
    etiquettes:     /** @type {any[]} */ ([]),
    etiquettes_sav: /** @type {any[]} */ ([]),
  };
}

describe('noir-travaux-sav', () => {
  /** @type {Bus} */       let bus;
  /** @type {UndoStack} */ let undo;
  /** @type {ReturnType<typeof makeStore>} */ let store;

  beforeEach(() => {
    bus = new Bus();
    undo = new UndoStack();
    store = makeStore();
    register(bus, undo, store);
  });

  it('sav.label.created (monteur-zone, etiquetteNoirId) => noir.data.travaux_sav rempli', () => {
    store.etiquettes.push({ id: 'N1', type: 'noir', data: {} });
    const s = { id: 'S1', type: 'sav-x', estMonteurZone: true, etiquetteNoirId: 'N1' };
    store.etiquettes_sav.push(s);

    bus.emit('sav.label.created', { label: s });

    expect(store.etiquettes[0].data.travaux_sav).toEqual([s]);
  });

  it('sav.label sans estMonteurZone => ignore', () => {
    store.etiquettes.push({ id: 'N1', type: 'noir' });
    const s = { id: 'S1', type: 'sav-x', etiquetteNoirId: 'N1' };
    store.etiquettes_sav.push(s);
    bus.emit('sav.label.created', { label: s });
    expect(undo.canUndo()).toBe(false);
  });

  it('sav.label sans etiquetteNoirId => ignore', () => {
    store.etiquettes.push({ id: 'N1', type: 'noir' });
    const s = { id: 'S1', type: 'sav-x', estMonteurZone: true };
    store.etiquettes_sav.push(s);
    bus.emit('sav.label.created', { label: s });
    expect(undo.canUndo()).toBe(false);
  });

  it('noir cible inexistant => no-op', () => {
    const s = { id: 'S1', type: 'sav-x', estMonteurZone: true, etiquetteNoirId: 'NX' };
    store.etiquettes_sav.push(s);
    bus.emit('sav.label.created', { label: s });
    expect(undo.canUndo()).toBe(false);
  });

  it('idempotent : 2eme emit identique = no-op (memes IDs)', () => {
    store.etiquettes.push({ id: 'N1', type: 'noir', data: {} });
    const s = { id: 'S1', type: 'sav-x', estMonteurZone: true, etiquetteNoirId: 'N1' };
    store.etiquettes_sav.push(s);
    bus.emit('sav.label.created', { label: s });
    expect(undo.canUndo()).toBe(true);
    undo.clear();
    bus.emit('sav.label.updated', { label: s });
    expect(undo.canUndo()).toBe(false);
  });

  it('agregge plusieurs SAV pour le meme noir', () => {
    store.etiquettes.push({ id: 'N1', type: 'noir', data: {} });
    const s1 = { id: 'S1', type: 'sav', estMonteurZone: true, etiquetteNoirId: 'N1' };
    const s2 = { id: 'S2', type: 'sav', estMonteurZone: true, etiquetteNoirId: 'N1' };
    store.etiquettes_sav.push(s1, s2);
    bus.emit('sav.label.created', { label: s2 });
    expect(store.etiquettes[0].data.travaux_sav).toHaveLength(2);
  });

  it('sav.label.deleted (apres retrait du store_sav) recompute correctement', () => {
    store.etiquettes.push({ id: 'N1', type: 'noir', data: { travaux_sav: [{ id: 'S1' }] } });
    const s = { id: 'S1', type: 'sav', estMonteurZone: true, etiquetteNoirId: 'N1' };
    // s a deja ete supprime du store : on simule.
    // store_sav vide => recompute => next=[].
    bus.emit('sav.label.deleted', { label: s });
    expect(store.etiquettes[0].data.travaux_sav).toEqual([]);
  });

  it('sav.label.moved avec prevEtiquetteNoirId => recompute LES DEUX noirs', () => {
    store.etiquettes.push({ id: 'N1', type: 'noir', data: { travaux_sav: [{ id: 'S1' }] } });
    store.etiquettes.push({ id: 'N2', type: 'noir', data: {} });
    const s = { id: 'S1', type: 'sav', estMonteurZone: true, etiquetteNoirId: 'N2' };
    store.etiquettes_sav.push(s);

    bus.emit('sav.label.moved', { label: s, prevEtiquetteNoirId: 'N1' });

    expect(store.etiquettes.find((e) => e.id === 'N1').data.travaux_sav).toEqual([]);
    expect(store.etiquettes.find((e) => e.id === 'N2').data.travaux_sav).toEqual([s]);
  });

  it('undo restaure les anciens travaux_sav (cas simple)', () => {
    store.etiquettes.push({ id: 'N1', type: 'noir', data: {} });
    const s = { id: 'S1', type: 'sav', estMonteurZone: true, etiquetteNoirId: 'N1' };
    store.etiquettes_sav.push(s);
    bus.emit('sav.label.created', { label: s });
    expect(store.etiquettes[0].data.travaux_sav).toEqual([s]);
    undo.undo();
    expect(store.etiquettes[0].data.travaux_sav).toBeUndefined();
  });

  it('redo refait le recompute', () => {
    store.etiquettes.push({ id: 'N1', type: 'noir', data: {} });
    const s = { id: 'S1', type: 'sav', estMonteurZone: true, etiquetteNoirId: 'N1' };
    store.etiquettes_sav.push(s);
    bus.emit('sav.label.created', { label: s });
    undo.undo();
    undo.redo();
    expect(store.etiquettes[0].data.travaux_sav).toEqual([s]);
  });

  it('anti-cycle visited', () => {
    store.etiquettes.push({ id: 'N1', type: 'noir', data: {} });
    const s = { id: 'S1', type: 'sav', estMonteurZone: true, etiquetteNoirId: 'N1' };
    store.etiquettes_sav.push(s);
    const ctx = {};
    bus.emit('sav.label.created', { label: s }, ctx);
    undo.clear();
    // 2eme emit avec meme ctx (cascade) : visited.has('S1:noir-travaux-sav')
    bus.emit('sav.label.updated', { label: s }, ctx);
    expect(undo.canUndo()).toBe(false);
  });

  it('events sans label ne plante pas', () => {
    expect(() => bus.emit('sav.label.created', {})).not.toThrow();
    expect(() => bus.emit('sav.label.deleted', { label: null })).not.toThrow();
  });

  it('RULE_ID stable', () => {
    expect(RULE_ID).toBe('noir-travaux-sav');
  });
});
