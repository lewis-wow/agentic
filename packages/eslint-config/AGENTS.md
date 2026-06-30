# AGENTS.md — packages/eslint-config

## Purpose

Shared ESLint flat-config presets consumed by every app and package in the monorepo.

## Required Context Loading

- @.docs/typescript.md

## Usage

Each app or package's `eslint.config.mjs` imports the appropriate preset:

```js
import { node } from '@repo/eslint-config/node';

export default [...node];
```

## Rules

- Do not add app-specific lint rules here. Override only in the consuming app's own `eslint.config.mjs`.
- Do not disable or override TypeScript strict rules (`no-explicit-any`, `no-unsafe-*`) in presets — they must remain enabled globally.
- Changes here affect the entire monorepo. Run `pnpm lint` from the repo root after modifying a preset.
