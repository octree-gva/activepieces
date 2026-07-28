import { z } from 'zod';
import { bearerAuthorization } from '../../runtime/authMode';
import { parseLocales } from '../../runtime/locales';

export function buildSearchSpacesRequestParams(args: {
  accessToken: string;
  spaceIds?: unknown;
  spaceManifests?: unknown;
  page?: unknown;
  perPage?: unknown;
  locales?: unknown;
}): { requestParams: SearchSpacesRequestParams; effectivePerPage: number } {
  const token = z.string().min(1, 'accessToken is required').parse(args.accessToken);
  const effectivePage = z.number().int().min(1).default(1).parse(args.page ?? 1);
  const effectivePerPage = z
    .number()
    .int()
    .min(1)
    .max(100)
    .default(10)
    .parse(args.perPage ?? 10);

  const requestParams: SearchSpacesRequestParams = {
    authorization: bearerAuthorization(token),
    page: effectivePage,
    perPage: effectivePerPage,
    locales: parseLocales(args.locales),
  };

  const ids = parsePositiveIdList(args.spaceIds);
  if (ids) requestParams.filterIdIn = ids;

  const manifests = parseStringList(args.spaceManifests);
  if (manifests) requestParams.filterManifestNameIn = manifests;

  return { requestParams, effectivePerPage };
}

function rowValue(row: unknown): unknown {
  if (row !== null && typeof row === 'object' && 'value' in row) {
    return Reflect.get(row, 'value');
  }
  return row;
}

function parseArrayValues(raw: unknown): unknown[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map(rowValue)
    .filter((v) => v !== undefined && v !== null && String(v).trim() !== '');
}

function parsePositiveIdList(raw: unknown): number[] | undefined {
  const values = parseArrayValues(raw);
  if (values.length === 0) return undefined;
  return values.map((v) => z.number().int().gt(0).parse(Number(v)));
}

function parseStringList(raw: unknown): string[] | undefined {
  const values = parseArrayValues(raw);
  if (values.length === 0) return undefined;
  return values.map((v) => z.string().min(1).parse(String(v).trim()));
}

export type SearchSpacesRequestParams = {
  authorization: string;
  locales?: unknown[];
  page?: number;
  perPage?: number;
  filterIdIn?: number[];
  filterManifestNameIn?: string[];
};
