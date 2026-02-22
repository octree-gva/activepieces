import { jsonStringify, jsonParse, parseJsonSafely } from '../../../src/lib/utils/json';

describe('parseJsonSafely', () => {
  it('should parse valid JSON string', () => {
    const result = parseJsonSafely<{ key: string }>('{"key":"value"}');
    expect(result).toEqual({ key: 'value' });
  });

  it('should return null for null/undefined/empty input', () => {
    expect(parseJsonSafely(null)).toBeNull();
    expect(parseJsonSafely(undefined)).toBeNull();
    expect(parseJsonSafely('')).toBeNull();
  });

  it('should return null for invalid JSON', () => {
    expect(parseJsonSafely('invalid json')).toBeNull();
  });

  it('should parse flatted format with Date', () => {
    const obj = { timestamp: new Date('2024-01-01T00:00:00Z'), value: 'test' };
    const str = jsonStringify(obj);
    const result = parseJsonSafely<typeof obj>(str);
    expect(result?.value).toBe('test');
    expect(result?.timestamp).toBeInstanceOf(Date);
  });
});

describe('jsonStringify', () => {
  it('should serialize regular objects', () => {
    const obj = { key: 'value', number: 123 };
    const result = jsonStringify(obj);
    const parsed = jsonParse<typeof obj>(result);
    expect(parsed).toEqual(obj);
  });

  it('should serialize Date objects and restore them', () => {
    const date = new Date('2024-01-01T00:00:00Z');
    const obj = { timestamp: date };
    const result = jsonStringify(obj);
    const parsed = jsonParse<typeof obj>(result);
    expect(parsed.timestamp).toBeInstanceOf(Date);
    expect(parsed.timestamp.toISOString()).toBe('2024-01-01T00:00:00.000Z');
  });

  it('should handle nested Date objects', () => {
    const date = new Date('2024-01-01T00:00:00Z');
    const obj = {
      nested: {
        timestamp: date,
        value: 'test',
      },
    };
    const result = jsonStringify(obj);
    const parsed = jsonParse<typeof obj>(result);
    expect(parsed.nested.timestamp).toBeInstanceOf(Date);
    expect(parsed.nested.timestamp.toISOString()).toBe('2024-01-01T00:00:00.000Z');
    expect(parsed.nested.value).toBe('test');
  });

  it('should handle arrays with Date objects', () => {
    const dates = [new Date('2024-01-01T00:00:00Z'), new Date('2024-01-02T00:00:00Z')];
    const obj = { dates };
    const result = jsonStringify(obj);
    const parsed = jsonParse<typeof obj>(result);
    expect(parsed.dates[0]).toBeInstanceOf(Date);
    expect(parsed.dates[1]).toBeInstanceOf(Date);
    expect(parsed.dates[0].toISOString()).toBe('2024-01-01T00:00:00.000Z');
    expect(parsed.dates[1].toISOString()).toBe('2024-01-02T00:00:00.000Z');
  });

  it('should handle null values', () => {
    const obj = { nullValue: null };
    const result = jsonStringify(obj);
    const parsed = jsonParse<typeof obj>(result);
    expect(parsed.nullValue).toBeNull();
  });

  it('should handle empty objects', () => {
    const obj = {};
    const result = jsonStringify(obj);
    const parsed = jsonParse<typeof obj>(result);
    expect(parsed).toEqual({});
  });

  it('should handle objects without Date objects', () => {
    const obj = {
      string: 'test',
      number: 123,
      boolean: true,
      array: [1, 2, 3],
    };
    const result = jsonStringify(obj);
    const parsed = jsonParse<typeof obj>(result);
    expect(parsed).toEqual(obj);
  });

  it('should handle circular references', () => {
    const obj: any = { key: 'value' };
    obj.circular = obj;
    const result = jsonStringify(obj);
    expect(() => jsonParse(result)).not.toThrow();
    const parsed = jsonParse<any>(result);
    expect(parsed.key).toBe('value');
    expect(parsed.circular).toBe(parsed);
  });

  it('should handle nested circular references', () => {
    const obj: any = {
      nested: {
        value: 'test',
      },
    };
    obj.nested.parent = obj;
    const result = jsonStringify(obj);
    expect(() => jsonParse(result)).not.toThrow();
    const parsed = jsonParse<any>(result);
    expect(parsed.nested.value).toBe('test');
    expect(parsed.nested.parent).toBe(parsed);
  });

  it('should handle circular references with Date objects', () => {
    const obj: any = {
      timestamp: new Date('2024-01-01T00:00:00Z'),
    };
    obj.self = obj;
    const result = jsonStringify(obj);
    expect(() => jsonParse(result)).not.toThrow();
    const parsed = jsonParse<any>(result);
    expect(parsed.timestamp).toBeInstanceOf(Date);
    expect(parsed.timestamp.toISOString()).toBe('2024-01-01T00:00:00.000Z');
    expect(parsed.self).toBe(parsed);
  });

  it('should handle arrays with circular references', () => {
    const obj: any = { items: [] };
    obj.items.push(obj);
    const result = jsonStringify(obj);
    expect(() => jsonParse(result)).not.toThrow();
    const parsed = jsonParse<any>(result);
    expect(Array.isArray(parsed.items)).toBe(true);
    expect(parsed.items[0]).toBe(parsed);
  });

  it('should handle primitive values', () => {
    const result = jsonStringify('string');
    const parsed = jsonParse<string>(result);
    expect(parsed).toBe('string');
  });

  it('should handle numbers', () => {
    const result = jsonStringify(123);
    const parsed = jsonParse<number>(result);
    expect(parsed).toBe(123);
  });

  it('should handle booleans', () => {
    const result = jsonStringify(true);
    const parsed = jsonParse<boolean>(result);
    expect(parsed).toBe(true);
  });

  it('should handle arrays', () => {
    const arr = [1, 2, 3];
    const result = jsonStringify(arr);
    const parsed = jsonParse<number[]>(result);
    expect(parsed).toEqual([1, 2, 3]);
  });
});
