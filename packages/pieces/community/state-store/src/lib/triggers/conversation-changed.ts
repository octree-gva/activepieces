import {
  createTrigger,
  TriggerStrategy,
  Property,
  AppConnectionValueForAuthProperty,
} from '@activepieces/pieces-framework';
import { DedupeStrategy, Polling, pollingHelper } from '@activepieces/pieces-common';
import { stateStoreAuth } from '../../stateStoreAuth';
import { redisConnect } from '../utils/redis';
import { getEventsKey } from '../utils/validation';
import { ConversationEvent } from '../../types';
import { jsonParse } from '../utils/json';

const polling: Polling<AppConnectionValueForAuthProperty<typeof stateStoreAuth>, Record<string, never>> = {
  strategy: DedupeStrategy.LAST_ITEM,
  items: async ({ auth, lastItemId }) => {
    // Use the correct type for auth from types.ts that includes all props from stateStoreAuth
    // Assuming the type is named StateStoreAuthProps in types.ts
    const { namespace } = auth.props; // Type will enforce inclusion of all required props
    const client = await redisConnect(auth);
    const eventsKey = getEventsKey(namespace);

    try {
      // Use simple XREAD approach for polling triggers
      // Consumer groups are better for webhook-style processing, but polling
      // triggers work better with simple XREAD from last known position
      let streamId = lastItemId as string || '0';

      // If lastItemId is '0', start from beginning, otherwise read from that ID
      const messages = await client.xread('COUNT', 100, 'STREAMS', eventsKey, streamId);

      if (!messages || messages.length === 0) {
        return [];
      }

      const items: Array<{ id: string; data: ConversationEvent }> = [];

      for (const [stream, entries] of messages) {
        for (const [id, fields] of entries) {
          const payloadField = fields.find(([key]) => key === 'payload');
          if (payloadField) {
            try {
              const event = await jsonParse<ConversationEvent>(payloadField[1] as string);
              items.push({
                id,
                data: event,
              });
            } catch (error) {
              // Skip invalid events
            }
          }
        }
      }

      return items;
    } finally {
      await client.quit();
    }
  },
};

export const conversationChangedTrigger = createTrigger({
  name: 'conversation_changed',
  auth: stateStoreAuth,
  displayName: 'On Conversation Changed',
  description: 'Triggered when a conversation state changes in the specified namespace',
  props: {},
  sampleData: {
    namespace: 'bot:proposal',
    conversation_id: 'whatsapp:+351...',
    previous: {
      state: 'PROPOSE',
      data: {},
    },
    current: {
      state: 'PROPOSE_TITLE',
      data: {
        title: 'Example proposal',
      },
    },
    at: '2026-01-24T12:00:00Z',
  },
  type: TriggerStrategy.POLLING,
  async test(context) {
    return await pollingHelper.test(polling, context);
  },
  async onEnable(context) {
    const { store, auth, propsValue } = context;
    await pollingHelper.onEnable(polling, { store, propsValue, auth });
  },
  async onDisable(context) {
    const { store, auth, propsValue } = context;
    await pollingHelper.onDisable(polling, { store, propsValue, auth });
  },
  async run(context) {
    return await pollingHelper.poll(polling, context);
  },
});
