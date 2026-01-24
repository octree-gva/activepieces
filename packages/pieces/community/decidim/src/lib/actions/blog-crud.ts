import { createAction, Property } from '@activepieces/pieces-framework';

export const blogCrud = createAction({
  // auth: check https://www.activepieces.com/docs/developers/piece-reference/authentication,
  name: 'blogCrud',
  displayName: 'Blog CRUD',
  description: 'Create, Read, Update or delete a blog post',
  props: {},
  async run() {
    // Action logic here
  },
});
