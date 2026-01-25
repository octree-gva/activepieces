import { translateAction } from '../../../src/lib/actions/translate';
import { createMockActionContext } from '../../helpers/create-mock-action-context';
import { StoreScope } from '@activepieces/pieces-framework';

describe('Translate Action Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const setupStore = async (context: ReturnType<typeof createMockActionContext>) => {
    await context.store.put('i18n_instance', 'initialized', StoreScope.PROJECT);
    await context.store.put('i18n_languages', 'en,fr', StoreScope.PROJECT);
    await context.store.put('i18n_namespaces_en', 'translation', StoreScope.PROJECT);
    await context.store.put('i18n_all_keys_en_translation', 'hello,world', StoreScope.PROJECT);
    await context.store.put('i18n_en_translation_hello', JSON.stringify('Hello'), StoreScope.PROJECT);
    await context.store.put('i18n_en_translation_world', JSON.stringify('World'), StoreScope.PROJECT);
    await context.store.put('i18n_interpolation_prefix', '%{', StoreScope.PROJECT);
    await context.store.put('i18n_interpolation_suffix', '}', StoreScope.PROJECT);
    await context.store.put('i18n_fallback_locale', 'en', StoreScope.PROJECT);
  };

  describe('Validation', () => {
    it('should validate store initialization', async () => {
      const context = createMockActionContext({
        propsValue: {
          language: 'en',
          path: 'hello',
          return_object: false,
        },
      });

      await expect(translateAction.run(context as Parameters<typeof translateAction.run>[0])).rejects.toThrow(
        'Translation store not initialized'
      );
    });

    it('should validate language exists', async () => {
      const context = createMockActionContext({
        propsValue: {
          language: 'de',
          path: 'hello',
          return_object: false,
        },
      });

      await context.store.put('i18n_instance', 'initialized', StoreScope.PROJECT);
      await context.store.put('i18n_languages', 'en,fr', StoreScope.PROJECT);

      await expect(translateAction.run(context as Parameters<typeof translateAction.run>[0])).rejects.toThrow(
        'Language "de" not found in store'
      );
    });

    it('should validate resources exist for language', async () => {
      const context = createMockActionContext({
        propsValue: {
          language: 'en',
          path: 'hello',
          return_object: false,
        },
      });

      await context.store.put('i18n_instance', 'initialized', StoreScope.PROJECT);
      await context.store.put('i18n_languages', 'en', StoreScope.PROJECT);
      await context.store.put('i18n_namespaces_en', '', StoreScope.PROJECT);

      await expect(translateAction.run(context as Parameters<typeof translateAction.run>[0])).rejects.toThrow(
        'No resources found for language: en'
      );
    });
  });
});
