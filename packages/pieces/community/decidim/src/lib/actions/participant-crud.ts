import { createAction, Property } from '@activepieces/pieces-framework';

export const participantCrud = createAction({
  // auth: check https://www.activepieces.com/docs/developers/piece-reference/authentication,
  name: 'participantCrud',
  displayName: 'Participant CRUD',
  description: 'Create, read, update or delete a participant',
  props: {},
  async run() {
    // Action logic here
  },
});
