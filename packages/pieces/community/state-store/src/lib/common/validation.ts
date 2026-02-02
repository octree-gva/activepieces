import Ajv from 'ajv';
import { Conversation, SchemaBundle } from './types';

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

export function validateData(
  state: string,
  data: Record<string, unknown>,
  jsonSchema?: Record<string, unknown>
): { valid: boolean; error?: string } {
  if (!jsonSchema) {
    return { valid: true };
  }

  try {
    const ajv = new Ajv();
    const validate = ajv.compile(jsonSchema);
    const valid = validate({ state, data });

    if (!valid) {
      const errors = validate.errors?.map((err) => {
        const path = err.instancePath || err.schemaPath || '';
        return `${path} ${err.message}`;
      }).join('; ') || 'Unknown validation error';

      return {
        valid: false,
        error: `JSON Schema validation failed: ${errors}`,
      };
    }

    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: `Failed to validate JSON Schema: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

export function getSchemaKey(namespace: string): string {
  return `${namespace}:schema`;
}

export function getConversationKey(namespace: string, conversationId: string): string {
  return `${namespace}:conversation:${conversationId}`;
}

export function getEventsKey(namespace: string): string {
  return `${namespace}:events`;
}
