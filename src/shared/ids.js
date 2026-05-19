// @ts-check
/**
 * Generation d'identifiants. Tente crypto.randomUUID() (RFC 4122 v4),
 * fallback Math.random + Date.now en environnements vieillots ou non-DOM
 * (Node < 19 sans webcrypto, certains JSDom anciens).
 *
 * @returns {string}
 */
export function generateId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  const rand = Math.random().toString(36).slice(2, 12);
  return `id-${rand}-${Date.now().toString(36)}`;
}
