// @ts-check
/**
 * Bus d'evenements synchrone, sans dependance externe.
 *
 * Convention de namespacing : `domaine.action` (ex. `label.created`,
 * `label.moved`, `theme.changed`).
 *
 * Design notes :
 * - SYNC par construction : tous les handlers d'un emit s'executent dans
 *   le meme tick, ce qui permet a J2.2 (undo) d'envelopper un emit dans une
 *   transaction atomique sans race entre handlers et capture undoable.
 * - Le bus n'a AUCUNE connaissance de l'undo : c'est aux handlers de pousser
 *   leurs `UndoableAction` sur la stack via un wrapper en J2.2.
 * - Les erreurs handler sont catchees et envoyees a `onError` (par defaut
 *   console.error). Un handler qui leve n'interrompt pas les autres.
 * - Snapshot des handlers avant iteration : un handler peut s'unsubscribe ou
 *   ajouter un autre handler pendant l'emit sans corrompre la boucle.
 *
 * @template [TPayload=any]
 * @template [TCtx=any]
 * @typedef {{ type: string, payload?: TPayload, ctx?: TCtx }} BusEvent
 */

/**
 * @typedef {(event: BusEvent) => void} Handler
 */

/**
 * @typedef {(err: unknown, event: BusEvent, handler: Handler) => void} ErrorReporter
 */

export class Bus {
  constructor() {
    /** @type {Map<string, Set<Handler>>} */
    this._handlers = new Map();

    /** @type {ErrorReporter} */
    this._onError = (err, event) => {
      // eslint-disable-next-line no-console
      console.error('[bus] handler error on', event.type, err);
    };
  }

  /**
   * Souscrit `handler` aux events de `type`. Retourne un unsubscribe.
   * @param {string} type
   * @param {Handler} handler
   * @returns {() => void}
   */
  on(type, handler) {
    let set = this._handlers.get(type);
    if (!set) {
      set = new Set();
      this._handlers.set(type, set);
    }
    set.add(handler);
    return () => this.off(type, handler);
  }

  /**
   * Desabonne `handler` de `type`. No-op si non abonne.
   * @param {string} type
   * @param {Handler} handler
   */
  off(type, handler) {
    const set = this._handlers.get(type);
    if (!set) return;
    set.delete(handler);
    if (set.size === 0) this._handlers.delete(type);
  }

  /**
   * Emet un event vers tous les handlers de `type`.
   * SYNC : chaque handler s'execute avant que `emit` ne retourne.
   * Une erreur dans un handler est isolee (envoyee a onError) et n'empeche
   * pas l'execution des handlers suivants.
   * @param {string} type
   * @param {any} [payload]
   * @param {any} [ctx]
   */
  emit(type, payload, ctx) {
    const set = this._handlers.get(type);
    if (!set || set.size === 0) return;
    /** @type {BusEvent} */
    const event = { type, payload, ctx };
    // Snapshot pour autoriser unsubscribe/subscribe pendant l'iteration.
    const snapshot = [...set];
    for (const handler of snapshot) {
      try {
        handler(event);
      } catch (err) {
        try {
          this._onError(err, event, handler);
        } catch {
          // L'onError lui-meme peut lever — on ne propage rien.
        }
      }
    }
  }

  /**
   * Installe un reporter d'erreur global. Utile pour brancher un trace ring
   * buffer (anticipation observabilite Phase 3 du plan v2).
   * @param {ErrorReporter} fn
   */
  onError(fn) {
    this._onError = fn;
  }

  /**
   * Nombre d'handlers abonnes a `type`. Utile pour tests + diagnostics.
   * @param {string} type
   * @returns {number}
   */
  listenerCount(type) {
    return this._handlers.get(type)?.size ?? 0;
  }

  /**
   * Supprime tous les handlers. Utile pour reset entre tests.
   */
  clear() {
    this._handlers.clear();
  }
}

/**
 * Singleton bus utilise par l'application (un seul contexte JS en ESM bundle).
 * Les tests peuvent instancier `new Bus()` pour isolation.
 */
export const bus = new Bus();
