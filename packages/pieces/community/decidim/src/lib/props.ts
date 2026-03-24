import { Property } from "@activepieces/pieces-framework";

/**
 * Filter operators for Decidim search endpoints. Values are the API tokens; labels are for builders.
 */
const SEARCH_FILTER_OPERATORS = [
  { label: 'Equals', value: 'eq' },
  { label: 'Not equals', value: 'not_eq' },
  { label: 'In list', value: 'in' },
  { label: 'Not in list', value: 'not_in' },
  { label: 'Less than', value: 'lt' },
  { label: 'Greater than', value: 'gt' },
  { label: 'Starts with', value: 'start' },
  { label: 'Matches pattern', value: 'matches' },
  { label: 'Is present', value: 'present' },
  { label: 'Is blank', value: 'blank' },
] as const;

function searchFilterOperatorDropdown(description: string) {
  return Property.StaticDropdown({
    displayName: 'Operator',
    required: true,
    description,
    options: { options: [...SEARCH_FILTER_OPERATORS] },
  });
}

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

export function extendedDataQueryProp(required = false) {
  return Property.ShortText({
    displayName: 'Extended data filter (JSON)',
    description:
      'JSON object used to search inside extended_data. Example: {"chatbotUserId":"123"}. Search action only.',
    required,
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
    description: 'Locale codes for translated text (e.g. en, fr-ca). One row per code.',
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
    description: '1-based page index.',
  });
}

export function perPageProp(required = false) {
  return Property.Number({
    displayName: 'Items per page',
    required,
    defaultValue: 50,
    description: 'How many items each API page returns (max 100).',
  });
}

export function spaceSearchMaxResultsProp(required = false) {
  return Property.Number({
    displayName: 'Max spaces (total)',
    required,
    defaultValue: 500,
    description: 'Stop after this many spaces across all pages (max 5000).',
  });
}

export function spaceSearchTitleQueryProp(required = false) {
  return Property.ShortText({
    displayName: 'Title contains',
    required,
    description:
      'Plain text: spaces whose translated title contains this (case depends on server). Combine with space type or advanced filters.',
  });
}

/** Chain from Impersonate / OAuth; empty = piece client credentials (system). */
export function userAccessTokenProp(required = false) {
  return Property.ShortText({
    displayName: required ? 'User access token' : 'User access token (optional)',
    required,
    description: required
      ? 'Paste the token from Impersonate or OAuth (with or without "Bearer ").'
      : 'Leave empty for app (client) credentials. Or paste a user token from Impersonate / OAuth.',
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

export function componentSearchAdvancedFiltersProp(required = false) {
  return Property.Array({
    displayName: 'Advanced filters',
    required,
    description: 'Optional rows sent to GET /components/search.',
    properties: {
      field: Property.StaticDropdown({
        displayName: 'Field',
        required: true,
        options: {
          options: [
            { label: 'Component type (manifest)', value: 'manifest_name' },
            { label: 'Component ID', value: 'id' },
            { label: 'Participatory space ID', value: 'participatory_space_id' },
            { label: 'Participatory space type', value: 'participatory_space_type' },
            { label: 'Component name (title)', value: 'name' },
          ],
        },
      }),
      operator: searchFilterOperatorDropdown(
        'IDs: equals, in list, less than, greater than, is present, is blank. Text: also not equals, starts with, matches pattern.',
      ),
      value: Property.Json({
        displayName: 'Value',
        required: false,
        description:
          'Single value, or for “In list” / “Not in list” a JSON array. Ignored for is present / is blank.',
      }),
    },
  });
}

export function spaceSearchAdvancedFiltersProp(required = false) {
  return Property.Array({
    displayName: 'Advanced filters',
    required,
    description: 'Optional rows sent to GET /spaces/search.',
    properties: {
      field: Property.StaticDropdown({
        displayName: 'Field',
        required: true,
        options: {
          options: [
            { label: 'Space type (manifest)', value: 'manifest_name' },
            { label: 'Space ID', value: 'id' },
            { label: 'Slug (URL segment)', value: 'slug' },
            { label: 'Title (translated)', value: 'title' },
          ],
        },
      }),
      operator: searchFilterOperatorDropdown(
        'Space ID: equals, in list, less than, greater than, is present, is blank. Text fields: all operators.',
      ),
      value: Property.Json({
        displayName: 'Value',
        required: false,
        description:
          'Single value or JSON array for “In list” / “Not in list”. Ignored for is present / is blank.',
      }),
      values: Property.Json({
        displayName: 'Values (JSON array)',
        required: false,
        description:
          'Alternative to Value: JSON array only. Example: ["a","b"]. Ignored if Value is set.',
      }),
    },
  });
}

