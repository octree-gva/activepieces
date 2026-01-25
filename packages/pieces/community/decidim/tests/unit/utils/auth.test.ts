import { extractAuth } from '../../../src/lib/utils/auth';

describe('extractAuth', () => {
  const validAuth = {
    clientId: 'test-client-id',
    clientSecret: 'test-client-secret',
    baseUrl: 'https://example.com',
  };

  it('should return auth object when valid', () => {
    expect(extractAuth({ auth: validAuth })).toEqual(validAuth);
  });

  it('should throw when auth is undefined', () => {
    expect(() => extractAuth({ auth: undefined })).toThrow('Auth is required');
  });

  it('should throw when auth is null', () => {
    expect(() => extractAuth({ auth: null })).toThrow('Auth is required');
  });

  it('should throw when clientId is empty string', () => {
    expect(() => extractAuth({ auth: { ...validAuth, clientId: '' } })).toThrow('Client ID is required');
  });

  it('should throw when clientId is missing', () => {
    expect(() => extractAuth({ auth: { clientSecret: validAuth.clientSecret, baseUrl: validAuth.baseUrl } })).toThrow('Client ID is required');
  });

  it('should throw when clientSecret is empty string', () => {
    expect(() => extractAuth({ auth: { ...validAuth, clientSecret: '' } })).toThrow('Client Secret is required');
  });

  it('should throw when clientSecret is missing', () => {
    expect(() => extractAuth({ auth: { clientId: validAuth.clientId, baseUrl: validAuth.baseUrl } })).toThrow('Client Secret is required');
  });

  it('should throw when baseUrl is empty string', () => {
    expect(() => extractAuth({ auth: { ...validAuth, baseUrl: '' } })).toThrow('Base URL is required');
  });

  it('should throw when baseUrl is missing', () => {
    expect(() => extractAuth({ auth: { clientId: validAuth.clientId, clientSecret: validAuth.clientSecret } })).toThrow('Base URL is required');
  });
});
