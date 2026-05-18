// @ts-check
// Planning Menetrey - ESM bundle entry point.
// J2.1 : bus de relations cable en consumer smoke-test.

import { bus } from './shared/bus.js';

bus.on('app.boot', (event) => {
  // eslint-disable-next-line no-console
  console.log('[planning] bus alive', event);
});

console.log('[planning] bundle loaded, version=0.0.0-refonte');
bus.emit('app.boot', { ts: Date.now(), phase: 'J2.1' });

const root = document.getElementById('app');
if (root) {
  root.textContent = 'Planning Menetrey - ESM bundle scaffold (J2.1). Bus de relations en place. Aucune regle metier encore convertie.';
}
