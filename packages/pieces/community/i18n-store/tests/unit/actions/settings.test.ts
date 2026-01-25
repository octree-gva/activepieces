import { settingsAction } from '../../../src/lib/actions/settings';
import { createMockActionContext } from '../../helpers/create-mock-action-context';
import { StoreScope } from '@activepieces/pieces-framework';

describe('Settings Action Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Settings Retrieval', () => {
    it('should retrieve available locales from store', async () => {
      const context = createMockActionContext({
        propsValue: {},
      });

      await context.store.put('i18n_languages', 'en,fr,de', StoreScope.PROJECT);
      await context.store.put('i18n_fallback_locale', 'en', StoreScope.PROJECT);
      await context.store.put('i18n_interpolation_prefix', '%{', StoreScope.PROJECT);
      await context.store.put('i18n_interpolation_suffix', '}', StoreScope.PROJECT);

      const result = await settingsAction.run(context as Parameters<typeof settingsAction.run>[0]) as {
        availableLocales: string[];
        fallbackLocale: string;
        interpolationPrefix: string;
        interpolationSuffix: string;
      };

      expect(result.availableLocales).toEqual(['en', 'fr', 'de']);
    });

    it('should return empty array when no languages configured', async () => {
      const context = createMockActionContext({
        propsValue: {},
      });

      await context.store.put('i18n_fallback_locale', 'en', StoreScope.PROJECT);
      await context.store.put('i18n_interpolation_prefix', '%{', StoreScope.PROJECT);
      await context.store.put('i18n_interpolation_suffix', '}', StoreScope.PROJECT);

      const result = await settingsAction.run(context as Parameters<typeof settingsAction.run>[0]) as {
        availableLocales: string[];
        fallbackLocale: string;
        interpolationPrefix: string;
        interpolationSuffix: string;
      };

      expect(result.availableLocales).toEqual([]);
    });

    it('should retrieve fallback locale from store', async () => {
      const context = createMockActionContext({
        propsValue: {},
      });

      await context.store.put('i18n_languages', 'en', StoreScope.PROJECT);
      await context.store.put('i18n_fallback_locale', 'fr', StoreScope.PROJECT);
      await context.store.put('i18n_interpolation_prefix', '%{', StoreScope.PROJECT);
      await context.store.put('i18n_interpolation_suffix', '}', StoreScope.PROJECT);

      const result = await settingsAction.run(context as Parameters<typeof settingsAction.run>[0]) as {
        availableLocales: string[];
        fallbackLocale: string;
        interpolationPrefix: string;
        interpolationSuffix: string;
      };

      expect(result.fallbackLocale).toBe('fr');
    });

    it('should default fallback locale to en when not configured', async () => {
      const context = createMockActionContext({
        propsValue: {},
      });

      await context.store.put('i18n_languages', 'en', StoreScope.PROJECT);
      await context.store.put('i18n_interpolation_prefix', '%{', StoreScope.PROJECT);
      await context.store.put('i18n_interpolation_suffix', '}', StoreScope.PROJECT);

      const result = await settingsAction.run(context as Parameters<typeof settingsAction.run>[0]) as {
        availableLocales: string[];
        fallbackLocale: string;
        interpolationPrefix: string;
        interpolationSuffix: string;
      };

      expect(result.fallbackLocale).toBe('en');
    });

    it('should retrieve interpolation prefix from store', async () => {
      const context = createMockActionContext({
        propsValue: {},
      });

      await context.store.put('i18n_languages', 'en', StoreScope.PROJECT);
      await context.store.put('i18n_fallback_locale', 'en', StoreScope.PROJECT);
      await context.store.put('i18n_interpolation_prefix', '{{', StoreScope.PROJECT);
      await context.store.put('i18n_interpolation_suffix', '}', StoreScope.PROJECT);

      const result = await settingsAction.run(context as Parameters<typeof settingsAction.run>[0]) as {
        availableLocales: string[];
        fallbackLocale: string;
        interpolationPrefix: string;
        interpolationSuffix: string;
      };

      expect(result.interpolationPrefix).toBe('{{');
    });

    it('should default interpolation prefix to %{ when not configured', async () => {
      const context = createMockActionContext({
        propsValue: {},
      });

      await context.store.put('i18n_languages', 'en', StoreScope.PROJECT);
      await context.store.put('i18n_fallback_locale', 'en', StoreScope.PROJECT);
      await context.store.put('i18n_interpolation_suffix', '}', StoreScope.PROJECT);

      const result = await settingsAction.run(context as Parameters<typeof settingsAction.run>[0]) as {
        availableLocales: string[];
        fallbackLocale: string;
        interpolationPrefix: string;
        interpolationSuffix: string;
      };

      expect(result.interpolationPrefix).toBe('%{');
    });

    it('should retrieve interpolation suffix from store', async () => {
      const context = createMockActionContext({
        propsValue: {},
      });

      await context.store.put('i18n_languages', 'en', StoreScope.PROJECT);
      await context.store.put('i18n_fallback_locale', 'en', StoreScope.PROJECT);
      await context.store.put('i18n_interpolation_prefix', '%{', StoreScope.PROJECT);
      await context.store.put('i18n_interpolation_suffix', '}}', StoreScope.PROJECT);

      const result = await settingsAction.run(context as Parameters<typeof settingsAction.run>[0]) as {
        availableLocales: string[];
        fallbackLocale: string;
        interpolationPrefix: string;
        interpolationSuffix: string;
      };

      expect(result.interpolationSuffix).toBe('}}');
    });

    it('should default interpolation suffix to } when not configured', async () => {
      const context = createMockActionContext({
        propsValue: {},
      });

      await context.store.put('i18n_languages', 'en', StoreScope.PROJECT);
      await context.store.put('i18n_fallback_locale', 'en', StoreScope.PROJECT);
      await context.store.put('i18n_interpolation_prefix', '%{', StoreScope.PROJECT);

      const result = await settingsAction.run(context as Parameters<typeof settingsAction.run>[0]) as {
        availableLocales: string[];
        fallbackLocale: string;
        interpolationPrefix: string;
        interpolationSuffix: string;
      };

      expect(result.interpolationSuffix).toBe('}');
    });
  });
});
