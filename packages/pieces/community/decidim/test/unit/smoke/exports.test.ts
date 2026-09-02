import { describe, expect, it } from 'vitest';

/**
 * These are intentionally boring smoke tests.
 *
 * Goal: ensure the piece modules load (no import-time crashes) and keep basic
 * coverage on the "wiring" files that otherwise stay at 0% in unit tests.
 */
describe('decidim piece exports smoke', () => {
  it('loads root exports', async () => {
    const mod = await import('../../../src/index');
    expect(mod).toHaveProperty('decidim');
    expect(mod).toHaveProperty('decidimAuth');
  });

  it('loads logo exports', async () => {
    const mod = await import('../../../src/logo');
    expect(typeof mod.logoUrl).toBe('string');
  });

  it('loads registry exports', async () => {
    const mod = await import('../../../src/lib/registry/actions');
    expect(Array.isArray(mod.allActions)).toBe(true);
  });

  it('loads triggers', async () => {
    const meetings = await import('../../../src/lib/triggers/meetings-reminder');
    expect(meetings.meetingsReminder).toBeDefined();

    const proposal = await import('../../../src/lib/triggers/proposal-published');
    expect(proposal.proposalPublished).toBeDefined();
  });

  it('loads actions', async () => {
    const custom = await import('../../../src/lib/actions/custom-api-call');
    expect(custom.customApiCallAction).toBeDefined();
  });

  it('loads domains modules', async () => {
    const blogs = await import('../../../src/lib/domains/blogs/blog-posts');
    expect(blogs).toBeDefined();

    const components = await import('../../../src/lib/domains/components/search-component');
    expect(components).toBeDefined();

    const typedComponentsParams = await import(
      '../../../src/lib/domains/components/typed-components.params'
    );
    expect(typedComponentsParams).toBeDefined();

    const typedComponents = await import('../../../src/lib/domains/components/typed-components');
    expect(typedComponents).toBeDefined();

    const org = await import('../../../src/lib/domains/organizations/organizations');
    expect(org).toBeDefined();

    const orgExt = await import(
      '../../../src/lib/domains/organizations/organization-extended-data'
    );
    expect(orgExt).toBeDefined();

    const proposals = await import('../../../src/lib/domains/proposals/proposals');
    expect(proposals).toBeDefined();

    const drafts = await import('../../../src/lib/domains/proposals/draft-proposals');
    expect(drafts).toBeDefined();

    const spaces = await import('../../../src/lib/domains/spaces/get-participatory-space');
    expect(spaces).toBeDefined();

    const users = await import('../../../src/lib/domains/users/search-users');
    expect(users).toBeDefined();

    const token = await import('../../../src/lib/domains/users/get-token');
    expect(token).toBeDefined();

    const me = await import('../../../src/lib/domains/users/me-extended-data');
    expect(me).toBeDefined();
  });
});

