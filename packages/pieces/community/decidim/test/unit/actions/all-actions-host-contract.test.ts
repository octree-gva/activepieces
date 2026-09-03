import { describe, expect, it } from 'vitest';
import { HttpMethod } from '@activepieces/pieces-common';
import type { Action } from '@activepieces/pieces-framework';
import { allActions } from '../../../src/lib/registry/actions';
import { createMockActionContext } from '../../helpers/create-mock-action-context';
import {
  decidimCustomAuth,
  decidimTestHost,
} from '../../helpers/decidim-test-fixtures';
import { meetingsReminder } from '../../../src/lib/triggers/meetings-reminder';
import { proposalPublished } from '../../../src/lib/triggers/proposal-published';

const EXPECTED_ACTION_NAMES = [
  'blogPosts',
  'createMagicLink',
  'custom_api_call',
  'draftProposals',
  'getParticipatorySpace',
  'getToken',
  'impersonate',
  'organizationExtendedData',
  'organizations',
  'meExtendedData',
  'participant',
  'proposals',
  'roles',
  'searchComponent',
  'searchParticipatorySpace',
  'typedComponents',
  'upsertParticipant',
  'usersList',
] as const;

function baselineProps(actionName: string): Record<string, unknown> {
  switch (actionName) {
    case 'impersonate':
      return { username: 'validuser' };
    case 'custom_api_call':
      return {
        method: HttpMethod.GET,
        url: { url: '/api/rest_full/v0.3' },
        headers: {},
        queryParams: {},
        body_type: 'none',
      };
    case 'upsertParticipant':
      return { by: 'nickname' };
    default:
      return {};
  }
}

async function captureRunError(
  action: Action,
  propsValue: Record<string, unknown>
): Promise<string> {
  const context = createMockActionContext({
    auth: decidimCustomAuth,
    propsValue,
  }) as Parameters<Action['run']>[0];
  try {
    const result = await action.run(context);
    if (
      result !== null &&
      typeof result === 'object' &&
      'error' in result &&
      typeof (result as { error: unknown }).error === 'string' &&
      (result as { error: string }).error
    ) {
      return (result as { error: string }).error;
    }
    if (
      result !== null &&
      typeof result === 'object' &&
      'ok' in result &&
      (result as { ok: unknown }).ok === false
    ) {
      const err = (result as { error?: unknown }).error;
      return typeof err === 'string' && err !== ''
        ? err
        : JSON.stringify(result);
    }
    return `unexpected-success:${JSON.stringify(result)}`;
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}

function isHostRelated(message: string): boolean {
  return (
    message.includes('Platform host is required') ||
    message.includes('Unknown platform host') ||
    message.includes('Tenants JSON') ||
    message.includes('Auth is required') ||
    message.includes('Name is required')
  );
}

describe('all Decidim actions host contract', () => {
  it('registers exactly the expected actions', () => {
    expect(allActions.map((action) => action.name).sort()).toEqual(
      [...EXPECTED_ACTION_NAMES].sort()
    );
  });

  it('covers 18 actions', () => {
    expect(allActions).toHaveLength(18);
  });

  for (const action of allActions) {
    describe(action.name, () => {
      const base = baselineProps(action.name);

      it('declares required Platform host prop', () => {
        const host = action.props.host;
        expect(host).toBeDefined();
        expect(host.required).toBe(true);
        expect(host.displayName).toBe('Platform host');
        if (action.name !== 'custom_api_call') {
          expect(Object.keys(action.props)[0]).toBe('host');
        }
      });

      it('requires auth at runtime', () => {
        expect(action.requireAuth).toBe(true);
      });

      it('fails when host is missing', async () => {
        const error = await captureRunError(action, {
          ...base,
          host: undefined,
        });
        expect(error).toContain('Platform host is required');
      });

      it('fails when host is empty', async () => {
        const error = await captureRunError(action, {
          ...base,
          host: '',
        });
        expect(error).toContain('Platform host is required');
      });

      it('fails closed on unknown host', async () => {
        const error = await captureRunError(action, {
          ...base,
          host: 'https://unknown-tenant.example',
        });
        expect(error).toContain(
          'Unknown platform host: https://unknown-tenant.example'
        );
      });

      it('does not host-fail when host matches the pack', async () => {
        const error = await captureRunError(action, {
          ...base,
          host: decidimTestHost,
        });
        expect(isHostRelated(error)).toBe(false);
      });

      it('selects credentials for a trailing-slash host variant', async () => {
        const error = await captureRunError(action, {
          ...base,
          host: `${decidimTestHost}/`,
        });
        expect(isHostRelated(error)).toBe(false);
      });
    });
  }
});

describe('webhook triggers stay host-free', () => {
  it.each([
    ['meetingsReminder', meetingsReminder],
    ['proposalPublished', proposalPublished],
  ] as const)('%s has no host prop', (_name, trigger) => {
    expect(trigger.props).not.toHaveProperty('host');
  });
});
