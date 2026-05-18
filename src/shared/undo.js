// @ts-check
/**
 * Stack undo/redo synchrone, sans dependance externe.
 *
 * Design notes (figes par PM J2.2) :
 * - SYNC par construction (coherent bus J2.1).
 * - Re-entrance FLAT : transactions imbriquees fusionnent dans la parent.
 * - Echec revert : BEST-EFFORT, on continue les autres reverts, on log via
 *   onRevertError (defaut console.error). Aucune exception ne remonte hors
 *   de undo() / redo() / revert composite.
 * - Stack LIFO undo + redo separes. Redo-stack vide a la prochaine action
 *   poussee apres un undo.
 * - Cap configurable du stack undo (defaut 100), ejection de la plus ancienne.
 * - Pas d'apply : le handler mute l'etat directement et push une action avec
 *   revert ; redo seulement si fourni (sinon redo desactive pour cette entree).
 * - Pas de timestamp dans UndoableAction : ajoute par transaction/push sur
 *   l'enveloppe stack interne (`{action, timestamp}`).
 */

/**
 * Action reversible. Signature publique figee.
 *
 * @typedef {Object} UndoableAction
 * @property {() => void}      revert       OBLIGATOIRE.
 * @property {() => void}      [redo]       Si absent, redo desactive pour cette action.
 * @property {string}          [description]
 * @property {string[]}        [affectedIds] Agnostique du domaine (cf. Realtime conflict check J3).
 * @property {string}          [domain]     Qualifie affectedIds ('label', 'project', etc.).
 */

/**
 * @typedef {Object} StackEntry
 * @property {UndoableAction} action
 * @property {number}         timestamp
 */

/**
 * @typedef {(err: unknown, action: UndoableAction, transactionDescription: string) => void} RevertErrorHandler
 */

/**
 * @typedef {Object} UndoStackOptions
 * @property {number} [cap=100]
 */

export class UndoStack {
  /** @param {UndoStackOptions} [opts] */
  constructor(opts = {}) {
    /** @type {number} */
    this._cap = opts.cap ?? 100;

    /** @type {StackEntry[]} */
    this._undoStack = [];

    /** @type {StackEntry[]} */
    this._redoStack = [];

    /**
     * Transaction courante. null = pas dans une transaction. Re-entrance flat :
     * un nouveau transaction() pendant qu'une est ouverte se comporte comme un
     * simple fn() — les push s'accumulent dans la parent.
     * @type {{ actions: UndoableAction[], description: string | undefined } | null}
     */
    this._currentTransaction = null;

    /** @type {Set<RevertErrorHandler>} */
    this._errorHandlers = new Set();
  }

  /**
   * Push une action. Si on est dans une transaction, l'action s'accumule dans
   * sa composite. Sinon, elle est pushee atomiquement sur le stack undo.
   * Tout push (atomique ou via transaction.commit) vide le stack redo.
   * @param {UndoableAction} action
   */
  push(action) {
    if (this._currentTransaction !== null) {
      this._currentTransaction.actions.push(action);
      return;
    }
    this._pushStack(action);
  }

  /**
   * Ouvre une transaction, execute `fn` synchronement, ferme en CompositeAction
   * et push (sauf si aucune action n'a ete collectee). En re-entrance, fn() est
   * simplement appelee — toutes les actions s'accumulent dans la parent.
   *
   * Les exceptions de `fn()` BUBBLE pour visibilite developpeur ; le composite
   * collecte avant l'exception est tout de meme push (durabilite best-effort,
   * permet l'undo de la partie deja appliquee).
   *
   * @param {() => void} fn
   * @param {string}     [description]
   */
  transaction(fn, description) {
    if (this._currentTransaction !== null) {
      // Re-entrance flat : on execute fn() dans le contexte de la transaction
      // parent. Les push iront dans parent.actions automatiquement.
      fn();
      return;
    }
    this._currentTransaction = { actions: [], description };
    try {
      fn();
    } finally {
      const tx = this._currentTransaction;
      this._currentTransaction = null;
      if (tx.actions.length > 0) {
        const composite = this._makeComposite(tx.actions, tx.description);
        this._pushStack(composite);
      }
    }
  }

  /**
   * Annule la derniere entree du stack undo. Best-effort : si revert leve, on
   * log via onRevertError mais on conserve l'entree dans redo et on retourne
   * true (l'utilisateur a quand meme demande l'undo).
   * @returns {boolean} true si une entree a ete annulee, false si stack vide.
   */
  undo() {
    const entry = this._undoStack.pop();
    if (!entry) return false;
    const desc = entry.action.description || '';
    try {
      entry.action.revert();
    } catch (err) {
      this._reportError(err, entry.action, desc);
    }
    this._redoStack.push(entry);
    return true;
  }

  /**
   * Re-applique la derniere entree du stack redo. Si l'entree n'a pas de redo
   * (composite avec au moins une action sans redo, ou action sans redo), no-op
   * et retourne false.
   * @returns {boolean}
   */
  redo() {
    const entry = this._redoStack[this._redoStack.length - 1];
    if (!entry || typeof entry.action.redo !== 'function') return false;
    this._redoStack.pop();
    const desc = entry.action.description || '';
    try {
      entry.action.redo();
    } catch (err) {
      this._reportError(err, entry.action, desc);
    }
    this._undoStack.push(entry);
    return true;
  }

  /** @returns {boolean} */
  canUndo() {
    return this._undoStack.length > 0;
  }

  /** @returns {boolean} */
  canRedo() {
    const top = this._redoStack[this._redoStack.length - 1];
    return !!top && typeof top.action.redo === 'function';
  }

  /** Vide les deux stacks et la transaction courante. */
  clear() {
    this._undoStack.length = 0;
    this._redoStack.length = 0;
    this._currentTransaction = null;
  }

  /**
   * Souscrit un handler de log d'erreur revert/redo. Retourne unsubscribe.
   * Pattern coherent avec Bus.on() (J2.1).
   * @param {RevertErrorHandler} handler
   * @returns {() => void}
   */
  onRevertError(handler) {
    this._errorHandlers.add(handler);
    return () => { this._errorHandlers.delete(handler); };
  }

  // ── internes ─────────────────────────────────────────────────────────────

  /**
   * @param {UndoableAction} action
   * @private
   */
  _pushStack(action) {
    this._redoStack.length = 0;
    this._undoStack.push({ action, timestamp: Date.now() });
    // Cap : ejecte la plus ancienne. O(n) acceptable pour cap raisonnable.
    while (this._undoStack.length > this._cap) {
      this._undoStack.shift();
    }
  }

  /**
   * Construit une UndoableAction composite a partir d'une liste d'actions.
   * Revert : ordre inverse, best-effort.
   * Redo   : ordre normal, uniquement si TOUTES les actions ont un redo.
   * Domain : si toutes les actions partagent le meme domain, le composite en
   *   herite, sinon undefined.
   * AffectedIds : union (deduplication via Set).
   * @param {UndoableAction[]} actions
   * @param {string | undefined} description
   * @returns {UndoableAction}
   * @private
   */
  _makeComposite(actions, description) {
    const allHaveRedo = actions.every((a) => typeof a.redo === 'function');
    const domains = new Set(actions.map((a) => a.domain).filter(Boolean));
    const affected = new Set();
    for (const a of actions) {
      if (a.affectedIds) {
        for (const id of a.affectedIds) affected.add(id);
      }
    }

    const desc = description ?? `composite(${actions.length})`;

    /** @type {UndoableAction} */
    const composite = {
      description: desc,
      affectedIds: affected.size > 0 ? [...affected] : undefined,
      domain: domains.size === 1 ? [...domains][0] : undefined,
      revert: () => {
        for (let i = actions.length - 1; i >= 0; i--) {
          const a = actions[i];
          try {
            a.revert();
          } catch (err) {
            this._reportError(err, a, desc);
          }
        }
      },
    };

    if (allHaveRedo) {
      composite.redo = () => {
        for (const a of actions) {
          try {
            /** @type {() => void} */ (a.redo)();
          } catch (err) {
            this._reportError(err, a, desc);
          }
        }
      };
    }

    return composite;
  }

  /**
   * @param {unknown} err
   * @param {UndoableAction} action
   * @param {string} txDescription
   * @private
   */
  _reportError(err, action, txDescription) {
    if (this._errorHandlers.size === 0) {
      // eslint-disable-next-line no-console
      console.error('[undo] revert/redo error in', txDescription || '<no description>', err);
      return;
    }
    for (const h of [...this._errorHandlers]) {
      try {
        h(err, action, txDescription);
      } catch {
        // swallow : un onRevertError buggue ne doit pas casser le revert.
      }
    }
  }
}

/**
 * Singleton utilise par l'application (un seul contexte JS en ESM bundle).
 * Les tests peuvent instancier `new UndoStack()` pour isolation.
 */
export const undo = new UndoStack();
