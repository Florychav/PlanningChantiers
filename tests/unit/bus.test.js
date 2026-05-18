// @ts-check
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Bus, bus as singleton } from '../../src/shared/bus.js';

describe('Bus — cas nominaux', () => {
  /** @type {Bus} */
  let bus;
  beforeEach(() => { bus = new Bus(); });

  it('emit appelle les handlers abonnes au meme type avec un event {type, payload, ctx}', () => {
    const h = vi.fn();
    bus.on('label.created', h);
    bus.emit('label.created', { id: 'a' }, { origin: 'user' });

    expect(h).toHaveBeenCalledTimes(1);
    expect(h).toHaveBeenCalledWith({
      type: 'label.created',
      payload: { id: 'a' },
      ctx: { origin: 'user' },
    });
  });

  it('emit sans handler ne leve pas', () => {
    expect(() => bus.emit('label.moved', { id: 'a' })).not.toThrow();
  });

  it('plusieurs handlers du meme type recoivent l\'event', () => {
    const h1 = vi.fn();
    const h2 = vi.fn();
    bus.on('label.updated', h1);
    bus.on('label.updated', h2);
    bus.emit('label.updated', { id: 'b' });
    expect(h1).toHaveBeenCalledTimes(1);
    expect(h2).toHaveBeenCalledTimes(1);
  });

  it('un handler ne recoit pas les events d\'un autre type', () => {
    const h = vi.fn();
    bus.on('label.created', h);
    bus.emit('label.deleted', { id: 'c' });
    expect(h).not.toHaveBeenCalled();
  });

  it('emit est synchrone : handler execute avant retour de emit', () => {
    let executed = false;
    bus.on('app.boot', () => { executed = true; });
    bus.emit('app.boot');
    expect(executed).toBe(true);
  });
});

describe('Bus — desabonnement', () => {
  /** @type {Bus} */
  let bus;
  beforeEach(() => { bus = new Bus(); });

  it('on() retourne une fonction unsubscribe qui retire le handler', () => {
    const h = vi.fn();
    const off = bus.on('label.created', h);
    off();
    bus.emit('label.created', { id: 'a' });
    expect(h).not.toHaveBeenCalled();
  });

  it('off(type, handler) retire un handler precis', () => {
    const h1 = vi.fn();
    const h2 = vi.fn();
    bus.on('label.created', h1);
    bus.on('label.created', h2);
    bus.off('label.created', h1);
    bus.emit('label.created');
    expect(h1).not.toHaveBeenCalled();
    expect(h2).toHaveBeenCalledTimes(1);
  });

  it('off() sur un handler inconnu ne leve pas', () => {
    expect(() => bus.off('inexistant', () => {})).not.toThrow();
  });

  it('un handler peut se desabonner pendant emit sans casser la boucle', () => {
    const order = /** @type {string[]} */ ([]);
    const offSelf = bus.on('cascade', () => {
      order.push('h1');
      offSelf();
    });
    bus.on('cascade', () => { order.push('h2'); });
    bus.emit('cascade');
    expect(order).toEqual(['h1', 'h2']);

    // Second emit : h1 n'est plus la, h2 oui.
    bus.emit('cascade');
    expect(order).toEqual(['h1', 'h2', 'h2']);
  });

  it('un handler peut ajouter un nouveau handler pendant emit sans le declencher dans le meme emit', () => {
    const order = /** @type {string[]} */ ([]);
    bus.on('cascade', () => {
      order.push('h1');
      bus.on('cascade', () => { order.push('h2-added-mid-emit'); });
    });
    bus.emit('cascade');
    // Le snapshot a fige les handlers : seul h1 s'execute au 1er emit.
    expect(order).toEqual(['h1']);

    // Au 2eme emit, h2 (ajoute) s'execute, h1 aussi (et reajoute h3, etc — on
    // borne en limitant le test au 2eme cycle).
    bus.emit('cascade');
    expect(order).toContain('h2-added-mid-emit');
  });

  it('listenerCount() reflete les abonnements en cours', () => {
    expect(bus.listenerCount('x')).toBe(0);
    const off = bus.on('x', () => {});
    expect(bus.listenerCount('x')).toBe(1);
    bus.on('x', () => {});
    expect(bus.listenerCount('x')).toBe(2);
    off();
    expect(bus.listenerCount('x')).toBe(1);
  });

  it('clear() supprime tous les handlers tous types confondus', () => {
    bus.on('a', () => {});
    bus.on('b', () => {});
    expect(bus.listenerCount('a')).toBe(1);
    bus.clear();
    expect(bus.listenerCount('a')).toBe(0);
    expect(bus.listenerCount('b')).toBe(0);
  });
});

describe('Bus — gestion d\'erreur handler', () => {
  /** @type {Bus} */
  let bus;
  beforeEach(() => { bus = new Bus(); });

  it('une erreur dans un handler n\'interrompt pas les handlers suivants', () => {
    const h1 = vi.fn(() => { throw new Error('boom'); });
    const h2 = vi.fn();
    bus.onError(() => { /* swallow pour ce test */ });
    bus.on('x', h1);
    bus.on('x', h2);
    bus.emit('x', { v: 1 });
    expect(h1).toHaveBeenCalled();
    expect(h2).toHaveBeenCalled();
  });

  it('onError personnalise est invoque avec (err, event, handler)', () => {
    const onErr = vi.fn();
    bus.onError(onErr);
    const failing = () => { throw new Error('boom'); };
    bus.on('x', failing);
    bus.emit('x', 42);
    expect(onErr).toHaveBeenCalledTimes(1);
    const [err, event, handler] = onErr.mock.calls[0];
    expect(err).toBeInstanceOf(Error);
    expect(/** @type {Error} */ (err).message).toBe('boom');
    expect(event).toEqual({ type: 'x', payload: 42, ctx: undefined });
    expect(handler).toBe(failing);
  });

  it('si onError lui-meme leve, emit ne propage pas l\'erreur', () => {
    bus.onError(() => { throw new Error('onError-boom'); });
    bus.on('x', () => { throw new Error('handler-boom'); });
    expect(() => bus.emit('x')).not.toThrow();
  });

  it('onError par defaut log via console.error', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    bus.on('x', () => { throw new Error('boom'); });
    bus.emit('x');
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe('Bus — singleton exporte', () => {
  it('exporte un singleton `bus` distinct des instances Bus', () => {
    expect(singleton).toBeInstanceOf(Bus);
    // Reset au cas ou un autre test ait pollue.
    singleton.clear();
    const h = vi.fn();
    singleton.on('demo', h);
    singleton.emit('demo', { ok: true });
    expect(h).toHaveBeenCalledWith({ type: 'demo', payload: { ok: true }, ctx: undefined });
    singleton.clear();
  });
});
