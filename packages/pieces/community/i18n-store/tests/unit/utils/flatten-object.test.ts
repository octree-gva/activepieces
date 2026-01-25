import { flattenObject } from '../../../src/lib/actions/configure';

describe('flattenObject', () => {
  it('should flatten simple object', () => {
    const input = { a: '1', b: '2' };
    const result = flattenObject(input);
    expect(result).toEqual({ a: '1', b: '2' });
  });

  it('should flatten nested objects with dot notation', () => {
    const input = {
      level1: {
        level2: {
          level3: 'deep value',
        },
      },
    };
    const result = flattenObject(input);
    expect(result).toEqual({
      'level1.level2.level3': 'deep value',
    });
  });

  it('should handle arrays as values', () => {
    const input = { items: [1, 2, 3] };
    const result = flattenObject(input);
    expect(result).toEqual({ items: [1, 2, 3] });
  });

  it('should handle arrays with prefix', () => {
    const input = [1, 2, 3];
    const result = flattenObject(input, 'prefix');
    expect(result['prefix']).toEqual([1, 2, 3]);
  });

  it('should handle null values', () => {
    const input = { nullValue: null };
    const result = flattenObject(input);
    expect(result).toEqual({ nullValue: null });
  });

  it('should handle empty object', () => {
    const result = flattenObject({});
    expect(result).toEqual({});
  });

  it('should handle null root', () => {
    const result = flattenObject(null);
    expect(result).toEqual({});
  });

  it('should handle undefined root', () => {
    const result = flattenObject(undefined);
    expect(result).toEqual({});
  });

  it('should handle complex nested structure', () => {
    const input = {
      greeting: {
        hello: 'Hello',
        goodbye: 'Goodbye',
      },
      user: {
        name: 'John',
        age: 30,
      },
    };
    const result = flattenObject(input);
    expect(result).toEqual({
      'greeting.hello': 'Hello',
      'greeting.goodbye': 'Goodbye',
      'user.name': 'John',
      'user.age': 30,
    });
  });
});
