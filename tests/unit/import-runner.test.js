// @ts-check
import { describe, it, expect } from 'vitest';
import { runImport, ETQ_BATCH_SIZE } from '../../src/import/import-runner.js';

/**
 * Construit un client Supabase factice.
 * @param {{existing?:any[], failOn?:{select?:string, insert?:string, upsert?:string}}} [cfg]
 */
function makeFakeClient(cfg = {}) {
  const existing = cfg.existing || [];
  const failOn = cfg.failOn || {};
  /** @type {{inserted:Record<string,any[]>, upserted:Record<string,any[]>}} */
  const captured = { inserted: {}, upserted: {} };

  const client = {
    captured,
    from(/** @type {string} */ table) {
      return {
        select() {
          if (failOn.select === table) {
            return Promise.resolve({ data: null, error: { message: `select ${table} KO` } });
          }
          const data =
            table === 'personnes' ? existing.map((b) => ({ body: b })) : [];
          return Promise.resolve({ data, error: null });
        },
        insert(/** @type {any[]} */ rows) {
          if (failOn.insert === table) {
            return Promise.resolve({ error: { message: `insert ${table} KO` } });
          }
          captured.inserted[table] = (captured.inserted[table] || []).concat(rows);
          return Promise.resolve({ error: null });
        },
        upsert(/** @type {any[]} */ rows) {
          if (failOn.upsert === table) {
            return Promise.resolve({ error: { message: `upsert ${table} KO` } });
          }
          captured.upserted[table] = (captured.upserted[table] || []).concat(rows);
          return Promise.resolve({ error: null });
        },
      };
    },
  };
  return client;
}

/** Collecte les appels onLog / onProgress. */
function makeHandlers() {
  /** @type {{msg:string, type:string}[]} */
  const logs = [];
  /** @type {number[]} */
  const progress = [];
  return {
    logs,
    progress,
    handlers: {
      onLog: (/** @type {string} */ msg, /** @type {string=} */ type) =>
        logs.push({ msg, type: type || '' }),
      onProgress: (/** @type {number} */ p) => progress.push(p),
    },
  };
}

describe('import-runner — runImport() nominal', () => {
  it('importe personnes, etiquettes, ponts, reunions', async () => {
    const client = makeFakeClient();
    const { handlers, progress } = makeHandlers();
    const parsed = {
      personnes: [{ id: 'old-1', prenom: 'Anne', nom: 'Martin' }],
      etiquettes: [{ id: 'e1', personneId: 'old-1', type: 'rouge' }],
      ponts: [{ id: 'po1', date: '2026-05-01' }],
      reunions: [{ id: 'r1', personnes: ['old-1'] }],
    };

    const res = await runImport(client, parsed, handlers);

    expect(res).toEqual({
      personnesNew: 1,
      personnesSkip: 0,
      etqInserted: 1,
      pontsInserted: 1,
      reuInserted: 1,
    });
    expect(client.captured.inserted.personnes).toHaveLength(1);
    expect(client.captured.upserted.etiquettes).toHaveLength(1);
    expect(client.captured.upserted.ponts).toHaveLength(1);
    expect(client.captured.upserted.reunions).toHaveLength(1);
    expect(progress[progress.length - 1]).toBe(100);
  });

  it('ignore une personne deja en base', async () => {
    const client = makeFakeClient({
      existing: [{ id: 'db-1', prenom: 'Anne', nom: 'Martin' }],
    });
    const { handlers } = makeHandlers();
    const res = await runImport(
      client,
      { personnes: [{ id: 'old-1', prenom: 'Anne', nom: 'Martin' }] },
      handlers,
    );
    expect(res.personnesNew).toBe(0);
    expect(res.personnesSkip).toBe(1);
    expect(client.captured.inserted.personnes).toBeUndefined();
  });

  it('remappe personneId des etiquettes vers le nouvel id', async () => {
    const client = makeFakeClient();
    const { handlers } = makeHandlers();
    await runImport(
      client,
      {
        personnes: [{ id: 'old-9', prenom: 'Zoé', nom: 'Blanc' }],
        etiquettes: [{ id: 'e1', personneId: 'old-9' }],
      },
      handlers,
    );
    const row = client.captured.upserted.etiquettes[0];
    expect(row.body.personneId).not.toBe('old-9');
    expect(row.body.personneId).toBe(client.captured.inserted.personnes[0].id);
  });

  it('decoupe les etiquettes en lots de ETQ_BATCH_SIZE', async () => {
    const client = makeFakeClient();
    const { handlers } = makeHandlers();
    const N = ETQ_BATCH_SIZE * 2 + 5;
    const etiquettes = Array.from({ length: N }, (_, i) => ({
      id: `e${i}`,
      personneId: 'old-1',
    }));
    await runImport(
      client,
      { personnes: [{ id: 'old-1', prenom: 'A', nom: 'B' }], etiquettes },
      handlers,
    );
    expect(client.captured.upserted.etiquettes).toHaveLength(N);
  });
});

describe('import-runner — runImport() erreurs', () => {
  it('leve si la lecture des personnes echoue', async () => {
    const client = makeFakeClient({ failOn: { select: 'personnes' } });
    const { handlers } = makeHandlers();
    await expect(
      runImport(client, { personnes: [] }, handlers),
    ).rejects.toThrow(/Lecture personnes/);
  });

  it('leve si l insertion des personnes echoue', async () => {
    const client = makeFakeClient({ failOn: { insert: 'personnes' } });
    const { handlers } = makeHandlers();
    await expect(
      runImport(
        client,
        { personnes: [{ id: 'old-1', prenom: 'A', nom: 'B' }] },
        handlers,
      ),
    ).rejects.toThrow(/Insert personnes/);
  });

  it('leve si l upsert des etiquettes echoue', async () => {
    const client = makeFakeClient({ failOn: { upsert: 'etiquettes' } });
    const { handlers } = makeHandlers();
    await expect(
      runImport(
        client,
        {
          personnes: [{ id: 'old-1', prenom: 'A', nom: 'B' }],
          etiquettes: [{ id: 'e1', personneId: 'old-1' }],
        },
        handlers,
      ),
    ).rejects.toThrow(/Insert étiquettes/);
  });
});

describe('import-runner — runImport() journal', () => {
  it('emet une ligne de log finale de type success', async () => {
    const client = makeFakeClient();
    const { handlers, logs } = makeHandlers();
    await runImport(
      client,
      { personnes: [{ id: 'old-1', prenom: 'A', nom: 'B' }] },
      handlers,
    );
    expect(logs.some((l) => l.type === 'success')).toBe(true);
  });

  it('fonctionne sans handlers (callbacks optionnels)', async () => {
    const client = makeFakeClient();
    const res = await runImport(client, { personnes: [] });
    expect(res.personnesNew).toBe(0);
  });
});
