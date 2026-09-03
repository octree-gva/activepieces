import { z } from 'zod';

const tenantEntrySchema = z.object({
  client_id: z.string().min(1),
  client_secret: z.string().min(1),
  scopes: z.string().min(1),
});

const tenantsMapSchema = z
  .record(z.string(), tenantEntrySchema)
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Tenants map must include at least one host',
  });

export function normalizeHost(host: string): string {
  return host.trim().replace(/\/$/, '');
}

export function isHttpUrl(host: string): boolean {
  try {
    const url = new URL(host);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export function parseTenantsJson(raw: unknown): DecidimTenantsMap {
  if (typeof raw !== 'string' || raw.trim() === '') {
    throw new Error('Tenants JSON is required');
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('Tenants JSON is invalid');
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Tenants JSON must be an object keyed by host URL');
  }
  const normalizedEntries: Record<string, z.infer<typeof tenantEntrySchema>> = {};
  for (const [key, value] of Object.entries(parsed)) {
    const host = normalizeHost(key);
    if (!isHttpUrl(host)) {
      throw new Error(`Invalid host URL: ${key}`);
    }
    if (normalizedEntries[host]) {
      throw new Error(`Duplicate host after normalization: ${host}`);
    }
    normalizedEntries[host] = tenantEntrySchema.parse(value);
  }
  return tenantsMapSchema.parse(normalizedEntries);
}

export function listTenantHosts(raw: unknown): string[] {
  return Object.keys(parseTenantsJson(raw));
}

export function resolveTenantAuth(input: {
  tenantsRaw: unknown;
  host: unknown;
  name?: string;
}): {
  clientId: string;
  clientSecret: string;
  baseUrl: string;
  name?: string;
  scopes?: string;
} {
  const host =
    typeof input.host === 'string' ? normalizeHost(input.host) : '';
  if (host === '') {
    throw new Error('Platform host is required');
  }
  const tenants = parseTenantsJson(input.tenantsRaw);
  const entry = tenants[host];
  if (!entry) {
    throw new Error(`Unknown platform host: ${host}`);
  }
  return {
    baseUrl: host,
    clientId: entry.client_id,
    clientSecret: entry.client_secret,
    scopes: entry.scopes,
    ...(input.name !== undefined ? { name: input.name } : {}),
  };
}

export function readConnectionProps(auth: unknown): DecidimConnectionProps {
  if (auth === null || auth === undefined) {
    throw new Error('Auth is required');
  }
  const authValue = auth as { type?: string; props?: DecidimConnectionProps } | DecidimConnectionProps;
  const props =
    typeof authValue === 'object' &&
    authValue !== null &&
    'props' in authValue &&
    authValue.props
      ? authValue.props
      : (authValue as DecidimConnectionProps);
  if (typeof props.name !== 'string' || props.name.trim() === '') {
    throw new Error('Name is required');
  }
  if (typeof props.tenants !== 'string') {
    throw new Error('Tenants JSON is required');
  }
  return {
    name: props.name,
    tenants: props.tenants,
  };
}

export type DecidimTenantEntry = {
  client_id: string;
  client_secret: string;
  scopes: string;
};

export type DecidimTenantsMap = Record<string, DecidimTenantEntry>;

export type DecidimConnectionProps = {
  name: string;
  tenants: string;
};
