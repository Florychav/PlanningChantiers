// @ts-check
/**
 * Wrapper exceljs lazy-loaded.
 *
 * `await import('exceljs')` declenche un chunk separe (~900 KB) charge
 * uniquement quand l'utilisateur lance un export Excel. Le bundle initial
 * ne paie pas le cout.
 *
 * Usage :
 *   const ExcelJS = await loadExcelJs();
 *   const wb = new ExcelJS.Workbook();
 *   const ws = wb.addWorksheet('Sheet1');
 *   ws.addRow(['col1', 'col2']);
 *   const buf = await wb.xlsx.writeBuffer();
 *
 * Le port du legacy exportExcel() (XLSX/SheetJS via CDN) vers exceljs
 * arrivera en J3.x avec le bundlage du JS legacy. CVE xlsx eliminees J3.1.
 */

/**
 * Charge exceljs a la demande et retourne le namespace.
 * @returns {Promise<typeof import('exceljs')>}
 */
export async function loadExcelJs() {
  const mod = await import('exceljs');
  // exceljs export par defaut le namespace (Workbook + utilitaires).
  return mod.default ?? mod;
}

/**
 * Helper de demo : cree un Workbook vide (utile pour smoke tests).
 * @returns {Promise<import('exceljs').Workbook>}
 */
export async function createWorkbook() {
  const ExcelJS = await loadExcelJs();
  return new ExcelJS.Workbook();
}
