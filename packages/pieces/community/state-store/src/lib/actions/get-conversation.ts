import { createAction } from '@activepieces/pieces-framework';
import { stateStoreAuth } from '../../stateStoreAuth';
import { conversationIdProp } from '../../props';
import { redisConnect } from '../utils/redis';
import { Conversation, ConversationEvent, UNKNOWN_STATE } from '../../types';
import {
  getAllowedNextStates,
  getConversationKey,
  getEventsKey,
  getFsmFromAuth,
  parseConversation,
} from '../utils/validation';
import { getConversationActionOutputSchema } from '../output-schemas';

export const getConversationAction = createAction({
  name: 'get_conversation',
  displayName: 'Get or Create State',
  description:
    'Return the current state and data for a Conversation ID. Creates one at FSM `initial` (or `unknown` if no FSM).',
  auth: stateStoreAuth,
  audience: 'both',
  classification: 'WRITE',
  aiMetadata: {
    description:
      'Loads the FSM instance for a Conversation ID in the connection namespace, or creates one at the FSM initial state (or unknown when no FSM). Returns state/data, whether it was created, and allowed_next_states for routing.',
    idempotent: false,
  },
  outputSchema: getConversationActionOutputSchema,
  props: {
    conversation_id: conversationIdProp,
  },
  async run(context) {
    const namespace = context.auth.props.namespace;
    const { conversation_id } = context.propsValue;
    const client = await redisConnect(context.auth);
    const fsm = getFsmFromAuth(context.auth);
    try {
      const conversationKey = getConversationKey(namespace, conversation_id);

      const existing = await client.get(conversationKey);
      const existingConversation = parseConversation(existing);

      if (existingConversation) {
        return {
          ok: true,
          created: false,
          conversation: existingConversation,
          allowed_next_states: getAllowedNextStates(existingConversation.state, fsm),
        };
      }

      const initialState = fsm?.initial ?? UNKNOWN_STATE;
      const newConversation: Conversation = {
        state: initialState,
        data: {},
      };

      const setResult = await client.set(conversationKey, JSON.stringify(newConversation), 'NX');

      if (setResult === 'OK') {
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
          allowed_next_states: getAllowedNextStates(newConversation.state, fsm),
        };
      }

      const existingAfter = parseConversation(await client.get(conversationKey));
      if (existingAfter) {
        return {
          ok: true,
          created: false,
          conversation: existingAfter,
          allowed_next_states: getAllowedNextStates(existingAfter.state, fsm),
        };
      }

      return {
        ok: true,
        created: true,
        conversation: newConversation,
        allowed_next_states: getAllowedNextStates(newConversation.state, fsm),
      };
    } catch (error) {
      throw new Error(`Redis operation failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      await client.quit();
    }
  },
});
