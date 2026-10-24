import type { NumericConstraints } from '../../core';

export function numberStep(
    value: unknown,
    constraints: NumericConstraints = {},
    integer = false,
): number {
    if (integer) return 1;
    const min = constraints.min ?? constraints.exclusiveMin;
    const max = constraints.max ?? constraints.exclusiveMax;
    if (min !== undefined && min >= 0 && max !== undefined && max <= 1) return 0.01;
    if (typeof value !== 'number' || !Number.isFinite(value)) return 1;
    const [mantissa = '', exponent = '0'] = Math.abs(value).toString().split('e');
    const decimals = (mantissa.split('.')[1]?.length ?? 0) - Number(exponent);
    return Math.max(Number.MIN_VALUE, 10 ** -Math.max(0, decimals));
}
