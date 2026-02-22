import { createAction } from '@activepieces/pieces-framework';
import { stateStoreAuth } from '../../stateStoreAuth';
import { conversationIdProp } from '../../props';
import { redisConnect } from '../utils/redis';
import { Conversation, ConversationEvent, UNKNOWN_STATE } from '../../types';
import { getConversationKey, getEventsKey, getFsmFromAuth } from '../utils/validation';

export const getConversationAction = createAction({
  name: 'get_conversation',
  displayName: 'Get Conversation State',
  description: 'Retrieve the current state and data for a conversation. Creates a new conversation with initial state if it does not exist.',
  auth: stateStoreAuth,
  props: {
    conversation_id: conversationIdProp,
  },
  async run(context) {
    const namespace = context.auth.props.namespace;
    const { conversation_id } = context.propsValue;
    const client = await redisConnect(context.auth);
    try {
      const conversationKey = getConversationKey(namespace, conversation_id);

      // Try to get existing conversation
      const existing = await client.get(conversationKey);

      if (existing) {
        const conversation = JSON.parse(existing as string) as Conversation;
        if (conversation) {
          return {
            ok: true,
            created: false,
            conversation,
          };
        }
      }

      // Conversation doesn't exist, create it
      let initialState = UNKNOWN_STATE;
      const fsm = getFsmFromAuth(context.auth);
      if (fsm?.initial) {
        initialState = fsm.initial;
      }

      const newConversation: Conversation = {
        state: initialState,
        data: {},
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
          'MAXLEN',
          '~',
          '10000',
          '*',
          'payload',
          JSON.stringify(event)
        );

        return {
          ok: true,
          created: true,
          conversation: newConversation,
        };
      } else {
        // Another process created it, re-read
        const existingAfter = await client.get(conversationKey);
        const conversation = JSON.parse(existingAfter as string) as Conversation;
        if (conversation) {
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
