/**
 * Slugifies an environment name into the cosmetic key prefix segment
 * (kebab-case, matching the flag-key slugify pattern). Purely a display
 * hint — see docs/adr/0008-api-key-prefix-is-cosmetic-only.md.
 */
export const slugifyEnvironmentName = (value: string): string =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
