import { assertProp } from './assertProp';

export type DecidimAuth = {
  clientId: string;
  clientSecret: string;
  baseUrl: string;
};

export function extractAuth(context: { auth: unknown }): DecidimAuth {
  const auth: DecidimAuth = context.auth as DecidimAuth;
  if(!auth) {
    throw new Error('Auth is required');
  }
  assertProp(auth.clientId, 'Client ID is required');
  assertProp(auth.clientSecret, 'Client Secret is required');
  assertProp(auth.baseUrl, 'Base URL is required');

  return auth;
}
