import { OutputSchema } from '@activepieces/pieces-framework';

const conversationFields: OutputSchema['fields'] = [
  { key: 'state', label: 'State' },
  { key: 'data', label: 'Data', dynamicKey: true },
];

export const getConversationActionOutputSchema: OutputSchema = {
  fields: [
    { key: 'ok', label: 'OK', format: 'boolean' },
    { key: 'created', label: 'Created', format: 'boolean' },
    { key: 'conversation', label: 'Conversation', children: conversationFields },
    {
      key: 'allowed_next_states',
      label: 'Allowed Next States',
      listItems: [{ key: '', label: 'State', value: '' }],
    },
  ],
};

export const setConversationActionOutputSchema: OutputSchema = {
  fields: [
    { key: 'ok', label: 'OK', format: 'boolean' },
    { key: 'conversation', label: 'Conversation', children: conversationFields },
    {
      key: 'allowed_next_states',
      label: 'Allowed Next States',
      listItems: [{ key: '', label: 'State', value: '' }],
    },
    {
      key: 'error',
      label: 'Error',
      children: [
        { key: 'code', label: 'Code' },
        { key: 'message', label: 'Message' },
      ],
    },
  ],
};

export const debugSchemaActionOutputSchema: OutputSchema = {
  fields: [
    { key: 'ok', label: 'OK', format: 'boolean' },
    { key: 'namespace', label: 'Namespace' },
    { key: 'schema', label: 'Schema', dynamicKey: true },
    {
      key: 'events',
      label: 'Events',
      listItems: [
        { key: 'id', label: 'Stream ID' },
        { key: 'namespace', label: 'Namespace' },
        { key: 'conversation_id', label: 'User ID' },
        { key: 'at', label: 'At', format: 'datetime' },
      ],
    },
    { key: 'event_count', label: 'Event Count', format: 'number' },
  ],
};

export const conversationChangedTriggerOutputSchema: OutputSchema = {
  fields: [
    { key: 'namespace', label: 'Namespace' },
    { key: 'conversation_id', label: 'User ID' },
    { key: 'previous', label: 'Previous', children: conversationFields },
    { key: 'current', label: 'Current', children: conversationFields },
    { key: 'at', label: 'At', format: 'datetime' },
  ],
};
