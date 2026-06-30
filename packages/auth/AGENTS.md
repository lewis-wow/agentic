# AGENTS.md — packages/auth

## Purpose

Cross-cutting authentication primitives: JWT sign/verify, RS256 key helpers, API key generation/verification, role constants, and the shared JWT claims contract between the BFF layers and `apps/api`.

## Required Context Loading

- @.docs/typescript.md

## Source Layout

```text
src/
  apiKey.ts   # API key generate/verify (env_<id>.<secret> format)
  claims.ts   # JWT claims types: ProjectJwtClaims, SdkJwtClaims, MeJwtClaims, AuthJwtClaims
  jwt.ts      # RS256 JWT sign/verify helpers
  roles.ts    # SYSTEM_ROLE, MEMBERSHIP_ROLE, PROJECT_ROLE as const enums + type guards
```

## Key Concepts

**JWT claims contract** — `AuthJwtClaims` is the union type that `apps/api`'s JWT middleware decodes. The three variants are:

| Type               | Issued when                             | Carries                                                   |
| ------------------ | --------------------------------------- | --------------------------------------------------------- |
| `ProjectJwtClaims` | Dashboard user in a project context     | `userId`, `systemRole`, `projectId`, `projectRole`        |
| `SdkJwtClaims`     | SDK client authenticated via API key    | `projectId`, `environmentId`, `projectRole: 'sdk-client'` |
| `MeJwtClaims`      | Dashboard user at non-project endpoints | `userId`, `systemRole`                                    |

Use `isSdkClaims(claims)` to narrow `AuthJwtClaims` to `SdkJwtClaims`.

**Role hierarchy** — three distinct role sets with different scopes:

| Const             | Scope                                                      | Used on                 |
| ----------------- | ---------------------------------------------------------- | ----------------------- |
| `SYSTEM_ROLE`     | Installation-wide (`OWNER` \| `MEMBER`)                    | `User.role`             |
| `MEMBERSHIP_ROLE` | Project-level (`admin` \| `viewer`)                        | `ProjectMember.role`    |
| `PROJECT_ROLE`    | JWT claim (`owner` \| `admin` \| `viewer` \| `sdk-client`) | `projectRole` JWT claim |

## Rules

- Never add application-domain logic here (no flag logic, no project business rules). This package is limited to auth infrastructure.
- Always use `ValueOfEnum` from `@repo/types` to derive the union type from role consts.
- Exports are maintained via a barrelsby barrel at `src/index.ts`. After adding a new export, run `pnpm barrels` from the repo root.
