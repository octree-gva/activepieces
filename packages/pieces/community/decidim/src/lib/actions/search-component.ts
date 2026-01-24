import { createAction, Property } from '@activepieces/pieces-framework';

export const searchComponent = createAction({
  // auth: check https://www.activepieces.com/docs/developers/piece-reference/authentication,
  name: 'searchComponent',
  displayName: 'Search Component',
  description: 'Search a component ',
  props: {},
  async run() {
    // Action logic here
  },
});
