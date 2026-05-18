// @ts-check
// esbuild config — produces dist/bundle.js + dist/bundle.css + sourcemaps
// Source maps are 'linked' (separate .map files) — loaded only when DevTools open.
import * as esbuild from 'esbuild';

const isWatch = process.argv.includes('--watch');

/** @type {import('esbuild').BuildOptions} */
const config = {
  entryPoints: ['src/main.js'],
  outfile: 'dist/bundle.js',
  bundle: true,
  format: 'esm',
  target: 'es2020',
  platform: 'browser',
  sourcemap: 'linked',
  minify: !isWatch,
  treeShaking: true,
  logLevel: 'info',
  // Externals are decided at J1 verification (Plan B fallback for any dep that breaks bundling)
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
    const bytes = Object.values(result.metafile.outputs).reduce((a, o) => a + o.bytes, 0);
    console.log(`[esbuild] output size: ${(bytes / 1024).toFixed(1)} KB`);
  }
}
