// @ts-check
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { subscribeRealtime, applyPatch } from '../../src/shared/realtime.js';

function makeStore() {
  return {
    etiquettes:     /** @type {any[]} */ ([]),
    etiquettes_sav: /** @type {any[]} */ ([]),
    personnes:      /** @type {any[]} */ ([]),
    personnes_sav:  /** @type {any[]} */ ([]),
  };
}

/**
 * Mock minimal d'un client Supabase. Expose _fire(channelName, payload)
 * pour declencher des events depuis les tests.
 */
function makeMockClient() {
  /** @type {Map<string, ((p: any) => void)[]>} */
  const handlers = new Map();
  const unsubscribed = new Set();
  const client = {
    channel(/** @type {string} */ name) {
      const ch = {
        on(/** @type {string} */ _evt, /** @type {any} */ _cfg, /** @type {(p: any) => void} */ fn) {
          const list = handlers.get(name) ?? [];
          list.push(fn);
          handlers.set(name, list);
          return ch;
        },
        subscribe() { return ch; },
        unsubscribe() { unsubscribed.add(name); return ch; },
      };
      return ch;
    },
    _fire(/** @type {string} */ channelName, /** @type {any} */ payload) {
      for (const fn of handlers.get(channelName) ?? []) fn(payload);
    },
    _unsubscribed: unsubscribed,
  };
  return client;
}

describe('applyPatch — operations directes', () => {
  /** @type {ReturnType<typeof makeStore>} */ let store;
  beforeEach(() => { store = makeStore(); });

  it('INSERT ajoute un item nouveau', () => {
    const info = applyPatch(store, 'etiquettes', { eventType: 'INSERT', new: { id: 'A', body: { id: 'A', type: 'rouge' } } });
    expect(store.etiquettes).toHaveLength(1);
    expect(store.etiquettes[0].type).toBe('rouge');
    expect(info?.op).toBe('insert');
  });

  it('INSERT duplique (meme id) = no-op', () => {
    store.etiquettes.push({ id: 'A', type: 'rouge' });
    const info = applyPatch(store, 'etiquettes', { eventType: 'INSERT', new: { id: 'A', body: { id: 'A', type: 'bleu' } } });
    expect(store.etiquettes).toHaveLength(1);
    expect(store.etiquettes[0].type).toBe('rouge');
    expect(info).toBeNull();
  });

  it('UPDATE remplace par id', () => {
    store.etiquettes.push({ id: 'A', type: 'rouge' });
    applyPatch(store, 'etiquettes', { eventType: 'UPDATE', new: { id: 'A', body: { id: 'A', type: 'bleu' } } });
    expect(store.etiquettes[0].type).toBe('bleu');
  });

  it('UPDATE sur id inconnu => insertion (resilience)', () => {
    applyPatch(store, 'etiquettes', { eventType: 'UPDATE', new: { id: 'A', body: { id: 'A', type: 'bleu' } } });
    expect(store.etiquettes).toHaveLength(1);
  });

  it('DELETE retire l\'item', () => {
    store.etiquettes.push({ id: 'A', type: 'rouge' });
    store.etiquettes.push({ id: 'B', type: 'bleu' });
    const info = applyPatch(store, 'etiquettes', { eventType: 'DELETE', old: { id: 'B', body: { id: 'B' } } });
    expect(store.etiquettes.map((e) => e.id)).toEqual(['A']);
    expect(info?.op).toBe('delete');
  });

  it('DELETE id inconnu = no-op', () => {
    store.etiquettes.push({ id: 'A', type: 'rouge' });
    const info = applyPatch(store, 'etiquettes', { eventType: 'DELETE', old: { id: 'ZZZ', body: { id: 'ZZZ' } } });
    expect(store.etiquettes).toHaveLength(1);
    expect(info).toBeNull();
  });

  it('table inconnue = no-op', () => {
    const info = applyPatch(store, 'unknown', { eventType: 'INSERT', new: { id: 'X', body: { id: 'X' } } });
    expect(info).toBeNull();
  });

  it('payload sans body utilise row direct', () => {
    applyPatch(store, 'personnes', { eventType: 'INSERT', new: { id: 'P1', prenom: 'Alice' } });
    expect(store.personnes[0].prenom).toBe('Alice');
  });

  it('routes vers la bonne table', () => {
    applyPatch(store, 'etiquettes_sav', { eventType: 'INSERT', new: { id: 'S1', body: { id: 'S1', type: 'sav' } } });
    applyPatch(store, 'personnes_sav',  { eventType: 'INSERT', new: { id: 'P1', body: { id: 'P1', prenom: 'X' } } });
    expect(store.etiquettes_sav).toHaveLength(1);
    expect(store.personnes_sav).toHaveLength(1);
    expect(store.etiquettes).toHaveLength(0);
    expect(store.personnes).toHaveLength(0);
  });
});

describe('applyPatch — anti-echo originTag', () => {
  /** @type {ReturnType<typeof makeStore>} */ let store;
  beforeEach(() => { store = makeStore(); });

  it('event avec own tag => skip', () => {
    const info = applyPatch(store, 'etiquettes', {
      eventType: 'INSERT',
      new: { id: 'A', body: { id: 'A', type: 'rouge', originTag: 'me' } },
    }, 'me');
    expect(store.etiquettes).toHaveLength(0);
    expect(info).toBeNull();
  });

  it('event avec tag different => applique', () => {
    applyPatch(store, 'etiquettes', {
      eventType: 'INSERT',
      new: { id: 'A', body: { id: 'A', type: 'rouge', originTag: 'other' } },
    }, 'me');
    expect(store.etiquettes).toHaveLength(1);
  });

  it('event sans tag => applique (legacy untaggued)', () => {
    applyPatch(store, 'etiquettes', {
      eventType: 'INSERT',
      new: { id: 'A', body: { id: 'A', type: 'rouge' } },
    }, 'me');
    expect(store.etiquettes).toHaveLength(1);
  });

  it('tag dans body.data.originTag aussi reconnu', () => {
    const info = applyPatch(store, 'etiquettes', {
      eventType: 'INSERT',
      new: { id: 'A', body: { id: 'A', type: 'rouge', data: { originTag: 'me' } } },
    }, 'me');
    expect(info).toBeNull();
  });
});

describe('subscribeRealtime — souscription + integration', () => {
  /** @type {ReturnType<typeof makeStore>} */ let store;
  /** @type {ReturnType<typeof makeMockClient>} */ let client;
  beforeEach(() => {
    store = makeStore();
    client = makeMockClient();
  });

  it('souscrit aux 4 tables par defaut', () => {
    const off = subscribeRealtime(client, store);
    expect(typeof off).toBe('function');

    client._fire('realtime:etiquettes', {
      eventType: 'INSERT',
      new: { id: 'A', body: { id: 'A', type: 'rouge' } },
    });
    expect(store.etiquettes).toHaveLength(1);

    client._fire('realtime:etiquettes_sav', {
      eventType: 'INSERT',
      new: { id: 'S1', body: { id: 'S1', type: 'sav' } },
    });
    expect(store.etiquettes_sav).toHaveLength(1);
  });

  it('opts.tables restreint le sous-ensemble', () => {
    subscribeRealtime(client, store, { tables: ['etiquettes'] });
    client._fire('realtime:etiquettes_sav', {
      eventType: 'INSERT',
      new: { id: 'S1', body: { id: 'S1' } },
    });
    // Pas de handler abonne pour etiquettes_sav.
    expect(store.etiquettes_sav).toHaveLength(0);
  });

  it('unsubscribe ferme les channels', () => {
    const off = subscribeRealtime(client, store);
    off();
    expect(client._unsubscribed.has('realtime:etiquettes')).toBe(true);
    expect(client._unsubscribed.has('realtime:etiquettes_sav')).toBe(true);
  });

  it('opts.onPatchApplied est appele pour chaque patch effectif', () => {
    const observer = vi.fn();
    subscribeRealtime(client, store, { onPatchApplied: observer, originTag: 'me' });

    client._fire('realtime:etiquettes', {
      eventType: 'INSERT',
      new: { id: 'A', body: { id: 'A' } },
    });
    expect(observer).toHaveBeenCalledTimes(1);
    expect(observer.mock.calls[0][0].table).toBe('etiquettes');
    expect(observer.mock.calls[0][0].op).toBe('insert');

    // Echo (own tag) ne declenche pas onPatchApplied.
    client._fire('realtime:etiquettes', {
      eventType: 'INSERT',
      new: { id: 'B', body: { id: 'B', originTag: 'me' } },
    });
    expect(observer).toHaveBeenCalledTimes(1); // pas appele
  });

  it('scenario complet : INSERT, UPDATE, DELETE sur etiquettes', () => {
    subscribeRealtime(client, store);
    const fire = (op, item) => client._fire('realtime:etiquettes', { eventType: op, [op === 'DELETE' ? 'old' : 'new']: { id: item.id, body: item } });

    fire('INSERT', { id: 'A', type: 'rouge' });
    expect(store.etiquettes).toHaveLength(1);

    fire('UPDATE', { id: 'A', type: 'bleu' });
    expect(store.etiquettes[0].type).toBe('bleu');

    fire('DELETE', { id: 'A' });
    expect(store.etiquettes).toHaveLength(0);
  });

  it('anti-echo avec subscribeRealtime + opts.originTag', () => {
    subscribeRealtime(client, store, { originTag: 'me' });
    client._fire('realtime:etiquettes', {
      eventType: 'INSERT',
      new: { id: 'A', body: { id: 'A', originTag: 'me' } },
    });
    expect(store.etiquettes).toHaveLength(0);
  });
});
