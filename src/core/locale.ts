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
} as const;

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
    return extractPlaceholders(text)
        .filter((key) => !fieldKeys.includes(key) && !Object.hasOwn(FORMATTING_TOKENS, key))
        .map((key) => ({
            path,
            message: 'Unknown placeholder {{' + key + '}}',
            severity: 'error',
        }));
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
        if (Object.hasOwn(context, key)) {
            return String(context[key]);
        }
        const field = spec.fields.find((f) => f.key === key);
        const value = source.Fields[key];
        if (field && value !== undefined) {
            if (field.domain && isRecord(value)) {
                const x = Math.max(
                    field.domain[0],
                    Math.min(field.domain[1], Math.trunc(statValue)),
                );
                try {
                    return String(evaluateCurve(value as unknown as Curve, x, field.domain));
                } catch {
                    return match;
                }
            }
            if (typeof value === 'number') {
                return String(value);
            }
        }
        return Object.hasOwn(FORMATTING_TOKENS, key)
            ? FORMATTING_TOKENS[key as keyof typeof FORMATTING_TOKENS]
            : match;
    });
}
