import { SCALAR_REFERENCE_HTML } from '@repo/api';
import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const generatedPath = path.resolve(
  import.meta.dirname,
  '../generated/openapi.json',
);
const outDir = path.resolve(import.meta.dirname, '../../openapi/dist');
mkdirSync(outDir, { recursive: true });

copyFileSync(generatedPath, path.join(outDir, 'openapi.json'));
writeFileSync(path.join(outDir, 'index.html'), SCALAR_REFERENCE_HTML);

console.log(`Wrote static API reference to ${outDir}`);
