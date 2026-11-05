import { describe, expect, it } from 'vitest';
import { HASH_MAX_DIGITS, hashDigits } from './HashInput';

describe('hashDigits', () => {
    it.each([
        ['', ''],
        ['12345', '12345'],
        ['  123 456 ', '123456'],
        ['-123', '123'],
        ['1e+21', '121'],
        ['0x1F', '01'],
        ['１２３', ''],
        ['0007', '0007'],
    ])('keeps only ASCII digits of %j', (raw, expected) => {
        expect(hashDigits(raw)).toBe(expected);
    });

    it('allows the 10 digits of the largest uint32 hash', () => {
        expect(HASH_MAX_DIGITS).toBe('4294967295'.length);
    });
});
