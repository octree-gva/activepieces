import { PieceAuth, Property } from '@activepieces/pieces-framework';
import {
  redisUrlProp,
  redisUseSslProp,
  fsmProp,
  bridgeUrlProp,
} from './props';
import { createRedisClient } from './lib/utils/redis';
import { validateFsm } from './lib/utils/validation';

export const stateStoreAuth = PieceAuth.CustomAuth({
  displayName: 'State Store Connection',
  description: 'Redis, namespace, optional FSM, and watcher URL.',
  required: true,
  props: {
    url: redisUrlProp,
    useSsl: redisUseSslProp,
    namespace: Property.ShortText({
      displayName: 'Namespace',
      description: 'Isolates FSM instances in Redis (e.g. `orders`).',
      required: true,
    }),
    bridgeUrl: bridgeUrlProp,
    fsmHelp: Property.MarkDown({
      value: `
## FSM (Finite State Machine)

An [FSM](https://en.wikipedia.org/wiki/Finite-state_machine) is a model where an instance is in exactly one state at a time. Transitions between states are validated against your definition.

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

- \`initial\`: starting state for new instances
- \`transitions\`: map each state to an array of allowed next states. **Update State** validates transitions unless **Jump, skip FSM** is on.
- Same-state updates always succeed so you can merge data without leaving the state.
- Conversation ID is the stable key for one FSM instance. No history / go-back.
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
    if (!namespace) {
      return { valid: false, error: 'Namespace is required' };
    }
    const fsmRaw =
      typeof fsm === 'string' ? fsm.trim() : fsm == null ? '' : fsm;
    if (fsmRaw !== '' && fsmRaw != null) {
      let fsmJson: unknown;
      try {
        fsmJson = typeof fsmRaw === 'string' ? JSON.parse(fsmRaw) : fsmRaw;
      } catch {
        return { valid: false, error: 'Invalid FSM JSON' };
      }
      if (!fsmJson || typeof fsmJson !== 'object') {
        return { valid: false, error: 'Invalid FSM JSON' };
      }
      const fsmResult = validateFsm(fsmJson);
      if (!fsmResult.valid) {
        return { valid: false, error: fsmResult.error ?? 'Invalid FSM' };
      }
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
