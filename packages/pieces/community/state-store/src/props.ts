import { Property } from '@activepieces/pieces-framework';

export const redisUrlProp = Property.ShortText({
  displayName: 'Redis URL',
  description:
    'Redis connection URL (e.g., redis://default:redis_password@localhost:6379/1 or rediss://default:redis_password@localhost:6380/1 for SSL)',
  required: true,
});

export const redisUseSslProp = Property.Checkbox({
  displayName: 'Use SSL',
  description: 'Enable SSL/TLS connection',
  required: false,
  defaultValue: false,
});

export const namespaceProp = Property.ShortText({
  displayName: 'Namespace',
  description: 'Isolates FSM instances in Redis (e.g. `orders`).',
  required: true,
  defaultValue: `${process.env['AP_STATE_STORE_NAMESPACE'] || 'ap:default'}`,
});

export const conversationIdProp = Property.ShortText({
  displayName: 'Conversation ID',
  description: 'Stable id for one FSM instance in this namespace.',
  required: true,
});

export const fsmProp = Property.LongText({
  displayName: 'FSM',
  description:
    'Optional. `initial` plus `transitions`. Empty means any state is allowed.',
  required: false,
  defaultValue: JSON.stringify({
    initial: 'START',
    transitions: {
      START: ['PROPOSE'],
      PROPOSE: ['PROPOSE_SUBMIT', 'START'],
      PROPOSE_SUBMIT: ['START'],
    },
  }),
});

export const bridgeUrlProp = Property.ShortText({
  displayName: 'Watcher URL',
  description:
    'HTTP URL of the Redis watcher used by On State Changed (Webhook).',
  required: false,
  defaultValue: 'http://127.0.0.1:3847',
});
