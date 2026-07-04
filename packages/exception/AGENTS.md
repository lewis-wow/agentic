# AGENTS.md — packages/exception

## Purpose

The structured error base class (`Exception<TData>`) and the runtime schema (`ExceptionShapeSchema`) used to validate error responses on the client side.

## Required Context Loading

- @docs/standards/typescript.md
- @docs/standards/effect.md

## Key Concepts

**`Exception<TData>`** — extend this to define a concrete error case. Subclasses declare three static fields:

```ts
import { HttpStatusCode } from '@repo/enums';
import { Exception } from '@repo/exception';

export class FlagNotFound extends Exception {
  static readonly status = HttpStatusCode.NOT_FOUND_404;
  static readonly code = 'FlagNotFound';
  static readonly message = 'Flag not found.';
}
```

Use `TData` to attach structured payload (e.g. validation field errors):

```ts
export class RequestValidationFailed extends Exception<{ fields: string[] }> {
  static readonly status = HttpStatusCode.BAD_REQUEST_400;
  static readonly code = 'RequestValidationFailed';
  static readonly message = 'Request validation failed.';
}
```

**Producing a response** — call `exception.toResponse()` in a Hono handler:

```ts
return new FlagNotFound().toResponse();
// or throw — middleware catches it
throw new FlagNotFound();
```

**Parsing a response** — call `Exception.fromResponse({ json, status })` on the client to reconstruct a typed exception. Returns `null` when the body does not match `ExceptionShapeSchema`.

**`AnyException`** — use in catch blocks and union types when the concrete subclass is not known.

## Rules

- Never return plain `Error` objects or raw `{ error: string }` JSON from HTTP handlers. Always use a typed `Exception` subclass.
- Subclasses live in an `exceptions/` folder inside the app or package that owns the error domain (e.g. `apps/api/src/exceptions/`), not in this package. This package provides only the base class and schema.
- Do not add domain-specific exception subclasses here.
- Exports are maintained via a barrelsby barrel at `src/index.ts`. After adding a new export, run `pnpm barrels` from the repo root.
