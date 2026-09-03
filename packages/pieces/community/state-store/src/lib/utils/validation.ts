import { z } from 'zod';
import { Conversation, FsmDef } from '../../types';

const conversationSchema = z.object({
  state: z.string(),
  data: z.record(z.string(), z.unknown()),
});

export const conversationEventSchema = z.object({
  namespace: z.string(),
  conversation_id: z.string(),
  previous: conversationSchema.nullable(),
  current: conversationSchema,
  at: z.string(),
});

export type ConversationEventPayload = z.infer<typeof conversationEventSchema>;

export function parseConversationEvent(body: string | unknown): ConversationEventPayload | null {
  let parsed: unknown;
  if (typeof body === 'string') {
    try {
      parsed = JSON.parse(body);
    } catch {
      return null;
    }
  } else {
    parsed = body;
  }
  if (parsed == null) return null;
  const result = conversationEventSchema.safeParse(parsed);
  return result.success ? result.data : null;
}

export function parseConversation(raw: string | null | undefined): Conversation | null {
  if (raw == null || raw === '') {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    const result = conversationSchema.safeParse(parsed);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

export function validateTransition(
  currentState: string,
  newState: string,
  fsm?: { initial: string; transitions: Record<string, string[]> }
): { valid: boolean; error?: string } {
  if (currentState === newState) {
    return { valid: true };
  }

  if (!fsm || !fsm.transitions) {
    return { valid: true };
  }

  const allowedStates = fsm.transitions[currentState];
  if (!allowedStates) {
    return {
      valid: false,
      error: `Unknown current state "${currentState}". No transitions defined.`,
    };
  }

  if (!allowedStates.includes(newState)) {
    return {
      valid: false,
      error: `Invalid transition from "${currentState}" to "${newState}". Allowed states: ${allowedStates.join(', ')}`,
    };
  }

  return { valid: true };
}

const fsmSchema = z.object({
  initial: z.string(),
  transitions: z.record(z.string(), z.array(z.string())),
});

export function validateFsm(fsm: unknown): { valid: boolean; error?: string } {
  if (!fsm) {
    return { valid: true };
  }

  try {
    const parsedFsm = typeof fsm === 'string' ? JSON.parse(fsm) : fsm;
    fsmSchema.parse(parsedFsm);
    return { valid: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        valid: false,
        error: `Invalid FSM: ${error.issues.map(e => `${e.path.join('.')} ${e.message}`).join('; ')}`,
      };
    }
    return {
      valid: false,
      error: `Invalid FSM: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

export const fsmZodValidator = z.union([
  fsmSchema,
  z.string().transform((val, ctx) => {
    try {
      const parsed = JSON.parse(val);
      return fsmSchema.parse(parsed);
    } catch (error) {
      ctx.addIssue({
        code: "custom",
        message: error instanceof Error ? error.message : 'Invalid JSON',
      });
      return z.NEVER;
    }
  }),
]);

export function getSchemaKey(namespace: string): string {
  return `${namespace}:schema`;
}

export function getFsmFromAuth(auth: { props?: { fsm?: unknown } }): FsmDef | undefined {
  const raw = auth.props?.fsm;
  if (raw == null) return undefined;
  if (typeof raw === 'string' && raw.trim() === '') return undefined;
  try {
    const parsed: unknown = typeof raw === 'string' ? JSON.parse(raw) : raw;
    const result = fsmSchema.safeParse(parsed);
    return result.success ? result.data : undefined;
  } catch {
    return undefined;
  }
}

export function conversationPayloadChanged({
  previous,
  current,
}: {
  previous: Conversation | null;
  current: Conversation;
}): boolean {
  if (!previous) {
    return true;
  }
  if (previous.state !== current.state) {
    return true;
  }
  return JSON.stringify(previous.data) !== JSON.stringify(current.data);
}

export function shouldEmitConversationEvent({
  event,
  stateFilter,
}: {
  event: ConversationEventPayload;
  stateFilter?: string | null;
}): boolean {
  if (!conversationPayloadChanged({ previous: event.previous, current: event.current })) {
    return false;
  }
  if (stateFilter && event.current.state !== stateFilter) {
    return false;
  }
  return true;
}

export function resolvePropString(value: unknown): string | undefined {
  if (typeof value === 'string') {
    return value;
  }
  if (
    value != null &&
    typeof value === 'object' &&
    'value' in value &&
    typeof (value as { value: unknown }).value === 'string'
  ) {
    return (value as { value: string }).value;
  }
  return undefined;
}

export function getAllowedNextStates(currentState: string, fsm?: FsmDef): string[] {
  if (!fsm?.transitions) {
    return [];
  }
  return fsm.transitions[currentState] ?? [];
}

export function listFsmStates(fsm: FsmDef): string[] {
  const states = new Set<string>([fsm.initial, ...Object.keys(fsm.transitions)]);
  for (const targets of Object.values(fsm.transitions)) {
    for (const target of targets) {
      states.add(target);
    }
  }
  return Array.from(states).sort();
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

export function mergeConversationData(
  existing: Record<string, unknown>,
  incoming: unknown,
  replaceData: boolean
): Record<string, unknown> {
  const patch = isPlainObject(incoming) ? incoming : {};
  if (replaceData) {
    return patch;
  }
  return { ...existing, ...patch };
}

export function getConversationKey(namespace: string, conversationId: string): string {
  return `${namespace}:conversation:${conversationId}`;
}

export function getEventsKey(namespace: string): string {
  return `${namespace}:events`;
}
