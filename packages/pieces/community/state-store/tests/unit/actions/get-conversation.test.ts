import { getConversationAction } from '../../../src/lib/actions/get-conversation';
import { createMockActionContext } from '../../helpers/create-mock-action-context';
import { redisConnect } from '../../../src/lib/utils/redis';
import { UNKNOWN_STATE } from '../../../src/types';
import { AppConnectionType } from '@activepieces/pieces-framework';

jest.mock('../../../src/lib/utils/redis');

describe('getConversationAction', () => {
  let mockClient: {
    get: jest.Mock;
    set: jest.Mock;
    xadd: jest.Mock;
    quit: jest.Mock;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockClient = {
      get: jest.fn(),
      set: jest.fn(),
      xadd: jest.fn(),
      quit: jest.fn().mockResolvedValue('OK'),
    };
    (redisConnect as jest.Mock).mockResolvedValue(mockClient);
  });

  it('should return existing conversation when found', async () => {
    const conversation = { state: 'PROPOSE', data: { key: 'value' } };
    mockClient.get.mockResolvedValueOnce(JSON.stringify(conversation));

    const context = createMockActionContext({
      auth: {
        type: AppConnectionType.CUSTOM_AUTH,
        props: {
          url: 'redis://localhost:6379',
          namespace: 'test:namespace',
          fsm: JSON.stringify({
            initial: 'START',
            transitions: { PROPOSE: ['PROPOSE_SUBMIT', 'START'] },
          }),
        },
      } as never,
      propsValue: {
        conversation_id: 'conv-123',
      },
    });

    const result = await (getConversationAction.run as (ctx: unknown) => Promise<unknown>)(context);

    expect(result).toEqual({
      ok: true,
      created: false,
      conversation,
      allowed_next_states: ['PROPOSE_SUBMIT', 'START'],
    });
    expect(mockClient.get).toHaveBeenCalledWith('test:namespace:conversation:conv-123');
    expect(mockClient.quit).toHaveBeenCalled();
  });

  it('should create new conversation with unknown state when not found and no FSM', async () => {
    mockClient.get.mockResolvedValueOnce(null);
    mockClient.set.mockResolvedValueOnce('OK');

    const context = createMockActionContext({
      auth: {
        type: AppConnectionType.CUSTOM_AUTH,
        props: { url: 'redis://localhost:6379', namespace: 'test:namespace' },
      } as never,
      propsValue: {
        conversation_id: 'conv-123',
      },
    });

    const result = await (getConversationAction.run as (ctx: unknown) => Promise<unknown>)(context);

    expect(result).toEqual({
      ok: true,
      created: true,
      conversation: {
        state: UNKNOWN_STATE,
        data: {},
      },
      allowed_next_states: [],
    });
    const setCall = mockClient.set.mock.calls.find(
      (call: unknown[]) => call[0] === 'test:namespace:conversation:conv-123' && call[2] === 'NX'
    );
    expect(setCall).toBeDefined();
    expect(mockClient.xadd).toHaveBeenCalled();
  });

  it('should use initial state from FSM when creating new conversation', async () => {
    mockClient.get.mockResolvedValueOnce(null);
    mockClient.set.mockResolvedValueOnce('OK');

    const context = createMockActionContext({
      auth: {
        type: AppConnectionType.CUSTOM_AUTH,
        props: {
          url: 'redis://localhost:6379',
          namespace: 'test:namespace',
          fsm: JSON.stringify({
            initial: 'initial_state',
            transitions: { initial_state: ['next'] },
          }),
        },
      } as never,
      propsValue: { conversation_id: 'conv-123' },
    });

    const result = await (getConversationAction.run as (ctx: unknown) => Promise<unknown>)(context);

    expect(result).toEqual({
      ok: true,
      created: true,
      conversation: {
        state: 'initial_state',
        data: {},
      },
      allowed_next_states: ['next'],
    });
  });

  it('should handle race condition when another process creates conversation', async () => {
    const existingConversation = { state: 'state1', data: {} };
    mockClient.get.mockResolvedValueOnce(null);
    mockClient.set.mockResolvedValueOnce(null);
    mockClient.get.mockResolvedValueOnce(JSON.stringify(existingConversation));

    const context = createMockActionContext({
      auth: {
        type: AppConnectionType.CUSTOM_AUTH,
        props: { url: 'redis://localhost:6379', namespace: 'test:namespace' },
      } as never,
      propsValue: {
        conversation_id: 'conv-123',
      },
    });

    const result = await (getConversationAction.run as (ctx: unknown) => Promise<unknown>)(context);

    expect(result).toEqual({
      ok: true,
      created: false,
      conversation: existingConversation,
      allowed_next_states: [],
    });
  });

  it('should handle Redis errors', async () => {
    mockClient.get.mockRejectedValueOnce(new Error('Redis error'));

    const context = createMockActionContext({
      auth: {
        type: AppConnectionType.CUSTOM_AUTH,
        props: { url: 'redis://localhost:6379', namespace: 'test:namespace' },
      } as never,
      propsValue: {
        conversation_id: 'conv-123',
      },
    });

    await expect(
      (getConversationAction.run as (ctx: unknown) => Promise<unknown>)(context)
    ).rejects.toThrow('Redis operation failed: Redis error');
    expect(mockClient.quit).toHaveBeenCalled();
  });
});
