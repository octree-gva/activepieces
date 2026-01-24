import { createAction, Property } from '@activepieces/pieces-framework';
import { propsValidation } from '@activepieces/pieces-common';
import { z } from 'zod';
export const createMagicLink = createAction({
  // auth: check https://www.activepieces.com/docs/developers/piece-reference/authentication,
  name: 'createMagicLink',
  displayName: 'Create Magic Link',
  description: 'Create a magic link for a user or a visitor',
  props: {
    email: Property.ShortText({
      displayName: 'Email',
      description: 'Email of the user',
      required: false,
      defaultValue: 'user@example.org',
    }),
    identifier: Property.ShortText({
      displayName: 'Unique identifier',
      description: 'A unique identifier for the user',
      required: false,
      defaultValue: '1234567890',
    })
  },
  async run({propsValue}) {
    await propsValidation.validateZod(propsValue, {
      email: z.string().email('Invalid email format').optional(),
      identifier: z.string().min(6, 'Identifier must be at least 6 characters').optional(),
    });

    if (!propsValue.email && !propsValue.identifier) {
      throw new Error('At least one of email or identifier must be provided');
    }
    const email = propsValue.email;
    const identifier = propsValue.identifier;
    return {
      message: `Magic link created for ${email} with identifier ${identifier}`,
      email: email,
      identifier: identifier,
    };
  },
});
