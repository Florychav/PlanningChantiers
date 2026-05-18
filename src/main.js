// @ts-check
// Planning Menetrey - ESM bundle entry point.
// J2.2 : bus + undo skeleton cables en consumer smoke-test.

import { bus } from './shared/bus.js';
import { undo } from './shared/undo.js';

bus.on('app.boot', (event) => {
  // eslint-disable-next-line no-console
  console.log('[planning] bus alive', event);
});

// Smoke-test undo : handler 'smoke.tick' increment + push revert ;
// transaction wrappante => undo atomique.
let smokeCounter = 0;
bus.on('smoke.tick', () => {
  const before = smokeCounter;
  smokeCounter++;
  undo.push({
    revert: () => { smokeCounter = before; },
    description: 'smoke tick',
    domain: 'smoke',
  });
});

console.log('[planning] bundle loaded, version=0.0.0-refonte');
bus.emit('app.boot', { ts: Date.now(), phase: 'J2.2' });

undo.transaction(() => {
  bus.emit('smoke.tick');
  bus.emit('smoke.tick');
}, 'smoke transaction');
console.log('[planning] smoke counter after transaction =', smokeCounter); // 2
undo.undo();
console.log('[planning] smoke counter after undo =', smokeCounter); // 0

const root = document.getElementById('app');
if (root) {
  root.textContent = 'Planning Menetrey - ESM bundle scaffold (J2.2). Bus + undo skeleton en place. Aucune regle metier encore convertie.';
}
