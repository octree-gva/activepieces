import {
  createTrigger,
  TriggerStrategy,
  AppConnectionValueForAuthProperty,
} from '@activepieces/pieces-framework';
import { DedupeStrategy, Polling, pollingHelper } from '@activepieces/pieces-common';
import { stateStoreAuth } from '../../stateStoreAuth';
import { redisConnect } from '../utils/redis';
import {
  getEventsKey,
  parseConversationEvent,
  resolvePropString,
  shouldEmitConversationEvent,
} from '../utils/validation';
import { ConversationEvent } from '../../types';
import { stateDropdownProp } from '../common/state-dropdown';
import { conversationChangedTriggerOutputSchema } from '../output-schemas';

type TriggerProps = {
  state_filter?: unknown;
};

const polling: Polling<
  AppConnectionValueForAuthProperty<typeof stateStoreAuth>,
  TriggerProps
> = {
  strategy: DedupeStrategy.LAST_ITEM,
  items: async ({ auth, lastItemId, propsValue }) => {
    const { namespace } = auth.props;
    const client = await redisConnect(auth);
    const eventsKey = getEventsKey(namespace);
    const stateFilter = resolvePropString(propsValue.state_filter);

    try {
      const streamId =
        typeof lastItemId === 'string' && lastItemId.length > 0 ? lastItemId : '0';
      const messages = await client.xread(
        'COUNT',
        100,
        'BLOCK',
        1,
        'STREAMS',
        eventsKey,
        streamId
      );

      if (!messages || messages.length === 0) {
        return [];
      }

      const items: Array<{ id: string; data: ConversationEvent }> = [];

      for (const [, entries] of messages) {
        for (const [id, fields] of entries) {
          const payloadIndex = fields.indexOf('payload');
          const payloadRaw = payloadIndex >= 0 ? fields[payloadIndex + 1] : undefined;
          const event = parseConversationEvent(payloadRaw);
          if (!event) {
            continue;
          }
          if (!shouldEmitConversationEvent({ event, stateFilter })) {
            continue;
          }
          items.push({
            id,
            data: event,
          });
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
  displayName: 'On State Changed',
  description:
    'Fires when an FSM instance changes state or data in this namespace.',
  classification: 'READ',
  aiMetadata: {
    description:
      'Polling trigger for FSM state-change events in the connection namespace. Optional state filter keeps only events whose new state matches.',
  },
  outputSchema: conversationChangedTriggerOutputSchema,
  props: {
    state_filter: stateDropdownProp({
      required: false,
      displayName: 'State Filter',
      description: 'If set, only events whose new state matches.',
    }),
  },
  sampleData: {
    namespace: 'orders',
    conversation_id: 'user-123',
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
    await pollingHelper.onEnable(polling, context);
  },
  async onDisable(context) {
    await pollingHelper.onDisable(polling, context);
  },
  async run(context) {
    return await pollingHelper.poll(polling, context);
  },
});
