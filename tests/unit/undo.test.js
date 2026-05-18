// @ts-check
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UndoStack, undo as singleton } from '../../src/shared/undo.js';
import { Bus } from '../../src/shared/bus.js';

describe('UndoStack — push hors transaction (a)', () => {
  /** @type {UndoStack} */
  let u;
  beforeEach(() => { u = new UndoStack(); });

  it('push atomique applique l\'action puis permet undo', () => {
    let state = 'A';
    // Le handler/code applicatif a deja mute. On push juste le revert.
    state = 'B';
    u.push({ revert: () => { state = 'A'; }, description: 'A->B' });
    expect(u.canUndo()).toBe(true);
    u.undo();
    expect(state).toBe('A');
    expect(u.canUndo()).toBe(false);
  });

  it('canUndo / canRedo initiaux = false', () => {
    expect(u.canUndo()).toBe(false);
    expect(u.canRedo()).toBe(false);
  });
});

describe('UndoStack — transaction simple, 1 action (b)', () => {
  it('1 action dans une transaction = composite a 1 enfant, undoable atomiquement', () => {
    const u = new UndoStack();
    let n = 0;
    u.transaction(() => {
      n = 1;
      u.push({ revert: () => { n = 0; }, description: 'inc1' });
    }, 'tx-simple');
    expect(n).toBe(1);
    expect(u.canUndo()).toBe(true);
    u.undo();
    expect(n).toBe(0);
  });

  it('transaction vide ne push rien', () => {
    const u = new UndoStack();
    u.transaction(() => {});
    expect(u.canUndo()).toBe(false);
  });
});

describe('UndoStack — transaction composite, n actions (c)', () => {
  it('undo et redo atomiques sur n actions', () => {
    const u = new UndoStack();
    let v = 0;
    u.transaction(() => {
      u.push({
        revert: () => { v -= 1; },
        redo:   () => { v += 1; },
      });
      u.push({
        revert: () => { v -= 10; },
        redo:   () => { v += 10; },
      });
      u.push({
        revert: () => { v -= 100; },
        redo:   () => { v += 100; },
      });
      v = 111;
    }, 'cascade');
    expect(v).toBe(111);
    u.undo();
    expect(v).toBe(0); // revert dans l'ordre inverse : -100, -10, -1
    expect(u.canRedo()).toBe(true);
    u.redo();
    expect(v).toBe(111);
  });
});

describe('UndoStack — re-entrance FLAT (d)', () => {
  it('transactions imbriquees fusionnent dans la parent (1 seule entree stack)', () => {
    const u = new UndoStack();
    /** @type {string[]} */
    const log = [];
    u.transaction(() => {
      u.push({ revert: () => log.push('R-outer1'), description: 'O1' });
      u.transaction(() => {
        u.push({ revert: () => log.push('R-inner1'), description: 'I1' });
        u.push({ revert: () => log.push('R-inner2'), description: 'I2' });
      }, 'tx-inner');
      u.push({ revert: () => log.push('R-outer2'), description: 'O2' });
    }, 'tx-outer');

    // 1 seule entree stack = composite outer contenant O1, I1, I2, O2 a plat.
    expect(u._undoStack.length).toBe(1);
    expect(u.canUndo()).toBe(true);

    u.undo();
    // Revert ordre inverse : O2, I2, I1, O1
    expect(log).toEqual(['R-outer2', 'R-inner2', 'R-inner1', 'R-outer1']);
    expect(u.canUndo()).toBe(false);
  });

  it('description de la transaction inner est ignoree (flat)', () => {
    const u = new UndoStack();
    u.transaction(() => {
      u.transaction(() => {
        u.push({ revert: () => {}, description: 'leaf' });
      }, 'inner-desc');
    }, 'outer-desc');

    expect(u._undoStack.length).toBe(1);
    expect(u._undoStack[0].action.description).toBe('outer-desc');
  });
});

describe('UndoStack — revert best-effort sur throw (e)', () => {
  it('un revert qui throw n\'empeche pas les autres de s\'executer', () => {
    const u = new UndoStack();
    u.onRevertError(() => { /* swallow pour focus test */ });
    /** @type {string[]} */
    const log = [];
    u.transaction(() => {
      u.push({ revert: () => log.push('A'), description: 'A' });
      u.push({ revert: () => { throw new Error('B-boom'); }, description: 'B' });
      u.push({ revert: () => log.push('C'), description: 'C' });
    }, 'tx-boom');

    u.undo();
    // Ordre inverse : C revert OK, B throw (skip), A revert OK.
    expect(log).toEqual(['C', 'A']);
  });

  it('aucune exception ne remonte hors de undo()', () => {
    const u = new UndoStack();
    u.onRevertError(() => {});
    u.push({ revert: () => { throw new Error('atomic-boom'); }, description: 'A' });
    expect(() => u.undo()).not.toThrow();
  });
});

describe('UndoStack — onRevertError (f)', () => {
  it('est appele avec (err, action, transactionDescription)', () => {
    const u = new UndoStack();
    const reports = vi.fn();
    u.onRevertError(reports);

    const failing = { revert: () => { throw new Error('boom'); }, description: 'failing-action' };
    u.transaction(() => {
      u.push(failing);
    }, 'tx-description');

    u.undo();
    expect(reports).toHaveBeenCalledTimes(1);
    const [err, action, txDesc] = reports.mock.calls[0];
    expect(err).toBeInstanceOf(Error);
    expect(/** @type {Error} */ (err).message).toBe('boom');
    expect(action).toBe(failing);
    expect(txDesc).toBe('tx-description');
  });

  it('plusieurs handlers recoivent l\'erreur', () => {
    const u = new UndoStack();
    const h1 = vi.fn();
    const h2 = vi.fn();
    u.onRevertError(h1);
    u.onRevertError(h2);
    u.push({ revert: () => { throw new Error('x'); }, description: 'A' });
    u.undo();
    expect(h1).toHaveBeenCalledTimes(1);
    expect(h2).toHaveBeenCalledTimes(1);
  });

  it('unsubscribe via la valeur de retour', () => {
    const u = new UndoStack();
    const h = vi.fn();
    const off = u.onRevertError(h);
    off();
    u.push({ revert: () => { throw new Error('x'); }, description: 'A' });
    // Pas d'handler abonne → log console.error par defaut.
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    u.undo();
    expect(h).not.toHaveBeenCalled();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('si un handler throw, les autres recoivent quand meme l\'erreur (swallow)', () => {
    const u = new UndoStack();
    const h1 = vi.fn(() => { throw new Error('h1-bug'); });
    const h2 = vi.fn();
    u.onRevertError(h1);
    u.onRevertError(h2);
    u.push({ revert: () => { throw new Error('x'); }, description: 'A' });
    expect(() => u.undo()).not.toThrow();
    expect(h1).toHaveBeenCalled();
    expect(h2).toHaveBeenCalled();
  });

  it('defaut = console.error si aucun handler abonne', () => {
    const u = new UndoStack();
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    u.push({ revert: () => { throw new Error('boom'); }, description: 'A' });
    u.undo();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe('UndoStack — redo apres undo (g)', () => {
  it('undo puis redo restaure l\'etat post-action', () => {
    const u = new UndoStack();
    let n = 0;
    n = 5;
    u.push({
      revert: () => { n = 0; },
      redo:   () => { n = 5; },
      description: 'set-5',
    });
    u.undo();
    expect(n).toBe(0);
    expect(u.canRedo()).toBe(true);
    expect(u.redo()).toBe(true);
    expect(n).toBe(5);
  });

  it('canRedo() = false si l\'action n\'a pas de redo', () => {
    const u = new UndoStack();
    u.push({ revert: () => {}, description: 'no-redo' });
    u.undo();
    expect(u.canRedo()).toBe(false);
    expect(u.redo()).toBe(false);
  });

  it('composite avec une seule action sans redo = pas de redo composite', () => {
    const u = new UndoStack();
    u.transaction(() => {
      u.push({ revert: () => {}, redo: () => {}, description: 'A' });
      u.push({ revert: () => {}, description: 'B-no-redo' });
    });
    u.undo();
    expect(u.canRedo()).toBe(false);
  });
});

describe('UndoStack — redo-stack vide a la nouvelle action (h)', () => {
  it('un push apres undo vide le stack redo', () => {
    const u = new UndoStack();
    u.push({ revert: () => {}, redo: () => {}, description: 'A' });
    u.push({ revert: () => {}, redo: () => {}, description: 'B' });
    u.undo();
    expect(u.canRedo()).toBe(true);

    u.push({ revert: () => {}, redo: () => {}, description: 'C' });
    expect(u.canRedo()).toBe(false);
  });

  it('un commit de transaction apres undo vide le stack redo', () => {
    const u = new UndoStack();
    u.push({ revert: () => {}, redo: () => {}, description: 'A' });
    u.undo();
    expect(u.canRedo()).toBe(true);
    u.transaction(() => {
      u.push({ revert: () => {}, redo: () => {}, description: 'B' });
    });
    expect(u.canRedo()).toBe(false);
  });
});

describe('UndoStack — cap (i)', () => {
  it('push au-dela du cap ejecte la plus ancienne entree', () => {
    const u = new UndoStack({ cap: 3 });
    u.push({ revert: () => {}, description: 'A' });
    u.push({ revert: () => {}, description: 'B' });
    u.push({ revert: () => {}, description: 'C' });
    u.push({ revert: () => {}, description: 'D' }); // ejecte A

    let n = 0;
    while (u.undo()) n++;
    expect(n).toBe(3); // D, C, B annules ; A perdue
  });

  it('cap par defaut = 100', () => {
    const u = new UndoStack();
    for (let i = 0; i < 105; i++) {
      u.push({ revert: () => {}, description: `A${i}` });
    }
    let n = 0;
    while (u.undo()) n++;
    expect(n).toBe(100);
  });

  it('clear() vide tout', () => {
    const u = new UndoStack();
    u.push({ revert: () => {}, description: 'A' });
    u.push({ revert: () => {}, description: 'B' });
    u.undo();
    u.clear();
    expect(u.canUndo()).toBe(false);
    expect(u.canRedo()).toBe(false);
  });
});

describe('UndoStack — singleton vs class (j)', () => {
  it('exporte un singleton `undo` distinct de UndoStack', () => {
    expect(singleton).toBeInstanceOf(UndoStack);
    singleton.clear();
    let n = 0;
    n = 1;
    singleton.push({ revert: () => { n = 0; }, description: 'A' });
    singleton.undo();
    expect(n).toBe(0);
    singleton.clear();
  });

  it('plusieurs instances sont independantes', () => {
    const a = new UndoStack();
    const b = new UndoStack();
    a.push({ revert: () => {}, description: 'X' });
    expect(a.canUndo()).toBe(true);
    expect(b.canUndo()).toBe(false);
  });
});

describe('UndoStack — integration bus J2.1 (k)', () => {
  it('transaction wrappant un bus.emit avec handlers qui pushent = undo atomique', () => {
    const bus = new Bus();
    const u = new UndoStack();
    const state = { count: 0 };

    bus.on('inc', () => {
      const before = state.count;
      state.count++;
      u.push({
        revert: () => { state.count = before; },
        redo:   () => { state.count = before + 1; },
        description: 'inc',
        domain: 'counter',
        affectedIds: ['counter'],
      });
    });

    u.transaction(() => {
      bus.emit('inc');
      bus.emit('inc');
      bus.emit('inc');
    }, 'triple-inc');

    expect(state.count).toBe(3);
    expect(u.canUndo()).toBe(true);

    u.undo();
    expect(state.count).toBe(0);

    expect(u.canRedo()).toBe(true);
    u.redo();
    expect(state.count).toBe(3);
  });

  it('composite herite du domain commun et union des affectedIds', () => {
    const u = new UndoStack();
    u.transaction(() => {
      u.push({ revert: () => {}, domain: 'label', affectedIds: ['l1', 'l2'] });
      u.push({ revert: () => {}, domain: 'label', affectedIds: ['l2', 'l3'] });
    });
    const entry = u._undoStack[0];
    expect(entry.action.domain).toBe('label');
    expect(entry.action.affectedIds?.sort()).toEqual(['l1', 'l2', 'l3']);
  });

  it('composite avec domains differents = domain undefined', () => {
    const u = new UndoStack();
    u.transaction(() => {
      u.push({ revert: () => {}, domain: 'label' });
      u.push({ revert: () => {}, domain: 'project' });
    });
    expect(u._undoStack[0].action.domain).toBeUndefined();
  });
});
