import { vi } from 'vitest';
import { createMagicLink } from '../../../src/lib/domains/users/create-magic-link';
import { createMockActionContext } from '../../helpers/create-mock-action-context';
import { decidimCustomAuth } from '../../helpers/decidim-test-fixtures';

const { generateMagicLinkMock } = vi.hoisted(() => ({
  generateMagicLinkMock: vi.fn(),
}));

vi.mock('../../../src/lib/runtime/authMode', () => ({
  resolveAuthContext: vi.fn().mockResolvedValue({
    mode: 'user',
    rawAccessToken: 'user-token',
    baseConfiguration: {},
  }),
  bearerAuthorization: vi.fn().mockReturnValue('Bearer user-token'),
}));

vi.mock('../../../src/lib/runtime/clients', () => ({
  createUsersApi: vi.fn().mockReturnValue({
    generateMagicLink: generateMagicLinkMock,
  }),
}));

describe('createMagicLink', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    generateMagicLinkMock.mockResolvedValue({
      data: {
        data: {
          attributes: { token: 'magic-token' },
          links: { sign_in: { href: 'https://example.org/signin' } },
        },
      },
    });
  });

  it('returns normalized output fields', async () => {
    const result = await createMagicLink.run(
      createMockActionContext({
        auth: decidimCustomAuth,
        propsValue: {
          accessToken: 'user-token',
          redirectUrl: 'https://example.org/assemblies/42',
        },
      }) as Parameters<typeof createMagicLink.run>[0]
    );

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected success');
    expect(result.token).toBe('magic-token');
    expect(result.signInUrl).toBe('https://example.org/signin');
    expect(result.redirectUrl).toBe('https://example.org/assemblies/42');
  });
});
