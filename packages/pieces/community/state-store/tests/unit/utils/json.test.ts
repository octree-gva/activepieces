import { jsonStringify, jsonParse, parseJsonSafely } from '../../../src/lib/utils/json';

describe('parseJsonSafely', () => {
  it('should parse valid JSON string', async () => {
    const result = await parseJsonSafely<{ key: string }>('{"key":"value"}');
    expect(result).toEqual({ key: 'value' });
  });

  it('should return null for null/undefined/empty input', async () => {
    expect(await parseJsonSafely(null)).toBeNull();
    expect(await parseJsonSafely(undefined)).toBeNull();
    expect(await parseJsonSafely('')).toBeNull();
  });

  it('should return null for invalid JSON', async () => {
    expect(await parseJsonSafely('invalid json')).toBeNull();
  });

  it('should parse superjson format', async () => {
    const obj = { timestamp: new Date('2024-01-01T00:00:00Z'), value: 'test' };
    const str = await jsonStringify(obj);
    const result = await parseJsonSafely<typeof obj>(str);
    expect(result?.value).toBe('test');
    expect(result?.timestamp).toBeInstanceOf(Date);
  });
});

describe('jsonStringify', () => {
  it('should serialize regular objects', async () => {
    const obj = { key: 'value', number: 123 };
    const result = await jsonStringify(obj);
    const parsed = await jsonParse<typeof obj>(result);
    expect(parsed).toEqual(obj);
  });

  it('should serialize Date objects and restore them', async () => {
    const date = new Date('2024-01-01T00:00:00Z');
    const obj = { timestamp: date };
    const result = await jsonStringify(obj);
    const parsed = await jsonParse<typeof obj>(result);
    expect(parsed.timestamp).toBeInstanceOf(Date);
    expect(parsed.timestamp.toISOString()).toBe('2024-01-01T00:00:00.000Z');
  });

  it('should handle nested Date objects', async () => {
    const date = new Date('2024-01-01T00:00:00Z');
    const obj = {
      nested: {
        timestamp: date,
        value: 'test',
      },
    };
    const result = await jsonStringify(obj);
    const parsed = await jsonParse<typeof obj>(result);
    expect(parsed.nested.timestamp).toBeInstanceOf(Date);
    expect(parsed.nested.timestamp.toISOString()).toBe('2024-01-01T00:00:00.000Z');
    expect(parsed.nested.value).toBe('test');
  });

  it('should handle arrays with Date objects', async () => {
    const dates = [new Date('2024-01-01T00:00:00Z'), new Date('2024-01-02T00:00:00Z')];
    const obj = { dates };
    const result = await jsonStringify(obj);
    const parsed = await jsonParse<typeof obj>(result);
    expect(parsed.dates[0]).toBeInstanceOf(Date);
    expect(parsed.dates[1]).toBeInstanceOf(Date);
    expect(parsed.dates[0].toISOString()).toBe('2024-01-01T00:00:00.000Z');
    expect(parsed.dates[1].toISOString()).toBe('2024-01-02T00:00:00.000Z');
  });

  it('should handle null and undefined values', async () => {
    const obj = { nullValue: null, undefinedValue: undefined };
    const result = await jsonStringify(obj);
    const parsed = await jsonParse<typeof obj>(result);
    expect(parsed.nullValue).toBeNull();
    expect(parsed.undefinedValue).toBeUndefined();
  });

  it('should handle empty objects', async () => {
    const obj = {};
    const result = await jsonStringify(obj);
    const parsed = await jsonParse<typeof obj>(result);
    expect(parsed).toEqual({});
  });

  it('should handle objects without Date objects', async () => {
    const obj = {
      string: 'test',
      number: 123,
      boolean: true,
      array: [1, 2, 3],
    };
    const result = await jsonStringify(obj);
    const parsed = await jsonParse<typeof obj>(result);
    expect(parsed).toEqual(obj);
  });

  it('should handle circular references', async () => {
    const obj: any = { key: 'value' };
    obj.circular = obj; // Create circular reference
    
    const result = await jsonStringify(obj);
    await expect(jsonParse(result)).resolves.not.toThrow();
    const parsed = await jsonParse<any>(result);
    expect(parsed.key).toBe('value');
    expect(parsed.circular).toBe(parsed); // Circular reference preserved
  });

  it('should handle nested circular references', async () => {
    const obj: any = {
      nested: {
        value: 'test',
      },
    };
    obj.nested.parent = obj; // Create nested circular reference
    
    const result = await jsonStringify(obj);
    await expect(jsonParse(result)).resolves.not.toThrow();
    const parsed = await jsonParse<any>(result);
    expect(parsed.nested.value).toBe('test');
    expect(parsed.nested.parent).toBe(parsed); // Circular reference preserved
  });

  it('should handle circular references with Date objects', async () => {
    const obj: any = {
      timestamp: new Date('2024-01-01T00:00:00Z'),
    };
    obj.self = obj; // Create circular reference
    
    const result = await jsonStringify(obj);
    await expect(jsonParse(result)).resolves.not.toThrow();
    const parsed = await jsonParse<any>(result);
    expect(parsed.timestamp).toBeInstanceOf(Date);
    expect(parsed.timestamp.toISOString()).toBe('2024-01-01T00:00:00.000Z');
    expect(parsed.self).toBe(parsed); // Circular reference preserved
  });

    it('should handle arrays with circular references', async () => {
      const obj: any = { items: [] };
      obj.items.push(obj); // Array contains reference to parent
      
      const result = await jsonStringify(obj);
      await expect(jsonParse(result)).resolves.not.toThrow();
      const parsed = await jsonParse<any>(result);
      expect(Array.isArray(parsed.items)).toBe(true);
      expect(parsed.items[0]).toBe(parsed); // Circular reference preserved
    });

    it('should handle primitive values', async () => {
      const result = await jsonStringify('string');
      const parsed = await jsonParse<string>(result);
      expect(parsed).toBe('string');
    });

    it('should handle numbers', async () => {
      const result = await jsonStringify(123);
      const parsed = await jsonParse<number>(result);
      expect(parsed).toBe(123);
    });

    it('should handle booleans', async () => {
      const result = await jsonStringify(true);
      const parsed = await jsonParse<boolean>(result);
      expect(parsed).toBe(true);
    });

    it('should handle arrays', async () => {
      const arr = [1, 2, 3];
      const result = await jsonStringify(arr);
      const parsed = await jsonParse<number[]>(result);
      expect(parsed).toEqual([1, 2, 3]);
    });
});
