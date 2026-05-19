// @ts-check
import { describe, it, expect, beforeEach } from 'vitest';
import { Bus } from '../../src/shared/bus.js';
import { UndoStack } from '../../src/shared/undo.js';
import { register, shouldAllowDelete, RULE_ID } from '../../src/relations/verrou-noir.js';

describe('verrou-noir — reactions bus', () => {
  /** @type {Bus} */     let bus;
  /** @type {UndoStack} */ let undo;
  /** @type {() => void} */ let off;

  beforeEach(() => {
    bus = new Bus();
    undo = new UndoStack();
    off = register(bus, undo);
  });

  it('label.created type=noir => verrouille:true', () => {
    const label = { id: 'L1', type: 'noir' };
    bus.emit('label.created', { label });
    expect(label.verrouille).toBe(true);
    expect(undo.canUndo()).toBe(true);
  });

  it('label.updated noir -> autre type => verrouille devient false', () => {
    const label = { id: 'L1', type: 'noir', verrouille: true };
    bus.emit('label.updated', { label });
    // Le label est passe a 'noir' mais deja lock, donc rien ne devrait changer.
    expect(label.verrouille).toBe(true);
    // Simulons maintenant un changement de type
    label.type = 'rouge';
    bus.emit('label.updated', { label });
    expect(label.verrouille).toBe(false);
  });

  it('label.created autre type => verrouille reste/passe a false (no-op si pas lock)', () => {
    const label = { id: 'L1', type: 'rouge' };
    bus.emit('label.created', { label });
    expect(label.verrouille).toBeUndefined(); // jamais touche
    expect(undo.canUndo()).toBe(false);
  });

  it('undo restaure l\'etat verrouille precedent', () => {
    const label = { id: 'L1', type: 'noir' };
    bus.emit('label.created', { label });
    expect(label.verrouille).toBe(true);
    undo.undo();
    expect(label.verrouille).toBe(false);
  });

  it('redo refait le lock', () => {
    const label = { id: 'L1', type: 'noir' };
    bus.emit('label.created', { label });
    undo.undo();
    undo.redo();
    expect(label.verrouille).toBe(true);
  });

  it('event sans label ne plante pas', () => {
    expect(() => bus.emit('label.created', {})).not.toThrow();
    expect(() => bus.emit('label.created', { label: null })).not.toThrow();
  });

  it('anti-cycle : 2eme emit avec meme ctx ne re-declenche pas', () => {
    const label = { id: 'L1', type: 'noir' };
    const ctx = {};
    bus.emit('label.created', { label }, ctx);
    expect(undo.canUndo()).toBe(true);
    undo.clear();
    // Re-emit avec MEME ctx (cascade theorique) : visited contient L1:verrou-noir
    bus.emit('label.updated', { label }, ctx);
    expect(undo.canUndo()).toBe(false);
  });

  it('unregister retire les handlers', () => {
    off();
    const label = { id: 'L1', type: 'noir' };
    bus.emit('label.created', { label });
    expect(label.verrouille).toBeUndefined();
  });

  it('expose RULE_ID stable', () => {
    expect(RULE_ID).toBe('verrou-noir');
  });
});

describe('verrou-noir — shouldAllowDelete', () => {
  it('autre type que noir => true', () => {
    expect(shouldAllowDelete({ id: 'L1', type: 'rouge' }, { role: 'viewer' })).toBe(true);
  });

  it('noir non-verrouille => true', () => {
    expect(shouldAllowDelete({ id: 'L1', type: 'noir', verrouille: false }, { role: 'viewer' })).toBe(true);
    expect(shouldAllowDelete({ id: 'L1', type: 'noir' }, { role: 'viewer' })).toBe(true);
  });

  it('noir verrouille + non-admin => false', () => {
    expect(shouldAllowDelete({ id: 'L1', type: 'noir', verrouille: true }, { role: 'editor' })).toBe(false);
    expect(shouldAllowDelete({ id: 'L1', type: 'noir', verrouille: true }, { role: 'viewer' })).toBe(false);
  });

  it('noir verrouille + admin => true', () => {
    expect(shouldAllowDelete({ id: 'L1', type: 'noir', verrouille: true }, { role: 'admin' })).toBe(true);
  });

  it('user null ou undefined avec noir verrouille => false', () => {
    expect(shouldAllowDelete({ id: 'L1', type: 'noir', verrouille: true }, null)).toBe(false);
    expect(shouldAllowDelete({ id: 'L1', type: 'noir', verrouille: true }, undefined)).toBe(false);
  });
});
