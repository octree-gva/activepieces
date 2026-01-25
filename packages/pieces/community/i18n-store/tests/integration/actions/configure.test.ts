import { configureAction } from '../../../src/lib/actions/configure';
import { createMockActionContext } from '../../helpers/create-mock-action-context';
import { StoreScope } from '@activepieces/pieces-framework';

describe('Configure Action Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should store translation files and make them retrievable', async () => {
    const mockFile = {
      file: {
        data: Buffer.from(JSON.stringify({ hello: 'Hello', world: 'World' })),
        filename: 'en.json',
        extension: 'json',
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

    const storedValue = await context.store.get<string>('i18n_en_translation_hello', StoreScope.PROJECT);
    expect(storedValue).toBe(JSON.stringify('Hello'));
  });

  it('should handle multiple languages', async () => {
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
          data: Buffer.from(JSON.stringify({ hello: 'Bonjour' })),
          filename: 'fr.json',
          extension: 'json',
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
    expect(result.languages.length).toBe(2);
  });

  it('should handle nested translation objects', async () => {
    const mockFile = {
      file: {
        data: Buffer.from(JSON.stringify({
          greeting: {
            hello: 'Hello',
            goodbye: 'Goodbye',
          },
        })),
        filename: 'en.json',
        extension: 'json',
      },
    };

    const context = createMockActionContext({
      propsValue: {
        files: [mockFile],
      },
    });

    const result = await configureAction.run(context as Parameters<typeof configureAction.run>[0]) as { ok: boolean; languages: string[]; message: string };

    expect(result.ok).toBe(true);
    const storedValue = await context.store.get<string>('i18n_en_translation_greeting.hello', StoreScope.PROJECT);
    expect(storedValue).toBe(JSON.stringify('Hello'));
  });

  it('should handle locale codes with underscores like pt_BR', async () => {
    const mockFile = {
      file: {
        data: Buffer.from(JSON.stringify({ hello: 'Olá', world: 'Mundo' })),
        filename: 'pt_BR.json',
        extension: 'json',
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

  it('should handle es_MX locale code', async () => {
    const mockFile = {
      file: {
        data: Buffer.from(JSON.stringify({ hello: 'Hola' })),
        filename: 'es_MX.json',
        extension: 'json',
      },
    };

    const context = createMockActionContext({
      propsValue: {
        files: [mockFile],
      },
    });

    const result = await configureAction.run(context as Parameters<typeof configureAction.run>[0]) as { ok: boolean; languages: string[]; message: string };

    expect(result.ok).toBe(true);
    expect(result.languages).toContain('es_mx');
    const storedValue = await context.store.get<string>('i18n_es_mx_translation_hello', StoreScope.PROJECT);
    expect(storedValue).toBe(JSON.stringify('Hola'));
  });

  it('should store interpolation configuration', async () => {
    const mockFile = {
      file: {
        data: Buffer.from(JSON.stringify({ hello: 'Hello' })),
        filename: 'en.json',
        extension: 'json',
      },
    };

    const context = createMockActionContext({
      propsValue: {
        files: [mockFile],
        interpolationPrefix: '{{',
        interpolationSuffix: '}}',
        fallbackLocale: 'fr',
      },
    });

    await configureAction.run(context as Parameters<typeof configureAction.run>[0]);

    const prefix = await context.store.get<string>('i18n_interpolation_prefix', StoreScope.PROJECT);
    const suffix = await context.store.get<string>('i18n_interpolation_suffix', StoreScope.PROJECT);
    const fallback = await context.store.get<string>('i18n_fallback_locale', StoreScope.PROJECT);

    expect(prefix).toBe('{{');
    expect(suffix).toBe('}}');
    expect(fallback).toBe('fr');
  });

  it('should use default interpolation and fallback locale when not provided', async () => {
    const mockFile = {
      file: {
        data: Buffer.from(JSON.stringify({ hello: 'Hello' })),
        filename: 'en.json',
        extension: 'json',
      },
    };

    const context = createMockActionContext({
      propsValue: {
        files: [mockFile],
      },
    });

    await configureAction.run(context as Parameters<typeof configureAction.run>[0]);

    const prefix = await context.store.get<string>('i18n_interpolation_prefix', StoreScope.PROJECT);
    const suffix = await context.store.get<string>('i18n_interpolation_suffix', StoreScope.PROJECT);
    const fallback = await context.store.get<string>('i18n_fallback_locale', StoreScope.PROJECT);

    expect(prefix).toBe('%{');
    expect(suffix).toBe('}');
    expect(fallback).toBe('en');
  });
});
