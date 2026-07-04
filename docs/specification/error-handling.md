# Error Handling with Exception Classes

Every error returned from an HTTP handler must be an instance of `Exception` from `@repo/exception`. Never return plain `Error` objects, raw `{ error: string }` JSON, or call `c.json()` directly with a status code — always use the structured exception pattern.

Define a concrete subclass for each distinct error case. The subclass lives in an `exceptions/` folder inside the package or app that owns the error domain (e.g. `apps/api/src/exceptions/`, `packages/bff/src/exceptions/`). Export all exception classes from an `index.ts` barrel in that folder.

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

Use `Exception.fromResponse({ json, status })` on the client side to reconstruct a typed exception from an API error response. Returns `null` when the response body does not match the exception shape.

The `Exception` base class is generic (`Exception<TData>`): use `TData` to attach structured data to the error (e.g. validation field errors). `AnyException` is the unparameterised alias for use in catch blocks and union types.
