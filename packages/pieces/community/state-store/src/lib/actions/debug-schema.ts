import {
  ActionContext,
  createAction,
  PieceAuthProperty,
  Property,
} from '@activepieces/pieces-framework';
import { stateStoreAuth } from '../..';
import { redisConnect } from '../common/redis';
import { SchemaBundle } from '../common/types';
import { getSchemaKey, getEventsKey } from '../common/validation';

export const debugSchemaAction = createAction({
  name: 'debug_schema',
  displayName: 'Debug Schema Bundle',
  description: 'Return schema bundle content and recent events for debugging',
  auth: stateStoreAuth,
  props: {
    namespace: Property.ShortText({
      displayName: 'Namespace',
      description: 'Namespace to debug',
      required: true,
    }),
    event_count: Property.Number({
      displayName: 'Event Count',
      description: 'Number of recent events to return (default: 10)',
      required: false,
      defaultValue: 10,
    }),
  },
  async run(context) {
    const { namespace, event_count } = context.propsValue;
    const client = await redisConnect(context.auth);
    
    try {
      const schemaKey = getSchemaKey(namespace);
      const eventsKey = getEventsKey(namespace);

      // Load schema bundle
      let schema: SchemaBundle | null = null;
      const schemaStr = await client.get(schemaKey);
      if (schemaStr) {
        try {
          schema = JSON.parse(schemaStr);
        } catch (error) {
          // Invalid JSON
        }
      }

      // Load recent events
      const eventCount = event_count || 10;
      const events = await client.xrevrange(eventsKey, '+', '-', 'COUNT', eventCount);

      const parsedEvents = events.map(([id, fields]) => {
        const payloadField = fields.find(([key]) => key === 'payload');
        if (payloadField) {
          try {
            return {
              id,
              ...JSON.parse(payloadField[1] as string),
            };
          } catch (error) {
            return {
              id,
              raw: payloadField[1],
            };
          }
        }
        return { id, fields };
      });

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
