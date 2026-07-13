# AGENTS.md — packages/prisma

## Purpose

Prisma schema, generated client, and the shared singleton `prisma` instance. Re-exported as `@repo/prisma`.

## Required Context Loading

- @docs/standards/prisma.md
- @docs/standards/typescript.md

## Rules

- **Only `apps/api` may query the database.** No other app or package may run Prisma queries directly. `apps/dashboard` is a narrow exception: it may import the `prisma` singleton solely to construct the DI service classes documented in [ADR-0023](../../docs/adr/0023-dashboard-prisma-access-via-di-services.md) (`packages/bff`'s `UserService`, `packages/api`'s `ProjectService`) — it never calls `prisma.*` itself.
- **Never run queries here.** This package only instantiates and exports the client; all query logic lives in `apps/api` (or, per the exception above, inside a DI service class).
- The singleton pattern (`globalThis.prisma`) prevents connection pool exhaustion during Next.js hot reloads. Do not remove it.
- After modifying `schema.prisma`, run `pnpm prisma generate` to regenerate the client, then run `pnpm barrels` if any new types need to be re-exported.

## Schema Conventions

See @docs/standards/prisma.md for the full set of schema rules. Key points:

- Every model has `id String @id @default(cuid())`, `createdAt DateTime @default(now())`, and `updatedAt DateTime @updatedAt`.
- Timestamps are always the last two fields in every model.
- All child relations use `onDelete: Cascade`.
- Use Prisma `enum` for fixed value sets in the DB schema; use `as const` objects in application code for the same values.
