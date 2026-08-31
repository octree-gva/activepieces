import { createAction, Property } from '@activepieces/pieces-framework';
import { stateStoreAuth } from '../../stateStoreAuth';
import { conversationIdProp } from '../../props';
import { redisConnect } from '../utils/redis';
import { Conversation, ConversationEvent, UNKNOWN_STATE } from '../../types';
import {
  getAllowedNextStates,
  getConversationKey,
  getEventsKey,
  getFsmFromAuth,
  mergeConversationData,
  parseConversation,
  validateTransition,
} from '../utils/validation';
import { stateDropdownProp } from '../common/state-dropdown';
import { setConversationActionOutputSchema } from '../output-schemas';

export const setConversationAction = createAction({
  name: 'set_conversation',
  displayName: 'Update Conversation',
  description:
    'Advance or jump a user conversation to a state and merge session data. Normal updates validate the FSM; turn on Jump to skip the FSM for intercepts.',
  auth: stateStoreAuth,
  audience: 'both',
  classification: 'WRITE',
  aiMetadata: {
    description:
      'Updates the conversation for a user id: optional next state (FSM-validated unless Jump), and merges data into the existing session object. Use Jump for intercepts that must leave the FSM. Omit state to stay put and only patch data. Set Replace Data to wipe session data instead of merging.',
    idempotent: true,
  },
  outputSchema: setConversationActionOutputSchema,
  props: {
    conversation_id: conversationIdProp,
    state: stateDropdownProp({
      required: false,
      displayName: 'State',
      description:
        'Next state. Leave empty to stay in the current state and only update data. Pick from the connection FSM.',
    }),
    data: Property.Json({
      displayName: 'Data',
      description: 'Session data to merge into the conversation (default) or replace when Replace Data is on.',
      required: false,
      defaultValue: {},
    }),
    replace_data: Property.Checkbox({
      displayName: 'Replace Data',
      description: 'When on, replace session data with Data instead of merging.',
      required: false,
      defaultValue: false,
    }),
    jump: Property.Checkbox({
      displayName: 'Jump, skip FSM',
      description: 'When on, move to State without checking the FSM (use for intercepts / special messages).',
      required: false,
      defaultValue: false,
    }),
  },
  async run(context) {
    const namespace = context.auth.props.namespace;
    const { conversation_id, state, data, replace_data, jump } = context.propsValue;
    const client = await redisConnect(context.auth);

    try {
      const conversationKey = getConversationKey(namespace, conversation_id);
      const eventsKey = getEventsKey(namespace);
      const fsm = getFsmFromAuth(context.auth);

      const existingStr = await client.get(conversationKey);
      let currentConversation = parseConversation(existingStr);

      if (!currentConversation) {
        currentConversation = {
          state: fsm?.initial ?? UNKNOWN_STATE,
          data: {},
        };
      }

      const nextState = state && state.length > 0 ? state : currentConversation.state;

      if (!jump) {
        const transitionResult = validateTransition(
          currentConversation.state,
          nextState,
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

      const newConversation: Conversation = {
        state: nextState,
        data: mergeConversationData(
          currentConversation.data,
          data,
          !!replace_data
        ),
      };

      await client.set(conversationKey, JSON.stringify(newConversation));

      const event: ConversationEvent = {
        namespace,
        conversation_id,
        previous: currentConversation,
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
