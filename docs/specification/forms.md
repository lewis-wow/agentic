# Forms

Every form (any component collecting user input and submitting it) must use **react-hook-form** with the **Effect Schema resolver** (`effectTsResolver` from `@hookform/resolvers/effect-ts`). Never validate form fields with manual `useState` + `onChange` handlers, plain `if` checks in a submit handler, or any resolver other than `effectTsResolver` (no `zodResolver`, no hand-rolled validation).

- Define the form's shape as an Effect `Schema.Struct` (see [Effect Schema for Requests and Responses](./effect-schema.md)) and export both the schema and its inferred type together.
- Wire it up with `useForm({ resolver: effectTsResolver(TheSchema) })`.
- Render fields with the shared shadcn `Form` primitives (`Form`, `FormField`, `FormItem`, `FormLabel`, `FormControl`, `FormMessage`) from `@repo/ui/components/ui/form`, not raw `<input>`/`<select>` elements wired to local state.
- Field arrays (dynamic lists of rows) use `useFieldArray`, not manual array state (`useState<T[]>` + splice/move helpers).

```tsx
import { effectTsResolver } from '@hookform/resolvers/effect-ts';
import { Schema } from 'effect';
import { useForm } from 'react-hook-form';

export const CreateFlagFormSchema = Schema.Struct({
  name: Schema.String.pipe(Schema.minLength(1)),
  key: Schema.String.pipe(Schema.pattern(/^[a-z0-9-]+$/)),
});
export type CreateFlagFormValues = Schema.Schema.Type<
  typeof CreateFlagFormSchema
>;

const form = useForm<CreateFlagFormValues>({
  resolver: effectTsResolver(CreateFlagFormSchema),
  defaultValues: { name: '', key: '' },
});
```

Form validation schemas that are only consumed by a single form belong beside that form's owning app (e.g. `apps/dashboard/src/schemas/`), following the same "single-consumer schemas stay local" rule as [App-Scoped Packages for Domain Schemas](./app-scoped-packages.md). This rule applies to `apps/dashboard`, the only app with browser-rendered forms today; see `apps/dashboard/AGENTS.md` for the full pattern.
