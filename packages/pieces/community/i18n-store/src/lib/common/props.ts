import { Property} from '@activepieces/pieces-framework';

export const props = {
  files: Property.Array({
    displayName: 'Translation Files',
    description: 'JSON files containing translation data',
    required: true,
    properties: {
      file: Property.File({
        displayName: 'Translation File',
        description: 'A JSON or YAML file with translation data',
        required: true,
      }),
    },
  }),
  interpolationPrefix: Property.ShortText({
    displayName: 'Interpolation Prefix',
    description: 'Prefix for interpolation variables (e.g., "%{")',
    required: false,
    defaultValue: '%{',
  }),
  interpolationSuffix: Property.ShortText({
    displayName: 'Interpolation Suffix',
    description: 'Suffix for interpolation variables (e.g., "}")',
    required: false,
    defaultValue: '}',
  }),
  fallbackLocale: Property.ShortText({
    displayName: 'Fallback Locale',
    description: 'Fallback language code when translation is not found',
    required: false,
    defaultValue: 'en',
  }),
  variables: Property.Array({
    displayName: 'Interpolation Variables',
    description: 'Variables to interpolate into the translation',
    required: false,
    properties: {
      key: Property.ShortText({
        displayName: 'Key',
        description: 'The key to interpolate',
        required: true,
      }),
      value: Property.ShortText({
        displayName: 'Value',
        description: 'The value to interpolate',
        required: true,
      }),
    },
  }),
  path: Property.ShortText({
    displayName: 'Path',
    description: 'Translation key path (e.g., "namespace:key" or "key.subkey")',
    required: true,
  }),
  return_object: Property.Checkbox({
    displayName: 'Return Object',
    description: 'If true, returns the object/record. If false, returns the translated string.',
    required: false,
    defaultValue: false,
  }),
  language: Property.ShortText({
    displayName: 'Language',
    description: 'The language to get the translation for',
    required: true,
  }),
};
