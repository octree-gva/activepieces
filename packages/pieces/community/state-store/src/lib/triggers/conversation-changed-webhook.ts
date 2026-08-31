import { createTrigger, TriggerStrategy, Property } from '@activepieces/pieces-framework';
import { parseConversationEvent } from '../utils/validation';
import { conversationChangedTriggerOutputSchema } from '../output-schemas';

export const conversationChangedWebhookTrigger = createTrigger({
  name: 'conversation_changed_webhook',
  auth: undefined,
  displayName: 'On Conversation Changed (Webhook)',
  description:
    'Advanced real-time trigger. Run the Redis bridge script to forward stream events to this webhook. Prefer WhatsApp inbound for the bot loop.',
  classification: 'READ',
  aiMetadata: {
    description:
      'Webhook trigger for conversation change events forwarded by the Redis bridge. Advanced setup; not required for the standard WhatsApp message loop.',
  },
  outputSchema: conversationChangedTriggerOutputSchema,
  props: {
    setupInstructions: Property.MarkDown({
      value: `
## Advanced: Redis Bridge

This trigger receives events when a bridge subscribes to the Redis stream and POSTs here. Most chatbots should use a WhatsApp (or channel) trigger plus Get/Update Conversation instead.

**Webhook URL:** \`{{webhookUrl}}\`

**1. Enable this trigger** and copy the webhook URL above.

**2. To return a success body** (instead of \`{}\`): add a Webhook step with "Return Response", set body to \`{"received": true}\`, and use \`{{webhookUrl}}/sync\` in the bridge.

**3. Run the bridge** (from state-store package directory):

\`\`\`bash
cd packages/pieces/community/state-store
npx ts-node bin/redis-webhook-bridge.ts \\
  --webhook-url "{{webhookUrl}}/sync" \\
  --redis-url "redis://redis:6379" \\
  --namespace "bot:proposal"
\`\`\`

Use the same Redis your Activepieces instance uses (see docker-compose Redis service). Keep the bridge running as a separate process if you need this path.
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
