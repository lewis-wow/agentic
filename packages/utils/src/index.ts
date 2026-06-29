import * as Schema from 'effect/Schema';

export const omitUndefined = <T extends Record<string, unknown>>(
  obj: T,
): Partial<T> => {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined),
  ) as Partial<T>;
};

export const emptyStringAsUndefined = <K extends string>(
  obj: Record<K, string | undefined>,
): Record<K, string | undefined> => {
  return Object.fromEntries(
    Object.entries(obj).map(([key, value]) => [
      key,
      value === '' ? undefined : value,
    ]),
  ) as Record<K, string | undefined>;
};

export const createEnv = <Fields extends Schema.Struct.Fields>(options: {
  schema: Fields;
  runtimeEnv: Record<string, string | undefined>;
  emptyStringAsUndefined?: boolean;
  skipValidation?: boolean;
}): Schema.Schema.Type<Schema.Struct<Fields>> => {
  if (options.skipValidation) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return options.runtimeEnv as any;
  }

  options.emptyStringAsUndefined = options.emptyStringAsUndefined ?? true;

  if (options.emptyStringAsUndefined) {
    options.runtimeEnv = emptyStringAsUndefined(options.runtimeEnv);
  }

  const envSchema = Schema.Struct(options.schema);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return Schema.decodeUnknownSync(envSchema as any)(options.runtimeEnv) as any;
};
