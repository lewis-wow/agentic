# AGENTS.md — packages/exception

## Purpose

Two structured error base classes and the runtime schema (`ExceptionShapeSchema`) used to validate error responses on the client side.

- **`Exception<TData>`** — HTTP-agnostic. `code`, `message`, `data`, `cause`. Use for errors that never cross an HTTP boundary (e.g. `packages/sdk-core`'s `ConnectFailed`, `ClientNotConnected` — the SDK throws these directly, it doesn't produce HTTP responses). See `docs/adr/0002-exception-http-exception-split.md`.
- **`HttpException<TData>`** — extends `Exception`, adds `status`, `.toResponse()`, and the static `.fromResponse()` parser. Use for every error that a Hono handler returns or that a client reconstructs from an HTTP response. **`Exception` itself has no `status`, no `.toResponse()`, and no `.fromResponse()`** — those are `HttpException`-only. If a subclass carries an HTTP status code, it must extend `HttpException`, never the plain `Exception`.

## Required Context Loading

- @docs/standards/typescript.md
- @docs/standards/effect.md

## Key Concepts

**`HttpException<TData>`** — extend this for any error that crosses an HTTP boundary. Subclasses declare three static fields:

```ts
import { HttpStatusCode } from '@repo/enums';
import { HttpException } from '@repo/exception';

export class FlagNotFound extends HttpException {
  static readonly status = HttpStatusCode.NOT_FOUND_404;
  static readonly code = 'FlagNotFound';
  static readonly message = 'Flag not found.';
}
```

Use `TData` to attach structured payload (e.g. validation field errors):

```ts
export class RequestValidationFailed extends HttpException<{
  fields: string[];
}> {
  static readonly status = HttpStatusCode.BAD_REQUEST_400;
  static readonly code = 'RequestValidationFailed';
  static readonly message = 'Request validation failed.';
}
```

**Producing a response** — call `exception.toResponse()` in a Hono handler (only defined on `HttpException`):

```ts
return new FlagNotFound().toResponse();
// or throw — middleware catches it
throw new FlagNotFound();
```

**Parsing a response** — call `HttpException.fromResponse({ json, status })` on the client to reconstruct a typed exception. Returns `null` when the body does not match `ExceptionShapeSchema`. Never call `.fromResponse` on the plain `Exception` base — it does not have this method.

**`AnyException`** / **`AnyHttpException`** — use in catch blocks and union types when the concrete subclass is not known; use `AnyHttpException` specifically when you still need `.status` or `.toResponse()`.

**`UnknownError`** — the one generic (non-domain-specific) `HttpException` subclass that lives in this package rather than an app/package's own `exceptions/` folder. Throw it when `HttpException.fromResponse` returns `null` (the response body didn't match `ExceptionShapeSchema` — e.g. a network-level error page from an intermediary proxy, not a structured API error). Any client calling `fromResponse` uses the same fallback rather than each app inventing its own.

## Rules

- Never return plain `Error` objects or raw `{ error: string }` JSON from HTTP handlers. Always use a typed `HttpException` subclass.
- **`Exception` is for non-HTTP error domains; `HttpException` is for everything with an HTTP status code.** Don't add `status` to a plain `Exception` subclass — extend `HttpException` instead.
- Domain-specific subclasses (`FlagNotFound`, `ProjectNotFound`, ...) live in an `exceptions/` folder inside the app or package that owns that error domain (e.g. `apps/api/src/exceptions/`), not in this package.
- The one exception to the rule above: `UnknownError` lives directly in this package (`src/UnknownError.ts`) since it isn't tied to any resource domain — it's the shared fallback for every caller of `HttpException.fromResponse`.
- Exports are maintained via a barrelsby barrel at `src/index.ts`. After adding a new export, run `pnpm barrels` from the repo root.
