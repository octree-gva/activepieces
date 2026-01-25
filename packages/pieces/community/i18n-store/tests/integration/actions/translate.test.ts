import { translateAction } from '../../../src/lib/actions/translate';
import { createMockActionContext } from '../../helpers/create-mock-action-context';
import { StoreScope } from '@activepieces/pieces-framework';

describe('Translate Action Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const setupStore = async (context: ReturnType<typeof createMockActionContext>) => {
    await context.store.put('i18n_instance', 'initialized', StoreScope.PROJECT);
    await context.store.put('i18n_languages', 'en,fr', StoreScope.PROJECT);
    await context.store.put('i18n_namespaces_en', 'translation', StoreScope.PROJECT);
    await context.store.put('i18n_all_keys_en_translation', 'hello,world,greeting.hello', StoreScope.PROJECT);
    await context.store.put('i18n_en_translation_hello', JSON.stringify('Hello'), StoreScope.PROJECT);
    await context.store.put('i18n_en_translation_world', JSON.stringify('World'), StoreScope.PROJECT);
    await context.store.put('i18n_en_translation_greeting.hello', JSON.stringify('Greetings'), StoreScope.PROJECT);
    await context.store.put('i18n_interpolation_prefix', '%{', StoreScope.PROJECT);
    await context.store.put('i18n_interpolation_suffix', '}', StoreScope.PROJECT);
    await context.store.put('i18n_fallback_locale', 'en', StoreScope.PROJECT);
  };

  it('should retrieve translation for simple key', async () => {
    const context = createMockActionContext({
      propsValue: {
        language: 'en',
        path: 'hello',
        return_object: false,
      },
    });

    await setupStore(context);
    const result = await translateAction.run(context as Parameters<typeof translateAction.run>[0]);

    expect(result).toEqual({
      ok: true,
      path: 'hello',
      language: 'en',
      translation: 'Hello',
    });
  });

  it('should retrieve translation for nested key', async () => {
    const context = createMockActionContext({
      propsValue: {
        language: 'en',
        path: 'greeting.hello',
        return_object: false,
      },
    });

    await setupStore(context);
    const result = await translateAction.run(context as Parameters<typeof translateAction.run>[0]);

    expect(result).toEqual({
      ok: true,
      path: 'greeting.hello',
      language: 'en',
      translation: 'Greetings',
    });
  });

  it('should return object when return_object is true', async () => {
    const context = createMockActionContext({
      propsValue: {
        language: 'en',
        path: 'greeting',
        return_object: true,
      },
    });

    await setupStore(context);
    await context.store.put('i18n_all_keys_en_translation', 'greeting', StoreScope.PROJECT);
    await context.store.put('i18n_en_translation_greeting', JSON.stringify({ hello: 'Hello', goodbye: 'Goodbye' }), StoreScope.PROJECT);

    const result = await translateAction.run(context as Parameters<typeof translateAction.run>[0]);

    expect(result).toEqual({
      ok: true,
      path: 'greeting',
      language: 'en',
      translation: { hello: 'Hello', goodbye: 'Goodbye' },
    });
  });

  it('should handle namespace:key format', async () => {
    const context = createMockActionContext({
      propsValue: {
        language: 'en',
        path: 'common:title',
        return_object: false,
      },
    });

    await setupStore(context);
    await context.store.put('i18n_namespaces_en', 'translation,common', StoreScope.PROJECT);
    await context.store.put('i18n_all_keys_en_common', 'title', StoreScope.PROJECT);
    await context.store.put('i18n_en_common_title', JSON.stringify('Common Title'), StoreScope.PROJECT);

    const result = await translateAction.run(context as Parameters<typeof translateAction.run>[0]);

    expect(result).toEqual({
      ok: true,
      path: 'common:title',
      language: 'en',
      translation: 'Common Title',
    });
  });

  it('should handle locale codes with underscores like pt_br', async () => {
    const context = createMockActionContext({
      propsValue: {
        language: 'pt',
        path: 'hello',
        return_object: false,
      },
    });

    await context.store.put('i18n_instance', 'initialized', StoreScope.PROJECT);
    await context.store.put('i18n_languages', 'pt', StoreScope.PROJECT);
    await context.store.put('i18n_namespaces_pt', 'br', StoreScope.PROJECT);
    await context.store.put('i18n_all_keys_pt_br', 'hello', StoreScope.PROJECT);
    await context.store.put('i18n_pt_br_hello', JSON.stringify('Olá'), StoreScope.PROJECT);
    await context.store.put('i18n_interpolation_prefix', '%{', StoreScope.PROJECT);
    await context.store.put('i18n_interpolation_suffix', '}', StoreScope.PROJECT);
    await context.store.put('i18n_fallback_locale', 'en', StoreScope.PROJECT);

    const result = await translateAction.run(context as Parameters<typeof translateAction.run>[0]);

    expect(result).toEqual({
      ok: true,
      path: 'hello',
      language: 'pt',
      translation: 'Olá',
    });
  });

  it('should handle es_mx locale code', async () => {
    const context = createMockActionContext({
      propsValue: {
        language: 'es',
        path: 'hello',
        return_object: false,
      },
    });

    await context.store.put('i18n_instance', 'initialized', StoreScope.PROJECT);
    await context.store.put('i18n_languages', 'es', StoreScope.PROJECT);
    await context.store.put('i18n_namespaces_es', 'mx', StoreScope.PROJECT);
    await context.store.put('i18n_all_keys_es_mx', 'hello', StoreScope.PROJECT);
    await context.store.put('i18n_es_mx_hello', JSON.stringify('Hola'), StoreScope.PROJECT);
    await context.store.put('i18n_interpolation_prefix', '%{', StoreScope.PROJECT);
    await context.store.put('i18n_interpolation_suffix', '}', StoreScope.PROJECT);
    await context.store.put('i18n_fallback_locale', 'en', StoreScope.PROJECT);

    const result = await translateAction.run(context as Parameters<typeof translateAction.run>[0]);

    expect(result).toEqual({
      ok: true,
      path: 'hello',
      language: 'es',
      translation: 'Hola',
    });
  });

  it('should use fallback locale when translation not found', async () => {
    const context = createMockActionContext({
      propsValue: {
        language: 'de',
        path: 'hello',
        return_object: false,
      },
    });

    await context.store.put('i18n_instance', 'initialized', StoreScope.PROJECT);
    await context.store.put('i18n_languages', 'en,de', StoreScope.PROJECT);
    await context.store.put('i18n_namespaces_en', 'translation', StoreScope.PROJECT);
    await context.store.put('i18n_namespaces_de', 'translation', StoreScope.PROJECT);
    await context.store.put('i18n_all_keys_en_translation', 'hello', StoreScope.PROJECT);
    await context.store.put('i18n_all_keys_de_translation', 'world', StoreScope.PROJECT);
    await context.store.put('i18n_en_translation_hello', JSON.stringify('Hello'), StoreScope.PROJECT);
    await context.store.put('i18n_de_translation_world', JSON.stringify('Welt'), StoreScope.PROJECT);
    await context.store.put('i18n_interpolation_prefix', '%{', StoreScope.PROJECT);
    await context.store.put('i18n_interpolation_suffix', '}', StoreScope.PROJECT);
    await context.store.put('i18n_fallback_locale', 'en', StoreScope.PROJECT);

    const result = await translateAction.run(context as Parameters<typeof translateAction.run>[0]);

    expect(result).toEqual({
      ok: true,
      path: 'hello',
      language: 'de',
      translation: 'Hello',
    });
  });

  it('should use custom interpolation prefix and suffix', async () => {
    const context = createMockActionContext({
      propsValue: {
        language: 'en',
        path: 'greeting',
        return_object: false,
        variables: [{ key: 'name', value: 'John' }],
      },
    });

    await context.store.put('i18n_instance', 'initialized', StoreScope.PROJECT);
    await context.store.put('i18n_languages', 'en', StoreScope.PROJECT);
    await context.store.put('i18n_namespaces_en', 'translation', StoreScope.PROJECT);
    await context.store.put('i18n_all_keys_en_translation', 'greeting', StoreScope.PROJECT);
    await context.store.put('i18n_en_translation_greeting', JSON.stringify('Hello {{name}}'), StoreScope.PROJECT);
    await context.store.put('i18n_interpolation_prefix', '{{', StoreScope.PROJECT);
    await context.store.put('i18n_interpolation_suffix', '}}', StoreScope.PROJECT);
    await context.store.put('i18n_fallback_locale', 'en', StoreScope.PROJECT);

    const result = await translateAction.run(context as Parameters<typeof translateAction.run>[0]);

    expect(result).toEqual({
      ok: true,
      path: 'greeting',
      language: 'en',
      translation: 'Hello John',
    });
  });

  it('should throw error when no languages found in store', async () => {
    const context = createMockActionContext({
      propsValue: {
        language: 'en',
        path: 'hello',
        return_object: false,
      },
    });

    await context.store.put('i18n_instance', 'initialized', StoreScope.PROJECT);

    await expect(translateAction.run(context as Parameters<typeof translateAction.run>[0])).rejects.toThrow(
      'No languages found in store'
    );
  });

  it('should throw error when translation key not found', async () => {
    const context = createMockActionContext({
      propsValue: {
        language: 'en',
        path: 'nonexistent.key',
        return_object: false,
      },
    });

    await setupStore(context);

    await expect(translateAction.run(context as Parameters<typeof translateAction.run>[0])).rejects.toThrow(
      'Translation not found for path: nonexistent.key in language: en'
    );
  });
});
