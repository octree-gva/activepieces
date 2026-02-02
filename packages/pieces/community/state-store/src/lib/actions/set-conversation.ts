import {
  ActionContext,
  createAction,
  PieceAuthProperty,
  Property,
} from '@activepieces/pieces-framework';
import { stateStoreAuth } from '../..';
import { redisConnect } from '../common/redis';
import { Conversation, SchemaBundle, ConversationEvent } from '../common/types';
import {
  getSchemaKey,
  getConversationKey,
  getEventsKey,
  validateTransition,
  validateData,
} from '../common/validation';

export const setConversationAction = createAction({
  name: 'set_conversation',
  displayName: 'Set Conversation',
  description: 'Update conversation state with validation and emit event',
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
    state: Property.ShortText({
      displayName: 'State',
      description: 'New state to transition to',
      required: true,
    }),
    data: Property.Json({
      displayName: 'Data',
      description: 'Data object for the conversation state',
      required: false,
      defaultValue: {},
    }),
  },
  async run(context) {
    const { namespace, conversation_id, state, data } = context.propsValue;
    const client = await redisConnect(context.auth);
    
    try {
      const conversationKey = getConversationKey(namespace, conversation_id);
      const schemaKey = getSchemaKey(namespace);
      const eventsKey = getEventsKey(namespace);

      // Load current conversation
      let currentConversation: Conversation | null = null;
      const existingStr = await client.get(conversationKey);
      
      if (existingStr) {
        currentConversation = JSON.parse(existingStr);
      } else {
        // Try to get initial state from schema
        const schemaStr = await client.get(schemaKey);
        if (schemaStr) {
          try {
            const schema: SchemaBundle = JSON.parse(schemaStr);
            if (schema.fsm?.initial) {
              currentConversation = {
                state: schema.fsm.initial,
                data: {},
              };
            }
          } catch (error) {
            // Schema invalid, treat as unknown
          }
        }
        
        if (!currentConversation) {
          currentConversation = {
            state: 'unknown',
            data: {},
          };
        }
      }

      // Load schema bundle
      let schema: SchemaBundle | undefined;
      const schemaStr = await client.get(schemaKey);
      if (schemaStr) {
        try {
          schema = JSON.parse(schemaStr);
        } catch (error) {
          // Invalid schema, continue without validation
        }
      }

      // Validate transition
      if (schema?.fsm && currentConversation) {
        const transitionResult = validateTransition(
          currentConversation.state,
          state,
          schema.fsm
        );
        
        if (!transitionResult.valid) {
          return {
            ok: false,
            error: {
              code: 'INVALID_TRANSITION',
              message: transitionResult.error || 'Invalid transition',
            },
          };
        }
      }

      // Prepare new conversation
      const newData = data && typeof data === 'object' && !Array.isArray(data) 
        ? data as Record<string, unknown>
        : {};
      
      const newConversation: Conversation = {
        state,
        data: newData,
      };

      // Validate data with JSON Schema
      if (schema?.json_schema) {
        const validationResult = validateData(state, newData, schema.json_schema);
        
        if (!validationResult.valid) {
          return {
            ok: false,
            error: {
              code: 'INVALID_DATA',
              message: validationResult.error || 'Data validation failed',
            },
          };
        }
      }

      // Write conversation (full replace)
      await client.set(conversationKey, JSON.stringify(newConversation));

      // Emit event to Redis Streams
      const event: ConversationEvent = {
        namespace,
        conversation_id,
        previous: currentConversation,
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
        conversation: newConversation,
      };
    } catch (error) {
      throw new Error(`Redis operation failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      await client.quit();
    }
  },
});
