// Scalar's documented static-HTML embed — no build step, no npm package,
// works both as a live route (served relative to /openapi.json) and copied
// as a standalone file next to a generated openapi.json. Kept in its own
// module (no `effect` import) so apps/api can serve it without pulling in
// openapi.ts's Schema/JSONSchema-based document generator into the runtime
// bundle — that generator only ever runs from build-time scripts.
export const SCALAR_REFERENCE_HTML = `<!doctype html>
<html>
  <head>
    <title>Feature Flag Service API Reference</title>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
  </head>
  <body>
    <script id="api-reference" data-url="./openapi.json"></script>
    <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
  </body>
</html>
`;
