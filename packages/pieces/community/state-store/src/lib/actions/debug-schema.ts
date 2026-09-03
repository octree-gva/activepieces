import { createAction, Property } from '@activepieces/pieces-framework';
import { stateStoreAuth } from '../../stateStoreAuth';
import { redisConnect } from '../utils/redis';
import { getEventsKey, getFsmFromAuth, parseConversationEvent } from '../utils/validation';
import { debugSchemaActionOutputSchema } from '../output-schemas';

export const debugSchemaAction = createAction({
  name: 'debug_schema',
  displayName: 'Inspect FSM',
  description: 'Show the connection FSM and recent state-change events.',
  auth: stateStoreAuth,
  audience: 'both',
  classification: 'READ',
  aiMetadata: {
    description:
      'Returns the connection FSM schema and recent state-change events from the Redis stream. Optional Conversation ID filters events for one FSM instance. Use when debugging transitions or monitoring activity.',
    idempotent: true,
  },
  outputSchema: debugSchemaActionOutputSchema,
  props: {
    event_count: Property.Number({
      displayName: 'Event Count',
      description: 'Number of recent events to return (default: 10)',
      required: false,
      defaultValue: 10,
    }),
    conversation_id: Property.ShortText({
      displayName: 'Conversation ID',
      description: 'If set, only return events for this FSM instance',
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

      const parsedEvents = [];
      for (const [id, fields] of events) {
        const payloadIndex = fields.indexOf('payload');
        const payloadRaw = payloadIndex >= 0 ? fields[payloadIndex + 1] : undefined;
        const event = parseConversationEvent(payloadRaw);
        if (!event) {
          continue;
        }
        if (conversation_id && event.conversation_id !== conversation_id) {
          continue;
        }
        parsedEvents.push({ id, ...event });
        if (parsedEvents.length >= eventCount) {
          break;
        }
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
