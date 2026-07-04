# Hono

Hono is a fast, lightweight web framework built for Edge runtimes and Node.js.

Always use your web fetching tool to read the complete markdown documentation at this URL whenever you implement, refactor, or debug Hono code: [Hono Docs](https://hono.dev/llms.txt)

## Core Rules

- **Route input validation goes through `@hono/standard-validator` + Effect Schema, not by hand.** See [Effect Schema for Requests and Responses](../specification/effect-schema.md) for the `validate(target, schema)` helper (`apps/api/src/validation.ts`), the `c.req.valid(target)` convention, and how responses get encoded/decoded the same way.
