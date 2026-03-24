import { createTrigger, TriggerStrategy, Property } from '@activepieces/pieces-framework';

export const meetingsReminder = createTrigger({
  name: 'meetingsReminder',
  displayName: 'Meetings Reminder',
  description:
    'Receive meeting reminder payloads when your Decidim instance POSTs to this flow’s webhook URL (configure the route in Decidim or your reverse proxy).',
  props: {
    setup: Property.MarkDown({
      value: `
### Meetings reminder webhook

This piece does **not** register webhooks in Decidim automatically.

1. **Enable this trigger** and copy the **Webhook URL** shown for this step.
2. In Decidim (or your integration layer), configure that URL to receive reminder payloads when reminders fire.
3. If your platform does not support outbound webhooks for reminders yet, use a **schedule + HTTP** flow instead.

No error is raised when you enable the trigger; it only forwards incoming HTTP bodies to the next steps.
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
    const body = (context.payload?.body ?? {}) as Record<string, unknown>;
    return [{ ...body }];
  },
});
