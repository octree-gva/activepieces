import { vi } from 'vitest';
import {
  ActionContext,
  ExecutionType,
  InputPropertyMap,
  PieceAuthProperty,
  PiecePropValueSchema,
  StaticPropsValue,
} from '@activepieces/pieces-framework';
import { decidimTestHost } from './decidim-test-fixtures';

export function createMockActionContext<
  PieceAuth extends PieceAuthProperty = PieceAuthProperty,
  ActionProps extends InputPropertyMap = InputPropertyMap,
>(
  overrides?: Partial<ActionContext<PieceAuth, ActionProps>>
): ActionContext<PieceAuth, ActionProps> {
  const { propsValue: overrideProps, ...restOverrides } = overrides ?? {};
  const propsValue = {
    host: decidimTestHost,
    ...(overrideProps ?? {}),
  } as StaticPropsValue<ActionProps>;
  return {
    executionType: 'BEGIN' as ExecutionType.BEGIN,
    auth: {} as PiecePropValueSchema<PieceAuth>,
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
    ...restOverrides,
    propsValue,
  } as ActionContext<PieceAuth, ActionProps>;
}

export async function loadDynamicProps(
  prop: unknown,
  propsValue: Record<string, unknown>
): Promise<Record<string, unknown>> {
  if (prop === null || typeof prop !== 'object' || !('props' in prop)) {
    throw new Error('expected DynamicProperties');
  }
  const fn = Reflect.get(prop, 'props');
  if (typeof fn !== 'function') {
    throw new Error('expected DynamicProperties');
  }
  return fn(propsValue, {});
}
