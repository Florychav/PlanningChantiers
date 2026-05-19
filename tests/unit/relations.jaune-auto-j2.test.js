// @ts-check
import { describe, it, expect, beforeEach } from 'vitest';
import { Bus } from '../../src/shared/bus.js';
import { UndoStack } from '../../src/shared/undo.js';
import { register, RULE_ID, PRINCIPAL_TYPES, JAUNE_AUTO_DURATION } from '../../src/relations/jaune-auto-j2.js';

function makeStore() {
  return { etiquettes: /** @type {any[]} */ ([]) };
}

describe('jaune-auto-j2', () => {
  /** @type {Bus} */       let bus;
  /** @type {UndoStack} */ let undo;
  /** @type {ReturnType<typeof makeStore>} */ let store;

  beforeEach(() => {
    bus = new Bus();
    undo = new UndoStack();
    store = makeStore();
    register(bus, undo, store);
  });

  it('rouge avec dureeOuvr=5 => mere raccourcie a 3j, jaune sur 2 derniers j', () => {
    // 2026-05-18 = lundi. 2026-05-22 = vendredi. 5 jours ouvres.
    const M = { id: 'M', type: 'rouge', personneId: 'P', dateDebut: '2026-05-18', dateFin: '2026-05-22' };
    store.etiquettes.push(M);
    bus.emit('label.created', { label: M });

    // Mere raccourcie : 3 jours = lun-mer (18-20).
    expect(M.dateFin).toBe('2026-05-20');

    // Jaune cree : jeudi-vendredi (21-22).
    const jaunes = store.etiquettes.filter((e) => e.type === 'jaune');
    expect(jaunes).toHaveLength(1);
    expect(jaunes[0].dateDebut).toBe('2026-05-21');
    expect(jaunes[0].dateFin).toBe('2026-05-22');
    expect(jaunes[0].motherLabelId).toBe('M');
    expect(jaunes[0].personneId).toBe('P');
  });

  it('rouge avec dureeOuvr=2 => pas de raccourcissement, jaune memes dates', () => {
    // lun-mar
    const M = { id: 'M', type: 'rouge', personneId: 'P', dateDebut: '2026-05-18', dateFin: '2026-05-19' };
    store.etiquettes.push(M);
    bus.emit('label.created', { label: M });

    expect(M.dateFin).toBe('2026-05-19'); // pas touche
    const jaunes = store.etiquettes.filter((e) => e.type === 'jaune');
    expect(jaunes).toHaveLength(1);
    expect(jaunes[0].dateDebut).toBe('2026-05-18');
    expect(jaunes[0].dateFin).toBe('2026-05-19');
  });

  it('rouge avec dureeOuvr=1 => pas de raccourcissement, jaune meme jour', () => {
    const M = { id: 'M', type: 'rouge', personneId: 'P', dateDebut: '2026-05-19', dateFin: '2026-05-19' };
    store.etiquettes.push(M);
    bus.emit('label.created', { label: M });

    expect(M.dateFin).toBe('2026-05-19');
    const jaunes = store.etiquettes.filter((e) => e.type === 'jaune');
    expect(jaunes[0].dateDebut).toBe('2026-05-19');
    expect(jaunes[0].dateFin).toBe('2026-05-19');
  });

  it('bleu et violet declenchent aussi', () => {
    store.etiquettes.push({ id: 'B', type: 'bleu', personneId: 'P', dateDebut: '2026-05-18', dateFin: '2026-05-22' });
    bus.emit('label.created', { label: store.etiquettes[0] });
    expect(store.etiquettes.filter((e) => e.type === 'jaune')).toHaveLength(1);

    store.etiquettes.push({ id: 'V', type: 'violet', personneId: 'P', dateDebut: '2026-06-01', dateFin: '2026-06-05' });
    bus.emit('label.created', { label: store.etiquettes.find((e) => e.id === 'V') });
    expect(store.etiquettes.filter((e) => e.type === 'jaune')).toHaveLength(2);
  });

  it('jaune / gris / noir => no-op', () => {
    store.etiquettes.push({ id: 'J', type: 'jaune', personneId: 'P', dateDebut: '2026-05-18', dateFin: '2026-05-22' });
    bus.emit('label.created', { label: store.etiquettes[0] });
    expect(store.etiquettes).toHaveLength(1);
  });

  it('numeroInstallation et personneId propages a la jaune', () => {
    const M = { id: 'M', type: 'rouge', personneId: 'P42', numeroInstallation: 'INST-X', dateDebut: '2026-05-18', dateFin: '2026-05-22' };
    store.etiquettes.push(M);
    bus.emit('label.created', { label: M });
    const jaune = store.etiquettes.find((e) => e.type === 'jaune');
    expect(jaune?.personneId).toBe('P42');
    expect(jaune?.numeroInstallation).toBe('INST-X');
  });

  it('undo restaure dateFin mere + retire la jaune', () => {
    const M = { id: 'M', type: 'rouge', personneId: 'P', dateDebut: '2026-05-18', dateFin: '2026-05-22' };
    store.etiquettes.push(M);
    bus.emit('label.created', { label: M });
    expect(M.dateFin).toBe('2026-05-20');
    expect(store.etiquettes.filter((e) => e.type === 'jaune')).toHaveLength(1);

    undo.undo();
    expect(M.dateFin).toBe('2026-05-22');
    expect(store.etiquettes.filter((e) => e.type === 'jaune')).toHaveLength(0);
  });

  it('redo refait raccourcissement + jaune', () => {
    const M = { id: 'M', type: 'rouge', personneId: 'P', dateDebut: '2026-05-18', dateFin: '2026-05-22' };
    store.etiquettes.push(M);
    bus.emit('label.created', { label: M });
    undo.undo();
    undo.redo();
    expect(M.dateFin).toBe('2026-05-20');
    expect(store.etiquettes.filter((e) => e.type === 'jaune')).toHaveLength(1);
  });

  it('cascade : re-emit label.created sur la jaune (visited preserve anti-cycle)', () => {
    // On observe les emit. Apres creation rouge, on doit voir 2 emit dans
    // l'ordre : le notre (rouge) + cascade (jaune).
    /** @type {string[]} */
    const seen = [];
    bus.on('label.created', (e) => { seen.push(e.payload?.label?.type); });

    const M = { id: 'M', type: 'rouge', personneId: 'P', dateDebut: '2026-05-18', dateFin: '2026-05-22' };
    store.etiquettes.push(M);
    bus.emit('label.created', { label: M });

    // Observer (registered apres le handler de la regle) voit la cascade EN
    // PREMIER (re-emit synchrone depuis onPrincipalCreated qui re-itere les
    // handlers), puis le rouge d'origine au retour.
    expect(seen).toEqual(['jaune', 'rouge']);
  });

  it('anti-cycle : meme ctx, 2eme emit sur la mere ignore', () => {
    const M = { id: 'M', type: 'rouge', personneId: 'P', dateDebut: '2026-05-18', dateFin: '2026-05-22' };
    store.etiquettes.push(M);
    const ctx = {};
    bus.emit('label.created', { label: M }, ctx);
    const undoLen1 = /** @type {any} */ (undo)._undoStack.length;
    bus.emit('label.created', { label: M }, ctx);
    const undoLen2 = /** @type {any} */ (undo)._undoStack.length;
    expect(undoLen2).toBe(undoLen1); // pas de nouveau push
  });

  it('exports stables', () => {
    expect(RULE_ID).toBe('jaune-auto-j2');
    expect(PRINCIPAL_TYPES).toEqual(['rouge', 'bleu', 'violet']);
    expect(JAUNE_AUTO_DURATION).toBe(2);
  });
});
