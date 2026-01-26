import {
  ActionContext,
  createAction,
  PieceAuthProperty,
} from '@activepieces/pieces-framework';
import i18next from 'i18next';
import { StoreScope } from '@activepieces/pieces-framework';
import { props } from '../common/props';

export async function reconstructResources(
  context: { store: { get: <T>(key: string, scope?: StoreScope) => Promise<T | null> } },
  language: string
): Promise<Record<string, Record<string, Record<string, unknown>>>> {
  const namespacesStr = await context.store.get<string>(
    `i18n_namespaces_${language}`,
    StoreScope.PROJECT
  );

  if (!namespacesStr) {
    return {};
  }

  const namespaces = namespacesStr.split(',');
  const resources: Record<string, Record<string, Record<string, unknown>>> = {
    [language]: {},
  };

  for (const namespace of namespaces) {
    if (!namespace) continue;
    resources[language][namespace] = {};

    const allKeys = await context.store.get<string>(
      `i18n_all_keys_${language}_${namespace}`,
      StoreScope.PROJECT
    );

    if (!allKeys) {
      continue;
    }

    const keyList = allKeys.split(',');
    for (const keyPath of keyList) {
      if (!keyPath) continue;
      const valueStr = await context.store.get<string>(
        `i18n_${language}_${namespace}_${keyPath}`,
        StoreScope.PROJECT
      );
      if (valueStr) {
        const value = JSON.parse(valueStr);
        const keys = keyPath.split('.');
        let current = resources[language][namespace] as Record<string, unknown>;
        for (let i = 0; i < keys.length - 1; i++) {
          const key = keys[i];
          if (!(key in current) || typeof current[key] !== 'object' || current[key] === null) {
            current[key] = {};
          }
          current = current[key] as Record<string, unknown>;
        }
        current[keys[keys.length - 1]] = value;
      }
    }
  }

  return resources;
}

async function executeTranslate(
  context: ActionContext<PieceAuthProperty | undefined, {
    language: typeof props.language;
    path: typeof props.path;
    return_object: typeof props.return_object;
    variables: typeof props.variables;
  }>
) {
  const path = context.propsValue.path;
  const returnObject = context.propsValue.return_object ?? false;
  const language = context.propsValue.language;
  const variables = context.propsValue.variables as { key: string; value: string }[] ?? [];

  const initialized = await context.store.get<string>(
    'i18n_instance',
    StoreScope.PROJECT
  );

  if (!initialized) {
    throw new Error('Translation store not initialized. Please run "Configure" action first.');
  }

  const languagesStr = await context.store.get<string>(
    'i18n_languages',
    StoreScope.PROJECT
  );

  if (!languagesStr) {
    throw new Error('No languages found in store. Please run "Configure" action first.');
  }

  const availableLanguages = languagesStr.split(',').filter(Boolean);
  if (!availableLanguages.includes(language)) {
    throw new Error(`Language "${language}" not found in store. Available languages: ${availableLanguages.join(', ')}`);
  }


  const interpolationVariables = variables.reduce((acc, variable) => {
    acc[variable.key] = variable.value;
    return acc;
  }, {} as Record<string, string>);

  const fallbackLocale = await context.store.get<string>(
    'i18n_fallback_locale',
    StoreScope.PROJECT
  ) ?? 'en';

  const i18nResources = await reconstructResources(context, language);
  if (fallbackLocale !== language) {
    const fallbackResources = await reconstructResources(context, fallbackLocale);
    Object.assign(i18nResources, fallbackResources);
  }
  const namespaces = Object.keys(i18nResources[language] || {});

  if (namespaces.length === 0) {
    throw new Error(`No resources found for language: ${language}`);
  }

  const interpolationPrefix = await context.store.get<string>(
    'i18n_interpolation_prefix',
    StoreScope.PROJECT
  ) ?? '%{';

  const interpolationSuffix = await context.store.get<string>(
    'i18n_interpolation_suffix',
    StoreScope.PROJECT
  ) ?? '}';

  await i18next.init({
    lng: language,
    fallbackLng: fallbackLocale,
    resources: i18nResources,
    defaultNS: namespaces[0] || 'translation',
    ns: namespaces.length > 0 ? namespaces : ['translation'],
    interpolation: {
      escapeValue: false,
      prefix: interpolationPrefix,
      suffix: interpolationSuffix,
    },
  });

  const translation = i18next.t(path, { returnObjects: returnObject, ...interpolationVariables });
  if(translation === path) {
    throw new Error(`Translation not found for path: ${path} in language: ${language}`);
  }
  return {
    ok: true,
    path: path,
    language: language,
    translation: translation,
  };
}

export const translateAction = createAction({
  name: 'translate',
  displayName: 'Translate',
  description: 'Get a translation value by path',
  props: {
    language: props.language,
    path: props.path,
    variables: props.variables,
    return_object: props.return_object,
  },
  async run(context) {
    return await executeTranslate(context);
  },
});
