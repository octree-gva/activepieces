import {
  ActionContext,
  createAction,
  PieceAuthProperty,
} from '@activepieces/pieces-framework';
import { StoreScope } from '@activepieces/pieces-framework';

async function executeSettings(
  context: ActionContext<PieceAuthProperty | undefined, {}>
) {
  const languagesStr = await context.store.get<string>(
    'i18n_languages',
    StoreScope.PROJECT
  );

  const availableLocales = languagesStr
    ? languagesStr.split(',').filter(Boolean)
    : [];

  const fallbackLocale =
    (await context.store.get<string>(
      'i18n_fallback_locale',
      StoreScope.PROJECT
    )) ?? 'en';

  const interpolationPrefix =
    (await context.store.get<string>(
      'i18n_interpolation_prefix',
      StoreScope.PROJECT
    )) ?? '%{';

  const interpolationSuffix =
    (await context.store.get<string>(
      'i18n_interpolation_suffix',
      StoreScope.PROJECT
    )) ?? '}';

  return {
    availableLocales,
    fallbackLocale,
    interpolationPrefix,
    interpolationSuffix,
  };
}

export const settingsAction = createAction({
  name: 'settings',
  displayName: 'Get Settings',
  description: 'Get current i18n store settings',
  props: {},
  async run(context) {
    return await executeSettings(context);
  },
});
