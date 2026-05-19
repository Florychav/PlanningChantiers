// @ts-check
// esbuild config — produces dist/bundle.js + chunks dynamiques + sourcemaps.
//
// J3.3 : `splitting: true` permet aux `await import()` (cf. export-pdf.js,
// export-excel.js) de produire des chunks separes (chunk-XXXX.js) charges
// uniquement quand le code les sollicite. Le bundle initial reste petit
// meme avec jspdf (~800 KB) et exceljs (~900 KB) en deps runtime.
//
// Source maps `linked` (fichiers .map separes, charges uniquement DevTools).
import * as esbuild from 'esbuild';

const isWatch = process.argv.includes('--watch');

/** @type {import('esbuild').BuildOptions} */
const config = {
  entryPoints: ['src/main.js'],
  outdir: 'dist',
  entryNames: 'bundle',       // bundle.js (au lieu du nom auto 'main.js')
  chunkNames: 'chunk-[hash]', // chunks dynamiques
  bundle: true,
  splitting: true,            // active code-splitting (requiert format ESM)
  format: 'esm',
  target: 'es2020',
  platform: 'browser',
  sourcemap: 'linked',
  minify: !isWatch,
  treeShaking: true,
  logLevel: 'info',
  external: [],
  metafile: true,
};

if (isWatch) {
  const ctx = await esbuild.context(config);
  await ctx.watch();
  console.log('[esbuild] watching...');
} else {
  const result = await esbuild.build(config);
  if (result.metafile) {
    const entries = Object.entries(result.metafile.outputs);
    const total = entries.reduce((a, [, o]) => a + o.bytes, 0);
    console.log(`[esbuild] outputs:`);
    for (const [path, info] of entries) {
      console.log(`  ${path.padEnd(40)} ${(info.bytes / 1024).toFixed(1)} KB`);
    }
    console.log(`[esbuild] total: ${(total / 1024).toFixed(1)} KB`);
  }
}
