import { createAction, Property } from '@activepieces/pieces-framework';
import { stateStoreAuth } from '../../stateStoreAuth';
import { conversationIdProp } from '../../props';
import { redisConnect } from '../utils/redis';
import { Conversation, ConversationEvent, UNKNOWN_STATE } from '../../types';
import { getConversationKey, getEventsKey, validateTransition, getFsmFromAuth } from '../utils/validation';
import { jsonStringify, parseJsonSafely } from '../utils/json';

export const setConversationAction = createAction({
  name: 'set_conversation',
  displayName: 'Update Conversation State',
  description: 'Transition a conversation to a new state. Validates state transitions (FSM), then emits an event.',
  auth: stateStoreAuth,
  props: {
    conversation_id: conversationIdProp,
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
    const namespace = context.auth.props.namespace;
    const { conversation_id, state, data } = context.propsValue;
    const client = await redisConnect(context.auth);

    try {
      const conversationKey = getConversationKey(namespace, conversation_id);
      const eventsKey = getEventsKey(namespace);
      const fsm = getFsmFromAuth(context.auth);

      // Load current conversation
      const existingStr = await client.get(conversationKey);
      let currentConversation: Conversation | null = parseJsonSafely<Conversation>(existingStr);

      if (!currentConversation) {
        currentConversation = {
          state: fsm?.initial ?? UNKNOWN_STATE,
          data: {},
        };
      }

      // Validate transition
      if (fsm && currentConversation) {
        const transitionResult = validateTransition(
          currentConversation.state,
          state,
          fsm
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

      // Write conversation (full replace)
      await client.set(conversationKey, await jsonStringify(newConversation));

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
        await jsonStringify(event),
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
