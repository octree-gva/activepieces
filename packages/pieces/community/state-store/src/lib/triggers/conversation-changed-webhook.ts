import {
  createTrigger,
  TriggerStrategy,
  Property,
  MarkdownVariant,
  InputPropertyMap,
} from '@activepieces/pieces-framework';
import { httpClient, HttpMethod } from '@activepieces/pieces-common';
import { stateStoreAuth } from '../../stateStoreAuth';
import { bridgeUrl } from '../common/bridge-url';
import { stateDropdownProp } from '../common/state-dropdown';
import {
  parseConversationEvent,
  resolvePropString,
  shouldEmitConversationEvent,
} from '../utils/validation';
import { conversationChangedTriggerOutputSchema } from '../output-schemas';

const SUBSCRIBER_STORE_KEY = 'subscriberId';

export const conversationChangedWebhookTrigger = createTrigger({
  name: 'conversation_changed_webhook',
  auth: stateStoreAuth,
  displayName: 'On State Changed (Webhook)',
  description: 'Fires when a conversation enters the selected state (Redis watcher).',
  classification: 'READ',
  aiMetadata: {
    description:
      'Webhook trigger for FSM enter-state events delivered by the Redis watcher. Requires a State Filter. Enable the flow to HTTP-subscribe.',
  },
  outputSchema: conversationChangedTriggerOutputSchema,
  props: {
    setupInstructions: Property.MarkDown({
      value:
        'Enabling this flow registers it with the Redis watcher for the connection namespace and required State Filter (enter that state only).',
    }),
    watcherStatus: Property.DynamicProperties({
      displayName: 'Watcher status',
      description: 'Live status of the Redis watcher for this connection.',
      required: false,
      auth: stateStoreAuth,
      refreshers: [],
      props: async ({ auth }): Promise<InputPropertyMap> => {
        const url = bridgeUrl.resolve({ auth });
        const healthy = await bridgeUrl.isHealthy({ url });
        if (healthy) {
          return {
            status: Property.MarkDown({
              variant: MarkdownVariant.INFO,
              value: `Watcher is running at \`${url}\`.`,
            }),
          };
        }
        return {
          status: Property.MarkDown({
            variant: MarkdownVariant.WARNING,
            value: `
Watcher is not reachable at \`${url}\`.

Run the watcher locally:

\`\`\`bash
cd packages/pieces/community/state-store
AP_REDIS_URL="redis://localhost:6379" npm run bridge
\`\`\`

Then enable this flow. Set **Watcher URL** on the connection if the watcher listens elsewhere.
            `.trim(),
          }),
        };
      },
    }),
    state_filter: stateDropdownProp({
      required: true,
      displayName: 'State Filter',
      description: 'Required. Fires only when a conversation enters this state.',
    }),
  },
  type: TriggerStrategy.WEBHOOK,
  sampleData: {
    namespace: 'orders',
    conversation_id: 'user-123',
    previous: { state: 'PROPOSE', data: {} },
    current: { state: 'PROPOSE_TITLE', data: { title: 'Example proposal' } },
    at: '2026-01-24T12:00:00Z',
  },
  async onEnable(context) {
    const namespace = context.auth.props.namespace;
    const stateFilter = resolvePropString(context.propsValue.state_filter);
    if (!stateFilter || stateFilter.trim() === '') {
      throw new Error('State Filter is required to register the webhook trigger');
    }
    const resolvedBridgeUrl = bridgeUrl.resolve({ auth: context.auth });
    const response = await httpClient.sendRequest<{ id: string }>({
      method: HttpMethod.POST,
      url: `${resolvedBridgeUrl}/subscribers`,
      body: {
        url: context.webhookUrl,
        namespace,
        stateFilter,
      },
    });
    await context.store.put(SUBSCRIBER_STORE_KEY, response.body.id);
  },
  async onDisable(context) {
    const resolvedBridgeUrl = bridgeUrl.resolve({ auth: context.auth });
    const subscriberId = await context.store.get<string>(SUBSCRIBER_STORE_KEY);
    if (subscriberId) {
      await httpClient.sendRequest({
        method: HttpMethod.DELETE,
        url: `${resolvedBridgeUrl}/subscribers/${encodeURIComponent(subscriberId)}`,
      });
    }
    await httpClient.sendRequest({
      method: HttpMethod.DELETE,
      url: `${resolvedBridgeUrl}/subscribers?url=${encodeURIComponent(context.webhookUrl)}`,
    });
  },
  async run(context) {
    const event = parseConversationEvent(context.payload.body);
    if (!event) {
      return [];
    }
    const stateFilter = resolvePropString(context.propsValue.state_filter);
    if (!shouldEmitConversationEvent({ event, stateFilter })) {
      return [];
    }
    return [event];
  },
});
