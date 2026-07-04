# Error Handling with Exception Classes

Every error returned from an HTTP handler must be an instance of `Exception` from `@repo/exception`. Never return plain `Error` objects, raw `{ error: string }` JSON, or call `c.json()` directly with a status code — always use the structured exception pattern.

Define a concrete subclass for each distinct error case. The subclass lives in an `exceptions/` folder inside the package or app that owns the error domain (e.g. `packages/bff/src/exceptions/`). Export all exception classes from an `index.ts` barrel in that folder.

**`apps/api`'s exceptions live in `packages/api/src/exceptions/` (`@repo/api/exceptions`), not inside `apps/api` itself.** `packages/api/src/services/` — the framework-agnostic business-logic layer — throws these same exceptions, and `apps/api` depends on `packages/api`, never the reverse; the exceptions have to live on the side both can reach. See `packages/api/AGENTS.md`.

```ts
import { HttpStatusCode } from '@repo/enums';
import { Exception } from '@repo/exception';

export class RequestValidationFailed extends Exception {
  static readonly status = HttpStatusCode.BAD_REQUEST_400;
  static readonly code = 'RequestValidationFailed';
  static readonly message = 'Request validation failed.';
}

export class Unauthorized extends Exception {
  static readonly status = HttpStatusCode.UNAUTHORIZED_401;
  static readonly code = 'Unauthorized';
  static readonly message = 'Authentication required.';
}
```

Use `exception.toResponse()` to produce the HTTP response:

```ts
throw new RequestValidationFailed();
// or in a handler:
return new Unauthorized().toResponse();
```

**In `apps/api`, which of the two you use depends on whether a service is involved.** A route handler that checks auth/authorization inline before doing anything else (e.g. `if (!claims) return new Forbidden().toResponse();`) returns `.toResponse()` directly. A route handler that just calls a `packages/api/src/services/` method **lets the exception propagate** — it does not wrap the call in `try`/`catch`. `apps/api/src/index.ts` registers a global `app.onError` that catches any `HttpException` reaching it (from anywhere in the request pipeline — a service, a route, middleware) and calls `.toResponse()` on it; anything that isn't an `HttpException` is re-thrown, and Hono's own fallback produces a generic 500 without crashing the process.

```ts
// apps/api/src/index.ts
app.onError((err) => {
  if (err instanceof HttpException) return err.toResponse();
  throw err;
});
```

Use `Exception.fromResponse({ json, status })` on the client side to reconstruct a typed exception from an API error response. Returns `null` when the response body does not match the exception shape.

The `Exception` base class is generic (`Exception<TData>`): use `TData` to attach structured data to the error (e.g. validation field errors). `AnyException` is the unparameterised alias for use in catch blocks and union types.
