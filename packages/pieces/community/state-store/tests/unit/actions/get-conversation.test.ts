import { getConversationAction } from '../../../src/lib/actions/get-conversation';
import { createMockActionContext } from '../../helpers/create-mock-action-context';
import { redisConnect } from '../../../src/lib/utils/redis';
import { jsonStringify } from '../../../src/lib/utils/json';
import { UNKNOWN_STATE } from '../../../src/types';
import { AppConnectionType } from '@activepieces/shared';
import { stateStoreAuth } from '../../../src/stateStoreAuth';

jest.mock('../../../src/lib/utils/redis');

describe('getConversationAction', () => {
  let mockClient: any;

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
    const conversation = { state: 'state1', data: { key: 'value' } };
    mockClient.get.mockResolvedValueOnce(JSON.stringify(conversation));

    const context = createMockActionContext({
      auth: { type: AppConnectionType.CUSTOM_AUTH, props: { url: 'redis://localhost:6379', namespace: 'test:namespace' } } as any,
      propsValue: {
        conversation_id: 'conv-123',
      },
    });

    const result = await (getConversationAction.run as any)(context);

    expect(result).toEqual({
      ok: true,
      created: false,
      conversation,
    });
    expect(mockClient.get).toHaveBeenCalledWith('test:namespace:conversation:conv-123');
    expect(mockClient.quit).toHaveBeenCalled();
  });

  it('should create new conversation with unknown state when not found', async () => {
    mockClient.get.mockResolvedValueOnce(null); // conversation not found
    mockClient.get.mockResolvedValueOnce(null); // schema not found
    mockClient.set.mockResolvedValueOnce('OK'); // successfully created

    const context = createMockActionContext({
      auth: { type: AppConnectionType.CUSTOM_AUTH, props: { url: 'redis://localhost:6379', namespace: 'test:namespace' } } as any,
      propsValue: {
        conversation_id: 'conv-123',
      },
    }) as any;

    const result = await (getConversationAction.run as any)(context);

    expect(result).toEqual({
      ok: true,
      created: true,
      conversation: {
        state: UNKNOWN_STATE,
        data: {},
      },
    });
    const setCall = mockClient.set.mock.calls.find(
      (call: any[]) => call[0] === 'test:namespace:conversation:conv-123' && call[2] === 'NX'
    );
    expect(setCall).toBeDefined();
    const expectedValue = await jsonStringify({ state: UNKNOWN_STATE, data: {} });
    expect(setCall[1]).toBe(expectedValue);
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
          fsm: JSON.stringify({ initial: 'initial_state', transitions: {} }),
        },
      } as any,
      propsValue: { conversation_id: 'conv-123' },
    }) as any;

    const result = await (getConversationAction.run as any)(context);

    expect(result).toEqual({
      ok: true,
      created: true,
      conversation: {
        state: 'initial_state',
        data: {},
      },
    });
  });

  it('should handle race condition when another process creates conversation', async () => {
    const existingConversation = { state: 'state1', data: {} };
    mockClient.get.mockResolvedValueOnce(null); // first check - not found
    mockClient.set.mockResolvedValueOnce(null); // SET NX returns null (already exists)
    mockClient.get.mockResolvedValueOnce(JSON.stringify(existingConversation)); // re-read

    const context = createMockActionContext({
      auth: { type: AppConnectionType.CUSTOM_AUTH, props: { url: 'redis://localhost:6379', namespace: 'test:namespace' } } as any,
      propsValue: {
        conversation_id: 'conv-123',
      },
    }) as any;

    const result = await (getConversationAction.run as any)(context);

    expect(result).toEqual({
      ok: true,
      created: false,
      conversation: existingConversation,
    });
  });

  it('should handle Redis errors', async () => {
    mockClient.get.mockRejectedValueOnce(new Error('Redis error'));

    const context = createMockActionContext({
      auth: { type: AppConnectionType.CUSTOM_AUTH, props: { url: 'redis://localhost:6379', namespace: 'test:namespace' } } as any,
      propsValue: {
        conversation_id: 'conv-123',
      },
    });

    await expect((getConversationAction.run as any)(context)).rejects.toThrow('Redis operation failed: Redis error');
    expect(mockClient.quit).toHaveBeenCalled();
  });
});
