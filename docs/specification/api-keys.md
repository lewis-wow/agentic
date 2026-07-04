# Environment API Keys

**Environment API Key**: A bearer credential scoped to exactly one `Environment`, used by SDK clients to authenticate to the BFF and receive a flag-read JWT. Stored as `apiKeyId` (plaintext lookup handle) + `apiKeyHash` (bcrypt hash of the secret portion); the full key is shown once at creation/rotation and never persisted.
_Avoid_: Access token, credential (too generic — this refers specifically to the environment-scoped key).

**Key Prefix**: The human-readable segment prepended to a generated API key (e.g. `development_`, `production_`, `qa-staging_`), derived by slugifying the owning environment's name at mint time. Purely cosmetic — the auth parser ignores it and matches only the trailing `<apiKeyId>.<secret>` pattern. It exists so a key's origin is scannable by eye (in a dashboard, a `.env` file, or a leaked snippet), not to carry any authorization meaning.
_Avoid_: Key type, scope prefix (this project decided against encoding authorization-relevant type/scope in the key string — see [ADR 0008](../adr/0008-api-key-prefix-is-cosmetic-only.md)).

See [ADR 0008](../adr/0008-api-key-prefix-is-cosmetic-only.md) for why the prefix is cosmetic-only and carries no authorization meaning.
