import { assertProp } from './assertProp';

export type DecidimAuth = {
  clientId: string;
  clientSecret: string;
  baseUrl: string;
};

export function extractAuth(context: { auth: unknown }): DecidimAuth {
  const authValue = context.auth as { type?: string; props?: DecidimAuth } | DecidimAuth;
  if(!authValue) {
    throw new Error('Auth is required');
  }

  // Handle new structure with type and props
  const auth = (authValue as { type?: string; props?: DecidimAuth }).props
    ? (authValue as { props: DecidimAuth }).props
    : authValue as DecidimAuth;

  assertProp(auth.clientId, 'Client ID is required');
  assertProp(auth.clientSecret, 'Client Secret is required');
  assertProp(auth.baseUrl, 'Base URL is required');

  return auth;
}
