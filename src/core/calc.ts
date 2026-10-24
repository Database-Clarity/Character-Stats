import type { Ability, SuperAbility, Override } from './entities';
import type { StatSource } from './sources';
import { evaluateCurve, roundValue, type Curve } from './curves';

export interface CooldownResult {
    cooldown: number;
    effectiveBase: number;
    appliedOverrides: number[];
    unresolved: { hash: number; message: string }[];
}

export function calculateCooldown(
    ability: Ability | SuperAbility,
    overrides: readonly Override[],
    cooldownScalars: Curve,
    statValue: number,
): CooldownResult {
    if (!Number.isFinite(statValue)) {
        throw new Error('Stat value must be finite');
    }
    let base = ability.BaseCooldown;
    const appliedOverrides: number[] = [],
        unresolved: CooldownResult['unresolved'] = [];
    const applicable: { override: Override; indices: number[] }[] = [];
    for (const override of overrides) {
        const indices: number[] = [];
        override.Requirements.forEach((req, i) => {
            if (req < 0) {
                unresolved.push({ hash: req, message: 'subclass filter, cannot resolve' });
            }
            if (req === 0 || req === ability.Hash) {
                indices.push(i);
            }
        });
        if (indices.length) {
            applicable.push({ override, indices });
            appliedOverrides.push(override.Hash);
        }
    }
    // Replacement precedes all multiplicative scalars, including stacked overrides.
    for (const { override } of applicable) {
        if (override.CooldownOverride !== undefined) {
            base = override.CooldownOverride;
        }
    }
    for (const { override, indices } of applicable) {
        for (const index of indices) {
            base *= override.Scalar?.[index] ?? 1;
        }
    }
    const scalar = evaluateCurve(
        cooldownScalars,
        Math.max(0, Math.min(100, Math.trunc(statValue))),
        [0, 100],
    );
    return {
        cooldown: roundValue(base * scalar, 3),
        effectiveBase: base,
        appliedOverrides,
        unresolved,
    };
}

export function effectiveCooldown(
    source: StatSource,
    ability: Ability | SuperAbility,
    statValue: number,
    overrides = source.Overrides ?? [],
): CooldownResult {
    return calculateCooldown(ability, overrides, source.Fields.CooldownScalars as Curve, statValue);
}

export function calculateActiveRegen(
    ability: SuperAbility,
    curve: Curve,
    statValue: number,
): number {
    if (!Number.isFinite(statValue)) {
        throw new Error('Stat value must be finite');
    }
    return (
        ability.ActiveRegenScalar *
        evaluateCurve(curve, Math.max(0, Math.min(100, Math.trunc(statValue))), [0, 100])
    );
}
