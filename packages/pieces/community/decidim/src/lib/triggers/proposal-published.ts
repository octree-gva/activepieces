import { createTrigger, TriggerStrategy, Property } from '@activepieces/pieces-framework';

export const proposalPublished = createTrigger({
  name: 'proposalPublished',
  displayName: 'Proposal Published',
  description:
    'Runs when Decidim (or a middleware) POSTs proposal-published event data to this flow’s webhook URL.',
  props: {
    setup: Property.MarkDown({
      value: `
### Proposal published webhook

This piece does **not** create webhooks inside Decidim for you.

1. **Enable this trigger** and copy the **Webhook URL** (\`{{webhookUrl}}\` in test mode).
2. In the Decidim admin or your API gateway, register that URL for **proposal published** (or equivalent) notifications, if your deployment supports it.
3. Each request body is passed through to the next step as the trigger output.

If automatic registration is unavailable, forward events from your own service or use polling flows where the API allows it.
      `.trim(),
    }),
  },
  sampleData: {},
  type: TriggerStrategy.WEBHOOK,
  async onEnable() {
    return;
  },
  async onDisable() {
    return;
  },
  async run(context) {
    return [context.payload.body];
  },
});
