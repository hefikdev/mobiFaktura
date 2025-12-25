import { describe, it, expect } from 'vitest';

describe('Error Handling and Edge Cases', () => {
  describe('String Manipulation Edge Cases', () => {
    it('should handle empty strings', () => {
      const str = '';
      const result = str.trim();
      
      expect(result).toBe('');
      expect(result.length).toBe(0);
    });

    it('should handle strings with only whitespace', () => {
      const str = '   ';
      const result = str.trim();
      
      expect(result).toBe('');
    });

    it('should handle null-like strings safely', () => {
      const nullStr = 'null';
      const undefinedStr = 'undefined';
      
      expect(nullStr).not.toBe(null);
      expect(undefinedStr).not.toBe(undefined);
    });

    it('should handle very long strings', () => {
      const longStr = 'a'.repeat(10000);
      
      expect(longStr.length).toBe(10000);
      expect(longStr.substring(0, 10)).toBe('aaaaaaaaaa');
    });

    it('should handle unicode characters', () => {
      const unicode = 'Hello 👋 World 🌍';
      
      expect(unicode).toContain('👋');
      expect(unicode).toContain('🌍');
    });

    it('should handle special characters', () => {
      const special = '<script>alert("xss")</script>';
      const escaped = special
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      
      expect(escaped).toBe('&lt;script&gt;alert("xss")&lt;/script&gt;');
    });
  });

  describe('Number Edge Cases', () => {
    it('should handle division by zero', () => {
      const result = 10 / 0;
      
      expect(result).toBe(Infinity);
    });

    it('should handle negative zero', () => {
      const negZero = -0;
      
      expect(Object.is(negZero, -0)).toBe(true);
      expect(Object.is(negZero, 0)).toBe(false);
    });

    it('should handle NaN', () => {
      const result = 0 / 0;
      
      expect(Number.isNaN(result)).toBe(true);
      expect(result !== result).toBe(true);
    });

    it('should handle very large numbers', () => {
      const large = Number.MAX_SAFE_INTEGER;
      const tooBig = large + 1;
      const wayTooBig = large + 2;
      
      expect(tooBig === wayTooBig).toBe(true); // Loses precision
    });

    it('should handle very small numbers', () => {
      const small = Number.MIN_SAFE_INTEGER;
      
      expect(small).toBe(-9007199254740991);
    });

    it('should handle floating point precision', () => {
      const result = 0.1 + 0.2;
      
      expect(result).not.toBe(0.3); // Classic floating point issue
      expect(Math.abs(result - 0.3) < Number.EPSILON).toBe(true);
    });

    it('should parse integer strings correctly', () => {
      expect(parseInt('123')).toBe(123);
      expect(parseInt('123.45')).toBe(123);
      expect(parseInt('abc')).toBeNaN();
    });

    it('should parse float strings correctly', () => {
      expect(parseFloat('123.45')).toBe(123.45);
      expect(parseFloat('123')).toBe(123);
      expect(parseFloat('abc')).toBeNaN();
    });
  });

  describe('Array Edge Cases', () => {
    it('should handle empty arrays', () => {
      const arr: unknown[] = [];
      
      expect(arr.length).toBe(0);
      expect(arr[0]).toBeUndefined();
    });

    it('should handle array out of bounds access', () => {
      const arr = [1, 2, 3];
      
      expect(arr[10]).toBeUndefined();
      expect(arr[-1]).toBeUndefined();
    });

    it('should handle sparse arrays', () => {
      const sparse = new Array(5);
      sparse[0] = 1;
      sparse[4] = 5;
      
      expect(sparse.length).toBe(5);
      expect(sparse[2]).toBeUndefined();
    });

    it('should handle array mutation during iteration', () => {
      const arr = [1, 2, 3, 4, 5];
      const result: number[] = [];
      
      arr.forEach((item, index) => {
        result.push(item);
        // Don't mutate during forEach - just illustrating edge case
      });
      
      expect(result).toHaveLength(5);
    });

    it('should handle nested arrays', () => {
      const nested = [[1, 2], [3, 4], [5, 6]];
      const flattened = nested.flat();
      
      expect(flattened).toEqual([1, 2, 3, 4, 5, 6]);
    });
  });

  describe('Object Edge Cases', () => {
    it('should handle null prototype objects', () => {
      const obj = Object.create(null);
      obj.key = 'value';
      
      expect(obj.key).toBe('value');
      expect(obj.toString).toBeUndefined();
    });

    it('should handle property shadowing', () => {
      const parent = { prop: 'parent' };
      const child = Object.create(parent);
      child.prop = 'child';
      
      expect(child.prop).toBe('child');
      expect(Object.getPrototypeOf(child).prop).toBe('parent');
    });

    it('should handle property enumeration', () => {
      const obj = { a: 1, b: 2 };
      Object.defineProperty(obj, 'c', {
        value: 3,
        enumerable: false,
      });
      
      const keys = Object.keys(obj);
      expect(keys).toEqual(['a', 'b']);
    });

    it('should handle circular references safely', () => {
      const obj: Record<string, unknown> = { name: 'test' };
      obj.self = obj;
      
      expect(obj.self).toBe(obj);
      expect((obj.self as Record<string, unknown>).self).toBe(obj);
    });
  });

  describe('Date Edge Cases', () => {
    it('should handle invalid dates', () => {
      const invalid = new Date('invalid');
      
      expect(isNaN(invalid.getTime())).toBe(true);
    });

    it('should handle epoch date', () => {
      const epoch = new Date(0);
      
      expect(epoch.getTime()).toBe(0);
      expect(epoch.getUTCFullYear()).toBe(1970);
    });

    it('should handle far future dates', () => {
      const future = new Date('2999-12-31');
      
      expect(future.getFullYear()).toBe(2999);
    });

    it('should handle far past dates', () => {
      const past = new Date('1900-01-01');
      
      expect(past.getFullYear()).toBe(1900);
    });

    it('should handle timezone differences', () => {
      const date = new Date('2025-01-01T00:00:00Z');
      const utcHours = date.getUTCHours();
      const localHours = date.getHours();
      
      // Local hours may differ from UTC hours due to timezone
      expect(typeof utcHours).toBe('number');
      expect(typeof localHours).toBe('number');
    });

    it('should handle DST transitions', () => {
      const beforeDST = new Date('2025-03-01T12:00:00Z');
      const afterDST = new Date('2025-04-01T12:00:00Z');
      
      expect(beforeDST).not.toEqual(afterDST);
    });
  });

  describe('Promise Edge Cases', () => {
    it('should handle resolved promises', async () => {
      const result = await Promise.resolve(42);
      
      expect(result).toBe(42);
    });

    it('should handle rejected promises', async () => {
      try {
        await Promise.reject(new Error('Test error'));
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      }
    });

    it('should handle Promise.all with empty array', async () => {
      const result = await Promise.all([]);
      
      expect(result).toEqual([]);
    });

    it('should handle Promise.race with empty array', async () => {
      const racePromise = Promise.race([]);
      
      // Promise.race with empty array never resolves
      const timeout = new Promise(resolve => setTimeout(() => resolve('timeout'), 100));
      const result = await Promise.race([racePromise, timeout]);
      
      expect(result).toBe('timeout');
    });
  });

  describe('Error Types', () => {
    it('should handle TypeError', () => {
      const error = new TypeError('Type error');
      
      expect(error).toBeInstanceOf(TypeError);
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe('Type error');
    });

    it('should handle RangeError', () => {
      const error = new RangeError('Range error');
      
      expect(error).toBeInstanceOf(RangeError);
      expect(error).toBeInstanceOf(Error);
    });

    it('should handle custom errors', () => {
      class CustomError extends Error {
        constructor(message: string) {
          super(message);
          this.name = 'CustomError';
        }
      }

      const error = new CustomError('Custom error');
      
      expect(error).toBeInstanceOf(CustomError);
      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('CustomError');
    });

    it('should preserve error stack traces', () => {
      const error = new Error('Test error');
      
      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('Test error');
    });
  });

  describe('Type Coercion Edge Cases', () => {
    it('should handle truthy/falsy values', () => {
      expect(Boolean(0)).toBe(false);
      expect(Boolean('')).toBe(false);
      expect(Boolean(null)).toBe(false);
      expect(Boolean(undefined)).toBe(false);
      expect(Boolean(NaN)).toBe(false);
      
      expect(Boolean(1)).toBe(true);
      expect(Boolean('0')).toBe(true);
      expect(Boolean([])).toBe(true);
      expect(Boolean({})).toBe(true);
    });

    it('should handle loose equality oddities', () => {
      // These tests intentionally use loose equality (==) to test JavaScript coercion
      // @ts-ignore - Testing intentional loose equality
      expect(0 == '0').toBe(true);
      // @ts-ignore - Testing intentional loose equality
      expect(0 == ([] as unknown)).toBe(true);
      // @ts-ignore - Testing intentional loose equality
      expect('0' == ([] as unknown)).toBe(false);
      
      expect(null == undefined).toBe(true);
      expect(null === undefined).toBe(false);
    });

    it('should handle string to number coercion', () => {
      expect(Number('123')).toBe(123);
      expect(Number('123.45')).toBe(123.45);
      expect(Number('abc')).toBeNaN();
      expect(Number('')).toBe(0);
      expect(Number(' ')).toBe(0);
    });
  });

  describe('Regex Edge Cases', () => {
    it('should handle empty regex matches', () => {
      const result = 'test'.match(/x/);
      
      expect(result).toBeNull();
    });

    it('should handle global flag', () => {
      const matches = 'test test'.match(/test/g);
      
      expect(matches).toHaveLength(2);
    });

    it('should handle special characters', () => {
      const regex = /\./;
      
      expect(regex.test('.')).toBe(true);
      expect(regex.test('x')).toBe(false);
    });

    it('should handle lookaheads', () => {
      const regex = /\d+(?= PLN)/;
      
      expect(regex.test('100 PLN')).toBe(true);
      expect(regex.test('100 USD')).toBe(false);
    });
  });

  describe('JSON Edge Cases', () => {
    it('should handle JSON.stringify with circular references', () => {
      const obj: Record<string, unknown> = { name: 'test' };
      obj.self = obj;
      
      expect(() => JSON.stringify(obj)).toThrow();
    });

    it('should handle undefined in arrays', () => {
      const arr = [1, undefined, 3];
      const json = JSON.stringify(arr);
      
      expect(json).toBe('[1,null,3]');
    });

    it('should handle special numbers', () => {
      const obj = { inf: Infinity, nan: NaN };
      const json = JSON.stringify(obj);
      
      expect(json).toBe('{"inf":null,"nan":null}');
    });

    it('should parse JSON safely', () => {
      expect(() => JSON.parse('invalid')).toThrow();
      expect(JSON.parse('{"valid":true}')).toEqual({ valid: true });
    });
  });
});
