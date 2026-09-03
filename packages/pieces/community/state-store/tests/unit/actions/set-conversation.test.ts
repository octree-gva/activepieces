import { setConversationAction } from '../../../src/lib/actions/set-conversation';
import { createMockActionContext } from '../../helpers/create-mock-action-context';
import { redisConnect } from '../../../src/lib/utils/redis';
import { AppConnectionType } from '@activepieces/pieces-framework';

jest.mock('../../../src/lib/utils/redis');

const fsm = JSON.stringify({
  initial: 'START',
  transitions: {
    START: ['PROPOSE'],
    PROPOSE: ['PROPOSE_SUBMIT', 'START'],
    PROPOSE_SUBMIT: ['START'],
  },
});

function authProps(overrides: Record<string, unknown> = {}) {
  return {
    type: AppConnectionType.CUSTOM_AUTH,
    props: {
      url: 'redis://localhost:6379',
      namespace: 'test:namespace',
      fsm,
      ...overrides,
    },
  };
}

describe('setConversationAction', () => {
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
      set: jest.fn().mockResolvedValue('OK'),
      xadd: jest.fn().mockResolvedValue('1-0'),
      quit: jest.fn().mockResolvedValue('OK'),
    };
    (redisConnect as jest.Mock).mockResolvedValue(mockClient);
  });

  it('merges data by default when staying in the same state', async () => {
    mockClient.get.mockResolvedValueOnce(
      JSON.stringify({ state: 'PROPOSE', data: { title: 'Old' } })
    );

    const context = createMockActionContext({
      auth: authProps() as never,
      propsValue: {
        conversation_id: 'user-1',
        state: 'PROPOSE',
        data: { body: 'New' },
        replace_data: false,
        jump: false,
      },
    });

    const result = await (setConversationAction.run as (ctx: unknown) => Promise<unknown>)(context);

    expect(result).toEqual({
      ok: true,
      conversation: {
        state: 'PROPOSE',
        data: { title: 'Old', body: 'New' },
      },
      allowed_next_states: ['PROPOSE_SUBMIT', 'START'],
    });
    expect(mockClient.set).toHaveBeenCalledWith(
      'test:namespace:conversation:user-1',
      JSON.stringify({ state: 'PROPOSE', data: { title: 'Old', body: 'New' } })
    );
    expect(mockClient.xadd).toHaveBeenCalled();
  });

  it('allows same-state patch when FSM has no self-loop', async () => {
    mockClient.get.mockResolvedValueOnce(
      JSON.stringify({ state: 'START', data: {} })
    );

    const context = createMockActionContext({
      auth: authProps() as never,
      propsValue: {
        conversation_id: 'user-1',
        state: undefined,
        data: { step: 1 },
        replace_data: false,
        jump: false,
      },
    });

    const result = await (setConversationAction.run as (ctx: unknown) => Promise<unknown>)(context);

    expect(result).toEqual({
      ok: true,
      conversation: { state: 'START', data: { step: 1 } },
      allowed_next_states: ['PROPOSE'],
    });
  });

  it('rejects invalid FSM transitions when jump is off', async () => {
    mockClient.get.mockResolvedValueOnce(
      JSON.stringify({ state: 'START', data: {} })
    );

    const context = createMockActionContext({
      auth: authProps() as never,
      propsValue: {
        conversation_id: 'user-1',
        state: 'PROPOSE_SUBMIT',
        data: {},
        replace_data: false,
        jump: false,
      },
    });

    const result = await (setConversationAction.run as (ctx: unknown) => Promise<unknown>)(context);

    expect(result).toEqual({
      ok: false,
      error: {
        code: 'INVALID_TRANSITION',
        message: expect.stringContaining('Invalid transition'),
      },
    });
    expect(mockClient.set).not.toHaveBeenCalled();
  });

  it('rejects transitions from an unknown current state when jump is off', async () => {
    mockClient.get.mockResolvedValueOnce(
      JSON.stringify({ state: 'ORPHAN', data: {} })
    );

    const context = createMockActionContext({
      auth: authProps() as never,
      propsValue: {
        conversation_id: 'user-1',
        state: 'START',
        data: {},
        replace_data: false,
        jump: false,
      },
    });

    const result = await (setConversationAction.run as (ctx: unknown) => Promise<unknown>)(context);

    expect(result).toEqual({
      ok: false,
      error: {
        code: 'INVALID_TRANSITION',
        message: expect.stringContaining('Unknown current state'),
      },
    });
  });

  it('jumps to any state when jump is on', async () => {
    mockClient.get.mockResolvedValueOnce(
      JSON.stringify({ state: 'START', data: { keep: true } })
    );

    const context = createMockActionContext({
      auth: authProps() as never,
      propsValue: {
        conversation_id: 'user-1',
        state: 'PROPOSE_SUBMIT',
        data: { reason: 'intercept' },
        replace_data: false,
        jump: true,
      },
    });

    const result = await (setConversationAction.run as (ctx: unknown) => Promise<unknown>)(context);

    expect(result).toEqual({
      ok: true,
      conversation: {
        state: 'PROPOSE_SUBMIT',
        data: { keep: true, reason: 'intercept' },
      },
      allowed_next_states: ['START'],
    });
  });

  it('replaces data when replace_data is on', async () => {
    mockClient.get.mockResolvedValueOnce(
      JSON.stringify({ state: 'PROPOSE', data: { title: 'Old', extra: 1 } })
    );

    const context = createMockActionContext({
      auth: authProps() as never,
      propsValue: {
        conversation_id: 'user-1',
        state: 'PROPOSE',
        data: { title: 'New' },
        replace_data: true,
        jump: false,
      },
    });

    const result = await (setConversationAction.run as (ctx: unknown) => Promise<unknown>)(context);

    expect(result).toEqual({
      ok: true,
      conversation: { state: 'PROPOSE', data: { title: 'New' } },
      allowed_next_states: ['PROPOSE_SUBMIT', 'START'],
    });
  });

  it('creates from FSM initial when conversation is missing then transitions', async () => {
    mockClient.get.mockResolvedValueOnce(null);

    const context = createMockActionContext({
      auth: authProps() as never,
      propsValue: {
        conversation_id: 'user-new',
        state: 'PROPOSE',
        data: {},
        replace_data: false,
        jump: false,
      },
    });

    const result = await (setConversationAction.run as (ctx: unknown) => Promise<unknown>)(context);

    expect(result).toEqual({
      ok: true,
      conversation: { state: 'PROPOSE', data: {} },
      allowed_next_states: ['PROPOSE_SUBMIT', 'START'],
    });
    expect(mockClient.xadd).toHaveBeenCalled();
  });

  it('allows any transition when FSM is missing', async () => {
    mockClient.get.mockResolvedValueOnce(
      JSON.stringify({ state: 'START', data: {} })
    );

    const context = createMockActionContext({
      auth: authProps({ fsm: undefined }) as never,
      propsValue: {
        conversation_id: 'user-1',
        state: 'DONE',
        data: {},
        replace_data: false,
        jump: false,
      },
    });

    const result = await (setConversationAction.run as (ctx: unknown) => Promise<unknown>)(context);

    expect(result).toEqual({
      ok: true,
      conversation: { state: 'DONE', data: {} },
      allowed_next_states: [],
    });
  });

  it('skips xadd when state and data are unchanged', async () => {
    mockClient.get.mockResolvedValueOnce(
      JSON.stringify({ state: 'PROPOSE', data: { title: 'A' } })
    );

    const context = createMockActionContext({
      auth: authProps() as never,
      propsValue: {
        conversation_id: 'user-1',
        state: 'PROPOSE',
        data: { title: 'A' },
        replace_data: true,
        jump: false,
      },
    });

    const result = await (setConversationAction.run as (ctx: unknown) => Promise<unknown>)(context);

    expect(result).toEqual({
      ok: true,
      conversation: { state: 'PROPOSE', data: { title: 'A' } },
      allowed_next_states: ['PROPOSE_SUBMIT', 'START'],
    });
    expect(mockClient.set).toHaveBeenCalled();
    expect(mockClient.xadd).not.toHaveBeenCalled();
  });

  it('reads state from DynamicProperties value wrapper', async () => {
    mockClient.get.mockResolvedValueOnce(
      JSON.stringify({ state: 'START', data: {} })
    );

    const context = createMockActionContext({
      auth: authProps() as never,
      propsValue: {
        conversation_id: 'user-1',
        state: { value: 'PROPOSE' },
        data: {},
        replace_data: false,
        jump: false,
      },
    });

    const result = await (setConversationAction.run as (ctx: unknown) => Promise<unknown>)(context);

    expect(result).toEqual({
      ok: true,
      conversation: { state: 'PROPOSE', data: {} },
      allowed_next_states: ['PROPOSE_SUBMIT', 'START'],
    });
  });

  it('quits redis on error', async () => {
    mockClient.get.mockRejectedValueOnce(new Error('Redis error'));

    const context = createMockActionContext({
      auth: authProps() as never,
      propsValue: {
        conversation_id: 'user-1',
        state: 'PROPOSE',
        data: {},
        replace_data: false,
        jump: false,
      },
    });

    await expect(
      (setConversationAction.run as (ctx: unknown) => Promise<unknown>)(context)
    ).rejects.toThrow('Redis operation failed: Redis error');
    expect(mockClient.quit).toHaveBeenCalled();
  });
});
