import { vi } from 'vitest';
import { roles } from '../../../src/lib/domains/roles/roles';
import { createMockActionContext } from '../../helpers/create-mock-action-context';
import { decidimCustomAuth } from '../../helpers/decidim-test-fixtures';

const { createRoleMock } = vi.hoisted(() => ({
  createRoleMock: vi.fn(),
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
  createRolesApi: vi.fn().mockReturnValue({
    roles: vi.fn(),
    role: vi.fn(),
    destroyRole: vi.fn(),
    createRole: createRoleMock,
  }),
}));

describe('roles action', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createRoleMock.mockResolvedValue({ data: { data: { id: 'role-1' } } });
  });

  it('creates private assembly member role via convenience action', async () => {
    const result = await roles.run(
      createMockActionContext({
        auth: decidimCustomAuth,
        propsValue: {
          action: 'addPrivateAssemblyMember',
          createOptions: {
            assemblyId: 123,
            userId: 789,
          },
        },
      }) as Parameters<typeof roles.run>[0]
    );

    expect(createRoleMock).toHaveBeenCalledWith(
      expect.objectContaining({
        createRoleRequest: {
          data: {
            attributes: {
              resource_type: 'Decidim::Assembly',
              resource_id: 123,
              user_id: 789,
              type: 'space_private_member',
            },
          },
        },
      })
    );
    expect(result.ok).toBe(true);
  });
});
