import {
  validateTransition,
  validateFsm,
  fsmZodValidator,
  getSchemaKey,
  getConversationKey,
  getEventsKey,
  getAllowedNextStates,
  getFsmFromAuth,
  listFsmStates,
  mergeConversationData,
  conversationPayloadChanged,
  shouldEmitConversationEvent,
  resolvePropString,
} from '../../../src/lib/utils/validation';
import { z } from 'zod';

describe('validation', () => {
  describe('getSchemaKey', () => {
    it('should return correct schema key', () => {
      expect(getSchemaKey('test:namespace')).toBe('test:namespace:schema');
    });

    it('should handle empty namespace', () => {
      expect(getSchemaKey('')).toBe(':schema');
    });
  });

  describe('getConversationKey', () => {
    it('should return correct conversation key', () => {
      expect(getConversationKey('test:namespace', 'conv-123')).toBe('test:namespace:conversation:conv-123');
    });

    it('should handle empty namespace', () => {
      expect(getConversationKey('', 'conv-123')).toBe(':conversation:conv-123');
    });

    it('should handle empty conversation id', () => {
      expect(getConversationKey('test:namespace', '')).toBe('test:namespace:conversation:');
    });
  });

  describe('getEventsKey', () => {
    it('should return correct events key', () => {
      expect(getEventsKey('test:namespace')).toBe('test:namespace:events');
    });

    it('should handle empty namespace', () => {
      expect(getEventsKey('')).toBe(':events');
    });
  });

  describe('validateTransition', () => {
    it('should return valid when fsm is undefined', () => {
      const result = validateTransition('state1', 'state2');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should return invalid when fsm has empty transitions and state changes', () => {
      const fsm = { initial: 'state1', transitions: {} };
      const result = validateTransition('state1', 'state2', fsm);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Unknown current state');
    });

    it('should return valid when fsm transitions is null', () => {
      const fsm = { initial: 'state1', transitions: null as never };
      const result = validateTransition('state1', 'state2', fsm);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should return valid when fsm transitions is undefined', () => {
      const fsm = { initial: 'state1', transitions: undefined as never };
      const result = validateTransition('state1', 'state2', fsm);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should return invalid when current state has no transitions defined', () => {
      const fsm = {
        initial: 'state1',
        transitions: {
          state2: ['state3'],
        },
      };
      const result = validateTransition('state1', 'state2', fsm);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Unknown current state');
    });

    it('should return valid when transition is allowed', () => {
      const fsm = {
        initial: 'state1',
        transitions: {
          state1: ['state2', 'state3'],
        },
      };
      const result = validateTransition('state1', 'state2', fsm);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should return invalid when transition is not allowed', () => {
      const fsm = {
        initial: 'state1',
        transitions: {
          state1: ['state2'],
        },
      };
      const result = validateTransition('state1', 'state3', fsm);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid transition');
      expect(result.error).toContain('state1');
      expect(result.error).toContain('state3');
      expect(result.error).toContain('state2');
    });

    it('should return valid for same-state even when self-loop is not listed', () => {
      const fsm = {
        initial: 'state1',
        transitions: {
          state1: ['state2'],
        },
      };
      const result = validateTransition('state1', 'state1', fsm);
      expect(result.valid).toBe(true);
    });

    it('should return valid when transitioning to same state if allowed', () => {
      const fsm = {
        initial: 'state1',
        transitions: {
          state1: ['state1', 'state2'],
        },
      };
      const result = validateTransition('state1', 'state1', fsm);
      expect(result.valid).toBe(true);
    });
  });

  describe('validateFsm', () => {
    it('should return valid when fsm is undefined', () => {
      const result = validateFsm(undefined);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should return valid when fsm is null', () => {
      const result = validateFsm(null);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should return valid for valid FSM object', () => {
      const fsm = {
        initial: 'state1',
        transitions: {
          state1: ['state2', 'state3'],
          state2: ['state3'],
        },
      };
      const result = validateFsm(fsm);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should parse and validate FSM from JSON string', () => {
      const fsmStr = JSON.stringify({
        initial: 'state1',
        transitions: {
          state1: ['state2'],
        },
      });
      const result = validateFsm(fsmStr);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should return invalid for FSM missing initial', () => {
      const fsm = {
        transitions: {
          state1: ['state2'],
        },
      };
      const result = validateFsm(fsm);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid FSM');
    });

    it('should return invalid for FSM with invalid transitions', () => {
      const fsm = {
        initial: 'state1',
        transitions: 'not-an-object',
      };
      const result = validateFsm(fsm);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid FSM');
    });

    it('should return invalid for invalid JSON string', () => {
      const result = validateFsm('invalid json');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid FSM');
    });

    it('should handle ZodError with path details', () => {
      const fsm = {
        initial: 123,
        transitions: {},
      };
      const result = validateFsm(fsm);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid FSM');
    });

    it('should handle FSM with empty transitions object', () => {
      const fsm = {
        initial: 'state1',
        transitions: {},
      };
      const result = validateFsm(fsm);
      expect(result.valid).toBe(true);
    });

    it('should handle FSM string with empty transitions', () => {
      const fsmStr = JSON.stringify({
        initial: 'state1',
        transitions: {},
      });
      const result = validateFsm(fsmStr);
      expect(result.valid).toBe(true);
    });

    it('should handle FSM with transitions containing empty array', () => {
      const fsm = {
        initial: 'state1',
        transitions: {
          state1: [],
        },
      };
      const result = validateFsm(fsm);
      expect(result.valid).toBe(true);
    });

    it('should handle FSM with transitions containing non-string values in array', () => {
      const fsm = {
        initial: 'state1',
        transitions: {
          state1: ['state2', 123],
        },
      };
      const result = validateFsm(fsm);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid FSM');
    });
  });

  describe('fsmZodValidator', () => {
    it('should accept valid FSM object', () => {
      const schema = z.object({
        fsm: fsmZodValidator,
      });
      const validFsm = {
        initial: 'state1',
        transitions: {
          state1: ['state2'],
        },
      };
      const result = schema.safeParse({ fsm: validFsm });
      expect(result.success).toBe(true);
    });

    it('should accept valid FSM JSON string', () => {
      const schema = z.object({
        fsm: fsmZodValidator,
      });
      const validFsmStr = JSON.stringify({
        initial: 'state1',
        transitions: {
          state1: ['state2'],
        },
      });
      const result = schema.safeParse({ fsm: validFsmStr });
      expect(result.success).toBe(true);
    });

    it('should reject invalid FSM object', () => {
      const schema = z.object({
        fsm: fsmZodValidator,
      });
      const invalidFsm = {
        initial: 'state1',
        transitions: 'not-an-object',
      };
      const result = schema.safeParse({ fsm: invalidFsm });
      expect(result.success).toBe(false);
    });

    it('should reject invalid FSM JSON string', () => {
      const schema = z.object({
        fsm: fsmZodValidator,
      });
      const result = schema.safeParse({ fsm: 'invalid json' });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBeDefined();
      }
    });

    it('should reject FSM string with invalid structure', () => {
      const schema = z.object({
        fsm: fsmZodValidator,
      });
      const invalidFsmStr = JSON.stringify({
        initial: 'state1',
        transitions: 'not-an-object',
      });
      const result = schema.safeParse({ fsm: invalidFsmStr });
      expect(result.success).toBe(false);
    });

    it('should handle non-Error exception in fsmZodValidator string transform', () => {
      const schema = z.object({
        fsm: fsmZodValidator,
      });
      const result = schema.safeParse({ fsm: 'invalid json' });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBeDefined();
      }
    });
  });

  describe('getAllowedNextStates', () => {
    it('returns empty when fsm is missing', () => {
      expect(getAllowedNextStates('START')).toEqual([]);
    });

    it('returns transitions for the current state', () => {
      expect(
        getAllowedNextStates('START', {
          initial: 'START',
          transitions: { START: ['PROPOSE', 'MENU'] },
        })
      ).toEqual(['PROPOSE', 'MENU']);
    });

    it('returns empty for unknown state', () => {
      expect(
        getAllowedNextStates('ORPHAN', {
          initial: 'START',
          transitions: { START: ['PROPOSE'] },
        })
      ).toEqual([]);
    });
  });

  describe('listFsmStates', () => {
    it('includes initial, keys, and targets', () => {
      expect(
        listFsmStates({
          initial: 'START',
          transitions: {
            START: ['PROPOSE'],
            PROPOSE: ['DONE'],
          },
        })
      ).toEqual(['DONE', 'PROPOSE', 'START']);
    });
  });

  describe('mergeConversationData', () => {
    it('merges by default', () => {
      expect(mergeConversationData({ a: 1 }, { b: 2 }, false)).toEqual({ a: 1, b: 2 });
    });

    it('replaces when replaceData is true', () => {
      expect(mergeConversationData({ a: 1 }, { b: 2 }, true)).toEqual({ b: 2 });
    });
  });

  describe('getFsmFromAuth', () => {
    it('returns undefined for empty string', () => {
      expect(getFsmFromAuth({ props: { fsm: '' } })).toBeUndefined();
      expect(getFsmFromAuth({ props: { fsm: '   ' } })).toBeUndefined();
    });

    it('parses a valid FSM string', () => {
      expect(
        getFsmFromAuth({
          props: {
            fsm: JSON.stringify({
              initial: 'START',
              transitions: { START: ['DONE'] },
            }),
          },
        })
      ).toEqual({ initial: 'START', transitions: { START: ['DONE'] } });
    });
  });

  describe('conversationPayloadChanged', () => {
    it('returns true when previous is null', () => {
      expect(
        conversationPayloadChanged({
          previous: null,
          current: { state: 'START', data: {} },
        })
      ).toBe(true);
    });

    it('returns true when data changes', () => {
      expect(
        conversationPayloadChanged({
          previous: { state: 'START', data: { a: 1 } },
          current: { state: 'START', data: { a: 1, b: 2 } },
        })
      ).toBe(true);
    });

    it('returns true when state changes', () => {
      expect(
        conversationPayloadChanged({
          previous: { state: 'START', data: {} },
          current: { state: 'PROPOSE', data: {} },
        })
      ).toBe(true);
    });

    it('returns false when state and data are identical', () => {
      expect(
        conversationPayloadChanged({
          previous: { state: 'START', data: {} },
          current: { state: 'START', data: {} },
        })
      ).toBe(false);
    });
  });

  describe('shouldEmitConversationEvent', () => {
    const baseEvent = {
      namespace: 'orders',
      conversation_id: 'c1',
      previous: { state: 'PROPOSE', data: {} },
      current: { state: 'PROPOSE', data: { title: 'A' } },
      at: '2026-01-01T00:00:00Z',
    };

    it('emits data-only changes', () => {
      expect(shouldEmitConversationEvent({ event: baseEvent })).toBe(true);
    });

    it('skips true no-ops', () => {
      expect(
        shouldEmitConversationEvent({
          event: {
            ...baseEvent,
            previous: { state: 'PROPOSE', data: { title: 'A' } },
            current: { state: 'PROPOSE', data: { title: 'A' } },
          },
        })
      ).toBe(false);
    });

    it('respects state filter', () => {
      expect(
        shouldEmitConversationEvent({ event: baseEvent, stateFilter: 'PROPOSE' })
      ).toBe(true);
      expect(
        shouldEmitConversationEvent({ event: baseEvent, stateFilter: 'START' })
      ).toBe(false);
    });
  });

  describe('resolvePropString', () => {
    it('reads plain strings and DynamicProperties wrappers', () => {
      expect(resolvePropString('PROPOSE')).toBe('PROPOSE');
      expect(resolvePropString({ value: 'PROPOSE' })).toBe('PROPOSE');
      expect(resolvePropString(undefined)).toBeUndefined();
    });
  });
});
