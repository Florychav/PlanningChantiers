// @ts-check
/**
 * Coeur logique de l'import `planning.json` -> Supabase.
 *
 * Fonctions PURES : aucune I/O reseau, aucun acces DOM. Tout est deterministe
 * a generateur d'id injecte fixe pres. Les modules `import-runner` (I/O) et
 * `import-ui` (DOM) consomment ce module.
 *
 * Portage 1:1 de la logique du legacy `import.html` (J3.8) :
 * - deduplication des personnes par prenom+nom normalises ;
 * - table de correspondance ancienId -> nouvelId ;
 * - remap des references personne dans etiquettes et reunions ;
 * - ecartement des etiquettes orphelines (personne introuvable).
 */
import { generateId } from '../shared/ids.js';

/**
 * Normalise une chaine pour comparaison : trim + minuscules + suppression
 * des accents (decomposition NFD puis retrait des diacritiques combinants).
 *
 * @param {unknown} s
 * @returns {string}
 */
export function norm(s) {
  return (s == null ? '' : String(s))
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

/**
 * Cle de deduplication d'une personne : `prenom|nom` normalises.
 *
 * @param {any} p
 * @returns {string}
 */
export function personKey(p) {
  return norm(p && p.prenom) + '|' + norm(p && p.nom);
}

/**
 * Extrait les 4 collections d'un `planning.json` parse. Toute valeur non
 * tableau est remplacee par un tableau vide (tolerance fichier partiel).
 *
 * @param {any} parsed
 * @returns {{personnes:any[], etiquettes:any[], ponts:any[], reunions:any[]}}
 */
export function extractCollections(parsed) {
  const arr = (/** @type {unknown} */ v) => (Array.isArray(v) ? v : []);
  const p = parsed || {};
  return {
    personnes: arr(p.personnes),
    etiquettes: arr(p.etiquettes),
    ponts: arr(p.ponts),
    reunions: arr(p.reunions),
  };
}

/**
 * Decoupe un tableau en lots de taille `size`.
 *
 * @template T
 * @param {T[]} arr
 * @param {number} size
 * @returns {T[][]}
 */
export function chunkArray(arr, size) {
  if (!Number.isInteger(size) || size <= 0) {
    throw new Error('chunkArray: size doit etre un entier > 0');
  }
  const out = /** @type {T[][]} */ ([]);
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

/**
 * @typedef {Object} ImportPlan
 * @property {Record<string,string>} idMap            - ancienId -> nouvelId
 * @property {any[]} personnesToInsert                - personnes nouvelles (id remappe)
 * @property {{source:any, existing:any}[]} personnesSkipped - doublons detectes
 * @property {{id:string, body:any}[]} personnesInsertRows   - lignes pretes pour insert
 * @property {{id:string, body:any}[]} etqRows        - etiquettes remappees pretes a l'upsert
 * @property {any[]} orphanEtiquettes                 - etiquettes ecartees (personne introuvable)
 * @property {{id:string, body:any}[]} pontRows       - ponts prets a l'upsert
 * @property {{id:string, body:any}[]} reuRows        - reunions remappees pretes a l'upsert
 * @property {{personnesNew:number, personnesSkip:number, etiquettes:number,
 *            orphanEtiquettes:number, ponts:number, reunions:number}} counts
 */

/**
 * Construit le plan d'import complet a partir des donnees parsees et des
 * personnes deja presentes en base. PURE — ne touche ni reseau ni DOM.
 *
 * @param {any} parsed                  - contenu `planning.json` parse
 * @param {any[]} existingPersonnes     - bodies des personnes deja en base
 * @param {() => string} [genId]        - generateur d'id (injectable pour tests)
 * @returns {ImportPlan}
 */
export function buildImportPlan(parsed, existingPersonnes, genId = generateId) {
  const { personnes, etiquettes, ponts, reunions } = extractCollections(parsed);

  // Index des personnes existantes par cle de deduplication.
  const existingByKey = new Map();
  for (const p of existingPersonnes || []) {
    existingByKey.set(personKey(p), p);
  }

  /** @type {Record<string,string>} */
  const idMap = {};
  const personnesToInsert = [];
  /** @type {{source:any, existing:any}[]} */
  const personnesSkipped = [];

  for (const p of personnes) {
    const existing = existingByKey.get(personKey(p));
    if (existing) {
      idMap[p.id] = String(existing.id);
      personnesSkipped.push({ source: p, existing });
    } else {
      const newId = genId();
      idMap[p.id] = newId;
      personnesToInsert.push({ ...p, id: newId });
    }
  }

  // Etiquettes : remap de personneId, ecartement des orphelines.
  const etqRows = [];
  const orphanEtiquettes = [];
  for (const e of etiquettes) {
    const newPersonneId = idMap[e.personneId];
    if (newPersonneId === undefined) {
      orphanEtiquettes.push(e);
      continue;
    }
    etqRows.push({
      id: String(e.id || genId()),
      body: { ...e, personneId: newPersonneId },
    });
  }

  // Ponts : aucun remap (pas de reference personne).
  const pontRows = ponts.map((p) => ({ id: String(p.id || genId()), body: p }));

  // Reunions : remap des ids dans body.personnes[], orphelins filtres.
  const reuRows = reunions.map((r) => {
    const mappedPersonnes = (r.personnes || [])
      .map((/** @type {string} */ oldId) => idMap[oldId])
      .filter((/** @type {unknown} */ x) => x !== undefined);
    return {
      id: String(r.id || genId()),
      body: { ...r, personnes: mappedPersonnes },
    };
  });

  return {
    idMap,
    personnesToInsert,
    personnesSkipped,
    personnesInsertRows: personnesToInsert.map((p) => ({
      id: String(p.id),
      body: p,
    })),
    etqRows,
    orphanEtiquettes,
    pontRows,
    reuRows,
    counts: {
      personnesNew: personnesToInsert.length,
      personnesSkip: personnesSkipped.length,
      etiquettes: etqRows.length,
      orphanEtiquettes: orphanEtiquettes.length,
      ponts: pontRows.length,
      reunions: reuRows.length,
    },
  };
}
