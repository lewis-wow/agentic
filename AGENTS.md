# AGENTS.md

## Core Rules

- Package manager: pnpm
- Node.js version: stored in @.nvmrc using NVM
- Modules: ESM
- Always scope non-global .env into particular app as .env.production for production or .env.development for development

## Required Context Loading

You have access to specific local documentation files for this project. Before writing, refactoring, or reviewing any code, you must use your file-reading tool to read the relevant documentation file from the list below based on the technology you are working with:

- For TypeScript use: @.docs/typescript.md
- For React use: @.docs/react.md
- For Turborepo use: @.docs/turborepo.md
- For Dotenvx use: @.docs/dotenvx.md
- For Hono use: @.docs/hono.md
- For Effect use: @.docs/effect.md

Strictly follow the guidelines found inside these files for every task.
