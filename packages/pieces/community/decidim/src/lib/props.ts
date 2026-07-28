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
    displayName: 'Load full user from API',
    required,
    description: 'When on, the step fetches the user record after sign-in.',
    defaultValue: true,
  });
}

export function registerOnMissingProp(required = false) {
  return Property.Checkbox({
    displayName: 'Register if user not found',
    required,
    description: 'When on, creates a new user when the email is unknown.',
    defaultValue: false,
  });
}

export function userFullNameProp(required = false) {
  return Property.ShortText({
    displayName: 'Display name',
    required,
    description: 'Name shown in Decidim (e.g. for impersonation or registration).',
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
    displayName: 'Send email confirmation',
    required,
    description: 'When on, the user must confirm by email before the account is active.',
    defaultValue: false,
  });
}

export function userIdProp(required = false) {
  return Property.ShortText({
    displayName: 'User ID',
    description: 'Decidim user id string (read or update).',
    required,
  });
}

export function extendedDataProp(required = false) {
  return Property.Json({
    displayName: 'Extended data (JSON)',
    description: 'Key/value JSON merged into the user extended_data (create or update).',
    required,
  });
}

export function dataPathProp(required = false) {
  return Property.ShortText({
    displayName: 'Field path',
    description: 'Dot path inside extended_data. Use "." for the whole object.',
    required,
    defaultValue: '.',
  });
}

export function localesProp(required = false) {
  return Property.Array({
    displayName: 'Languages',
    required,
    description: 'Select only the given locales.',
    properties: {
      value: Property.ShortText({
        displayName: 'Code',
        required: true,
      }),
    },
  });
}

export function pageProp(required = false) {
  return Property.Number({
    displayName: 'Page number',
    required,
    defaultValue: 1,
    description: '1-based page index',
  });
}

export function perPageProp(required = false) {
  return Property.Number({
    displayName: 'Items per page',
    required,
    defaultValue: 50,
    description: 'max 100',
  });
}

export function spaceSearchPageProp(required = false) {
  return Property.Number({
    displayName: 'Page',
    required,
    defaultValue: 1,
    description: '1-paged pagination',
  });
}

export function spaceSearchPerPageProp(required = false) {
  return Property.Number({
    displayName: 'Items per page',
    required,
    defaultValue: 10,
    description: 'max 100',
  });
}

export function spaceSearchLanguagesProp(required = false) {
  return Property.Array({
    displayName: 'Languages',
    required,
    description: 'Only given languages will be fetched',
    properties: {
      value: Property.ShortText({
        displayName: 'Code',
        required: true,
      }),
    },
  });
}

export function spaceIdsFilterProp(required = false) {
  return Property.Array({
    displayName: 'Space id',
    required,
    description: 'Only spaces with this id will be fetched',
    properties: {
      value: Property.Number({
        displayName: 'ID',
        required: true,
      }),
    },
  });
}

export function spaceManifestsFilterProp(required = false) {
  return Property.Array({
    displayName: 'Space Manifest',
    required,
    description: 'Only spaces with this manifest will be fetched',
    properties: {
      value: Property.ShortText({
        displayName: 'Manifest',
        required: true,
      }),
    },
  });
}

export function participantUserIdsFilterProp(required = false) {
  return Property.Array({
    displayName: 'User id',
    required,
    description: 'Only the users with these ids will be fetched',
    properties: {
      value: Property.Number({
        displayName: 'ID',
        required: true,
      }),
    },
  });
}

export function participantNicknamesFilterProp(required = false) {
  return Property.Array({
    displayName: 'User nickname',
    required,
    description: 'Only the users with these nicknames will be fetched',
    properties: {
      value: Property.ShortText({
        displayName: 'Nickname',
        required: true,
      }),
    },
  });
}

export function participantExtendedDataFiltersProp(required = false) {
  return Property.Array({
    displayName: 'User extended data',
    required,
    description:
      'Only users matching this Cont filter (key/value JSON substring in extended_data)',
    properties: {
      key: Property.ShortText({
        displayName: 'Key',
        required: true,
        description: 'Dot path in extended_data (e.g. details.phone_number)',
      }),
      value: Property.ShortText({
        displayName: 'Value',
        required: true,
      }),
    },
  });
}

/** Chain from Impersonate / OAuth; empty = piece client credentials (system). */
export function userAccessTokenProp(required = false) {
  return Property.ShortText({
    displayName: required ? 'User access token' : 'User access token (optional)',
    required,
    description: required
      ? 'Paste the token from Impersonate or OAuth (with or without "Bearer ").'
      : 'If impersonating a user, use this field to add the impersonation token',
  });
}

/** Participatory space kind (Decidim manifest / space type). */
export function decidimSpaceManifestProp(required = false) {
  return Property.StaticDropdown({
    displayName: 'Space type',
    required,
    description: 'Restrict results to one kind of participatory space.',
    options: {
      options: [
        { label: 'Participatory processes', value: 'participatory_processes' },
        { label: 'Assemblies', value: 'assemblies' },
        { label: 'Conferences', value: 'conferences' },
        { label: 'Initiatives', value: 'initiatives' },
      ],
    },
  });
}

export function decidimSpaceIdProp(required = false) {
  return Property.Number({
    displayName: 'Space ID',
    required,
    description: 'Numeric id of a participatory space.',
  });
}

export function decidimComponentIdProp(required = false) {
  return Property.Number({
    displayName: 'Component ID',
    required,
    description: 'Numeric id of a component (e.g. blogs, proposals).',
  });
}

export function blogPostIdProp(required = false) {
  return Property.Number({
    displayName: 'Blog post ID',
    required,
    description: 'Numeric id from Decidim (GET /blogs/{id})',
  });
}

export function proposalIdProp(required = false) {
  return Property.Number({
    displayName: 'Proposal ID',
    required,
    description: 'Published proposal numeric id',
  });
}

export function draftProposalIdProp(required = false) {
  return Property.Number({
    displayName: 'Draft proposal ID',
    required,
    description: 'Draft proposal numeric id',
  });
}

export function voteWeightProp(required = false) {
  return Property.Number({
    displayName: 'Vote weight',
    required,
    description: 'Vote weight (see Decidim voting config for allowed values)',
  });
}

export function proposalOrderProp(required = false) {
  return Property.StaticDropdown({
    displayName: 'Order by',
    required,
    description: 'published_at or rand',
    options: {
      options: [
        { label: 'Published at', value: 'published_at' },
        { label: 'Random', value: 'rand' },
      ],
    },
  });
}

export function organizationIdStringProp(required = false) {
  return Property.ShortText({
    displayName: 'Organization ID',
    required,
    description: 'Organization id as returned by the API (string)',
  });
}

export function organizationNumericIdProp(required = false) {
  return Property.Number({
    displayName: 'Organization numeric ID',
    required,
    description: 'Organization id for extended_data routes (integer)',
  });
}

export function objectPathPropOrganization(required = false) {
  return Property.ShortText({
    displayName: 'Object path',
    required,
    description: 'Dot path into extended data (use "." for root)',
    defaultValue: '.',
  });
}

export function tokenToIntrospectProp(required = true) {
  return Property.ShortText({
    displayName: 'Token to introspect',
    required,
    description: 'Access token string to validate (RFC 7662)',
  });
}

export function roleIdProp(required = false) {
  return Property.ShortText({
    displayName: 'Role ID',
    required,
    description: 'Composite role id from the API',
  });
}

export function createRolePayloadProp(required = true) {
  return Property.Json({
    displayName: 'Create role body',
    required,
    description:
      'JSON body per Decidim API: { "data": { "attributes": { "resource_type", "resource_id", "user_id", "type" } } }',
  });
}

export function updateOrganizationPayloadProp(required = true) {
  return Property.Json({
    displayName: 'Update organization body',
    required,
    description: 'JSON body: { "data": { …OrganizationAttributes } }',
  });
}

export function blogOrderProp(required = false) {
  return Property.ShortText({
    displayName: 'Order by',
    required,
    description: 'Server-supported columns: published_at, rand',
  });
}

export function blogOrderDirectionProp(required = false) {
  return Property.StaticDropdown({
    displayName: 'Order direction',
    required,
    description: 'Used with Order by (list pagination; neighbor links on read)',
    options: {
      options: [
        { label: 'Ascending', value: 'asc' },
        { label: 'Descending', value: 'desc' },
      ],
    },
  });
}

export function componentIdsFilterProp(required = false) {
  return Property.Array({
    displayName: 'Component ids',
    required,
    description: 'Only components with these ids will be fetched',
    properties: {
      value: Property.Number({
        displayName: 'ID',
        required: true,
      }),
    },
  });
}

export function componentManifestsFilterProp(required = false) {
  return Property.Array({
    displayName: 'Component manifests',
    required,
    description: 'Only component with these manifest name will be fetched',
    properties: {
      value: Property.ShortText({
        displayName: 'Manifest',
        required: true,
      }),
    },
  });
}


