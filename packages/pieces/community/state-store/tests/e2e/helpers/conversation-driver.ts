import { AppConnectionType } from '@activepieces/pieces-framework';
import { setConversationAction } from '../../../src/lib/actions/set-conversation';
import { createMockActionContext } from '../../helpers/create-mock-action-context';
import { pollNamespacesOnce } from '../../../src/lib/bridge/run-bridge';
import Redis from 'ioredis';
import { listenerClient, ListenerChannel, ListenerSnapshot } from './listener-client';

const FSM = JSON.stringify({
  initial: 'WELCOME',
  transitions: {
    WELCOME: ['MENU', 'WELCOME'],
    MENU: ['READ_BLOG', 'WELCOME', 'MENU'],
    READ_BLOG: ['MENU', 'READ_BLOG', 'WELCOME'],
  },
});

function authForNamespace(namespace: string) {
  return {
    type: AppConnectionType.CUSTOM_AUTH,
    props: {
      url: process.env['AP_REDIS_URL'] ?? process.env['AP_STATE_STORE_REDIS_URL'] ?? '',
      namespace,
      fsm: FSM,
    },
  };
}

async function createConversation({
  namespace,
  conversationId,
  data,
}: {
  namespace: string;
  conversationId: string;
  data?: Record<string, unknown>;
}) {
  return updateConversation({
    namespace,
    conversationId,
    state: 'WELCOME',
    data: data ?? {},
    replaceData: true,
    jump: true,
  });
}

async function updateConversation({
  namespace,
  conversationId,
  state,
  data,
  replaceData = false,
  jump = true,
}: {
  namespace: string;
  conversationId: string;
  state?: string;
  data?: Record<string, unknown>;
  replaceData?: boolean;
  jump?: boolean;
}) {
  const context = createMockActionContext({
    auth: authForNamespace(namespace) as never,
    propsValue: {
      conversation_id: conversationId,
      state,
      data: data ?? {},
      replace_data: replaceData,
      jump,
    },
  });
  return (setConversationAction.run as (ctx: unknown) => Promise<unknown>)(context);
}

async function mutateAndPoll({
  redis,
  namespace,
  conversationId,
  state,
  data,
  replaceData,
  create,
}: {
  redis: Redis;
  namespace: string;
  conversationId: string;
  state?: string;
  data?: Record<string, unknown>;
  replaceData?: boolean;
  create?: boolean;
}): Promise<ListenerSnapshot> {
  if (create) {
    await createConversation({
      namespace,
      conversationId,
      data,
    });
  } else {
    await updateConversation({
      namespace,
      conversationId,
      state,
      data,
      replaceData,
    });
  }
  await pollNamespacesOnce({ redis });
  return listenerClient.getSnapshot();
}

function delta(
  before: Record<ListenerChannel, number>,
  after: ListenerSnapshot
): Record<ListenerChannel, number> {
  const afterCounts = listenerClient.counts(after);
  return {
    WEBA: afterCounts.WEBA - before.WEBA,
    WEBB: afterCounts.WEBB - before.WEBB,
    WEBC: afterCounts.WEBC - before.WEBC,
  };
}

export const conversationDriver = {
  authForNamespace,
  createConversation,
  updateConversation,
  mutateAndPoll,
  delta,
};
