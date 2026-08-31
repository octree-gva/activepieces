import { Property } from '@activepieces/pieces-framework';
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
  return Property.Dropdown({
    displayName,
    description,
    required,
    auth: stateStoreAuth,
    refreshers: [],
    options: async ({ auth }) => {
      if (!auth) {
        return {
          disabled: true,
          options: [],
          placeholder: 'Connect State Store first',
        };
      }
      const fsm = getFsmFromAuth(auth);
      if (!fsm) {
        return {
          disabled: true,
          options: [],
          placeholder: 'FSM not configured on the connection',
        };
      }
      return {
        disabled: false,
        options: listFsmStates(fsm).map((state) => ({
          label: state,
          value: state,
        })),
      };
    },
  });
}
