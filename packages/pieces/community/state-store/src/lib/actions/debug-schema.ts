import { createAction, Property } from '@activepieces/pieces-framework';
import { stateStoreAuth } from '../../stateStoreAuth';
import { redisConnect } from '../utils/redis';
import { getEventsKey, getFsmFromAuth } from '../utils/validation';

export const debugSchemaAction = createAction({
  name: 'debug_schema',
  displayName: 'Inspect State Configuration',
  description: 'View the configured state machine schema and recent conversation events for troubleshooting',
  auth: stateStoreAuth,
  props: {
    event_count: Property.Number({
      displayName: 'Event Count',
      description: 'Number of recent events to return (default: 10)',
      required: false,
      defaultValue: 10,
    }),
    conversation_id: Property.ShortText({
      displayName: 'Conversation ID',
      description: 'If set, only return events for this conversation',
      required: false,
    }),
  },
  async run(context) {
    const namespace = context.auth.props.namespace;
    const { event_count } = context.propsValue;
    const client = await redisConnect(context.auth);
    const schema = { fsm: getFsmFromAuth(context.auth) };

    try {
      const eventsKey = getEventsKey(namespace);

      const eventCount = event_count || 10;
      const conversation_id = context.propsValue.conversation_id;
      const fetchCount = conversation_id ? 500 : eventCount;
      const events = await client.xrevrange(eventsKey, '+', '-', 'COUNT', fetchCount);

      let parsedEvents = events.map(([id, fields]) => ({ id, ...JSON.parse(fields[1] as string) ?? {} }));
      if (conversation_id) {
        parsedEvents = parsedEvents
          .filter((e) => (e as { conversation_id?: string }).conversation_id === conversation_id)
          .slice(0, eventCount);
      }

      return {
        ok: true,
        namespace,
        schema,
        events: parsedEvents,
        event_count: parsedEvents.length,
      };
    } catch (error) {
      throw new Error(`Redis operation failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      await client.quit();
    }
  },
});
