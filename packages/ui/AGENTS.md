# AGENTS.md — @repo/ui

## Core Rules

- Package manager: pnpm
- Modules: ESM
- Node.js version: see root `.nvmrc`

## Required Context Loading

Before writing, refactoring, or reviewing any code in this package, read the relevant documentation:

- For TypeScript use: @docs/standards/typescript.md
- For React use: @docs/standards/react.md
- For Shadcn UI use: @docs/standards/shadcnui.md

## Commands

```bash
pnpm lint         # Lint this package
pnpm check-types  # TypeScript type-check
```

## Component Structure

This package has a two-tier architecture:

**`src/components/ui/`** — Shadcn UI primitives. Never hand-write files here. Always add via:

```bash
pnpm dlx shadcn@latest add <component>
```

These are internal building blocks; they are not exported from the package.

**`src/components/`** — Custom compositions (e.g. `Stack`, `Page`). These are auto-exported via the `./components/*` wildcard in `package.json`.

## Exports

This package does **not** use barrelsby. Never run `pnpm barrels` inside this package.

Exports are managed by the `exports` map in `package.json`:

- A new file at `src/components/Foo.tsx` is automatically exported as `@repo/ui/components/Foo` — no manual step needed.
- A new subdirectory component (e.g. `src/components/Foo/index.tsx`) requires a manual explicit entry:

```json
"./components/Foo": "./src/components/Foo/index.tsx"
```

## `'use client'` Directive

Only mark a component `'use client'` if it directly uses:

- Browser APIs (`window`, `document`, `localStorage`, etc.)
- React hooks with side effects (`useState`, `useEffect`, `useRef`, etc.)
- Event handlers that must run in the browser

Server-renderable compositions must not carry the directive.

## Tailwind v4

There is **no `tailwind.config.js`** in this package. Tailwind is configured CSS-first.

- New design tokens (colors, radii, fonts) go inside the `@theme inline { }` block in `src/styles/globals.css`.
- Use OKLCH color values and reference them via CSS variables (e.g. `--color-primary: var(--primary)`).
- Never create a `tailwind.config.js` or `tailwind.config.ts`.

Always use the `cn()` utility from `@repo/ui/lib/utils` for merging class names.

## Hooks, Context, and Mappers

`src/hooks/`, `src/context/`, and `src/mappers/` are for logic **shared across more than one app**. App-specific UI logic stays in the consuming app (e.g. `apps/web`).
