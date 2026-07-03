import path from 'node:path';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: path.join('prisma', 'schema.prisma'),
  migrations: {
    path: path.join('prisma', 'migrations'),
  },
  datasource: {
    // Not `env('DATABASE_URL')`: this file is loaded eagerly by `prisma generate`
    // too, which runs from `postinstall`/`build` before DATABASE_URL is available
    // (e.g. Docker install layers). Only Migrate needs a real value at runtime.
    url: process.env['DATABASE_URL'] ?? '',
  },
});
