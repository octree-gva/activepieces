export interface Conversation {
  state: string;
  data: Record<string, unknown>;
}

export interface FSM {
  initial: string;
  transitions: Record<string, string[]>;
}

export interface SchemaBundle {
  fsm?: FSM;
}

export interface ConversationEvent {
  namespace: string;
  conversation_id: string;
  previous: Conversation | null;
  current: Conversation;
  at: string;
}

export const UNKNOWN_STATE = 'unknown';
