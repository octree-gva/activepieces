export type Conversation = {
  state: string;
  data: Record<string, unknown>;
};

export type FsmDef = {
  initial: string;
  transitions: Record<string, string[]>;
};

export type FSM = FsmDef;

export type SchemaBundle = {
  fsm?: FsmDef;
};

export type ConversationEvent = {
  namespace: string;
  conversation_id: string;
  previous: Conversation | null;
  current: Conversation;
  at: string;
};

export const UNKNOWN_STATE = 'unknown';
