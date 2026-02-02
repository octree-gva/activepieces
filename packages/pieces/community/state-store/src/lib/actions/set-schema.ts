import {
  ActionContext,
  createAction,
  PieceAuthProperty,
  Property,
} from '@activepieces/pieces-framework';
import { stateStoreAuth } from '../..';
import { redisConnect } from '../common/redis';
import { getSchemaKey, SchemaBundle } from '../common/types';

export const setSchemaAction = createAction({
  name: 'set_schema',
  displayName: 'Set Schema Bundle',
  description: 'Store the FSM + JSON schema for a namespace',
  auth: stateStoreAuth,
  props: {
    namespace: Property.ShortText({
      displayName: 'Namespace',
      description: 'Namespace to store the schema bundle (e.g., "bot:proposal")',
      required: true,
    }),
    fsm: Property.Json({
      displayName: 'FSM',
      description: 'Finite State Machine definition with initial state and transitions',
      required: false,
    }),
    json_schema: Property.Json({
      displayName: 'JSON Schema',
      description: 'JSON Schema to validate conversation state and data',
      required: false,
    }),
  },
  async run(context) {
    const { namespace, fsm, json_schema } = context.propsValue;

    if (!fsm && !json_schema) {
      return {
        ok: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'At least one of fsm or json_schema must be provided',
        },
      };
    }

    const client = await redisConnect(context.auth);
    try {
      const schemaBundle: SchemaBundle = {};
      
      if (fsm) {
        try {
          const parsedFsm = typeof fsm === 'string' ? JSON.parse(fsm) : fsm;
          if (typeof parsedFsm !== 'object' || parsedFsm === null) {
            throw new Error('FSM must be an object');
          }
          schemaBundle.fsm = parsedFsm as SchemaBundle['fsm'];
        } catch (error) {
          return {
            ok: false,
            error: {
              code: 'INVALID_JSON',
              message: `Invalid FSM JSON: ${error instanceof Error ? error.message : String(error)}`,
            },
          };
        }
      }

      if (json_schema) {
        try {
          const parsedSchema = typeof json_schema === 'string' ? JSON.parse(json_schema) : json_schema;
          if (typeof parsedSchema !== 'object' || parsedSchema === null) {
            throw new Error('JSON Schema must be an object');
          }
          schemaBundle.json_schema = parsedSchema;
        } catch (error) {
          return {
            ok: false,
            error: {
              code: 'INVALID_JSON',
              message: `Invalid JSON Schema: ${error instanceof Error ? error.message : String(error)}`,
            },
          };
        }
      }

      const schemaKey = getSchemaKey(namespace);
      await client.set(schemaKey, JSON.stringify(schemaBundle));

      return { ok: true };
    } catch (error) {
      throw new Error(`Redis operation failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      await client.quit();
    }
  },
});
