import { z } from 'zod';
import { bearerAuthorization } from '../../runtime/authMode';
import { parseLocales } from '../../runtime/locales';

export type ComponentField =
  | 'manifest_name'
  | 'id'
  | 'participatory_space_id'
  | 'participatory_space_type'
  | 'name';

export type IdLikeOperator = 'eq' | 'in' | 'lt' | 'gt' | 'present' | 'blank';
export type StringOperator =
  | 'eq'
  | 'not_eq'
  | 'in'
  | 'not_in'
  | 'start'
  | 'matches'
  | 'blank';

export type ComponentAdvancedFilter = {
  field: ComponentField;
  operator: IdLikeOperator | StringOperator;
  value?: unknown;
};

/** Mirrors SDK filter fields for GET /components/search */
export type SearchComponentsRequestParams = {
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
  filterParticipatorySpaceIdIn?: string[];
  filterParticipatorySpaceIdEq?: string;
  filterParticipatorySpaceIdLt?: string;
  filterParticipatorySpaceIdGt?: string;
  filterParticipatorySpaceIdPresent?: boolean;
  filterParticipatorySpaceIdBlank?: boolean;
  filterParticipatorySpaceTypeNotIn?: string[];
  filterParticipatorySpaceTypeIn?: string[];
  filterParticipatorySpaceTypeStart?: string;
  filterParticipatorySpaceTypeEq?: string;
  filterParticipatorySpaceTypeNotEq?: string;
  filterParticipatorySpaceTypeMatches?: string;
  filterParticipatorySpaceTypeBlank?: boolean;
  filterNameNotIn?: string[];
  filterNameIn?: string[];
  filterNameStart?: string;
  filterNameEq?: string;
  filterNameNotEq?: string;
  filterNameMatches?: string;
  filterNameBlank?: boolean;
};

const componentManifestSchema = z.enum([
  'pages',
  'proposals',
  'meetings',
  'budgets',
  'surveys',
  'accountability',
  'debates',
  'sortitions',
  'blogs',
  'awesome_map',
  'awesome_iframe',
]);

const spaceTypeSlugSchema = z.enum([
  'participatory_processes',
  'assemblies',
  'conferences',
  'initiatives',
]);

const spaceClassSchema = z.enum([
  'Decidim::ParticipatoryProcess',
  'Decidim::Assembly',
  'Decidim::Conference',
  'Decidim::Initiative',
]);

const participatorySpaceTypeScalarSchema = z.union([spaceTypeSlugSchema, spaceClassSchema]);

const positiveIntSchema = z.number().int().gt(0, 'Value must be > 0');

function parsePositiveIdString(v: unknown): string {
  const n = typeof v === 'string' ? Number(v) : Number(v);
  const parsed = positiveIntSchema.safeParse(n);
  if (!parsed.success) throw new Error(String(parsed.error.message));
  return String(parsed.data);
}

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
      if (!arr.success)
        ctx.addIssue({ code: 'custom', message: 'id in requires number[] of > 0' });
      return;
    }
    const n = Number(f.value);
    const parsed = positiveIntSchema.safeParse(n);
    if (!parsed.success)
      ctx.addIssue({
        code: 'custom',
        message: `id ${f.operator} requires number > 0`,
      });
  });

const participatorySpaceIdFilterSchema = z
  .object({
    field: z.literal('participatory_space_id'),
    operator: z.enum(['eq', 'in', 'lt', 'gt', 'present', 'blank']),
    value: z.unknown().optional(),
  })
  .superRefine((f, ctx) => {
    if (f.operator === 'present' || f.operator === 'blank') return;
    if (f.operator === 'in') {
      const raw = Array.isArray(f.value) ? f.value : [];
      if (raw.length === 0) {
        ctx.addIssue({
          code: 'custom',
          message: 'participatory_space_id in requires non-empty array',
        });
        return;
      }
      for (const item of raw) {
        try {
          parsePositiveIdString(item);
        } catch {
          ctx.addIssue({
            code: 'custom',
            message: 'participatory_space_id in requires values > 0',
          });
          return;
        }
      }
      return;
    }
    try {
      parsePositiveIdString(f.value);
    } catch {
      ctx.addIssue({
        code: 'custom',
        message: `participatory_space_id ${f.operator} requires id > 0`,
      });
    }
  });

const componentManifestFilterSchema = z
  .object({
    field: z.literal('manifest_name'),
    operator: z.enum(['eq', 'not_eq', 'in', 'not_in', 'start', 'matches', 'blank']),
    value: z.unknown().optional(),
  })
  .superRefine((f, ctx) => {
    if (f.operator === 'blank') return;
    if (f.operator === 'in' || f.operator === 'not_in') {
      const arr = z.array(componentManifestSchema).min(1).safeParse(f.value);
      if (!arr.success)
        ctx.addIssue({
          code: 'custom',
          message: `${f.field} ${f.operator} requires component_manifest[]`,
        });
      return;
    }
    if (f.operator === 'eq' || f.operator === 'not_eq') {
      const v = componentManifestSchema.safeParse(f.value);
      if (!v.success)
        ctx.addIssue({
          code: 'custom',
          message: `${f.field} ${f.operator} requires a valid component_manifest`,
        });
      return;
    }
    const s = z.string().min(1).safeParse(f.value);
    if (!s.success)
      ctx.addIssue({
        code: 'custom',
        message: `${f.field} ${f.operator} requires string (non-empty)`,
      });
  });

const participatorySpaceTypeFilterSchema = z
  .object({
    field: z.literal('participatory_space_type'),
    operator: z.enum(['eq', 'not_eq', 'in', 'not_in', 'start', 'matches', 'blank']),
    value: z.unknown().optional(),
  })
  .superRefine((f, ctx) => {
    if (f.operator === 'blank') return;
    if (f.operator === 'in' || f.operator === 'not_in') {
      const arr = z.array(participatorySpaceTypeScalarSchema).min(1).safeParse(f.value);
      if (!arr.success)
        ctx.addIssue({
          code: 'custom',
          message: `${f.field} ${f.operator} requires space_type[] or Decidim class[]`,
        });
      return;
    }
    if (f.operator === 'eq' || f.operator === 'not_eq') {
      const v = participatorySpaceTypeScalarSchema.safeParse(f.value);
      if (!v.success)
        ctx.addIssue({
          code: 'custom',
          message: `${f.field} ${f.operator} requires space_type or Decidim space class`,
        });
      return;
    }
    const s = z.string().min(1).safeParse(f.value);
    if (!s.success)
      ctx.addIssue({
        code: 'custom',
        message: `${f.field} ${f.operator} requires string (non-empty)`,
      });
  });

const nameFilterSchema = z
  .object({
    field: z.literal('name'),
    operator: z.enum(['eq', 'not_eq', 'in', 'not_in', 'start', 'matches', 'blank']),
    value: z.unknown().optional(),
  })
  .superRefine((f, ctx) => {
    if (f.operator === 'blank') return;
    if (f.operator === 'in' || f.operator === 'not_in') {
      const arr = z.array(z.string().min(1)).min(1).safeParse(f.value);
      if (!arr.success)
        ctx.addIssue({
          code: 'custom',
          message: `${f.field} ${f.operator} requires string[] (non-empty)`,
        });
      return;
    }
    const s = z.string().min(1).safeParse(f.value);
    if (!s.success)
      ctx.addIssue({
        code: 'custom',
        message: `${f.field} ${f.operator} requires string (non-empty)`,
      });
  });

export const componentAdvancedFilterSchema = z.union([
  idFilterSchema,
  participatorySpaceIdFilterSchema,
  componentManifestFilterSchema,
  participatorySpaceTypeFilterSchema,
  nameFilterSchema,
]);

export const componentAdvancedFiltersSchema = z.array(componentAdvancedFilterSchema).min(1);

export function computeHasMore(itemCount: number, effectivePerPage: number): boolean {
  return itemCount === effectivePerPage;
}

function applyManifestNameFilter(
  params: SearchComponentsRequestParams,
  f: z.infer<typeof componentManifestFilterSchema>
): void {
  switch (f.operator) {
    case 'eq':
      params.filterManifestNameEq = f.value as string;
      break;
    case 'not_eq':
      params.filterManifestNameNotEq = f.value as string;
      break;
    case 'start':
      params.filterManifestNameStart = f.value as string;
      break;
    case 'matches':
      params.filterManifestNameMatches = f.value as string;
      break;
    case 'blank':
      params.filterManifestNameBlank = true;
      break;
    case 'in':
      params.filterManifestNameIn = f.value as string[];
      break;
    case 'not_in':
      params.filterManifestNameNotIn = f.value as string[];
      break;
  }
}

function applyParticipatorySpaceTypeFilter(
  params: SearchComponentsRequestParams,
  f: z.infer<typeof participatorySpaceTypeFilterSchema>
): void {
  const v = f.value as string;
  switch (f.operator) {
    case 'eq':
      params.filterParticipatorySpaceTypeEq = v;
      break;
    case 'not_eq':
      params.filterParticipatorySpaceTypeNotEq = v;
      break;
    case 'start':
      params.filterParticipatorySpaceTypeStart = v;
      break;
    case 'matches':
      params.filterParticipatorySpaceTypeMatches = v;
      break;
    case 'blank':
      params.filterParticipatorySpaceTypeBlank = true;
      break;
    case 'in':
      params.filterParticipatorySpaceTypeIn = f.value as string[];
      break;
    case 'not_in':
      params.filterParticipatorySpaceTypeNotIn = f.value as string[];
      break;
  }
}

function applyNameFilter(
  params: SearchComponentsRequestParams,
  f: z.infer<typeof nameFilterSchema>
): void {
  switch (f.operator) {
    case 'eq':
      params.filterNameEq = f.value as string;
      break;
    case 'not_eq':
      params.filterNameNotEq = f.value as string;
      break;
    case 'start':
      params.filterNameStart = f.value as string;
      break;
    case 'matches':
      params.filterNameMatches = f.value as string;
      break;
    case 'blank':
      params.filterNameBlank = true;
      break;
    case 'in':
      params.filterNameIn = f.value as string[];
      break;
    case 'not_in':
      params.filterNameNotIn = f.value as string[];
      break;
  }
}

export function buildSearchComponentsRequestParams(args: {
  accessToken: string;
  advancedFilters: unknown;
  page?: unknown;
  perPage?: unknown;
  locales?: unknown;
}): { requestParams: SearchComponentsRequestParams; effectivePerPage: number } {
  const token = z.string().min(1, 'accessToken is required').parse(args.accessToken);
  const effectivePage = z.number().int().min(1).default(1).parse(args.page ?? 1);
  const effectivePerPage = z
    .number()
    .int()
    .min(1)
    .max(100)
    .default(50)
    .parse(args.perPage ?? 50);

  const parsedFilters = componentAdvancedFiltersSchema.parse(args.advancedFilters);

  const requestParams: SearchComponentsRequestParams = {
    authorization: bearerAuthorization(token),
    page: effectivePage,
    perPage: effectivePerPage,
    locales: parseLocales(args.locales),
  };

  for (const f of parsedFilters) {
    if (f.field === 'id') {
      if (f.operator === 'eq') requestParams.filterIdEq = Number(f.value);
      else if (f.operator === 'lt') requestParams.filterIdLt = Number(f.value);
      else if (f.operator === 'gt') requestParams.filterIdGt = Number(f.value);
      else if (f.operator === 'in') requestParams.filterIdIn = f.value as number[];
      else if (f.operator === 'present') requestParams.filterIdPresent = true;
      else if (f.operator === 'blank') requestParams.filterIdBlank = true;
      continue;
    }

    if (f.field === 'participatory_space_id') {
      if (f.operator === 'eq')
        requestParams.filterParticipatorySpaceIdEq = parsePositiveIdString(f.value);
      else if (f.operator === 'lt')
        requestParams.filterParticipatorySpaceIdLt = parsePositiveIdString(f.value);
      else if (f.operator === 'gt')
        requestParams.filterParticipatorySpaceIdGt = parsePositiveIdString(f.value);
      else if (f.operator === 'in')
        requestParams.filterParticipatorySpaceIdIn = (f.value as unknown[]).map((x) =>
          parsePositiveIdString(x)
        );
      else if (f.operator === 'present')
        requestParams.filterParticipatorySpaceIdPresent = true;
      else if (f.operator === 'blank')
        requestParams.filterParticipatorySpaceIdBlank = true;
      continue;
    }

    if (f.field === 'manifest_name') {
      applyManifestNameFilter(requestParams, f);
      continue;
    }

    if (f.field === 'participatory_space_type') {
      applyParticipatorySpaceTypeFilter(requestParams, f);
      continue;
    }

    if (f.field === 'name') {
      applyNameFilter(requestParams, f);
    }
  }

  return { requestParams, effectivePerPage };
}
