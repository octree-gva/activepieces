import {
  ActionContext,
  createAction,
  PieceAuthProperty,
  Property,
} from '@activepieces/pieces-framework';
import { stateStoreAuth } from '../..';
import { redisConnect } from '../common/redis';
import { Conversation, SchemaBundle, ConversationEvent } from '../common/types';
import { getSchemaKey, getConversationKey, getEventsKey } from '../common/validation';

export const getConversationAction = createAction({
  name: 'get_conversation',
  displayName: 'Get Conversation',
  description: 'Fetch conversation state; if missing, create it with initial state',
  auth: stateStoreAuth,
  props: {
    namespace: Property.ShortText({
      displayName: 'Namespace',
      description: 'Namespace for the conversation',
      required: true,
    }),
    conversation_id: Property.ShortText({
      displayName: 'Conversation ID',
      description: 'Unique identifier for the conversation',
      required: true,
    }),
  },
  async run(context) {
    const { namespace, conversation_id } = context.propsValue;
    const client = await redisConnect(context.auth);

    try {
      const conversationKey = getConversationKey(namespace, conversation_id);

      // Try to get existing conversation
      const existing = await client.get(conversationKey);

      if (existing) {
        const conversation: Conversation = JSON.parse(existing);
        return {
          ok: true,
          created: false,
          conversation,
        };
      }

      // Conversation doesn't exist, create it
      let initialState = 'unknown';
      let initialData: Record<string, unknown> = {};

      // Try to load schema to get initial state
      const schemaKey = getSchemaKey(namespace);
      const schemaStr = await client.get(schemaKey);

      if (schemaStr) {
        try {
          const schema: SchemaBundle = JSON.parse(schemaStr);
          if (schema.fsm?.initial) {
            initialState = schema.fsm.initial;
          }
        } catch (error) {
          // Schema exists but invalid JSON, use default
        }
      }

      const newConversation: Conversation = {
        state: initialState,
        data: initialData,
      };

      // Use SET with NX to ensure atomicity
      const setResult = await client.set(conversationKey, JSON.stringify(newConversation), 'NX');

      if (setResult === 'OK') {
        // Successfully created - emit event
        const eventsKey = getEventsKey(namespace);
        const event: ConversationEvent = {
          namespace,
          conversation_id,
          previous: null,
          current: newConversation,
          at: new Date().toISOString(),
        };

        await client.xadd(
          eventsKey,
          '*',
          'payload',
          JSON.stringify(event),
          'MAXLEN',
          '~',
          '10000'
        );

        return {
          ok: true,
          created: true,
          conversation: newConversation,
        };
      } else {
        // Another process created it, re-read
        const existingAfter = await client.get(conversationKey);
        if (existingAfter) {
          const conversation: Conversation = JSON.parse(existingAfter);
          return {
            ok: true,
            created: false,
            conversation,
          };
        }
        // Should not happen, but handle it
        return {
          ok: true,
          created: true,
          conversation: newConversation,
        };
      }
    } catch (error) {
      throw new Error(`Redis operation failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      await client.quit();
    }
  },
});
