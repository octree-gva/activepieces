import { createAction, Property } from '@activepieces/pieces-framework';
import { stateStoreAuth } from '../../stateStoreAuth';
import { conversationIdProp } from '../../props';
import { redisConnect } from '../utils/redis';
import { Conversation, ConversationEvent, UNKNOWN_STATE } from '../../types';
import {
  conversationPayloadChanged,
  getAllowedNextStates,
  getConversationKey,
  getEventsKey,
  getFsmFromAuth,
  mergeConversationData,
  parseConversation,
  resolvePropString,
  validateTransition,
} from '../utils/validation';
import { stateDropdownProp } from '../common/state-dropdown';
import { setConversationActionOutputSchema } from '../output-schemas';

export const setConversationAction = createAction({
  name: 'set_conversation',
  displayName: 'Update State',
  description:
    'Move to a next state and/or merge data. Transitions are checked against the connection FSM unless Jump is on.',
  auth: stateStoreAuth,
  audience: 'both',
  classification: 'WRITE',
  aiMetadata: {
    description:
      'Updates an FSM instance by Conversation ID: optional next state (FSM-validated unless Jump), and merges data into the existing payload. Omit state to stay put and only patch data. Set Replace Data to wipe data instead of merging.',
    idempotent: true,
  },
  outputSchema: setConversationActionOutputSchema,
  props: {
    conversation_id: conversationIdProp,
    state: stateDropdownProp({
      required: false,
      displayName: 'State',
      description:
        'Next FSM state. Leave empty to stay and only update data.',
    }),
    data: Property.Json({
      displayName: 'Data',
      description: 'Payload stored on the current state. Merged by default.',
      required: false,
      defaultValue: {},
    }),
    replace_data: Property.Checkbox({
      displayName: 'Replace Data',
      description: 'Replace the payload instead of merging.',
      required: false,
      defaultValue: false,
    }),
    jump: Property.Checkbox({
      displayName: 'Jump, skip FSM',
      description: 'Do not check transitions. Use to force a state.',
      required: false,
      defaultValue: false,
    }),
  },
  async run(context) {
    const namespace = context.auth.props.namespace;
    const { conversation_id, data, replace_data, jump } = context.propsValue;
    const state = resolvePropString(context.propsValue.state);
    const client = await redisConnect(context.auth);

    try {
      const conversationKey = getConversationKey(namespace, conversation_id);
      const eventsKey = getEventsKey(namespace);
      const fsm = getFsmFromAuth(context.auth);

      const existingStr = await client.get(conversationKey);
      const previousConversation = parseConversation(existingStr);
      const currentConversation: Conversation = previousConversation ?? {
        state: fsm?.initial ?? UNKNOWN_STATE,
        data: {},
      };

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

      if (
        conversationPayloadChanged({
          previous: previousConversation,
          current: newConversation,
        })
      ) {
        const event: ConversationEvent = {
          namespace,
          conversation_id,
          previous: previousConversation,
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
      }

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
