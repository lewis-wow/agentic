# TypeScript Best Practices for Coding Agents

This guide outlines the core rules and standards that coding agents must follow when writing TypeScript code to ensure optimal type safety, maintainability, and clarity.

## Core Rules

- **Always use types, never use interfaces**
  Use the `type` keyword for all object definitions and contract declarations to ensure a unified approach and leverage advanced type features.

```typescript
type User = {
  id: string;
  name: string;
};
```

- **Use Args suffix for function arguments**
  Name function argument types using the `Args` suffix, wrapping multiple parameters into a single descriptive object.

```typescript
type RegisterUserArgs = {
  email: string;
  username: string;
};

const registerUser = (args: RegisterUserArgs) => {
  // implementation
};
```

- **Use Options suffix for class configurations**
  Name class constructor configurations or initialization options using the `Options` suffix.

```typescript
type LoggerOptions = {
  level: string;
  silent: boolean;
};

class Logger {
  constructor(options: LoggerOptions) {}
}
```

- **Always export type when exporting class or function**

- **Always use arrow functions**

```typescript
const calculateTotal = (args: CalculateTotalArgs): number => {
  return args.count * 2;
};
```

- **Enable strict mode**
  Always ensure `strict: true` is enabled in the configuration to catch potential null or undefined errors.

- **Avoid the any type**
  Do not use `any` under any circumstances. If a type is genuinely unknown, use `unknown` and implement type guards.

- **Define explicit return types**
  Always declare the return types of functions and methods explicitly to make the API boundaries clear.

```typescript
const calculateTotal = (args: CalculateTotalArgs): number => {
  return args.count * 2;
};
```

- **Define payload type for complex return type**

```typescript
type CalculateTotalPayload = {
  result: number;
};

const calculateTotal = (args: CalculateTotalArgs): CalculateTotalPayload => {
  return {
    result: args.count * 2,
  };
};
```

- **Prefer type guards and type predicates**
  Use type predicates to narrow down types safely instead of forcing types via type assertions.

```typescript
type Admin = { role: 'admin' };
type Guest = { role: 'guest' };

const isAdmin = (user: Admin | Guest): user is Admin => {
  return user.role === 'admin';
};
```

- **Use const assertions for literal types**
  Use `as const` to create immutable literal types instead of standard enums.

```typescript
const Roles = {
  Admin: 'admin',
  User: 'user',
} as const;
```

- **Use const assertions for enums**
  Avoid standard TypeScript enums. Instead, use `as const` objects where both the keys and values are identical and fully capitalized.

```typescript
const ROLES = {
  ADMIN: 'ADMIN',
  USER: 'USER',
} as const;
```

- **Keep types clean and concise**
  Avoid over-engineering types with deep nesting or unnecessary generics when a simple type definition suffices.

- **Always use ES modules**

- **Never use "as" during importing if it is not required**
