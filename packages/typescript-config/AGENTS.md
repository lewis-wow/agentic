# AGENTS.md — packages/typescript-config

## Purpose

Shared `tsconfig` presets consumed by every app and package in the monorepo.

## Usage

Each app or package's `tsconfig.json` extends the appropriate preset:

```json
{
  "extends": "@repo/typescript-config/node.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

## Rules

- `strict: true` must remain enabled in all presets. Never disable it.
- Do not add app-specific compiler options here. Add them in the consuming package's own `tsconfig.json`.
- Changes here affect the entire monorepo. Run `pnpm check-types` from the repo root after modifying a preset.
