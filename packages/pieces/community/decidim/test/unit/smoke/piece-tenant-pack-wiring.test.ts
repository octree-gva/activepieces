import { describe, expect, it } from 'vitest';
import { decidim } from '../../../src/index';
import { decidimAuth } from '../../../src/decidimAuth';
import { allActions } from '../../../src/lib/registry/actions';

describe('piece wiring for tenant pack', () => {
  it('uses decidimAuth on the piece', () => {
    expect(decidim.auth).toBe(decidimAuth);
  });

  it('auth props are name + tenants only', () => {
    expect(Object.keys(decidimAuth.props).sort()).toEqual(['name', 'tenants']);
    expect(decidimAuth.props).not.toHaveProperty('baseUrl');
    expect(decidimAuth.props).not.toHaveProperty('clientId');
    expect(decidimAuth.props).not.toHaveProperty('clientSecret');
    expect(decidimAuth.props).not.toHaveProperty('scopes');
  });

  it('every registry action declares host and requires auth', () => {
    expect(allActions).toHaveLength(18);
    for (const action of allActions) {
      expect(action.props).toHaveProperty('host');
      expect(action.props.host.required).toBe(true);
      expect(action.requireAuth).toBe(true);
    }
  });

  it('piece metadata display name stays Decidim', () => {
    expect(decidim.displayName).toBe('Decidim');
  });
});
