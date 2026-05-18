// @ts-check
// Copy static assets (HTML shell) from src/ to dist/
import { cp, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';

await mkdir('dist', { recursive: true });

const staticFiles = [
  ['src/index.html', 'dist/index.html'],
];

for (const [from, to] of staticFiles) {
  if (existsSync(from)) {
    await cp(from, to);
    console.log(`[copy] ${from} -> ${to}`);
  } else {
    console.warn(`[copy] missing: ${from}`);
  }
}
