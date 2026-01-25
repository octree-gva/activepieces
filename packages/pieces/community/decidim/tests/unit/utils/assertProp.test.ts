import { assertProp } from '../../../src/lib/utils/assertProp';

describe('assertProp', () => {
  it('should not throw when value is truthy', () => {
    expect(() => assertProp('value', 'Error')).not.toThrow();
    expect(() => assertProp(1, 'Error')).not.toThrow();
    expect(() => assertProp(true, 'Error')).not.toThrow();
  });

  it('should throw when value is falsy', () => {
    expect(() => assertProp(null, 'Required')).toThrow('Required');
    expect(() => assertProp(undefined, 'Required')).toThrow('Required');
    expect(() => assertProp('', 'Required')).toThrow('Required');
    expect(() => assertProp(0, 'Required')).toThrow('Required');
    expect(() => assertProp(false, 'Required')).toThrow('Required');
  });
});
