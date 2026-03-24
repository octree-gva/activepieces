import type { Locale } from '@octree/decidim-sdk';

/** Activepieces `locales` array prop → Decidim `locales[]` query */
export function parseLocales(locales: unknown): Locale[] | undefined {
  if (!Array.isArray(locales)) return undefined;
  const list = (locales as Array<{ value?: unknown }>)
    .map((l) => String(l?.value).trim())
    .filter((s) => s.length > 0);
  return list.length > 0 ? (list as Locale[]) : undefined;
}
