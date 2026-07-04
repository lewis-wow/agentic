import { generateOpenApiDocument, SCALAR_REFERENCE_HTML } from '@repo/api';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const outDir = path.resolve(import.meta.dirname, '../../openapi/dist');
mkdirSync(outDir, { recursive: true });

writeFileSync(
  path.join(outDir, 'openapi.json'),
  JSON.stringify(generateOpenApiDocument(), null, 2),
);
writeFileSync(path.join(outDir, 'index.html'), SCALAR_REFERENCE_HTML);

console.log(`Wrote static API reference to ${outDir}`);
