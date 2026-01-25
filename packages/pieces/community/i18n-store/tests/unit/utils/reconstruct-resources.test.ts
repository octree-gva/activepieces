import { reconstructResources } from '../../../src/lib/actions/translate';
import { createMockActionContext } from '../../helpers/create-mock-action-context';
import { StoreScope } from '@activepieces/pieces-framework';

describe('reconstructResources', () => {
  it('should reconstruct resources from store correctly', async () => {
    const context = createMockActionContext();
    await context.store.put('i18n_namespaces_en', 'translation', StoreScope.PROJECT);
    await context.store.put('i18n_all_keys_en_translation', 'hello,world', StoreScope.PROJECT);
    await context.store.put('i18n_en_translation_hello', JSON.stringify('Hello'), StoreScope.PROJECT);
    await context.store.put('i18n_en_translation_world', JSON.stringify('World'), StoreScope.PROJECT);

    const result = await reconstructResources(context, 'en');

    expect(result).toEqual({
      en: {
        translation: {
          hello: 'Hello',
          world: 'World',
        },
      },
    });
  });

  it('should handle multiple namespaces', async () => {
    const context = createMockActionContext();
    await context.store.put('i18n_namespaces_en', 'translation,common', StoreScope.PROJECT);
    await context.store.put('i18n_all_keys_en_translation', 'hello', StoreScope.PROJECT);
    await context.store.put('i18n_en_translation_hello', JSON.stringify('Hello'), StoreScope.PROJECT);
    await context.store.put('i18n_all_keys_en_common', 'title', StoreScope.PROJECT);
    await context.store.put('i18n_en_common_title', JSON.stringify('Common Title'), StoreScope.PROJECT);

    const result = await reconstructResources(context, 'en');

    expect(result).toEqual({
      en: {
        translation: {
          hello: 'Hello',
        },
        common: {
          title: 'Common Title',
        },
      },
    });
  });

  it('should reconstruct nested objects correctly', async () => {
    const context = createMockActionContext();
    await context.store.put('i18n_namespaces_en', 'translation', StoreScope.PROJECT);
    await context.store.put('i18n_all_keys_en_translation', 'greeting.hello', StoreScope.PROJECT);
    await context.store.put('i18n_en_translation_greeting.hello', JSON.stringify('Greetings'), StoreScope.PROJECT);

    const result = await reconstructResources(context, 'en');

    expect(result).toEqual({
      en: {
        translation: {
          greeting: {
            hello: 'Greetings',
          },
        },
      },
    });
  });

  it('should return empty object when no namespaces found', async () => {
    const context = createMockActionContext();
    const result = await reconstructResources(context, 'en');
    expect(result).toEqual({});
  });

  it('should skip empty namespaces', async () => {
    const context = createMockActionContext();
    await context.store.put('i18n_namespaces_en', 'translation,,common', StoreScope.PROJECT);
    await context.store.put('i18n_all_keys_en_translation', 'hello', StoreScope.PROJECT);
    await context.store.put('i18n_en_translation_hello', JSON.stringify('Hello'), StoreScope.PROJECT);
    await context.store.put('i18n_all_keys_en_common', 'title', StoreScope.PROJECT);
    await context.store.put('i18n_en_common_title', JSON.stringify('Title'), StoreScope.PROJECT);

    const result = await reconstructResources(context, 'en');

    expect(result['en']['translation']).toBeDefined();
    expect(result['en']['common']).toBeDefined();
  });

  it('should skip namespaces without keys', async () => {
    const context = createMockActionContext();
    await context.store.put('i18n_namespaces_en', 'translation,common', StoreScope.PROJECT);
    await context.store.put('i18n_all_keys_en_translation', 'hello', StoreScope.PROJECT);
    await context.store.put('i18n_en_translation_hello', JSON.stringify('Hello'), StoreScope.PROJECT);

    const result = await reconstructResources(context, 'en');

    expect(result['en']['translation']).toBeDefined();
    expect(result['en']['common']).toEqual({});
  });
});
