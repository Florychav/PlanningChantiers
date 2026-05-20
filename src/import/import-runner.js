// @ts-check
/**
 * Orchestration de l'import vers Supabase.
 *
 * Consomme `import-core` (logique pure) et effectue les I/O reseau.
 * UI-agnostique : toute remontee passe par les callbacks `onLog` / `onProgress`,
 * ce qui rend la fonction testable avec un client Supabase factice.
 */
import { buildImportPlan, chunkArray } from './import-core.js';

/** Taille des lots d'upsert d'etiquettes (aligne sur le legacy). */
export const ETQ_BATCH_SIZE = 200;

/**
 * @typedef {Object} ImportHandlers
 * @property {(msg:string, type?:string)=>void} [onLog]
 * @property {(pct:number)=>void} [onProgress]
 */

/**
 * @typedef {Object} ImportResult
 * @property {number} personnesNew
 * @property {number} personnesSkip
 * @property {number} etqInserted
 * @property {number} pontsInserted
 * @property {number} reuInserted
 */

/**
 * Execute l'import complet d'un `planning.json` parse vers Supabase.
 * Leve une `Error` lisible en cas d'echec d'une requete.
 *
 * @param {any} client                 - client supabase-js (ou factice de test)
 * @param {any} parsed                  - contenu `planning.json` parse
 * @param {ImportHandlers} [handlers]
 * @returns {Promise<ImportResult>}
 */
export async function runImport(client, parsed, handlers = {}) {
  const log = handlers.onLog || (() => {});
  const progress = handlers.onProgress || (() => {});

  // 1) Charger les personnes deja presentes en base.
  log('Chargement des personnes existantes dans Supabase…');
  const { data: existingRows, error: selErr } = await client
    .from('personnes')
    .select('body');
  if (selErr) throw new Error('Lecture personnes : ' + selErr.message);
  const existingPersonnes = (existingRows || []).map((/** @type {any} */ r) => r.body);
  log(`→ ${existingPersonnes.length} personnes déjà présentes`, 'skip');
  progress(8);

  // 2) Construire le plan d'import (pur).
  const plan = buildImportPlan(parsed, existingPersonnes);
  for (const s of plan.personnesSkipped) {
    log(
      `👤 ${s.source.prenom} ${s.source.nom} → existe déjà ` +
        `(${String(s.existing.id).slice(0, 8)}…)`,
      'skip',
    );
  }
  for (const p of plan.personnesToInsert) {
    log(`+ ${p.prenom} ${p.nom} → ${String(p.id).slice(0, 8)}…`, 'new');
  }
  progress(30);

  // 3) Inserer les nouvelles personnes.
  if (plan.personnesInsertRows.length > 0) {
    log(`Insertion de ${plan.personnesInsertRows.length} nouvelle(s) personne(s)…`);
    const { error } = await client.from('personnes').insert(plan.personnesInsertRows);
    if (error) throw new Error('Insert personnes : ' + error.message);
    log(`✓ ${plan.personnesInsertRows.length} personnes insérées`, 'ok');
  } else {
    log('Aucune nouvelle personne à insérer', 'skip');
  }
  progress(35);

  // 4) Etiquettes : upsert par lots.
  const totalEtq = plan.etqRows.length + plan.counts.orphanEtiquettes;
  log(`${totalEtq} étiquettes à traiter…`);
  if (plan.counts.orphanEtiquettes > 0) {
    log(
      `⚠ ${plan.counts.orphanEtiquettes} étiquettes orphelines ignorées ` +
        `(personne introuvable)`,
      'skip',
    );
  }
  const batches = chunkArray(plan.etqRows, ETQ_BATCH_SIZE);
  let etqDone = 0;
  for (const batch of batches) {
    const { error } = await client.from('etiquettes').upsert(batch);
    if (error) throw new Error('Insert étiquettes : ' + error.message);
    const from = etqDone + 1;
    etqDone += batch.length;
    log(`✓ Étiquettes ${from}–${etqDone} insérées`, 'ok');
    progress(35 + (etqDone / Math.max(1, plan.etqRows.length)) * 45);
  }

  // 5) Ponts : upsert direct (pas de remap).
  if (plan.pontRows.length > 0) {
    const { error } = await client.from('ponts').upsert(plan.pontRows);
    if (error) throw new Error('Insert ponts : ' + error.message);
    log(`✓ ${plan.pontRows.length} ponts insérés`, 'ok');
  }
  progress(88);

  // 6) Reunions : upsert (references personne deja remappees par le plan).
  if (plan.reuRows.length > 0) {
    const { error } = await client.from('reunions').upsert(plan.reuRows);
    if (error) throw new Error('Insert réunions : ' + error.message);
    log(`✓ ${plan.reuRows.length} réunions insérées`, 'ok');
  }
  progress(100);

  /** @type {ImportResult} */
  const result = {
    personnesNew: plan.counts.personnesNew,
    personnesSkip: plan.counts.personnesSkip,
    etqInserted: plan.counts.etiquettes,
    pontsInserted: plan.counts.ponts,
    reuInserted: plan.counts.reunions,
  };
  log(
    `Import terminé — ${result.personnesNew} personnes nouvelles ` +
      `(${result.personnesSkip} ignorées), ${result.etqInserted} étiquettes, ` +
      `${result.pontsInserted} ponts, ${result.reuInserted} réunions importées`,
    'success',
  );
  return result;
}
