import { vi } from 'vitest';
import {
  ActionContext,
  ExecutionType,
  InputPropertyMap,
  PieceAuthProperty,
  PiecePropValueSchema,
  StaticPropsValue,
} from '@activepieces/pieces-framework';

export function createMockActionContext<
  PieceAuth extends PieceAuthProperty = PieceAuthProperty,
  ActionProps extends InputPropertyMap = InputPropertyMap,
>(
  overrides?: Partial<ActionContext<PieceAuth, ActionProps>>
): ActionContext<PieceAuth, ActionProps> {
  return {
    executionType: 'BEGIN' as ExecutionType.BEGIN,
    auth: {} as PiecePropValueSchema<PieceAuth>,
    propsValue: {} as StaticPropsValue<ActionProps>,
    step: { name: 'test-step' },
    store: {
      get: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
    },
    flows: {
      list: vi.fn(),
      current: {
        id: 'test-flow-id',
        version: {
          id: 'test-flow-version-id',
        },
      },
    },
    project: {
      id: 'test-project-id',
      externalId: vi.fn().mockResolvedValue(undefined),
    },
    connections: {
      get: vi.fn(),
      list: vi.fn(),
    },
    tags: {
      add: vi.fn(),
    },
    server: {
      token: 'test-token',
      apiUrl: 'http://localhost:3000',
      publicUrl: 'http://localhost:4200',
    },
    run: {
      id: 'test-run-id',
      stop: vi.fn(),
      pause: vi.fn(),
      respond: vi.fn(),
    },
    files: {
      write: vi.fn(),
    },
    output: {
      update: vi.fn(),
    },
    generateResumeUrl: vi.fn(),
    ...overrides,
  } as ActionContext<PieceAuth, ActionProps>;
}
