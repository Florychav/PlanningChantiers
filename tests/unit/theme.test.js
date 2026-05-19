/** @vitest-environment jsdom */
// @ts-check
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { bus } from '../../src/shared/bus.js';
import {
  getTheme,
  setTheme,
  toggleTheme,
  subscribeTheme,
  applyStoredTheme,
  setupStorageSync,
  STORAGE_KEY,
  DEFAULT_THEME,
} from '../../src/shared/theme.js';

describe('theme — module ESM', () => {
  beforeEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset.theme;
    bus.clear();
  });

  it('defaut = dark si rien dans localStorage', () => {
    expect(getTheme()).toBe('dark');
    expect(DEFAULT_THEME).toBe('dark');
  });

  it('persiste dans localStorage.planning.theme', () => {
    setTheme('light');
    expect(localStorage.getItem(STORAGE_KEY)).toBe('light');
    expect(getTheme()).toBe('light');
  });

  it('applique document.documentElement.dataset.theme', () => {
    setTheme('light');
    expect(document.documentElement.dataset.theme).toBe('light');
    setTheme('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('toggle bascule dark <-> light', () => {
    expect(getTheme()).toBe('dark');
    expect(toggleTheme()).toBe('light');
    expect(getTheme()).toBe('light');
    expect(toggleTheme()).toBe('dark');
    expect(getTheme()).toBe('dark');
  });

  it('valeur invalide en localStorage -> fallback dark', () => {
    localStorage.setItem(STORAGE_KEY, 'rainbow');
    expect(getTheme()).toBe('dark');
  });

  it('setTheme avec valeur invalide -> fallback dark', () => {
    setTheme('puce');
    expect(getTheme()).toBe('dark');
    expect(localStorage.getItem(STORAGE_KEY)).toBe('dark');
  });

  it('emet theme-changed sur le bus quand le theme change', () => {
    const handler = vi.fn();
    bus.on('theme-changed', handler);
    setTheme('light');
    expect(handler).toHaveBeenCalledOnce();
    expect(handler.mock.calls[0][0]).toEqual({
      type: 'theme-changed',
      payload: { from: 'dark', to: 'light' },
      ctx: undefined,
    });
  });

  it('idempotence : setTheme(getTheme()) n\'emet rien', () => {
    const handler = vi.fn();
    bus.on('theme-changed', handler);
    setTheme(getTheme()); // dark -> dark
    expect(handler).not.toHaveBeenCalled();
    expect(getTheme()).toBe('dark');
  });

  it('subscribeTheme appelle callback avec {from, to} et retourne unsubscribe', () => {
    const cb = vi.fn();
    const off = subscribeTheme(cb);
    setTheme('light');
    expect(cb).toHaveBeenCalledWith({ from: 'dark', to: 'light' });
    off();
    setTheme('dark');
    expect(cb).toHaveBeenCalledTimes(1); // pas appele apres unsubscribe
  });

  it('applyStoredTheme applique sans emettre', () => {
    localStorage.setItem(STORAGE_KEY, 'light');
    const handler = vi.fn();
    bus.on('theme-changed', handler);
    expect(applyStoredTheme()).toBe('light');
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(handler).not.toHaveBeenCalled();
  });

  it('applyStoredTheme idempotent (2eme appel n\'altere rien)', () => {
    localStorage.setItem(STORAGE_KEY, 'light');
    applyStoredTheme();
    const datasetBefore = document.documentElement.dataset.theme;
    applyStoredTheme();
    expect(document.documentElement.dataset.theme).toBe(datasetBefore);
  });

  it('setupStorageSync : storage event sur notre cle applique le theme', () => {
    const handler = vi.fn();
    bus.on('theme-changed', handler);
    const off = setupStorageSync();

    // Simule un autre onglet qui passe en light.
    window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY, newValue: 'light', oldValue: 'dark' }));
    expect(getTheme()).toBe('light');
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(handler).toHaveBeenCalledTimes(1);

    off();
  });

  it('setupStorageSync : storage event sur autre cle = ignore', () => {
    const handler = vi.fn();
    bus.on('theme-changed', handler);
    const off = setupStorageSync();
    window.dispatchEvent(new StorageEvent('storage', { key: 'autre.cle', newValue: 'light' }));
    expect(getTheme()).toBe('dark');
    expect(handler).not.toHaveBeenCalled();
    off();
  });

  it('setupStorageSync : newValue null (removeItem) = ignore', () => {
    const handler = vi.fn();
    bus.on('theme-changed', handler);
    const off = setupStorageSync();
    window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY, newValue: null, oldValue: 'dark' }));
    expect(handler).not.toHaveBeenCalled();
    off();
  });

  it('setupStorageSync : unsubscribe retire le listener', () => {
    const handler = vi.fn();
    bus.on('theme-changed', handler);
    const off = setupStorageSync();
    off();
    window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY, newValue: 'light' }));
    expect(handler).not.toHaveBeenCalled();
  });

  it('localStorage throw (mode prive) -> fallback dark, pas de crash', () => {
    const original = Object.getOwnPropertyDescriptor(Storage.prototype, 'getItem');
    Storage.prototype.getItem = () => { throw new Error('storage unavailable'); };
    expect(() => getTheme()).not.toThrow();
    expect(getTheme()).toBe('dark');
    if (original) Object.defineProperty(Storage.prototype, 'getItem', original);
  });
});
