import { z } from 'zod';

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

/** Parse and validate webhook body as ConversationEvent. Returns null if invalid. */
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

export function validateTransition(
  currentState: string,
  newState: string,
  fsm?: { initial: string; transitions: Record<string, string[]> }
): { valid: boolean; error?: string } {
  if (!fsm || !fsm.transitions) {
    return { valid: true };
  }

  const allowedStates = fsm.transitions[currentState];
  if (!allowedStates) {
    return { valid: true };
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

export type FsmDef = { initial: string; transitions: Record<string, string[]> };

/** Parse FSM from connection auth (validated at connection time). */
export function getFsmFromAuth(auth: { props?: { fsm?: unknown } }): FsmDef | undefined {
  const raw = auth.props?.fsm;
  if (!raw) return undefined;
  const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
  return parsed as FsmDef;
}

export function getConversationKey(namespace: string, conversationId: string): string {
  return `${namespace}:conversation:${conversationId}`;
}

export function getEventsKey(namespace: string): string {
  return `${namespace}:events`;
}
