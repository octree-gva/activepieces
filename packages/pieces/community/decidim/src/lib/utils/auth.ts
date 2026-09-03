import { assertProp } from './assertProp';
import {
  readConnectionProps,
  resolveTenantAuth,
} from './tenantPack';

export function extractAuth(context: {
  auth: unknown;
  propsValue?: Record<string, unknown>;
}): DecidimAuth {
  const connection = readConnectionProps(context.auth);
  const host = context.propsValue?.host;
  assertProp(
    typeof host === 'string' ? host : undefined,
    'Platform host is required'
  );
  return resolveTenantAuth({
    tenantsRaw: connection.tenants,
    host,
    name: connection.name,
  });
}

export type DecidimAuth = {
  clientId: string;
  clientSecret: string;
  baseUrl: string;
  name?: string;
  scopes?: string;
};
