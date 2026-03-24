/**
 * Validates flow input and builds request fields for GET /spaces/search (SpacesApi.searchSpaces).
 * Order: parse → validate criteria → map filters → apply title query & space type.
 */
import { z } from 'zod';
import { bearerAuthorization } from '../../runtime/authMode';
import { parseLocales } from '../../runtime/locales';

type StringFilterKeyBase = 'ManifestName' | 'Slug' | 'Title';

type SearchSpacesRequestParams = {
  authorization: string;
  locales?: unknown[];
  page?: number;
  perPage?: number;
  filterManifestNameNotIn?: string[];
  filterManifestNameIn?: string[];
  filterManifestNameStart?: string;
  filterManifestNameEq?: string;
  filterManifestNameNotEq?: string;
  filterManifestNameMatches?: string;
  filterManifestNameBlank?: boolean;
  filterIdIn?: number[];
  filterIdEq?: number;
  filterIdLt?: number;
  filterIdGt?: number;
  filterIdPresent?: boolean;
  filterIdBlank?: boolean;
  filterSlugNotIn?: string[];
  filterSlugIn?: string[];
  filterSlugStart?: string;
  filterSlugEq?: string;
  filterSlugNotEq?: string;
  filterSlugMatches?: string;
  filterSlugBlank?: boolean;
  filterTitleNotIn?: string[];
  filterTitleIn?: string[];
  filterTitleStart?: string;
  filterTitleEq?: string;
  filterTitleNotEq?: string;
  filterTitleMatches?: string;
  filterTitleBlank?: boolean;
};

export type SpaceField = 'manifest_name' | 'id' | 'slug' | 'title';
export type IdOperator = 'eq' | 'in' | 'lt' | 'gt' | 'present' | 'blank';
export type StringOperator =
  | 'eq'
  | 'not_eq'
  | 'in'
  | 'not_in'
  | 'start'
  | 'matches'
  | 'blank';

export type AdvancedFilter = {
  field: SpaceField;
  operator: IdOperator | StringOperator;
  value?: unknown;
  values?: unknown;
};

function coerceApArrayOfShortText(values: unknown): unknown[] {
  if (!Array.isArray(values)) return [];
  return (values as Array<{ value?: unknown }>).map((row) => {
    if (row && typeof row === 'object' && 'value' in row) return row.value;
    return row;
  });
}

/** Merge `values` into `value` for in/not_in rows. */
export function normalizeAdvancedFiltersInput(raw: unknown): unknown {
  if (!Array.isArray(raw)) return raw;
  return raw.map((item) => {
    if (!item || typeof item !== 'object') return item;
    const o = item as Record<string, unknown>;
    const op = o['operator'];
    if (op !== 'in' && op !== 'not_in') return item;
    if (o['value'] !== undefined && o['value'] !== null) return item;
    if (o['values'] === undefined || o['values'] === null) return item;
    const { values, ...rest } = o;
    return { ...rest, value: coerceApArrayOfShortText(values) };
  });
}

const slugValueSchema = z
  .string()
  .min(1)
  .regex(/^[a-z\-_]+$/, 'Slug must be lowercase letters, digits, hyphens, or underscores');

const manifestNameSchema = z.enum([
  'participatory_processes',
  'assemblies',
  'conferences',
  'initiatives',
]);

const positiveIntSchema = z.coerce.number().int().gt(0, 'ID must be > 0');

const idFilterSchema = z
  .object({
    field: z.literal('id'),
    operator: z.enum(['eq', 'in', 'lt', 'gt', 'present', 'blank']),
    value: z.unknown().optional(),
  })
  .superRefine((f, ctx) => {
    if (f.operator === 'present' || f.operator === 'blank') return;
    if (f.operator === 'in') {
      const arr = z.array(positiveIntSchema).min(1).safeParse(f.value);
      if (!arr.success) {
        ctx.addIssue({
          code: 'custom',
          message: 'For operator “In”, set Value or Values to a non-empty list of numeric IDs.',
        });
      }
      return;
    }
    const parsed = positiveIntSchema.safeParse(f.value);
    if (!parsed.success) {
      ctx.addIssue({
        code: 'custom',
        message: `For operator “${f.operator}”, set Value to a numeric ID greater than 0.`,
      });
    }
  });

const titleFilterSchema = z
  .object({
    field: z.literal('title'),
    operator: z.enum(['eq', 'not_eq', 'in', 'not_in', 'start', 'matches', 'blank']),
    value: z.unknown().optional(),
  })
  .superRefine((f, ctx) => {
    if (f.operator === 'blank') return;
    if (f.operator === 'in' || f.operator === 'not_in') {
      const arr = z.array(z.string().min(1)).min(1).safeParse(f.value);
      if (!arr.success) {
        ctx.addIssue({
          code: 'custom',
          message: 'For “In” / “Not in”, set Value or Values to a non-empty list of strings.',
        });
      }
      return;
    }
    const s = z.string().min(1).safeParse(f.value);
    if (!s.success) {
      ctx.addIssue({
        code: 'custom',
        message: `For this operator, set Value to a non-empty string.`,
      });
    }
  });

const slugFilterSchema = z
  .object({
    field: z.literal('slug'),
    operator: z.enum(['eq', 'not_eq', 'in', 'not_in', 'start', 'matches', 'blank']),
    value: z.unknown().optional(),
  })
  .superRefine((f, ctx) => {
    if (f.operator === 'blank') return;
    if (f.operator === 'in' || f.operator === 'not_in') {
      const arr = z.array(slugValueSchema).min(1).safeParse(f.value);
      if (!arr.success) {
        ctx.addIssue({
          code: 'custom',
          message:
            'For “In” / “Not in”, each slug must be lowercase and use only letters, digits, hyphens, or underscores.',
        });
      }
      return;
    }
    const s = slugValueSchema.safeParse(f.value);
    if (!s.success) {
      ctx.addIssue({
        code: 'custom',
        message: 'Slug must be lowercase and use only letters, digits, hyphens, or underscores.',
      });
    }
  });

const manifestNameFilterSchema = z
  .object({
    field: z.literal('manifest_name'),
    operator: z.enum(['eq', 'not_eq', 'in', 'not_in', 'start', 'matches', 'blank']),
    value: z.unknown().optional(),
  })
  .superRefine((f, ctx) => {
    if (f.operator === 'blank') return;
    if (f.operator === 'in' || f.operator === 'not_in') {
      const arr = z.array(manifestNameSchema).min(1).safeParse(f.value);
      if (!arr.success) {
        ctx.addIssue({
          code: 'custom',
          message:
            'For “In” / “Not in”, use only allowed space types (e.g. assemblies, conferences).',
        });
      }
      return;
    }
    if (f.operator === 'eq' || f.operator === 'not_eq') {
      const v = manifestNameSchema.safeParse(f.value);
      if (!v.success) {
        ctx.addIssue({
          code: 'custom',
          message: 'Choose a space type from the list (e.g. participatory processes, assemblies).',
        });
      }
      return;
    }
    const s = z.string().min(1).safeParse(f.value);
    if (!s.success) {
      ctx.addIssue({ code: 'custom', message: 'Set Value to a non-empty string.' });
    }
  });

export const advancedFilterSchema = z.union([
  idFilterSchema,
  titleFilterSchema,
  slugFilterSchema,
  manifestNameFilterSchema,
]);

export const advancedFiltersSchema = z.array(advancedFilterSchema);

const CRITERION_MESSAGE =
  'Add a title search, a space type, or at least one advanced filter.';

export const searchParticipatorySpacePropsSchema = z
  .object({
    query: z.string().optional(),
    spaceType: manifestNameSchema.optional(),
    advancedFilters: advancedFiltersSchema.optional(),
    perPage: z.number().int().min(1).max(100).default(50),
    maxResults: z.number().int().min(1).max(5000).default(500),
  })
  .superRefine((data, ctx) => {
    const q = typeof data.query === 'string' ? data.query.trim() : '';
    const hasQuery = q.length > 0;
    const hasSpace = data.spaceType !== undefined;
    const hasAdv = (data.advancedFilters?.length ?? 0) > 0;
    if (!hasQuery && !hasSpace && !hasAdv) {
      ctx.addIssue({ code: 'custom', message: CRITERION_MESSAGE });
    }
  });

export type SearchParticipatorySpaceInput = z.infer<
  typeof searchParticipatorySpacePropsSchema
>;

type ParsedAdvanced = z.infer<typeof advancedFilterSchema>;

function keyBaseForStringField(
  field: 'manifest_name' | 'slug' | 'title'
): StringFilterKeyBase {
  if (field === 'manifest_name') return 'ManifestName';
  if (field === 'slug') return 'Slug';
  return 'Title';
}

function applyIdFilter(params: SearchSpacesRequestParams, f: ParsedAdvanced): void {
  if (f.field !== 'id') return;
  if (f.operator === 'eq') params.filterIdEq = positiveIntSchema.parse(f.value);
  else if (f.operator === 'lt') params.filterIdLt = positiveIntSchema.parse(f.value);
  else if (f.operator === 'gt') params.filterIdGt = positiveIntSchema.parse(f.value);
  else if (f.operator === 'in') {
    params.filterIdIn = (f.value as unknown[]).map((x) => positiveIntSchema.parse(x));
  } else if (f.operator === 'present') params.filterIdPresent = true;
  else if (f.operator === 'blank') params.filterIdBlank = true;
}

function applyStringFieldFilter(params: SearchSpacesRequestParams, f: ParsedAdvanced): void {
  if (f.field === 'id') return;
  const keyBase = keyBaseForStringField(f.field);
  if (f.operator === 'eq') params[`filter${keyBase}Eq` as const] = f.value as string;
  else if (f.operator === 'not_eq')
    params[`filter${keyBase}NotEq` as const] = f.value as string;
  else if (f.operator === 'start')
    params[`filter${keyBase}Start` as const] = f.value as string;
  else if (f.operator === 'matches')
    params[`filter${keyBase}Matches` as const] = f.value as string;
  else if (f.operator === 'blank') params[`filter${keyBase}Blank` as const] = true;
  else if (f.operator === 'in')
    params[`filter${keyBase}In` as const] = f.value as string[];
  else if (f.operator === 'not_in')
    params[`filter${keyBase}NotIn` as const] = f.value as string[];
}

function parsePaging(args: {
  accessToken: string;
  page?: unknown;
  perPage?: unknown;
}): { token: string; effectivePage: number; effectivePerPage: number } {
  const token = z.string().min(1, 'accessToken is required').parse(args.accessToken);
  const effectivePage = z.number().int().min(1).default(1).parse(args.page ?? 1);
  const effectivePerPage = z.number().int().min(1).max(100).default(50).parse(args.perPage ?? 50);
  return { token, effectivePage, effectivePerPage };
}

function parseSearchCriteria(args: {
  advancedFilters?: unknown;
  query?: unknown;
  spaceType?: unknown;
}): {
  parsedFilters: ParsedAdvanced[];
  queryTrimmed: string | undefined;
  spaceType: z.infer<typeof manifestNameSchema> | undefined;
} {
  const parsedFilters = advancedFiltersSchema.parse(
    normalizeAdvancedFiltersInput(args.advancedFilters ?? [])
  );
  const qRaw = args.query;
  const queryTrimmed =
    typeof qRaw === 'string' && qRaw.trim().length > 0 ? qRaw.trim() : undefined;
  const spaceTypeParsed = manifestNameSchema.optional().safeParse(args.spaceType);
  const spaceType = spaceTypeParsed.success ? spaceTypeParsed.data : undefined;
  return { parsedFilters, queryTrimmed, spaceType };
}

function assertHasCriterion(
  queryTrimmed: string | undefined,
  spaceType: unknown,
  parsedFilters: ParsedAdvanced[]
): void {
  const ok =
    queryTrimmed !== undefined || spaceType !== undefined || parsedFilters.length > 0;
  if (!ok) throw new Error(CRITERION_MESSAGE);
}

export function buildSearchSpacesRequestParams(args: {
  accessToken: string;
  advancedFilters?: unknown;
  query?: unknown;
  spaceType?: unknown;
  page?: unknown;
  perPage?: unknown;
  locales?: unknown;
}): { requestParams: SearchSpacesRequestParams; effectivePerPage: number } {
  const { token, effectivePage, effectivePerPage } = parsePaging(args);
  const { parsedFilters, queryTrimmed, spaceType } = parseSearchCriteria(args);
  assertHasCriterion(queryTrimmed, spaceType, parsedFilters);

  const requestParams: SearchSpacesRequestParams = {
    authorization: bearerAuthorization(token),
    page: effectivePage,
    perPage: effectivePerPage,
    locales: parseLocales(args.locales),
  };

  for (const f of parsedFilters) {
    applyIdFilter(requestParams, f);
    applyStringFieldFilter(requestParams, f);
  }

  if (queryTrimmed !== undefined) {
    requestParams.filterTitleMatches = `%${queryTrimmed}%`;
  }
  if (spaceType !== undefined) {
    requestParams.filterManifestNameEq = spaceType;
  }

  return { requestParams, effectivePerPage };
}
