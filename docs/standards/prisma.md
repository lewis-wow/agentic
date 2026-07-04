# Prisma Best Practices

This guide defines the conventions for writing Prisma schema models in this project.

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
