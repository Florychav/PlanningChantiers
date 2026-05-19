// @ts-check
import { describe, it, expect, beforeEach } from 'vitest';
import { Bus } from '../../src/shared/bus.js';
import { UndoStack } from '../../src/shared/undo.js';
import { register, RULE_ID } from '../../src/relations/mere-filles-drag-sync.js';

function makeStore() {
  return { etiquettes: /** @type {any[]} */ ([]) };
}

describe('mere-filles-drag-sync', () => {
  /** @type {Bus} */       let bus;
  /** @type {UndoStack} */ let undo;
  /** @type {ReturnType<typeof makeStore>} */ let store;

  beforeEach(() => {
    bus = new Bus();
    undo = new UndoStack();
    store = makeStore();
    register(bus, undo, store);
  });

  it('drag mere => fille jaune recolee J+2 ouvrables apres nouvelle fin mere', () => {
    // Mere finie mardi 2026-05-19. Jaune avant : pas important. Apres drag,
    // mere finit jeudi 2026-05-21. Jaune doit etre lundi 25 mai (J+2 ouvrables).
    const M = { id: 'M', type: 'rouge', dateDebut: '2026-05-19', dateFin: '2026-05-21' };
    const J = { id: 'J', type: 'jaune', motherLabelId: 'M', dateDebut: '2026-05-15', dateFin: '2026-05-15' };
    store.etiquettes.push(M, J);

    bus.emit('label.moved', { label: M });

    // Lundi 25 mai 2026 = 2026-05-25 (J+2 ouvres apres jeudi 21 : ven 22, lun 25)
    expect(J.dateDebut).toBe('2026-05-25');
    expect(J.dateFin).toBe('2026-05-25');
  });

  it('drag mere => fille gris recolee a debut mere, duree preservee', () => {
    const M = { id: 'M', type: 'rouge', dateDebut: '2026-05-18', dateFin: '2026-05-22' };
    // Gris fait 3 jours ouvres (lun-mer)
    const G = { id: 'G', type: 'gris', motherLabelId: 'M', dateDebut: '2026-06-01', dateFin: '2026-06-03' };
    store.etiquettes.push(M, G);

    bus.emit('label.moved', { label: M });

    expect(G.dateDebut).toBe('2026-05-18');
    expect(G.dateFin).toBe('2026-05-20'); // 3 jours ouvres : lun, mar, mer
  });

  it('fille manuallyMoved => intacte', () => {
    const M = { id: 'M', type: 'rouge', dateDebut: '2026-05-18', dateFin: '2026-05-20' };
    const G = { id: 'G', type: 'gris', motherLabelId: 'M', dateDebut: '2026-06-01', dateFin: '2026-06-01', manuallyMoved: true };
    store.etiquettes.push(M, G);

    bus.emit('label.moved', { label: M });

    expect(G.dateDebut).toBe('2026-06-01');
    expect(G.dateFin).toBe('2026-06-01');
  });

  it('jaune avec linkedFromId (= linked Protocoleur) => non touchee', () => {
    const M = { id: 'M', type: 'rouge', dateDebut: '2026-05-18', dateFin: '2026-05-20' };
    const J = { id: 'J', type: 'jaune', motherLabelId: 'M', linkedFromId: 'OTHER', dateDebut: '2026-04-01', dateFin: '2026-04-01' };
    store.etiquettes.push(M, J);

    bus.emit('label.moved', { label: M });

    expect(J.dateDebut).toBe('2026-04-01');
  });

  it('autres types (rouge, bleu, etc.) => non touches', () => {
    const M = { id: 'M', type: 'rouge', dateDebut: '2026-05-18', dateFin: '2026-05-20' };
    const F = { id: 'F', type: 'rouge', motherLabelId: 'M', dateDebut: '2026-06-01', dateFin: '2026-06-02' };
    store.etiquettes.push(M, F);

    bus.emit('label.moved', { label: M });

    expect(F.dateDebut).toBe('2026-06-01');
  });

  it('label sans filles => no-op', () => {
    const M = { id: 'M', type: 'rouge', dateDebut: '2026-05-18', dateFin: '2026-05-20' };
    store.etiquettes.push(M);
    bus.emit('label.moved', { label: M });
    expect(undo.canUndo()).toBe(false);
  });

  it('label non-mere (pas de child avec motherLabelId) => no-op', () => {
    store.etiquettes.push({ id: 'X', type: 'jaune', dateDebut: '2026-05-18', dateFin: '2026-05-18' });
    bus.emit('label.moved', { label: { id: 'X', type: 'jaune', dateDebut: '2026-05-20', dateFin: '2026-05-20' } });
    expect(undo.canUndo()).toBe(false);
  });

  it('undo restaure les dates des filles', () => {
    const M = { id: 'M', type: 'rouge', dateDebut: '2026-05-18', dateFin: '2026-05-20' };
    const G = { id: 'G', type: 'gris', motherLabelId: 'M', dateDebut: '2026-06-01', dateFin: '2026-06-02' };
    store.etiquettes.push(M, G);
    bus.emit('label.moved', { label: M });

    expect(G.dateDebut).toBe('2026-05-18');
    undo.undo();
    expect(G.dateDebut).toBe('2026-06-01');
    expect(G.dateFin).toBe('2026-06-02');
  });

  it('redo refait la propagation', () => {
    const M = { id: 'M', type: 'rouge', dateDebut: '2026-05-18', dateFin: '2026-05-20' };
    const G = { id: 'G', type: 'gris', motherLabelId: 'M', dateDebut: '2026-06-01', dateFin: '2026-06-02' };
    store.etiquettes.push(M, G);
    bus.emit('label.moved', { label: M });
    undo.undo();
    undo.redo();
    expect(G.dateDebut).toBe('2026-05-18');
  });

  it('plusieurs filles propagees en 1 undo atomique', () => {
    const M = { id: 'M', type: 'rouge', dateDebut: '2026-05-18', dateFin: '2026-05-20' };
    const G = { id: 'G', type: 'gris',  motherLabelId: 'M', dateDebut: '2026-06-01', dateFin: '2026-06-01' };
    const J = { id: 'J', type: 'jaune', motherLabelId: 'M', dateDebut: '2026-04-01', dateFin: '2026-04-01' };
    store.etiquettes.push(M, G, J);

    bus.emit('label.moved', { label: M });

    expect(G.dateDebut).toBe('2026-05-18');
    expect(J.dateDebut).toBe('2026-05-22'); // J+2 ouvrables apres mer 20 (jeu 21, ven 22)

    // 1 seul undo restaure les deux.
    undo.undo();
    expect(G.dateDebut).toBe('2026-06-01');
    expect(J.dateDebut).toBe('2026-04-01');
  });

  it('anti-cycle visited', () => {
    const M = { id: 'M', type: 'rouge', dateDebut: '2026-05-18', dateFin: '2026-05-20' };
    const G = { id: 'G', type: 'gris', motherLabelId: 'M', dateDebut: '2026-06-01', dateFin: '2026-06-01' };
    store.etiquettes.push(M, G);
    const ctx = {};
    bus.emit('label.moved', { label: M }, ctx);
    expect(undo.canUndo()).toBe(true);
    undo.clear();
    bus.emit('label.moved', { label: M }, ctx);
    expect(undo.canUndo()).toBe(false);
  });

  it('RULE_ID stable', () => {
    expect(RULE_ID).toBe('mere-filles-drag-sync');
  });
});
