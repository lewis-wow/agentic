import { generateOpenApiDocument } from '@repo/api';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const outDir = path.resolve(import.meta.dirname, '../generated');
mkdirSync(outDir, { recursive: true });

writeFileSync(
  path.join(outDir, 'openapi.json'),
  JSON.stringify(generateOpenApiDocument(), null, 2),
);

console.log(`Wrote ${path.join(outDir, 'openapi.json')}`);
