// @ts-check
import { describe, it, expect } from 'vitest';
import { loadJsPdf, generateEmptyPdf }   from '../../src/shared/export-pdf.js';
import { loadExcelJs, createWorkbook }   from '../../src/shared/export-excel.js';

describe('export-pdf.js — dynamic import jspdf', () => {
  it('loadJsPdf() retourne un constructeur', async () => {
    const JsPDF = await loadJsPdf();
    expect(typeof JsPDF).toBe('function');
  });

  it('generateEmptyPdf() retourne une instance avec methode output()', async () => {
    const doc = await generateEmptyPdf();
    expect(typeof doc.output).toBe('function');
    // output('blob') produit un Blob valide en Node 18+ (ou un Uint8Array).
    const out = doc.output('arraybuffer');
    expect(out).toBeInstanceOf(ArrayBuffer);
    expect(out.byteLength).toBeGreaterThan(0);
  });

  it('generateEmptyPdf() respecte opts', async () => {
    const doc = await generateEmptyPdf({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const { width, height } = doc.internal.pageSize;
    // a4 landscape : 297 x 210
    expect(width).toBeCloseTo(297, 0);
    expect(height).toBeCloseTo(210, 0);
  });
});

describe('export-excel.js — dynamic import exceljs', () => {
  it('loadExcelJs() retourne un namespace avec Workbook', async () => {
    const ExcelJS = await loadExcelJs();
    expect(typeof ExcelJS.Workbook).toBe('function');
  });

  it('createWorkbook() retourne une instance avec methode addWorksheet', async () => {
    const wb = await createWorkbook();
    expect(typeof wb.addWorksheet).toBe('function');
  });

  it('peut creer une feuille et ajouter une ligne', async () => {
    const wb = await createWorkbook();
    const ws = wb.addWorksheet('Test');
    ws.addRow(['a', 'b', 'c']);
    expect(ws.rowCount).toBe(1);
    expect(ws.getRow(1).getCell(2).value).toBe('b');
  });
});
