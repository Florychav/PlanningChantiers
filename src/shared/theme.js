// @ts-check
/**
 * Theme dark/light — source de verite cote bundle ESM.
 *
 * Persistance : `localStorage.planning.theme` ('dark' | 'light').
 * Application : `document.documentElement.dataset.theme = '<theme>'` (selecteur
 *   CSS `:root[data-theme="light"]`).
 * Defaut : 'dark' (zero regression visuelle au premier lancement).
 * Fallback : valeur invalide -> 'dark'.
 *
 * Le code legacy (planning-montage.html, planning-sav.html) duplique la
 * semantique en vanilla (boot snippet + bouton + handlers) car il ne charge
 * pas le bundle ESM (J2.4 decision A1). Les deux flux partagent la meme
 * cle localStorage et le meme dataset attribute, donc sont coherents.
 *
 * @typedef {'dark' | 'light'} Theme
 */

import { bus } from './bus.js';

export const STORAGE_KEY = 'planning.theme';
export const DEFAULT_THEME = /** @type {Theme} */ ('dark');
const VALID_THEMES = /** @type {Theme[]} */ (['dark', 'light']);

/**
 * @param {unknown} t
 * @returns {t is Theme}
 */
function isValidTheme(t) {
  return typeof t === 'string' && VALID_THEMES.includes(/** @type {Theme} */ (t));
}

/**
 * Lit le theme courant depuis localStorage. Defaut dark, fallback dark sur
 * valeur invalide ou storage indisponible (Safari mode prive, sandbox, etc.).
 * @returns {Theme}
 */
export function getTheme() {
  try {
    if (typeof localStorage === 'undefined') return DEFAULT_THEME;
    const raw = localStorage.getItem(STORAGE_KEY);
    return isValidTheme(raw) ? raw : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

/**
 * Definit le theme : persiste, applique au DOM, emet `theme-changed` sur le
 * bus si le theme a effectivement change.
 * @param {string} theme
 * @returns {Theme} le theme effectivement applique (fallback dark si invalide).
 */
export function setTheme(theme) {
  const next = isValidTheme(theme) ? theme : DEFAULT_THEME;
  const prev = getTheme();
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // storage indisponible : on continue quand meme l'application DOM.
  }
  if (typeof document !== 'undefined' && document.documentElement) {
    document.documentElement.dataset.theme = next;
  }
  if (prev !== next) {
    bus.emit('theme-changed', { from: prev, to: next });
  }
  return next;
}

/**
 * Bascule dark<->light. Retourne le nouveau theme.
 * @returns {Theme}
 */
export function toggleTheme() {
  return setTheme(getTheme() === 'dark' ? 'light' : 'dark');
}

/**
 * Souscrit aux changements de theme. Le callback recoit `{from, to}`. Retourne
 * une fonction unsubscribe.
 * @param {(payload: { from: Theme, to: Theme }) => void} handler
 * @returns {() => void}
 */
export function subscribeTheme(handler) {
  return bus.on('theme-changed', (event) => {
    handler(/** @type {{ from: Theme, to: Theme }} */ (event.payload));
  });
}

/**
 * Applique le theme stocke au dataset HTML sans declencher d'evenement.
 * Utile au boot : on veut peindre avec le bon theme avant tout autre code.
 * Idempotent.
 * @returns {Theme}
 */
export function applyStoredTheme() {
  const t = getTheme();
  if (typeof document !== 'undefined' && document.documentElement) {
    if (document.documentElement.dataset.theme !== t) {
      document.documentElement.dataset.theme = t;
    }
  }
  return t;
}

/**
 * J3.9 — synchro thème live cross-onglet/iframe via storage event.
 * Quand un autre onglet/iframe modifie `localStorage.planning.theme`,
 * applique le nouveau theme localement (DOM + emit bus) sans reload.
 * setTheme() chez nous ne re-declenche pas l'event (le navigateur n'emet
 * `storage` que pour les autres windows, pas la window courante).
 *
 * @returns {() => void}  unsubscribe.
 */
export function setupStorageSync() {
  if (typeof window === 'undefined') return () => {};
  /** @param {StorageEvent} ev */
  function handler(ev) {
    if (ev.key !== STORAGE_KEY) return;
    if (ev.newValue == null) return; // cleared via removeItem : ignorer
    setTheme(ev.newValue);
  }
  window.addEventListener('storage', handler);
  return () => window.removeEventListener('storage', handler);
}
