# `NEXT_PUBLIC_APP_URL` is a Docker build arg, not a dotenvx runtime secret

Every other app-level config value is decrypted at container startup via dotenvx, but `NEXT_PUBLIC_APP_URL` is injected as a Docker `ARG` and baked into the client bundle during `next build`. This is the one deliberate exception to the project's "everything goes through dotenvx" convention: Next.js inlines `NEXT_PUBLIC_*` variables into the built JavaScript at build time, so a value only available at container _runtime_ would never reach the browser bundle — dotenvx-at-startup is simply too late for this variable.
