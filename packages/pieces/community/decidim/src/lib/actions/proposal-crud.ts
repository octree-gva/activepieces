import { createAction, Property } from '@activepieces/pieces-framework';

export const proposalCrud = createAction({
  // auth: check https://www.activepieces.com/docs/developers/piece-reference/authentication,
  name: 'proposalCrud',
  displayName: 'Proposal CRUD',
  description: 'Create, read, update or delete a proposal',
  props: {},
  async run() {
    // Action logic here
  },
});
