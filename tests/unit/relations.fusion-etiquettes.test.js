// @ts-check
import { describe, it, expect, beforeEach } from 'vitest';
import { Bus } from '../../src/shared/bus.js';
import { UndoStack } from '../../src/shared/undo.js';
import { register, RULE_ID, TYPES_AVEC_INSTALLATION } from '../../src/relations/fusion-etiquettes.js';

function makeStore() {
  return { etiquettes: /** @type {any[]} */ ([]) };
}

describe('fusion-etiquettes', () => {
  /** @type {Bus} */       let bus;
  /** @type {UndoStack} */ let undo;
  /** @type {ReturnType<typeof makeStore>} */ let store;

  beforeEach(() => {
    bus = new Bus();
    undo = new UndoStack();
    store = makeStore();
    register(bus, undo, store);
  });

  it('fusion 2 etiquettes consecutives (lun-mer + jeudi-vendr)', () => {
    // mercredi 2026-05-20, jeudi = jour ouvre suivant 2026-05-21
    const A = { id: 'A', type: 'rouge', personneId: 'P', numeroInstallation: 'X', dateDebut: '2026-05-18', dateFin: '2026-05-20' };
    store.etiquettes.push(A);
    const B = { id: 'B', type: 'rouge', personneId: 'P', numeroInstallation: 'X', dateDebut: '2026-05-21', dateFin: '2026-05-22' };
    store.etiquettes.push(B);

    // B est cree apres A et doit absorber A.
    bus.emit('label.created', { label: B });

    expect(store.etiquettes).toHaveLength(1);
    expect(store.etiquettes[0].id).toBe('B');
    expect(B.dateDebut).toBe('2026-05-18'); // etendu vers debut de A
    expect(B.dateFin).toBe('2026-05-22');   // inchange (deja apres A)
  });

  it('fusion 2 etiquettes overlapping', () => {
    const A = { id: 'A', type: 'rouge', personneId: 'P', dateDebut: '2026-05-18', dateFin: '2026-05-20' };
    const B = { id: 'B', type: 'rouge', personneId: 'P', dateDebut: '2026-05-19', dateFin: '2026-05-22' };
    store.etiquettes.push(A);
    store.etiquettes.push(B);
    bus.emit('label.created', { label: B });

    expect(store.etiquettes).toHaveLength(1);
    expect(B.dateDebut).toBe('2026-05-18');
    expect(B.dateFin).toBe('2026-05-22');
  });

  it('pas de fusion si personneId different', () => {
    store.etiquettes.push({ id: 'A', type: 'rouge', personneId: 'P1', dateDebut: '2026-05-18', dateFin: '2026-05-20' });
    const B = { id: 'B', type: 'rouge', personneId: 'P2', dateDebut: '2026-05-21', dateFin: '2026-05-22' };
    store.etiquettes.push(B);
    bus.emit('label.created', { label: B });
    expect(store.etiquettes).toHaveLength(2);
  });

  it('pas de fusion si type different', () => {
    store.etiquettes.push({ id: 'A', type: 'rouge', personneId: 'P', dateDebut: '2026-05-18', dateFin: '2026-05-20' });
    const B = { id: 'B', type: 'bleu', personneId: 'P', dateDebut: '2026-05-21', dateFin: '2026-05-22' };
    store.etiquettes.push(B);
    bus.emit('label.created', { label: B });
    expect(store.etiquettes).toHaveLength(2);
  });

  it('pas de fusion si numeroInstallation different (type concerne)', () => {
    store.etiquettes.push({ id: 'A', type: 'rouge', personneId: 'P', numeroInstallation: 'X', dateDebut: '2026-05-18', dateFin: '2026-05-20' });
    const B = { id: 'B', type: 'rouge', personneId: 'P', numeroInstallation: 'Y', dateDebut: '2026-05-21', dateFin: '2026-05-22' };
    store.etiquettes.push(B);
    bus.emit('label.created', { label: B });
    expect(store.etiquettes).toHaveLength(2);
  });

  it('pas de fusion type=autre avec couleurHex differente', () => {
    store.etiquettes.push({ id: 'A', type: 'autre', personneId: 'P', couleurHex: '#ff0000', dateDebut: '2026-05-18', dateFin: '2026-05-20' });
    const B = { id: 'B', type: 'autre', personneId: 'P', couleurHex: '#00ff00', dateDebut: '2026-05-21', dateFin: '2026-05-22' };
    store.etiquettes.push(B);
    bus.emit('label.created', { label: B });
    expect(store.etiquettes).toHaveLength(2);
  });

  it('fusion type=autre meme couleurHex consecutifs', () => {
    store.etiquettes.push({ id: 'A', type: 'autre', personneId: 'P', couleurHex: '#ff0000', dateDebut: '2026-05-18', dateFin: '2026-05-20' });
    const B = { id: 'B', type: 'autre', personneId: 'P', couleurHex: '#ff0000', dateDebut: '2026-05-21', dateFin: '2026-05-22' };
    store.etiquettes.push(B);
    bus.emit('label.created', { label: B });
    expect(store.etiquettes).toHaveLength(1);
    expect(B.dateDebut).toBe('2026-05-18');
  });

  it('fusion 3 etiquettes en chaine', () => {
    store.etiquettes.push({ id: 'A', type: 'rouge', personneId: 'P', dateDebut: '2026-05-18', dateFin: '2026-05-18' });
    store.etiquettes.push({ id: 'B', type: 'rouge', personneId: 'P', dateDebut: '2026-05-19', dateFin: '2026-05-19' });
    const C = { id: 'C', type: 'rouge', personneId: 'P', dateDebut: '2026-05-20', dateFin: '2026-05-20' };
    store.etiquettes.push(C);
    bus.emit('label.created', { label: C });

    expect(store.etiquettes).toHaveLength(1);
    expect(C.dateDebut).toBe('2026-05-18');
    expect(C.dateFin).toBe('2026-05-20');
  });

  it('non-fusion : ecart de 2 jours ouvres (mardi-mardi)', () => {
    // 2026-05-19 = mardi. Fin mardi, prochain ouvre = mercredi. Si B commence jeudi : ecart.
    store.etiquettes.push({ id: 'A', type: 'rouge', personneId: 'P', dateDebut: '2026-05-19', dateFin: '2026-05-19' });
    const B = { id: 'B', type: 'rouge', personneId: 'P', dateDebut: '2026-05-21', dateFin: '2026-05-21' };
    store.etiquettes.push(B);
    bus.emit('label.created', { label: B });
    expect(store.etiquettes).toHaveLength(2);
  });

  it('undo restaure les etiquettes fusionnees et les dates originales', () => {
    const A = { id: 'A', type: 'rouge', personneId: 'P', dateDebut: '2026-05-18', dateFin: '2026-05-20' };
    const B = { id: 'B', type: 'rouge', personneId: 'P', dateDebut: '2026-05-21', dateFin: '2026-05-22' };
    store.etiquettes.push(A);
    store.etiquettes.push(B);
    bus.emit('label.created', { label: B });
    expect(store.etiquettes).toHaveLength(1);

    undo.undo();
    expect(store.etiquettes).toHaveLength(2);
    expect(store.etiquettes.some((e) => e.id === 'A')).toBe(true);
    expect(B.dateDebut).toBe('2026-05-21');
    expect(B.dateFin).toBe('2026-05-22');
  });

  it('redo refait la fusion', () => {
    const A = { id: 'A', type: 'rouge', personneId: 'P', dateDebut: '2026-05-18', dateFin: '2026-05-20' };
    const B = { id: 'B', type: 'rouge', personneId: 'P', dateDebut: '2026-05-21', dateFin: '2026-05-22' };
    store.etiquettes.push(A);
    store.etiquettes.push(B);
    bus.emit('label.created', { label: B });
    undo.undo();
    undo.redo();
    expect(store.etiquettes).toHaveLength(1);
    expect(B.dateDebut).toBe('2026-05-18');
  });

  it('anti-cycle : meme ctx, 2eme emit ignore', () => {
    const A = { id: 'A', type: 'rouge', personneId: 'P', dateDebut: '2026-05-18', dateFin: '2026-05-20' };
    const B = { id: 'B', type: 'rouge', personneId: 'P', dateDebut: '2026-05-21', dateFin: '2026-05-22' };
    store.etiquettes.push(A);
    store.etiquettes.push(B);
    const ctx = {};
    bus.emit('label.created', { label: B }, ctx);
    expect(undo.canUndo()).toBe(true);
    undo.clear();
    // 2eme emit avec meme ctx (cascade theorique) : visited.has('B:fusion-etiquettes')
    bus.emit('label.updated', { label: B }, ctx);
    expect(undo.canUndo()).toBe(false);
  });

  it('exports : RULE_ID + TYPES_AVEC_INSTALLATION', () => {
    expect(RULE_ID).toBe('fusion-etiquettes');
    expect(TYPES_AVEC_INSTALLATION).toContain('rouge');
    expect(TYPES_AVEC_INSTALLATION).toContain('noir');
    expect(TYPES_AVEC_INSTALLATION).not.toContain('autre');
    expect(TYPES_AVEC_INSTALLATION).not.toContain('jaune');
  });

  it('event sans label ne plante pas', () => {
    expect(() => bus.emit('label.created', {})).not.toThrow();
    expect(() => bus.emit('label.created', { label: null })).not.toThrow();
  });
});
