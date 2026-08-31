import { Property } from '@activepieces/pieces-framework';

export const redisUrlProp = Property.ShortText({
  displayName: 'Redis URL',
  description: 'Redis connection URL (e.g., redis://default:redis_password@localhost:6379/1 or rediss://default:redis_password@localhost:6380/1 for SSL)',
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
  description: 'Namespace (e.g., "bot:proposal")',
  required: true,
  defaultValue: `${process.env['AP_STATE_STORE_NAMESPACE'] || 'ap:default'}`,
});

export const conversationIdProp = Property.ShortText({
  displayName: 'User ID',
  description: 'Stable user key for this conversation, e.g. the WhatsApp sender id (whatsapp:+351912345678). One conversation per user in this connection namespace.',
  required: true,
});

export const fsmProp = Property.LongText({
  displayName: 'FSM',
  description: 'Finite State Machine definition with initial state and transitions',
  required: true,
  defaultValue: JSON.stringify({
    initial: 'START',
    transitions: {
      START: ['PROPOSE'],
      PROPOSE: ['PROPOSE_SUBMIT', 'START'],
      PROPOSE_SUBMIT: ['START'],
    },
  }),
});
