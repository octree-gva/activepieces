import { createTrigger, TriggerStrategy } from '@activepieces/pieces-framework';

const UNSUPPORTED_MESSAGE =
  'Meetings reminder auto-subscription is not supported by this Decidim piece yet. Use a platform webhook trigger or polling flow until meeting webhook endpoints are available.';

export const meetingsReminder = createTrigger({
  name: 'meetingsReminder',
  displayName: 'Meetings Reminder',
  description: 'Trigger when a reminder of meetings is triggered',
  props: {},
  sampleData: {},
  type: TriggerStrategy.WEBHOOK,
  async onEnable() {
    throw new Error(UNSUPPORTED_MESSAGE);
  },
  async onDisable() {
    return;
  },
  async run(context) {
    const body = (context.payload?.body ?? {}) as Record<string, unknown>;
    return [{ ...body }];
  },
});