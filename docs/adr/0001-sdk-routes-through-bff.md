# SDKs route through the BFF, never directly to `apps/api`

Every SDK (Node.js, browser) sends its environment API key to `apps/bff`, not `apps/api`. The BFF exchanges the key for a short-lived RS256 JWT and proxies the request onward; an SDK's `apiUrl` option always points at the BFF. This keeps API-key verification (bcrypt, revocation checks) and JWT minting in one place, so `apps/api` can trust any request that reaches it without owning credential storage or a database connection of its own.
