import { createTrigger, TriggerStrategy, Property } from '@activepieces/pieces-framework';
import { parseConversationEvent } from '../utils/validation';

/**
 * Webhook variant for real-time conversation events.
 * Requires running the Redis bridge script that subscribes to the stream and POSTs here.
 */
export const conversationChangedWebhookTrigger = createTrigger({
  name: 'conversation_changed_webhook',
  auth: undefined,
  displayName: 'On Conversation Changed (Webhook)',
  description: 'Real-time trigger. Run the Redis bridge script to forward events from the stream to this webhook.',
  props: {
    setupInstructions: Property.MarkDown({
      value: `
## Real-time via Redis Bridge

This trigger receives events when you run a bridge that subscribes to the Redis stream and forwards to this webhook.

**Webhook URL:** \`{{webhookUrl}}\`

**1. Enable this trigger** and copy the webhook URL above.

**2. To return a success body** (instead of \`{}\`): add a Webhook step with "Return Response", set body to \`{"received": true}\`, and use \`{{webhookUrl}}/sync\` in the bridge.

**3. Run the bridge** (from state-store package directory):

\`\`\`bash
cd packages/pieces/community/state-store
npx ts-node bin/redis-webhook-bridge.ts \\
  --webhook-url "{{webhookUrl}}/sync" \\
  --redis-url "redis://:password@localhost:6379/1" \\
  --namespace "bot:proposal"
\`\`\`

The bridge uses XREAD BLOCK to wait for new events and POSTs each to the webhook. Keep it running (e.g. in a separate process or systemd service).
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
  async onEnable() {},
  async onDisable() {},
  async run(context) {
    const event = parseConversationEvent(context.payload.body);
    return event ? [event] : [];
  },
});
