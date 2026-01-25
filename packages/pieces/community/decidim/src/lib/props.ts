import { Property } from "@activepieces/pieces-framework";

export function usernameProp(required = false) {
  return Property.ShortText({
    displayName: 'Nickname',
    required,
    description: 'The nickname of the user',
  });
}

export function fetchUserInfoProp(required = false) {
  return Property.Checkbox({
    displayName: 'Fetch user info?',
    required,
    description: 'If enabled, the user info will be fetched from the Decidim API',
    defaultValue: true,
  });
}

export function registerOnMissingProp(required = false) {
  return Property.Checkbox({
    displayName: 'Register on missing?',
    required,
    description: 'If enabled, the user will be registered if they do not exist',
    defaultValue: false,
  });
}

export function userFullNameProp(required = false) {
  return Property.ShortText({
    displayName: 'User Full Name',
    required,
    description:
      'The name of the user to impersonate',
  });
}

export function emailProp(required = false) {
  return Property.ShortText({
    displayName: 'Email',
    required,
    description: 'Email address for the user',
  });
}

export function sendConfirmationEmailOnRegisterProp(required = false) {
  return Property.Checkbox({
    displayName: 'Send confirmation email on registration?',
    required,
    description:
      'If enabled, the user will be registered but will need to confirm their email address by clicking a link in an email',
    defaultValue: false,
  });
}

export function extendedDataQueryProp(required = false) {
  return Property.ShortText({
    displayName: 'Extended Data Query',
    description: 'JSON string to search in extended_data (for Search action only, e.g., \'{"chatbotUserId": "123"}\')',
    required,
  });
}

export function userIdProp(required = false) {
  return Property.ShortText({
    displayName: 'User ID',
    description: 'Decidim user ID (for read/update actions)',
    required,
  });
}

export function extendedDataProp(required = false) {
  return Property.Json({
    displayName: 'Extended Data',
    description: 'Extended data to set/update (for Create/Update actions, e.g., {"chatbotUserId": "123"})',
    required,
  });
}

export function dataPathProp(required = false) {
  return Property.ShortText({
    displayName: 'Data Path',
    description: 'Path in extended_data to read/update (e.g., ".", ".chatbotUserId", etc.)',
    required,
    defaultValue: '.',
  });
}

