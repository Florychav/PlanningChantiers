// @ts-check
// Planning Menetrey - ESM bundle entry point.
// J3.3 : bus + undo + 3 regles metier + wrappers exports lazy (jspdf, exceljs).

import { bus } from './shared/bus.js';
import { undo } from './shared/undo.js';
import { state, resetState } from './shared/state.js';
import { register as registerVerrouNoir }       from './relations/verrou-noir.js';
import { register as registerGrisInstallation }  from './relations/gris-installation.js';
import { register as registerJauneProtocoleur }  from './relations/jaune-protocoleur.js';
import { register as registerFusionEtiquettes }  from './relations/fusion-etiquettes.js';
import { register as registerCascadeMereFilles } from './relations/cascade-mere-filles.js';
import { register as registerMereFillesDragSync } from './relations/mere-filles-drag-sync.js';
import { generateEmptyPdf, loadJsPdf } from './shared/export-pdf.js';
import { createWorkbook, loadExcelJs } from './shared/export-excel.js';

// Branchement des 3 regles (pattern Q2 : import explicite + register).
registerVerrouNoir(bus, undo);
registerGrisInstallation(bus, undo);
registerJauneProtocoleur(bus, undo);
registerFusionEtiquettes(bus, undo);
registerCascadeMereFilles(bus, undo);
registerMereFillesDragSync(bus, undo);

bus.on('app.boot', (event) => {
  // eslint-disable-next-line no-console
  console.log('[planning] bus alive', event);
});

console.log('[planning] bundle loaded, version=0.0.0-refonte');
bus.emit('app.boot', { ts: Date.now(), phase: 'J3.3' });

// J3.3 : expose les wrappers d'export pour test runtime (console).
// Les chunks jspdf/exceljs ne sont charges que lorsque ces fonctions
// sont APPELEES — pas au boot. cf. dist/chunk-*.js.
/** @type {any} */ (window).__exports = {
  generateEmptyPdf, loadJsPdf,
  createWorkbook,   loadExcelJs,
};

// Smoke J2.3 : creation d'un 'noir' => verrouille:true ; undo => unlock.
resetState();
const lab = /** @type {any} */ ({ id: 'smoke-1', type: 'noir' });
state.etiquettes.push(lab);
bus.emit('label.created', { label: lab });
console.log('[planning] smoke noir verrouille =', lab.verrouille); // true
undo.undo();
console.log('[planning] smoke noir verrouille apres undo =', lab.verrouille); // false

const root = document.getElementById('app');
if (root) {
  root.textContent = 'Planning Menetrey - ESM bundle scaffold (J2.3). Bus + undo + 3 regles metier en place. Branchement UI legacy a venir (J3).';
}
