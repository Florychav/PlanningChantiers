// @ts-check
// J1 verification: each declared runtime dep must bundle via esbuild.
// On failure, the dep is reported as candidate for "external + CDN" Plan B.
import * as esbuild from 'esbuild';
import { writeFile, mkdir, rm } from 'node:fs/promises';

const TMP = 'dist/.verify';
await mkdir(TMP, { recursive: true });

const deps = [
  { name: '@supabase/supabase-js', src: `import { createClient } from '@supabase/supabase-js'; export const _ = createClient;` },
  { name: 'html2canvas',           src: `import h from 'html2canvas'; export const _ = h;` },
  { name: 'jspdf',                 src: `import { jsPDF } from 'jspdf'; export const _ = jsPDF;` },
  { name: 'exceljs',               src: `import ExcelJS from 'exceljs'; export const _ = ExcelJS;` },
];

const results = [];
for (const dep of deps) {
  const entry = `${TMP}/${dep.name.replace(/[^a-z0-9]/gi, '_')}.js`;
  const out   = `${TMP}/${dep.name.replace(/[^a-z0-9]/gi, '_')}.bundle.js`;
  await writeFile(entry, dep.src);
  try {
    const r = await esbuild.build({
      entryPoints: [entry],
      outfile: out,
      bundle: true,
      format: 'esm',
      target: 'es2020',
      platform: 'browser',
      minify: true,
      logLevel: 'silent',
      metafile: true,
    });
    const bytes = Object.values(r.metafile?.outputs ?? {}).reduce((a, o) => a + o.bytes, 0);
    const kb = (bytes / 1024).toFixed(1);
    results.push({ dep: dep.name, status: 'OK', sizeKB: kb, note: '' });
    console.log(`OK  ${dep.name.padEnd(28)} ${kb} KB`);
  } catch (e) {
    const msg = e instanceof Error ? e.message.split('\n')[0] : String(e);
    results.push({ dep: dep.name, status: 'KO', sizeKB: '-', note: msg });
    console.log(`KO  ${dep.name.padEnd(28)} ${msg}`);
  }
}

await rm(TMP, { recursive: true, force: true });

const total = results.reduce((a, r) => a + (r.status === 'OK' ? parseFloat(r.sizeKB) : 0), 0);
console.log(`---`);
console.log(`Total bundled deps: ${total.toFixed(1)} KB`);
console.log(`Threshold (Plan B if >500 KB for supabase alone): see J1_REPORT.md`);

await writeFile('dist/.verify-deps.json', JSON.stringify(results, null, 2));
process.exit(results.some(r => r.status === 'KO') ? 1 : 0);
