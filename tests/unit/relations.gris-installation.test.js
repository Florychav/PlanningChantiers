// @ts-check
import { describe, it, expect, beforeEach } from 'vitest';
import { Bus } from '../../src/shared/bus.js';
import { UndoStack } from '../../src/shared/undo.js';
import { register, RULE_ID, PRINCIPAL_TYPES } from '../../src/relations/gris-installation.js';

/**
 * Helper : cree un store isole pour chaque test (pas le state global).
 */
function makeStore() {
  return { etiquettes: /** @type {any[]} */ ([]), personnes: /** @type {any[]} */ ([]) };
}

describe('gris-installation', () => {
  /** @type {Bus} */         let bus;
  /** @type {UndoStack} */   let undo;
  /** @type {ReturnType<typeof makeStore>} */ let store;

  beforeEach(() => {
    bus = new Bus();
    undo = new UndoStack();
    store = makeStore();
    register(bus, undo, store);
  });

  it('rouge cree avec numeroInstallation => gris orphelin meme numero aligne', () => {
    // Gris orphelin existe deja avec dateDebut 2026-05-25, duree 3 jours ouvres
    store.etiquettes.push({
      id: 'G1', type: 'gris',
      numeroInstallation: 'INST-42',
      dateDebut: '2026-05-25', dateFin: '2026-05-27',
    });

    // Le principal arrive avec dateDebut 2026-05-18 (lundi)
    const rouge = { id: 'R1', type: 'rouge', numeroInstallation: 'INST-42', dateDebut: '2026-05-18' };
    bus.emit('label.created', { label: rouge });

    const g = store.etiquettes.find((e) => e.id === 'G1');
    expect(g?.dateDebut).toBe('2026-05-18');
    expect(g?.dateFin).toBe('2026-05-20'); // 3 jours ouvres : lun, mar, mer
  });

  it('PRINCIPAL_TYPES inclut rouge bleu violet', () => {
    expect(PRINCIPAL_TYPES).toEqual(['rouge', 'bleu', 'violet']);
  });

  it('bleu et violet declenchent aussi', () => {
    store.etiquettes.push({
      id: 'G1', type: 'gris',
      numeroInstallation: 'X',
      dateDebut: '2026-05-25', dateFin: '2026-05-25',
    });
    bus.emit('label.created', {
      label: { id: 'B1', type: 'bleu', numeroInstallation: 'X', dateDebut: '2026-05-18' },
    });
    expect(store.etiquettes.find((e) => e.id === 'G1')?.dateDebut).toBe('2026-05-18');

    store.etiquettes.push({
      id: 'G2', type: 'gris',
      numeroInstallation: 'Y',
      dateDebut: '2026-05-25', dateFin: '2026-05-25',
    });
    bus.emit('label.created', {
      label: { id: 'V1', type: 'violet', numeroInstallation: 'Y', dateDebut: '2026-05-19' },
    });
    expect(store.etiquettes.find((e) => e.id === 'G2')?.dateDebut).toBe('2026-05-19');
  });

  it('gris avec motherLabelId est skipped (geres par cascade mere-filles)', () => {
    store.etiquettes.push({
      id: 'G1', type: 'gris',
      motherLabelId: 'M1',
      numeroInstallation: 'INST-42',
      dateDebut: '2026-05-25', dateFin: '2026-05-25',
    });
    bus.emit('label.created', {
      label: { id: 'R1', type: 'rouge', numeroInstallation: 'INST-42', dateDebut: '2026-05-18' },
    });
    expect(store.etiquettes.find((e) => e.id === 'G1')?.dateDebut).toBe('2026-05-25');
    expect(undo.canUndo()).toBe(false);
  });

  it('gris avec numeroInstallation different = pas aligne', () => {
    store.etiquettes.push({
      id: 'G1', type: 'gris',
      numeroInstallation: 'OTHER',
      dateDebut: '2026-05-25', dateFin: '2026-05-25',
    });
    bus.emit('label.created', {
      label: { id: 'R1', type: 'rouge', numeroInstallation: 'INST-42', dateDebut: '2026-05-18' },
    });
    expect(store.etiquettes.find((e) => e.id === 'G1')?.dateDebut).toBe('2026-05-25');
  });

  it('label.updated declenche aussi', () => {
    store.etiquettes.push({
      id: 'G1', type: 'gris',
      numeroInstallation: 'INST-42',
      dateDebut: '2026-05-25', dateFin: '2026-05-25',
    });
    bus.emit('label.updated', {
      label: { id: 'R1', type: 'rouge', numeroInstallation: 'INST-42', dateDebut: '2026-05-19' },
    });
    expect(store.etiquettes.find((e) => e.id === 'G1')?.dateDebut).toBe('2026-05-19');
  });

  it('undo restaure dateDebut et dateFin du gris', () => {
    store.etiquettes.push({
      id: 'G1', type: 'gris',
      numeroInstallation: 'INST-42',
      dateDebut: '2026-05-25', dateFin: '2026-05-27',
    });
    bus.emit('label.created', {
      label: { id: 'R1', type: 'rouge', numeroInstallation: 'INST-42', dateDebut: '2026-05-18' },
    });
    expect(store.etiquettes.find((e) => e.id === 'G1')?.dateDebut).toBe('2026-05-18');
    undo.undo();
    const g = store.etiquettes.find((e) => e.id === 'G1');
    expect(g?.dateDebut).toBe('2026-05-25');
    expect(g?.dateFin).toBe('2026-05-27');
  });

  it('redo re-aligne', () => {
    store.etiquettes.push({
      id: 'G1', type: 'gris',
      numeroInstallation: 'INST-42',
      dateDebut: '2026-05-25', dateFin: '2026-05-25',
    });
    bus.emit('label.created', {
      label: { id: 'R1', type: 'rouge', numeroInstallation: 'INST-42', dateDebut: '2026-05-18' },
    });
    undo.undo();
    undo.redo();
    expect(store.etiquettes.find((e) => e.id === 'G1')?.dateDebut).toBe('2026-05-18');
  });

  it('plusieurs gris du meme numeroInstallation alignes en cascade undoable', () => {
    store.etiquettes.push({
      id: 'G1', type: 'gris', numeroInstallation: 'X',
      dateDebut: '2026-05-25', dateFin: '2026-05-25',
    });
    store.etiquettes.push({
      id: 'G2', type: 'gris', numeroInstallation: 'X',
      dateDebut: '2026-05-26', dateFin: '2026-05-26',
    });
    bus.emit('label.created', {
      label: { id: 'R1', type: 'rouge', numeroInstallation: 'X', dateDebut: '2026-05-18' },
    });
    expect(store.etiquettes.find((e) => e.id === 'G1')?.dateDebut).toBe('2026-05-18');
    expect(store.etiquettes.find((e) => e.id === 'G2')?.dateDebut).toBe('2026-05-18');
    // 2 pushes undo => 2 undo successifs
    undo.undo();
    undo.undo();
    expect(store.etiquettes.find((e) => e.id === 'G1')?.dateDebut).toBe('2026-05-25');
    expect(store.etiquettes.find((e) => e.id === 'G2')?.dateDebut).toBe('2026-05-26');
  });

  it('aucun numeroInstallation sur le principal = no-op', () => {
    store.etiquettes.push({
      id: 'G1', type: 'gris', numeroInstallation: 'X',
      dateDebut: '2026-05-25', dateFin: '2026-05-25',
    });
    bus.emit('label.created', { label: { id: 'R1', type: 'rouge', dateDebut: '2026-05-18' } });
    expect(store.etiquettes.find((e) => e.id === 'G1')?.dateDebut).toBe('2026-05-25');
  });

  it('anti-cycle : meme ctx, deuxieme emit ignore', () => {
    store.etiquettes.push({
      id: 'G1', type: 'gris', numeroInstallation: 'X',
      dateDebut: '2026-05-25', dateFin: '2026-05-25',
    });
    const rouge = { id: 'R1', type: 'rouge', numeroInstallation: 'X', dateDebut: '2026-05-18' };
    const ctx = {};
    bus.emit('label.created', { label: rouge }, ctx);
    undo.clear();
    bus.emit('label.updated', { label: rouge }, ctx);
    expect(undo.canUndo()).toBe(false);
  });

  it('RULE_ID stable', () => {
    expect(RULE_ID).toBe('gris-installation');
  });
});
