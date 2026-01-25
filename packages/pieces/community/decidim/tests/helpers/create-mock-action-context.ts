import { ExecutionType } from '@activepieces/shared';
import { ActionContext } from '@activepieces/pieces-framework';
import { InputPropertyMap, PiecePropValueSchema, StaticPropsValue } from '@activepieces/pieces-framework';
import { PieceAuthProperty } from '@activepieces/pieces-framework';

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
      get: jest.fn(),
      put: jest.fn(),
      delete: jest.fn(),
    },
    flows: {
      list: jest.fn(),
      current: {
        id: 'test-flow-id',
        version: {
          id: 'test-flow-version-id',
        },
      },
    },
    project: {
      id: 'test-project-id',
      externalId: jest.fn().mockResolvedValue(undefined),
    },
    connections: {
      get: jest.fn(),
      list: jest.fn(),
    },
    tags: {
      add: jest.fn(),
    },
    server: {
      token: 'test-token',
      apiUrl: 'http://localhost:3000',
      publicUrl: 'http://localhost:4200',
    },
    serverUrl: 'http://localhost:4200',
    run: {
      id: 'test-run-id',
      stop: jest.fn(),
      pause: jest.fn(),
      respond: jest.fn(),
    },
    files: {
      write: jest.fn(),
    },
    output: {
      update: jest.fn(),
    },
    generateResumeUrl: jest.fn(),
    ...overrides,
  } as ActionContext<PieceAuth, ActionProps>;
}
