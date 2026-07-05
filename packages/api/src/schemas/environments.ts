import { Schema } from 'effect';

// Environment schema.
export const EnvironmentSchema = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
});

export type Environment = Schema.Schema.Type<typeof EnvironmentSchema>;
