import { createTrigger, TriggerStrategy, Property } from '@activepieces/pieces-framework';
import { httpClient, HttpMethod } from '@activepieces/pieces-common';
import { stateStoreAuth } from '../../stateStoreAuth';
import { getBridgeUrl } from '../common/bridge-url';
import { stateDropdownProp } from '../common/state-dropdown';
import { parseConversationEvent } from '../utils/validation';
import { conversationChangedTriggerOutputSchema } from '../output-schemas';

const SUBSCRIBER_STORE_KEY = 'subscriberId';

export const conversationChangedWebhookTrigger = createTrigger({
  name: 'conversation_changed_webhook',
  auth: stateStoreAuth,
  displayName: 'On Conversation Changed (Webhook)',
  description:
    'Real-time trigger when conversation state changes. Registers with the Redis watcher on enable. Prefer WhatsApp inbound for the main bot loop.',
  classification: 'READ',
  aiMetadata: {
    description:
      'Webhook trigger for conversation change events delivered by the Redis watcher. Enable the flow to HTTP-subscribe; optional state filter limits which new states fire.',
  },
  outputSchema: conversationChangedTriggerOutputSchema,
  props: {
    state_filter: stateDropdownProp({
      required: false,
      displayName: 'State Filter',
      description: 'If set, only emit events whose new (current) state matches this value.',
    }),
    setupInstructions: Property.MarkDown({
      value: `
## Redis watcher (one per deployment)

This trigger uses the standard webhook pattern: on enable it HTTP-subscribes \`{{webhookUrl}}\` with the connection namespace (and optional state filter). The **Redis watcher** forwards stream events to matching flows.

**Webhook URL:** \`{{webhookUrl}}\`

**1. Run the watcher** — Octree Docker starts it via PM2 (\`activepieces-state-store-bridge\`). Locally:

\`\`\`bash
cd packages/pieces/community/state-store
AP_REDIS_URL="redis://redis:6379" npm run bridge
\`\`\`

**2. Configure the watcher URL** for \`onEnable\` (default \`http://127.0.0.1:3847\`):

- \`AP_STATE_STORE_BRIDGE_URL\` — where the piece POSTs subscribe/unsubscribe (default \`http://127.0.0.1:3847\`)
- \`AP_STATE_STORE_BRIDGE_PORT\` — watcher listen port (default \`3847\`)

**3. Enable this flow** — pick the State Store connection (same Redis as the watcher) and optional **State Filter**. No per-flow bridge command.

Use the same Redis as Activepieces (\`AP_REDIS_URL\` / docker-compose Redis). One watcher serves all flows and namespaces.
      `.trim(),
    }),
  },
  type: TriggerStrategy.WEBHOOK,
  sampleData: {
    namespace: 'bot:proposal',
    conversation_id: 'whatsapp:+351...',
    previous: { state: 'PROPOSE', data: {} },
    current: { state: 'PROPOSE_TITLE', data: { title: 'Example proposal' } },
    at: '2026-01-24T12:00:00Z',
  },
  async onEnable(context) {
    const namespace = context.auth.props.namespace;
    const stateFilter = context.propsValue.state_filter ?? null;
    const bridgeUrl = getBridgeUrl();
    const response = await httpClient.sendRequest<{ id: string }>({
      method: HttpMethod.POST,
      url: `${bridgeUrl}/subscribers`,
      body: {
        url: context.webhookUrl,
        namespace,
        stateFilter,
      },
    });
    await context.store.put(SUBSCRIBER_STORE_KEY, response.body.id);
  },
  async onDisable(context) {
    const subscriberId = await context.store.get<string>(SUBSCRIBER_STORE_KEY);
    if (!subscriberId) {
      return;
    }
    const bridgeUrl = getBridgeUrl();
    await httpClient.sendRequest({
      method: HttpMethod.DELETE,
      url: `${bridgeUrl}/subscribers/${encodeURIComponent(subscriberId)}`,
    });
  },
  async run(context) {
    const event = parseConversationEvent(context.payload.body);
    if (!event) {
      return [];
    }
    const stateFilter = context.propsValue.state_filter;
    if (stateFilter && event.current.state !== stateFilter) {
      return [];
    }
    return [event];
  },
});
