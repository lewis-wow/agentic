# Environment Variables

Dotenvx is used for environment management. Variables are layered:

- Root `.env.{development,production,test}` — shared/global vars
- `apps/<name>/.env.{development,production,test}` — app-specific vars (takes precedence)

Env schemas are validated at runtime using Effect `Schema.Struct` in each app's `src/env.ts`. Add new env vars to both the `.env.*` files and the corresponding `Schema.Struct`.
