/**
 * Unit tests for the object helper module.
 *
 * This test suite covers:
 * - extendProperties: Extends destination object with source properties including getters/setters
 * - didObjectsChange: Checks if specific fields differ between two objects
 */

import { extendProperties, didObjectsChange } from '../../../ui/helpers/object';

describe('extendProperties', () => {
  it('copies simple properties from source to destination', () => {
    const dest = { a: 1 };
    const src = { b: 2, c: 3 };

    const result = extendProperties(dest, src);

    expect(result).toBe(dest);
    expect(result.a).toBe(1);
    expect(result.b).toBe(2);
    expect(result.c).toBe(3);
  });

  it('overwrites existing properties in destination', () => {
    const dest = { a: 1, b: 2 };
    const src = { b: 99 };

    extendProperties(dest, src);

    expect(dest.a).toBe(1);
    expect(dest.b).toBe(99);
  });

  it('copies getter properties correctly', () => {
    const dest = {};
    const src = {};
    let value = 42;
    Object.defineProperty(src, 'computed', {
      get: () => value,
      enumerable: true,
      configurable: true,
    });

    extendProperties(dest, src);

    expect(dest.computed).toBe(42);
    value = 100;
    expect(dest.computed).toBe(100);
  });

  it('copies getter and setter properties correctly', () => {
    const dest = {};
    const src = {};
    let internalValue = 10;
    Object.defineProperty(src, 'prop', {
      get: () => internalValue,
      set: (val) => {
        internalValue = val;
      },
      enumerable: true,
      configurable: true,
    });

    extendProperties(dest, src);

    expect(dest.prop).toBe(10);
    dest.prop = 50;
    expect(dest.prop).toBe(50);
    expect(internalValue).toBe(50);
  });

  it('returns destination when source is same object', () => {
    const obj = { a: 1 };

    const result = extendProperties(obj, obj);

    expect(result).toBe(obj);
    expect(result.a).toBe(1);
  });

  it('handles empty source object', () => {
    const dest = { a: 1 };
    const src = {};

    const result = extendProperties(dest, src);

    expect(result).toBe(dest);
    expect(result.a).toBe(1);
  });

  it('handles empty destination object', () => {
    const dest = {};
    const src = { a: 1, b: 2 };

    const result = extendProperties(dest, src);

    expect(result).toBe(dest);
    expect(result.a).toBe(1);
    expect(result.b).toBe(2);
  });

  it('does not copy inherited properties', () => {
    const dest = {};
    const parent = { inherited: 'value' };
    const src = Object.create(parent);
    src.own = 'owned';

    extendProperties(dest, src);

    expect(dest.own).toBe('owned');
    expect(dest.inherited).toBeUndefined();
  });

  it('only copies enumerable properties (for...in limitation)', () => {
    const dest = {};
    const src = {};
    Object.defineProperty(src, 'hidden', {
      value: 'hidden value',
      enumerable: false,
      configurable: true,
    });
    Object.defineProperty(src, 'visible', {
      value: 'visible value',
      enumerable: true,
      configurable: true,
    });

    extendProperties(dest, src);

    // for...in only iterates over enumerable properties
    expect(dest.hidden).toBeUndefined();
    expect(dest.visible).toBe('visible value');
  });
});

describe('didObjectsChange', () => {
  it('returns false when all specified fields are equal', () => {
    const first = { a: 1, b: 2, c: 3 };
    const second = { a: 1, b: 2, c: 3 };

    const result = didObjectsChange(first, second, ['a', 'b', 'c']);

    expect(result).toBe(false);
  });

  it('returns true when at least one specified field differs', () => {
    const first = { a: 1, b: 2, c: 3 };
    const second = { a: 1, b: 99, c: 3 };

    const result = didObjectsChange(first, second, ['a', 'b', 'c']);

    expect(result).toBe(true);
  });

  it('only checks specified fields', () => {
    const first = { a: 1, b: 2, c: 3 };
    const second = { a: 1, b: 2, c: 999 };

    const result = didObjectsChange(first, second, ['a', 'b']);

    expect(result).toBe(false);
  });

  it('returns false for empty fields array', () => {
    const first = { a: 1 };
    const second = { a: 2 };

    const result = didObjectsChange(first, second, []);

    expect(result).toBe(false);
  });

  it('handles missing fields in first object', () => {
    const first = { a: 1 };
    const second = { a: 1, b: 2 };

    const result = didObjectsChange(first, second, ['a', 'b']);

    expect(result).toBe(true); // undefined !== 2
  });

  it('handles missing fields in second object', () => {
    const first = { a: 1, b: 2 };
    const second = { a: 1 };

    const result = didObjectsChange(first, second, ['a', 'b']);

    expect(result).toBe(true); // 2 !== undefined
  });

  it('handles both objects missing a field', () => {
    const first = { a: 1 };
    const second = { a: 1 };

    const result = didObjectsChange(first, second, ['a', 'b']);

    expect(result).toBe(false); // undefined === undefined
  });

  it('compares objects by reference', () => {
    const nested = { x: 1 };
    const first = { a: nested };
    const second = { a: nested };

    const result = didObjectsChange(first, second, ['a']);

    expect(result).toBe(false); // same reference
  });

  it('returns true for different object references with same content', () => {
    const first = { a: { x: 1 } };
    const second = { a: { x: 1 } };

    const result = didObjectsChange(first, second, ['a']);

    expect(result).toBe(true); // different references
  });

  it('handles null values correctly', () => {
    const first = { a: null };
    const second = { a: null };

    const result = didObjectsChange(first, second, ['a']);

    expect(result).toBe(false);
  });

  it('distinguishes null from undefined', () => {
    const first = { a: null };
    const second = { a: undefined };

    const result = didObjectsChange(first, second, ['a']);

    expect(result).toBe(true);
  });
});
