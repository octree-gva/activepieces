import {
  ActionContext,
  createAction,
  PieceAuthProperty,
  ArrayProperty,
} from '@activepieces/pieces-framework';
import { StoreScope } from '@activepieces/pieces-framework';
import { props } from '../common/props';
import * as yaml from 'js-yaml';

export function flattenObject(
  obj: unknown,
  prefix = '',
  result: Record<string, unknown> = {}
): Record<string, unknown> {
  if (prefix && (obj === null || obj === undefined || typeof obj !== 'object' || Array.isArray(obj))) {
    result[prefix] = obj;
    return result;
  }

  if (obj === null || obj === undefined || typeof obj !== 'object') {
    return result;
  }

  if (Array.isArray(obj)) {
    result[prefix] = obj;
    return result;
  }

  for (const [key, value] of Object.entries(obj)) {
    const newKey = prefix ? `${prefix}.${key}` : key;
    flattenObject(value, newKey, result);
  }

  return result;
}

async function executeSetStore(
  context: ActionContext<
    PieceAuthProperty | undefined,
    {
      files: ArrayProperty<true>;
      interpolationPrefix: typeof props.interpolationPrefix;
      interpolationSuffix: typeof props.interpolationSuffix;
      fallbackLocale: typeof props.fallbackLocale;
    }
  >
) {
  const files = context.propsValue.files || [];
  const interpolationPrefix = context.propsValue.interpolationPrefix ?? '%{';
  const interpolationSuffix = context.propsValue.interpolationSuffix ?? '}';
  const fallbackLocale = context.propsValue.fallbackLocale ?? 'en';

  if (files.length === 0) {
    throw new Error('At least one translation file is required');
  }

  const languages = new Set<string>();
  const languageNamespaces: Record<string, Set<string>> = {};

  for (const fileItem of files) {
    const file = (fileItem as { file?: { data: Buffer; filename: string; extension?: string } }).file;
    if (!file) {
      continue;
    }

    try {
      const fileData = file.data.toString('utf-8');
      const filenameLower = file.filename.toLowerCase();
      const isYaml = filenameLower.endsWith('.yml') || filenameLower.endsWith('.yaml');

      let jsonData: unknown;
      if (isYaml) {
        jsonData = yaml.load(fileData);
      } else {
        jsonData = JSON.parse(fileData);
      }

      const filenameWithoutExt = file.filename.replace(/\.(json|yml|yaml)$/i, '');

      // Format: {language}[_{region}]
      // Examples: en.json, en_US.json, fr.json, pt_BR.json
      const match = filenameWithoutExt.match(/^([a-z]{2}(?:_[A-Z]{2})?)$/i);

      if (!match) {
        throw new Error(
          `Invalid filename format: ${file.filename}. Expected format: {language}[_{region}].{ext} (e.g., en.json, en_US.json, pt_BR.json)`
        );
      }

      const languageWithRegion = match[1].toLowerCase();

      // Language includes region if present (e.g., en_us, pt_br)
      const language = languageWithRegion;
      // Use default namespace for all translations
      const namespace = 'translation';
      languages.add(language);

      if (!languageNamespaces[language]) {
        languageNamespaces[language] = new Set();
      }
      languageNamespaces[language].add(namespace);

      const flattened = flattenObject(jsonData);
      const keyPaths: string[] = [];

      for (const [keyPath, value] of Object.entries(flattened)) {
        // keypath might start with en:, pt:, fr:, etc. remove it
        const keyParts = keyPath.split('.');
        const normalizedKeyPath = language === keyParts[0] ? keyParts.slice(1).join('.') : keyPath;
        const storeKey = `i18n_${language}_${namespace}_${normalizedKeyPath}`;
        await context.store.put(
          storeKey,
          JSON.stringify(value),
          StoreScope.PROJECT
        );
        keyPaths.push(normalizedKeyPath);
      }

      await context.store.put(
        `i18n_all_keys_${language}_${namespace}`,
        keyPaths.join(','),
        StoreScope.PROJECT
      );
    } catch (error) {
      throw new Error(`Failed to parse file ${file.filename}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  await context.store.put(
    'i18n_languages',
    Array.from(languages).join(','),
    StoreScope.PROJECT
  );

  for (const [language, namespaces] of Object.entries(languageNamespaces)) {
    await context.store.put(
      `i18n_namespaces_${language}`,
      Array.from(namespaces).join(','),
      StoreScope.PROJECT
    );
  }

  await context.store.put(
    'i18n_instance',
    'initialized',
    StoreScope.PROJECT
  );

  await context.store.put(
    'i18n_interpolation_prefix',
    interpolationPrefix,
    StoreScope.PROJECT
  );

  await context.store.put(
    'i18n_interpolation_suffix',
    interpolationSuffix,
    StoreScope.PROJECT
  );

  await context.store.put(
    'i18n_fallback_locale',
    fallbackLocale,
    StoreScope.PROJECT
  );

  const validFilesCount = files.filter(f => (f as { file?: unknown }).file).length;
  return {
    ok: true,
    languages: Array.from(languages),
    message: `Loaded ${validFilesCount} translation file(s) in your project`,
  };
}

export const setStoreAction = createAction({
  name: 'set_store',
  displayName: 'Set Store',
  description: 'Parse JSON or YAML translation files using i18next and store them',
  props: {
    files: props.files,
    interpolationPrefix: props.interpolationPrefix,
    interpolationSuffix: props.interpolationSuffix,
    fallbackLocale: props.fallbackLocale,
  },
  async run(context) {
    return await executeSetStore(context);
  },
});
