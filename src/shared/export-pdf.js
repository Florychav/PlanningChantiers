// @ts-check
/**
 * Wrapper jsPDF lazy-loaded.
 *
 * `await import('jspdf')` declenche un chunk separe (~800 KB) charge uniquement
 * quand l'utilisateur lance un export PDF. Le bundle initial ne paie pas le
 * cout.
 *
 * Usage :
 *   const JsPDF = await loadJsPdf();
 *   const doc = new JsPDF({ format: 'a4' });
 *   doc.text('hello', 10, 10);
 *   doc.save('out.pdf');
 *
 * Ou wrapper plus haut niveau a venir avec le port de exportWeekJPEG /
 * exportPDF du legacy (J3.x).
 */

/**
 * Charge jsPDF a la demande et retourne le constructeur.
 * @returns {Promise<typeof import('jspdf').jsPDF>}
 */
export async function loadJsPdf() {
  const mod = await import('jspdf');
  return mod.jsPDF;
}

/**
 * Helper de demo : produit un PDF vide (utile pour smoke tests).
 * Le type de `opts` est volontairement `any` car jsPDF a plusieurs overloads
 * et TypeScript ne resout pas le plus utile (objet de configuration complet).
 * Voir https://artskydj.github.io/jsPDF/docs/jsPDF.html pour la liste.
 *
 * @param {any} [opts]
 * @returns {Promise<import('jspdf').jsPDF>}
 */
export async function generateEmptyPdf(opts) {
  const JsPDF = await loadJsPdf();
  return new JsPDF(opts);
}
