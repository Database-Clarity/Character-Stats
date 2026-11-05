import { evaluateCurve, type Curve } from './curves';
import { isRecord, type ValidationIssue } from './fields';
import type { StatSpec } from './stats';
import type { StatSource } from './sources';

export type LocaleData = Record<string, unknown>;

export const FORMATTING_TOKENS = {
    Percent: '%',
    HP: ' HP',
    Time: 's',
    PercentPerSecond: '%/s',
    Scalar: '\u00d7',
    Enhancement: 'Enhanced:',
    Cooldown: '{{Cooldown}}',
    AbilityName: '{{AbilityName}}',
    ChargeCount: '{{ChargeCount}}',
    ChargeBasedScaling: '{{ChargeBasedScaling}}',
    BaseDuration: '{{BaseDuration}}',
    SuperDuration: '{{SuperDuration}}',
} as const;

/** Contextual tokens that accept the `ChargeList` formatter. */
export const CHARGE_LIST_TOKENS = ['ChargeBasedScaling', 'ChargeCount'] as const;

/**
 * Formats an ability's ChargeBasedScaling array the way tooltips list it per stored charge:
 * `[1, 1.415, 2.25]` becomes `0%|41.5%|125%` (increase over the base rate) and the charge
 * counts become `0|1|2`. `{{ChargeBasedScaling|ChargeList}}` and
 * `{{ChargeCount|ChargeList}}` render these values.
 */
export function formatChargeList(scalars: readonly number[]): {
    ChargeBasedScaling: string;
    ChargeCount: string;
} {
    return {
        ChargeBasedScaling: scalars
            .map((scalar) => String(Number(((scalar - 1) * 100).toPrecision(12))) + '%')
            .join('|'),
        ChargeCount: scalars.map((_, index) => index).join('|'),
    };
}

const isChargeListToken = (key: string): boolean =>
    (CHARGE_LIST_TOKENS as readonly string[]).includes(key);

export function resolveLocale(locale: LocaleData, id: string): string | undefined {
    let node: unknown = locale;
    for (const key of id.split('.')) {
        node = isRecord(node) && Object.hasOwn(node, key) ? node[key] : undefined;
    }
    return typeof node === 'string' ? node : undefined;
}

export function extractPlaceholders(text: string): string[] {
    return [...new Set(Array.from(text.matchAll(/\{\{\s*([^{}]+?)\s*\}\}/g), (m) => m[1]!))];
}

export function validatePlaceholders(
    text: string,
    fieldKeys: readonly string[],
    path = '',
): ValidationIssue[] {
    return extractPlaceholders(text).flatMap((placeholder) => {
        const [key = '', formatter, ...extra] = placeholder.split('|').map((part) => part.trim());
        if (formatter === undefined) {
            return fieldKeys.includes(key) || Object.hasOwn(FORMATTING_TOKENS, key)
                ? []
                : [{ path, message: 'Unknown placeholder {{' + key + '}}', severity: 'error' }];
        }
        if (formatter === 'ChargeList' && extra.length === 0 && isChargeListToken(key)) {
            return [];
        }
        if (formatter !== 'ScalarPercent' || extra.length > 0 || !key) {
            return [
                {
                    path,
                    message: 'Unknown placeholder formatter in {{' + placeholder + '}}',
                    severity: 'error',
                },
            ];
        }
        return fieldKeys.includes(key)
            ? []
            : [{ path, message: 'Unknown placeholder {{' + key + '}}', severity: 'error' }];
    });
}

export const localeId = (stat: string, key: string): string =>
    key === 'ChargeBasedScalingTooltip' ? 'ChargeBasedScaling' : stat + '.' + key;

export function renderTooltip(
    text: string,
    source: StatSource,
    spec: StatSpec,
    statValue: number,
    context: Record<string, string | number> = {},
): string {
    return text.replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (match: string, key: string) => {
        const [fieldKey = '', formatter, ...extra] = key.split('|').map((part) => part.trim());
        if (
            (formatter === undefined ||
                (formatter === 'ChargeList' &&
                    extra.length === 0 &&
                    isChargeListToken(fieldKey))) &&
            Object.hasOwn(context, fieldKey)
        ) {
            return String(context[fieldKey]);
        }
        if (formatter !== undefined && (formatter !== 'ScalarPercent' || extra.length > 0)) {
            return match;
        }
        const field = spec.fields.find((f) => f.key === fieldKey);
        const value = source.Fields[fieldKey];
        const renderNumber = (number: number): string => {
            if (formatter === undefined) return String(number);
            const percent = number * 100;
            return Number.isFinite(percent) ? String(Number(percent.toPrecision(15))) + '%' : match;
        };
        if (field && value !== undefined) {
            if (field.domain && isRecord(value)) {
                const x = Math.max(
                    field.domain[0],
                    Math.min(field.domain[1], Math.trunc(statValue)),
                );
                try {
                    return renderNumber(evaluateCurve(value as unknown as Curve, x, field.domain));
                } catch {
                    return match;
                }
            }
            if (typeof value === 'number') {
                return renderNumber(value);
            }
        }
        return formatter === undefined && Object.hasOwn(FORMATTING_TOKENS, fieldKey)
            ? FORMATTING_TOKENS[fieldKey as keyof typeof FORMATTING_TOKENS]
            : match;
    });
}
