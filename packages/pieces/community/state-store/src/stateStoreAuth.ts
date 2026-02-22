import { PieceAuth, Property } from '@activepieces/pieces-framework';
import { redisUrlProp, redisUseSslProp, fsmProp } from './props';
import { createRedisClient } from './lib/utils/redis';
import { validateFsm } from './lib/utils/validation';

export const stateStoreAuth = PieceAuth.CustomAuth({
  displayName: 'Redis Connection',
  description: 'Configure Redis connection and state machine (FSM)',
  required: true,
  props: {
    url: redisUrlProp,
    useSsl: redisUseSslProp,
    namespace: Property.ShortText({
      displayName: 'Namespace',
      description: 'Namespace (e.g., "bot:proposal")',
      required: true,
    }),
    fsmHelp: Property.MarkDown({
      value: `
## FSM (Finite State Machine)

An [FSM](https://en.wikipedia.org/wiki/Finite-state_machine) is a model where a conversation is in exactly one state at a time. Transitions between states are validated against your definition.

**JSON format:**
\`\`\`json
{
  "initial": "START",
  "transitions": {
    "START": ["PROPOSE"],
    "PROPOSE": ["PROPOSE_SUBMIT", "START"],
    "PROPOSE_SUBMIT": ["START"]
  }
}
\`\`\`

- \`initial\`: starting state for new conversations
- \`transitions\`: map each state to an array of allowed next states. \`Set Conversation\` validates transitions before applying.
      `.trim(),
    }),
    fsm: fsmProp,
  },
  validate: async ({ auth }) => {
    const url = auth['url'];
    const fsm = auth['fsm'];
    const useSsl = !!auth['useSsl'];
    const namespace = auth['namespace'];
    if (!url) {
      return { valid: false, error: 'Redis URL is required' };
    }
    if (!fsm) {
      return { valid: false, error: 'FSM is required' };
    }
    if (!namespace) {
      return { valid: false, error: 'Namespace is required' };
    }
    const fsmJson = JSON.parse(fsm as string) as unknown;
    if (!fsmJson || typeof fsmJson !== 'object') {
      return { valid: false, error: 'Invalid FSM JSON' };
    }
    const fsmResult = validateFsm(fsmJson);
    if (!fsmResult.valid) {
      return { valid: false, error: fsmResult.error ?? 'Invalid FSM' };
    }
    try {
      const client = await createRedisClient(url, useSsl);
      await client.quit();
      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        error: `Failed to connect to Redis: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  },
});
