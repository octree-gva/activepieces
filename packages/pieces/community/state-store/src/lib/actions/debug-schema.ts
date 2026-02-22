import { createAction, Property } from '@activepieces/pieces-framework';
import { stateStoreAuth } from '../../stateStoreAuth';
import { redisConnect } from '../utils/redis';
import { getEventsKey, getFsmFromAuth } from '../utils/validation';
import { jsonParse } from '../utils/json';

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
  },
  async run(context) {
    const namespace = context.auth.props.namespace;
    const { event_count } = context.propsValue;
    const client = await redisConnect(context.auth);
    const schema = { fsm: getFsmFromAuth(context.auth) };

    try {
      const eventsKey = getEventsKey(namespace);

      // Load recent events
      const eventCount = event_count || 10;
      const events = await client.xrevrange(eventsKey, '+', '-', 'COUNT', eventCount);

      const parsedEvents = await Promise.all(events.map(async ([id, fields]) => {
        const payloadField = fields.find(([key]) => key === 'payload');
        if (payloadField) {
          try {
            const parsed = await jsonParse<Record<string, unknown>>(payloadField[1] as string);
            return { id, ...parsed };
          } catch (error) {
            return {
              id,
              raw: payloadField[1],
            };
          }
        }
        return { id, fields };
      }));

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
