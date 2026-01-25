import { settingsAction } from '../../../src/lib/actions/settings';
import { createMockActionContext } from '../../helpers/create-mock-action-context';
import { StoreScope } from '@activepieces/pieces-framework';

describe('Settings Action Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should retrieve all settings when configured', async () => {
    const context = createMockActionContext({
      propsValue: {},
    });

    await context.store.put('i18n_languages', 'en,fr,de', StoreScope.PROJECT);
    await context.store.put('i18n_fallback_locale', 'en', StoreScope.PROJECT);
    await context.store.put('i18n_interpolation_prefix', '%{', StoreScope.PROJECT);
    await context.store.put('i18n_interpolation_suffix', '}', StoreScope.PROJECT);

    const result = await settingsAction.run(context as Parameters<typeof settingsAction.run>[0]);

    expect(result).toEqual({
      availableLocales: ['en', 'fr', 'de'],
      fallbackLocale: 'en',
      interpolationPrefix: '%{',
      interpolationSuffix: '}',
    });
  });

  it('should return default values when settings are not configured', async () => {
    const context = createMockActionContext({
      propsValue: {},
    });

    const result = await settingsAction.run(context as Parameters<typeof settingsAction.run>[0]);

    expect(result).toEqual({
      availableLocales: [],
      fallbackLocale: 'en',
      interpolationPrefix: '%{',
      interpolationSuffix: '}',
    });
  });

  it('should handle custom interpolation prefix and suffix', async () => {
    const context = createMockActionContext({
      propsValue: {},
    });

    await context.store.put('i18n_languages', 'en', StoreScope.PROJECT);
    await context.store.put('i18n_fallback_locale', 'fr', StoreScope.PROJECT);
    await context.store.put('i18n_interpolation_prefix', '{{', StoreScope.PROJECT);
    await context.store.put('i18n_interpolation_suffix', '}}', StoreScope.PROJECT);

    const result = await settingsAction.run(context as Parameters<typeof settingsAction.run>[0]);

    expect(result).toEqual({
      availableLocales: ['en'],
      fallbackLocale: 'fr',
      interpolationPrefix: '{{',
      interpolationSuffix: '}}',
    });
  });

  it('should handle empty languages string', async () => {
    const context = createMockActionContext({
      propsValue: {},
    });

    await context.store.put('i18n_languages', '', StoreScope.PROJECT);
    await context.store.put('i18n_fallback_locale', 'en', StoreScope.PROJECT);
    await context.store.put('i18n_interpolation_prefix', '%{', StoreScope.PROJECT);
    await context.store.put('i18n_interpolation_suffix', '}', StoreScope.PROJECT);

    const result = await settingsAction.run(context as Parameters<typeof settingsAction.run>[0]);

    expect(result).toEqual({
      availableLocales: [],
      fallbackLocale: 'en',
      interpolationPrefix: '%{',
      interpolationSuffix: '}',
    });
  });

  it('should handle locale codes with underscores', async () => {
    const context = createMockActionContext({
      propsValue: {},
    });

    await context.store.put('i18n_languages', 'en,pt_br,es_mx', StoreScope.PROJECT);
    await context.store.put('i18n_fallback_locale', 'en', StoreScope.PROJECT);
    await context.store.put('i18n_interpolation_prefix', '%{', StoreScope.PROJECT);
    await context.store.put('i18n_interpolation_suffix', '}', StoreScope.PROJECT);

    const result = await settingsAction.run(context as Parameters<typeof settingsAction.run>[0]);

    expect(result).toEqual({
      availableLocales: ['en', 'pt_br', 'es_mx'],
      fallbackLocale: 'en',
      interpolationPrefix: '%{',
      interpolationSuffix: '}',
    });
  });
});
