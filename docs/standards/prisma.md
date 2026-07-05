# Prisma Best Practices

This guide defines the conventions for writing Prisma schema models and querying them in this project.

## Core Rules

- **Always include `createdAt` and `updatedAt` on every model**
  Every model must have both timestamp fields. `createdAt` is set once on insert; `updatedAt` is maintained automatically by Prisma.

```prisma
model Example {
  id        String   @id @default(cuid())
  name      String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

- **Always use `cuid()` for primary keys**
  Use `@id @default(cuid())` on a `String` field named `id`.

```prisma
model Example {
  id String @id @default(cuid())
}
```

- **Place timestamp fields last**
  `createdAt` and `updatedAt` are always the last two fields in the model body, after all domain fields and relations.

```prisma
model Flag {
  id        String   @id @default(cuid())
  key       String
  name      String
  // relations...
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

- **Use `@relation` explicitly on foreign key fields**
  Always declare `@relation(fields: [...], references: [...])` on the owning side.

```prisma
model FlagState {
  id        String @id @default(cuid())
  flagId    String
  flag      Flag   @relation(fields: [flagId], references: [id])
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

- **Use `@@unique` for composite uniqueness constraints**

```prisma
model FlagState {
  flagId        String
  environmentId String

  @@unique([flagId, environmentId])
}
```

- **Use Prisma enums for fixed value sets**

```prisma
enum FlagStatus {
  active
  inactive
  archived
}
```

- **Use `Json` for variable-shape data with a code-level type**
  When storing structured data whose shape varies (e.g. targeting rules), use `Json` in Prisma and define the TypeScript type in application code.

```prisma
model FlagState {
  rules Json @default("[]") // TargetingRule[] — type defined in application code
}
```

- **Always cascade deletes on child relations**
  Use `onDelete: Cascade` so orphaned child rows are cleaned up automatically.

```prisma
model Flag {
  id        String      @id @default(cuid())
  projectId String
  project   Project     @relation(fields: [projectId], references: [id], onDelete: Cascade)
  createdAt DateTime    @default(now())
  updatedAt DateTime    @updatedAt
}
```

## Query Rules

- **Multiple Prisma queries that run together always go through `prisma.$transaction`, never `Promise.all`.** `Promise.all` runs each query as its own independent round trip, so one query can observe a database state the others didn't — a write landing between them produces a torn read (e.g. a paginated list and its `count` disagreeing). `$transaction` (the array form is enough for a batch of independent reads — no callback needed) runs every query against one consistent snapshot.

```ts
// Wrong — each query can see a different snapshot
const [items, total] = await Promise.all([
  prisma.flag.findMany({ where, skip, take }),
  prisma.flag.count({ where }),
]);

// Correct — one consistent snapshot
const [items, total] = await prisma.$transaction([
  prisma.flag.findMany({ where, skip, take }),
  prisma.flag.count({ where }),
]);
```

This applies whenever two or more Prisma calls are combined for one logical read or write — pagination's `findMany` + `count` pair is the most common case, but the same rule covers any other multi-query combination. `Promise.all` remains fine for combining non-Prisma work (e.g. an external API call alongside a Prisma query has nothing to gain from a DB transaction).
