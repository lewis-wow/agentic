export type ValueOfEnum<T extends Record<string, string | number>> = T[keyof T];
