import { configureAction } from '../../../src/lib/actions/configure';
import { createMockActionContext } from '../../helpers/create-mock-action-context';
import { StoreScope } from '@activepieces/pieces-framework';

describe('Configure Action Integration - YAML Files', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should parse and store YAML translation file', async () => {
    const yamlContent = `hello: Hello
world: World
greeting:
  hello: Greetings
  goodbye: Farewell`;

    const mockFile = {
      file: {
        data: Buffer.from(yamlContent),
        filename: 'en.yml',
        extension: 'yml',
      },
    };

    const context = createMockActionContext({
      propsValue: {
        files: [mockFile],
      },
    });

    const result = await configureAction.run(context as Parameters<typeof configureAction.run>[0]) as { ok: boolean; languages: string[]; message: string };

    expect(result).toEqual({
      ok: true,
      languages: ['en'],
      message: 'Loaded 1 translation file(s) in your project',
    });

    const storedHello = await context.store.get<string>('i18n_en_translation_hello', StoreScope.PROJECT);
    expect(storedHello).toBe(JSON.stringify('Hello'));

    const storedGreeting = await context.store.get<string>('i18n_en_translation_greeting.hello', StoreScope.PROJECT);
    expect(storedGreeting).toBe(JSON.stringify('Greetings'));
  });

  it('should handle YAML file with locale code pt_br', async () => {
    const yamlContent = `hello: Olá
world: Mundo`;

    const mockFile = {
      file: {
        data: Buffer.from(yamlContent),
        filename: 'pt_BR.yml',
        extension: 'yml',
      },
    };

    const context = createMockActionContext({
      propsValue: {
        files: [mockFile],
      },
    });

    const result = await configureAction.run(context as Parameters<typeof configureAction.run>[0]) as { ok: boolean; languages: string[]; message: string };

    expect(result.ok).toBe(true);
    expect(result.languages).toContain('pt_br');

    const storedValue = await context.store.get<string>('i18n_pt_br_translation_hello', StoreScope.PROJECT);
    expect(storedValue).toBe(JSON.stringify('Olá'));
  });

  it('should handle YAML file with .yaml extension', async () => {
    const yamlContent = `title: Title
description: Description`;

    const mockFile = {
      file: {
        data: Buffer.from(yamlContent),
        filename: 'en.yaml',
        extension: 'yaml',
      },
    };

    const context = createMockActionContext({
      propsValue: {
        files: [mockFile],
      },
    });

    const result = await configureAction.run(context as Parameters<typeof configureAction.run>[0]) as { ok: boolean; languages: string[]; message: string };

    expect(result.ok).toBe(true);
    const storedValue = await context.store.get<string>('i18n_en_translation_title', StoreScope.PROJECT);
    expect(storedValue).toBe(JSON.stringify('Title'));
  });

  it('should handle mixed JSON and YAML files', async () => {
    const mockFiles = [
      {
        file: {
          data: Buffer.from(JSON.stringify({ hello: 'Hello' })),
          filename: 'en.json',
          extension: 'json',
        },
      },
      {
        file: {
          data: Buffer.from(`hello: Bonjour`),
          filename: 'fr.yml',
          extension: 'yml',
        },
      },
    ];

    const context = createMockActionContext({
      propsValue: {
        files: mockFiles,
      },
    });

    const result = await configureAction.run(context as Parameters<typeof configureAction.run>[0]) as { ok: boolean; languages: string[]; message: string };

    expect(result.ok).toBe(true);
    expect(result.languages).toContain('en');
    expect(result.languages).toContain('fr');

    const enValue = await context.store.get<string>('i18n_en_translation_hello', StoreScope.PROJECT);
    expect(enValue).toBe(JSON.stringify('Hello'));

    const frValue = await context.store.get<string>('i18n_fr_translation_hello', StoreScope.PROJECT);
    expect(frValue).toBe(JSON.stringify('Bonjour'));
  });

  it('should handle complex YAML structure', async () => {
    const yamlContent = `user:
  profile:
    name: John Doe
    email: john@example.com
  settings:
    theme: dark
    language: en
features:
  - feature1
  - feature2`;

    const mockFile = {
      file: {
        data: Buffer.from(yamlContent),
        filename: 'en.yml',
        extension: 'yml',
      },
    };

    const context = createMockActionContext({
      propsValue: {
        files: [mockFile],
      },
    });

    const result = await configureAction.run(context as Parameters<typeof configureAction.run>[0]) as { ok: boolean; languages: string[]; message: string };

    expect(result.ok).toBe(true);
    const storedName = await context.store.get<string>('i18n_en_translation_user.profile.name', StoreScope.PROJECT);
    expect(storedName).toBe(JSON.stringify('John Doe'));

    const storedTheme = await context.store.get<string>('i18n_en_translation_user.settings.theme', StoreScope.PROJECT);
    expect(storedTheme).toBe(JSON.stringify('dark'));

    const storedFeatures = await context.store.get<string>('i18n_en_translation_features', StoreScope.PROJECT);
    expect(storedFeatures).toBe(JSON.stringify(['feature1', 'feature2']));
  });
});
