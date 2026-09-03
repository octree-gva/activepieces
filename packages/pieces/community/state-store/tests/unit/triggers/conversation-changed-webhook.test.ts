import { conversationChangedWebhookTrigger } from '../../../src/lib/triggers/conversation-changed-webhook';
import { httpClient } from '@activepieces/pieces-common';
import { AppConnectionType } from '@activepieces/pieces-framework';

jest.mock('@activepieces/pieces-common', () => {
  const actual = jest.requireActual('@activepieces/pieces-common');
  return {
    ...actual,
    httpClient: {
      sendRequest: jest.fn(),
    },
  };
});

function authProps(bridgeUrlValue?: string) {
  return {
    type: AppConnectionType.CUSTOM_AUTH,
    props: {
      url: 'redis://localhost:6379',
      namespace: 'orders',
      bridgeUrl: bridgeUrlValue,
      fsm: undefined,
    },
  };
}

describe('conversationChangedWebhookTrigger', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('subscribes using connection Watcher URL on enable', async () => {
    (httpClient.sendRequest as jest.Mock).mockResolvedValueOnce({
      body: { id: 'sub-1' },
    });
    const store = {
      put: jest.fn(),
      get: jest.fn(),
      delete: jest.fn(),
    };

    await conversationChangedWebhookTrigger.onEnable({
      auth: authProps('http://watcher:3848/') as never,
      propsValue: { state_filter: undefined },
      webhookUrl: 'http://ap/hooks/1',
      store,
    } as never);

    expect(httpClient.sendRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'http://watcher:3848/subscribers',
        body: {
          url: 'http://ap/hooks/1',
          namespace: 'orders',
          stateFilter: null,
        },
      })
    );
    expect(store.put).toHaveBeenCalledWith('subscriberId', 'sub-1');
  });

  it('run emits data-only changes and skips no-ops', async () => {
    const run = conversationChangedWebhookTrigger.run as (ctx: unknown) => Promise<unknown[]>;

    const dataOnly = await run({
      propsValue: { state_filter: undefined },
      payload: {
        body: {
          namespace: 'orders',
          conversation_id: 'c1',
          previous: { state: 'PROPOSE', data: {} },
          current: { state: 'PROPOSE', data: { title: 'A' } },
          at: '2026-01-01T00:00:00Z',
        },
      },
    });
    expect(dataOnly).toHaveLength(1);

    const noop = await run({
      propsValue: { state_filter: undefined },
      payload: {
        body: {
          namespace: 'orders',
          conversation_id: 'c1',
          previous: { state: 'PROPOSE', data: { title: 'A' } },
          current: { state: 'PROPOSE', data: { title: 'A' } },
          at: '2026-01-01T00:00:00Z',
        },
      },
    });
    expect(noop).toEqual([]);
  });

  it('run respects state filter', async () => {
    const run = conversationChangedWebhookTrigger.run as (ctx: unknown) => Promise<unknown[]>;
    const result = await run({
      propsValue: { state_filter: { value: 'START' } },
      payload: {
        body: {
          namespace: 'orders',
          conversation_id: 'c1',
          previous: { state: 'PROPOSE', data: {} },
          current: { state: 'PROPOSE', data: { title: 'A' } },
          at: '2026-01-01T00:00:00Z',
        },
      },
    });
    expect(result).toEqual([]);
  });
});
