import { configureAction } from '../../../src/lib/actions/configure';
import { createMockActionContext } from '../../helpers/create-mock-action-context';
import { StoreScope } from '@activepieces/pieces-framework';

describe('Configure Action Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('File processing', () => {
    it('should skip files without file property', async () => {
      const context = createMockActionContext({
        propsValue: {
          files: [
            { file: undefined },
            {
              file: {
                data: Buffer.from(JSON.stringify({ hello: 'Hello' })),
                filename: 'en.json',
                extension: 'json',
              },
            },
          ] as any,
        },
      });

      const result = await configureAction.run(context as Parameters<typeof configureAction.run>[0]) as { ok: boolean; languages: string[]; message: string };

      expect(result.ok).toBe(true);
      expect(result.message).toBe('Loaded 1 translation file(s) in your project');
    });

    it('should throw error when no files provided', async () => {
      const context = createMockActionContext({
        propsValue: {
          files: [],
        },
      });

      await expect(configureAction.run(context as Parameters<typeof configureAction.run>[0])).rejects.toThrow(
        'At least one translation file is required'
      );
    });

    it('should throw error when file contains invalid JSON', async () => {
      const context = createMockActionContext({
        propsValue: {
          files: [
            {
              file: {
                data: Buffer.from('invalid json'),
                filename: 'en.json',
                extension: 'json',
              },
            },
          ],
        },
      });

      await expect(configureAction.run(context as Parameters<typeof configureAction.run>[0])).rejects.toThrow(
        'Failed to parse file en.json'
      );
    });

    it('should parse YAML files correctly', async () => {
      const yamlContent = `hello: Hello
world: World`;

      const context = createMockActionContext({
        propsValue: {
          files: [
            {
              file: {
                data: Buffer.from(yamlContent),
                filename: 'en.yml',
                extension: 'yml',
              },
            },
          ],
        },
      });

      await configureAction.run(context as Parameters<typeof configureAction.run>[0]);

      expect(context.store.put).toHaveBeenCalledWith(
        'i18n_en_translation_hello',
        JSON.stringify('Hello'),
        StoreScope.PROJECT
      );
      expect(context.store.put).toHaveBeenCalledWith(
        'i18n_en_translation_world',
        JSON.stringify('World'),
        StoreScope.PROJECT
      );
    });

    it('should throw error when YAML file contains invalid YAML', async () => {
      const context = createMockActionContext({
        propsValue: {
          files: [
            {
              file: {
                data: Buffer.from('invalid: yaml: content: [unclosed'),
                filename: 'en.yml',
                extension: 'yml',
              },
            },
          ],
        },
      });

      await expect(configureAction.run(context as Parameters<typeof configureAction.run>[0])).rejects.toThrow(
        'Failed to parse file en.yml'
      );
    });
  });

  describe('Language extraction', () => {
    it('should extract language from filename', async () => {
      const context = createMockActionContext({
        propsValue: {
          files: [
            {
              file: {
                data: Buffer.from(JSON.stringify({ key: 'value' })),
                filename: 'fr.json',
                extension: 'json',
              },
            },
          ],
        },
      });

      await configureAction.run(context as Parameters<typeof configureAction.run>[0]);

      expect(context.store.put).toHaveBeenCalledWith(
        'i18n_namespaces_fr',
        'translation',
        StoreScope.PROJECT
      );
      expect(context.store.put).toHaveBeenCalledWith(
        'i18n_languages',
        'fr',
        StoreScope.PROJECT
      );
    });

    it('should handle locale codes with region like pt_BR', async () => {
      const context = createMockActionContext({
        propsValue: {
          files: [
            {
              file: {
                data: Buffer.from(JSON.stringify({ hello: 'Olá' })),
                filename: 'pt_BR.json',
                extension: 'json',
              },
            },
          ],
        },
      });

      await configureAction.run(context as Parameters<typeof configureAction.run>[0]);

      expect(context.store.put).toHaveBeenCalledWith(
        'i18n_languages',
        'pt_br',
        StoreScope.PROJECT
      );
      expect(context.store.put).toHaveBeenCalledWith(
        'i18n_namespaces_pt_br',
        'translation',
        StoreScope.PROJECT
      );
    });

    it('should handle locale codes with region like en_US', async () => {
      const context = createMockActionContext({
        propsValue: {
          files: [
            {
              file: {
                data: Buffer.from(JSON.stringify({ hello: 'Hello' })),
                filename: 'en_US.json',
                extension: 'json',
              },
            },
          ],
        },
      });

      await configureAction.run(context as Parameters<typeof configureAction.run>[0]);

      expect(context.store.put).toHaveBeenCalledWith(
        'i18n_languages',
        'en_us',
        StoreScope.PROJECT
      );
      expect(context.store.put).toHaveBeenCalledWith(
        'i18n_namespaces_en_us',
        'translation',
        StoreScope.PROJECT
      );
    });

    it('should throw error for invalid filename format', async () => {
      const context = createMockActionContext({
        propsValue: {
          files: [
            {
              file: {
                data: Buffer.from(JSON.stringify({ key: 'value' })),
                filename: 'invalid.json',
                extension: 'json',
              },
            },
          ],
        },
      });

      await expect(configureAction.run(context as Parameters<typeof configureAction.run>[0])).rejects.toThrow(
        'Invalid filename format'
      );
    });
  });

  describe('Multiple files handling', () => {
    it('should handle multiple languages', async () => {
      const context = createMockActionContext({
        propsValue: {
          files: [
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
          ],
        },
      });

      const result = await configureAction.run(context as Parameters<typeof configureAction.run>[0]) as { ok: boolean; languages: string[]; message: string };

      expect(result.languages).toContain('en');
      expect(result.languages).toContain('fr');
      expect(result.languages.length).toBe(2);
    });

    it('should handle multiple files for same language', async () => {
      const context = createMockActionContext({
        propsValue: {
          files: [
            {
              file: {
                data: Buffer.from(JSON.stringify({ key1: 'value1' })),
                filename: 'en.json',
                extension: 'json',
              },
            },
            {
              file: {
                data: Buffer.from(JSON.stringify({ key2: 'value2' })),
                filename: 'fr.json',
                extension: 'json',
              },
            },
          ],
        },
      });

      await configureAction.run(context as Parameters<typeof configureAction.run>[0]);

      expect(context.store.put).toHaveBeenCalledWith(
        'i18n_namespaces_en',
        'translation',
        StoreScope.PROJECT
      );
      expect(context.store.put).toHaveBeenCalledWith(
        'i18n_namespaces_fr',
        'translation',
        StoreScope.PROJECT
      );
    });
  });
});
