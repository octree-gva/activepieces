import {
  InputPropertyMap,
  Property,
} from '@activepieces/pieces-framework';
import { stateStoreAuth } from '../../stateStoreAuth';
import { getFsmFromAuth, listFsmStates } from '../utils/validation';

export function stateDropdownProp({
  required,
  displayName,
  description,
}: {
  required: boolean;
  displayName: string;
  description: string;
}) {
  return Property.DynamicProperties({
    displayName,
    description,
    required,
    auth: stateStoreAuth,
    refreshers: [],
    props: async ({ auth }): Promise<InputPropertyMap> => {
      if (!auth) {
        return {
          value: Property.ShortText({
            displayName,
            description,
            required,
            defaultValue: '',
          }),
        };
      }
      const fsm = getFsmFromAuth(auth);
      if (!fsm) {
        return {
          value: Property.ShortText({
            displayName,
            description,
            required,
          }),
        };
      }
      return {
        value: Property.StaticDropdown({
          displayName,
          description,
          required,
          options: {
            options: listFsmStates(fsm).map((state) => ({
              label: state,
              value: state,
            })),
          },
        }),
      };
    },
  });
}
