import { Property } from "@activepieces/pieces-framework";

export const usernameProp = Property.ShortText({
  displayName: 'Nickname',
  required: true,
  description: 'The nickname of the user to impersonate',
});

export const fetchUserInfoProp = Property.Checkbox({
  displayName: 'Fetch user info?',
  required: false,
  description: 'If enabled, the user info will be fetched from the Decidim API',
  defaultValue: true,
});

export const registerOnMissingProp = Property.Checkbox({
  displayName: 'Register on missing?',
  required: false,
  description: 'If enabled, the user will be registered if they do not exist',
  defaultValue: false,
});

export const userFullNameProp = Property.ShortText({
  displayName: 'User Full Name',
  required: false,
  description:
    'The name of the user to impersonate (used for registration)',
});

export const sendConfirmationEmailOnRegisterProp = Property.Checkbox({
  displayName: 'Send confirmation email on registration?',
  required: false,
  description:
    'If enabled, the user will be registered but will need to confirm their email address by clicking a link in an email',
  defaultValue: false,
});
