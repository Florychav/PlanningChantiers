// @ts-check
import { describe, it, expect, beforeEach } from 'vitest';
import { Bus } from '../../src/shared/bus.js';
import { UndoStack } from '../../src/shared/undo.js';
import { register, RULE_ID, PROTOCOLEUR_GROUP } from '../../src/relations/jaune-protocoleur.js';

function makeStore() {
  return { etiquettes: /** @type {any[]} */ ([]), personnes: /** @type {any[]} */ ([]) };
}

describe('jaune-protocoleur', () => {
  /** @type {Bus} */       let bus;
  /** @type {UndoStack} */ let undo;
  /** @type {ReturnType<typeof makeStore>} */ let store;

  beforeEach(() => {
    bus = new Bus();
    undo = new UndoStack();
    store = makeStore();
    store.personnes.push({ id: 'P1', prenom: 'Alice', groupe: PROTOCOLEUR_GROUP });
    store.personnes.push({ id: 'M1', prenom: 'Bob',   groupe: 'Monteur' });
    register(bus, undo, store);
  });

  it('jaune monteur creee => linked jaune sur Protocoleur libre', () => {
    const jaune = {
      id: 'J1', type: 'jaune',
      personneId: 'M1',
      dateDebut: '2026-05-18', dateFin: '2026-05-20',
    };
    store.etiquettes.push(jaune);
    bus.emit('label.created', { label: jaune });

    expect(jaune.linkedLabelId).toBeDefined();
    const linked = store.etiquettes.find((e) => e.id === jaune.linkedLabelId);
    expect(linked).toBeDefined();
    expect(linked?.type).toBe('jaune');
    expect(linked?.personneId).toBe('P1');
    expect(linked?.dateDebut).toBe('2026-05-20');
    expect(linked?.dateFin).toBe('2026-05-20');
    expect(linked?.linkedFromId).toBe('J1');
  });

  it('aucun Protocoleur dispo => no-op silencieux', () => {
    // Retire l'unique protocoleur
    store.personnes = store.personnes.filter((p) => p.groupe !== PROTOCOLEUR_GROUP);
    const jaune = {
      id: 'J1', type: 'jaune',
      personneId: 'M1',
      dateDebut: '2026-05-18', dateFin: '2026-05-20',
    };
    store.etiquettes.push(jaune);
    bus.emit('label.created', { label: jaune });
    expect(jaune.linkedLabelId).toBeUndefined();
    expect(undo.canUndo()).toBe(false);
  });

  it('Protocoleur occupe sur dateFin => no-op', () => {
    // Place une occupation sur P1 le 2026-05-20
    store.etiquettes.push({
      id: 'X', type: 'jaune', personneId: 'P1',
      dateDebut: '2026-05-19', dateFin: '2026-05-21',
    });
    const jaune = {
      id: 'J1', type: 'jaune', personneId: 'M1',
      dateDebut: '2026-05-18', dateFin: '2026-05-20',
    };
    store.etiquettes.push(jaune);
    bus.emit('label.created', { label: jaune });
    expect(jaune.linkedLabelId).toBeUndefined();
  });

  it('jaune linked (linkedFromId set) => pas de re-cascade', () => {
    const linked = {
      id: 'J1', type: 'jaune', personneId: 'P1',
      dateDebut: '2026-05-20', dateFin: '2026-05-20',
      linkedFromId: 'SRC',
    };
    store.etiquettes.push(linked);
    bus.emit('label.created', { label: linked });
    expect(undo.canUndo()).toBe(false);
  });

  it('jaune deja avec linkedLabelId => idempotent (no-op)', () => {
    const jaune = {
      id: 'J1', type: 'jaune', personneId: 'M1',
      dateDebut: '2026-05-18', dateFin: '2026-05-20',
      linkedLabelId: 'L_existant',
    };
    store.etiquettes.push(jaune);
    bus.emit('label.created', { label: jaune });
    expect(jaune.linkedLabelId).toBe('L_existant');
    expect(undo.canUndo()).toBe(false);
  });

  it('undo retire la linked et delock linkedLabelId', () => {
    const jaune = {
      id: 'J1', type: 'jaune', personneId: 'M1',
      dateDebut: '2026-05-18', dateFin: '2026-05-20',
    };
    store.etiquettes.push(jaune);
    bus.emit('label.created', { label: jaune });
    const linkedId = jaune.linkedLabelId;
    expect(linkedId).toBeDefined();

    undo.undo();
    expect(jaune.linkedLabelId).toBeUndefined();
    expect(store.etiquettes.find((e) => e.id === linkedId)).toBeUndefined();
  });

  it('redo recree la linked', () => {
    const jaune = {
      id: 'J1', type: 'jaune', personneId: 'M1',
      dateDebut: '2026-05-18', dateFin: '2026-05-20',
    };
    store.etiquettes.push(jaune);
    bus.emit('label.created', { label: jaune });
    const linkedId = jaune.linkedLabelId;
    undo.undo();
    undo.redo();
    expect(jaune.linkedLabelId).toBe(linkedId);
    expect(store.etiquettes.find((e) => e.id === linkedId)).toBeDefined();
  });

  it('update jaune source => linked resync sur nouvelle dateFin', () => {
    const jaune = {
      id: 'J1', type: 'jaune', personneId: 'M1',
      dateDebut: '2026-05-18', dateFin: '2026-05-20',
    };
    store.etiquettes.push(jaune);
    bus.emit('label.created', { label: jaune });
    const linkedId = jaune.linkedLabelId;

    jaune.dateFin = '2026-05-21';
    bus.emit('label.updated', { label: jaune });

    const linked = store.etiquettes.find((e) => e.id === linkedId);
    expect(linked?.dateDebut).toBe('2026-05-21');
    expect(linked?.dateFin).toBe('2026-05-21');
  });

  it('update sans changement de dateFin = no-op', () => {
    const jaune = {
      id: 'J1', type: 'jaune', personneId: 'M1',
      dateDebut: '2026-05-18', dateFin: '2026-05-20',
    };
    store.etiquettes.push(jaune);
    bus.emit('label.created', { label: jaune });
    const undoCountBefore = /** @type {any} */ (undo)._undoStack.length;

    bus.emit('label.updated', { label: jaune });
    const undoCountAfter = /** @type {any} */ (undo)._undoStack.length;
    expect(undoCountAfter).toBe(undoCountBefore);
  });

  it('delete jaune source => cascade delete de la linked', () => {
    const jaune = {
      id: 'J1', type: 'jaune', personneId: 'M1',
      dateDebut: '2026-05-18', dateFin: '2026-05-20',
    };
    store.etiquettes.push(jaune);
    bus.emit('label.created', { label: jaune });
    const linkedId = jaune.linkedLabelId;
    expect(store.etiquettes.find((e) => e.id === linkedId)).toBeDefined();

    bus.emit('label.deleted', { label: jaune });
    expect(store.etiquettes.find((e) => e.id === linkedId)).toBeUndefined();
  });

  it('undo cascade delete restaure la linked', () => {
    const jaune = {
      id: 'J1', type: 'jaune', personneId: 'M1',
      dateDebut: '2026-05-18', dateFin: '2026-05-20',
    };
    store.etiquettes.push(jaune);
    bus.emit('label.created', { label: jaune });
    const linkedId = jaune.linkedLabelId;

    bus.emit('label.deleted', { label: jaune });
    undo.undo();
    expect(store.etiquettes.find((e) => e.id === linkedId)).toBeDefined();
  });

  it('anti-cycle : meme ctx, 2 emits ignore le 2eme', () => {
    const jaune = {
      id: 'J1', type: 'jaune', personneId: 'M1',
      dateDebut: '2026-05-18', dateFin: '2026-05-20',
    };
    store.etiquettes.push(jaune);
    const ctx = {};
    bus.emit('label.created', { label: jaune }, ctx);
    expect(undo.canUndo()).toBe(true);
    undo.clear();
    // Update sur meme ctx (cascade theorique) : visited.has('J1:jaune-protocoleur')
    bus.emit('label.updated', { label: jaune }, ctx);
    expect(undo.canUndo()).toBe(false);
  });

  it('RULE_ID et PROTOCOLEUR_GROUP exposes', () => {
    expect(RULE_ID).toBe('jaune-protocoleur');
    expect(PROTOCOLEUR_GROUP).toBe('Protocoleur/TS');
  });
});
