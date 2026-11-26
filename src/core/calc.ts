import type {
    Ability,
    SuperAbility,
    Override,
    SuperOverride,
    MovementEffectType,
} from './entities';
import type { StatSource, MovementSource } from './sources';
import { evaluateCurve, roundValue, type Curve } from './curves';

export type ActivityMode = 'PVE' | 'PVP';

export interface CooldownResult {
    cooldown: number;
    effectiveBase: number;
    appliedOverrides: number[];
    unresolved: { hash: number; message: string }[];
}

export function calculateCooldown(
    ability: Ability | SuperAbility,
    overrides: readonly (Override | SuperOverride)[],
    cooldownScalars: Curve | undefined,
    statValue: number,
    activity: ActivityMode = 'PVE',
): CooldownResult {
    if (!Number.isFinite(statValue)) {
        throw new Error('Stat value must be finite');
    }
    let base =
        activity === 'PVP'
            ? (ability.PVPBaseCooldown ?? ability.BaseCooldown)
            : ability.BaseCooldown;
    const appliedOverrides: number[] = [],
        unresolved: CooldownResult['unresolved'] = [];
    const applicable: { override: Override | SuperOverride; indices: number[] }[] = [];
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
        const replacement =
            activity === 'PVP'
                ? (override.PVPCooldownOverride ?? override.CooldownOverride)
                : override.CooldownOverride;
        if (replacement !== undefined) {
            base = replacement;
        }
    }
    for (const { override, indices } of applicable) {
        const scalars =
            activity === 'PVP' ? (override.PVPScalar ?? override.Scalar) : override.Scalar;
        for (const index of indices) {
            base *= scalars?.[index] ?? 1;
        }
    }
    let scalar = 1;
    if (!('ActiveRegenScalar' in ability) && cooldownScalars !== undefined) {
        scalar = evaluateCurve(
            cooldownScalars,
            Math.max(0, Math.min(100, Math.trunc(statValue))),
            [0, 100],
        );
    }
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
    activity: ActivityMode = 'PVE',
): CooldownResult {
    return calculateCooldown(
        ability,
        overrides,
        source.Fields.CooldownScalars as Curve | undefined,
        statValue,
        activity,
    );
}

export function calculateActiveRegen(
    ability: SuperAbility,
    curve: Curve,
    statValue: number,
    overrides: readonly SuperOverride[] = [],
    activity: ActivityMode = 'PVE',
): number {
    if (!Number.isFinite(statValue)) {
        throw new Error('Stat value must be finite');
    }
    let activeScalar =
        activity === 'PVP'
            ? (ability.PVPActiveRegenScalar ?? ability.ActiveRegenScalar)
            : ability.ActiveRegenScalar;
    for (const override of overrides) {
        const values =
            activity === 'PVP'
                ? (override.PVPActiveRegenOverride ?? override.ActiveRegenOverride)
                : override.ActiveRegenOverride;
        if (!values) continue;
        override.Requirements.forEach((req, i) => {
            if (req === 0 || req === ability.Hash) {
                const replacement = values[i];
                if (replacement !== undefined) activeScalar = replacement;
            }
        });
    }
    return (
        activeScalar *
        evaluateCurve(curve, Math.max(0, Math.min(100, Math.trunc(statValue))), [0, 100])
    );
}

export function effectiveActiveRegen(
    source: StatSource,
    ability: SuperAbility,
    statValue: number,
    overrides: readonly SuperOverride[] = (source.Overrides as SuperOverride[] | undefined) ?? [],
    activity: ActivityMode = 'PVE',
): number {
    const curve = (
        activity === 'PVP'
            ? (source.Fields.PVPEnergyGainScalar ?? source.Fields.EnergyGainScalar)
            : source.Fields.EnergyGainScalar
    ) as Curve | undefined;
    if (curve === undefined) {
        throw new Error('Super energy gain curve is required for active regen');
    }
    return calculateActiveRegen(ability, curve, statValue, overrides, activity);
}

export function calculateSuperDuration(
    ability: SuperAbility,
    durationIncrease: Curve | undefined,
    statValue: number,
): number | undefined {
    if (!Number.isFinite(statValue)) {
        throw new Error('Stat value must be finite');
    }
    if (ability.BaseDuration === undefined) return undefined;
    if (durationIncrease === undefined) {
        throw new Error('Super duration increase curve is required for timed Supers');
    }
    const enhancedStat = Math.max(100, Math.min(200, Math.trunc(statValue)));
    const increase = evaluateCurve(durationIncrease, enhancedStat, [100, 200]);
    return roundValue(ability.BaseDuration * (1 + increase / 100), 2);
}

export function effectiveSuperDuration(
    source: StatSource,
    ability: SuperAbility,
    statValue: number,
): number | undefined {
    return calculateSuperDuration(
        ability,
        source.Fields.SuperDurationIncrease as Curve | undefined,
        statValue,
    );
}

export interface MovementSpeedInput {
    classHash: number;
    activity: ActivityMode;
    /** Active sources only; callers resolve held/category/conditional activation. */
    sources: readonly { hash: number; stacks?: number; boosted?: boolean }[];
    direction: 'Forward' | 'Strafe';
    posture: 'Standing' | 'Crouched';
    sprint?: boolean;
}

export interface MovementSpeedResult {
    mobility: number;
    speed: number;
    cappedBy?: 'ForwardSpeedCap' | 'StrafeSpeedCap' | 'CrouchSpeedCap';
}

/** Speed for the given movement rules (the repository's or an edited copy for previews). */
export function movementSpeed(
    input: MovementSpeedInput,
    source: MovementSource,
): MovementSpeedResult {
    const character = source.Classes.find((entry) => entry.ClassHash === input.classHash);
    if (!character) throw new Error('Unknown movement class ' + input.classHash);
    if (input.activity !== 'PVE' && input.activity !== 'PVP') throw new Error('Unknown activity');
    if (!['Forward', 'Strafe'].includes(input.direction))
        throw new Error('Unknown movement direction');
    if (!['Standing', 'Crouched'].includes(input.posture))
        throw new Error('Unknown movement posture');
    if (input.sprint && (input.direction !== 'Forward' || input.posture !== 'Standing'))
        throw new Error('Sprint requires forward standing movement');
    const rules = source.Rules;
    let mobility =
        input.activity === 'PVP'
            ? (character.BaseMobilityPVP ?? character.BaseMobility)
            : character.BaseMobility;
    let sprintBoost = 0;
    let strafeAdditive = 0;
    let crouchAdditive = 0;
    const multipliers: Record<
        Exclude<
            MovementEffectType,
            'Mobility' | 'SprintBoost' | 'StrafeAdditive' | 'CrouchAdditive'
        >,
        number
    > = {
        ForwardMultiplier: 1,
        SprintMultiplier: 1,
        StrafeMultiplier: 1,
        CrouchMultiplier: 1,
        GroundedMultiplier: 1,
        GroundedNonSprintMultiplier: 1,
    };
    const seen = new Set<number>();
    const activeSourceHashes = new Set<number>();
    for (const active of input.sources) {
        if (seen.has(active.hash))
            throw new Error('Duplicate active movement source ' + active.hash);
        seen.add(active.hash);
        const entry = source.Sources.find(
            (candidate) =>
                candidate.Hash === active.hash || candidate.AlsoMatches?.includes(active.hash),
        );
        if (!entry) throw new Error('Unknown movement source ' + active.hash);
        if (activeSourceHashes.has(entry.Hash))
            throw new Error('Duplicate active movement source ' + entry.Hash);
        activeSourceHashes.add(entry.Hash);
        const stacks = active.stacks ?? 1;
        if (!Number.isSafeInteger(stacks) || stacks < 1)
            throw new Error('Source stacks must be a positive integer');
        // boosted is the caller's assertion that every BoostRequiresAll hash is equipped.
        for (const effect of entry.Effects) {
            const values =
                active.boosted && entry.BoostRequiresAll?.length
                    ? (effect.BoostedValues ?? effect.Values)
                    : effect.Values;
            const value = values[Math.min(stacks, values.length) - 1];
            if (value === undefined || !Number.isFinite(value))
                throw new Error('Invalid movement effect values');
            if (effect.Type === 'Mobility') mobility += value;
            else if (effect.Type === 'SprintBoost') sprintBoost = Math.max(sprintBoost, value);
            else if (effect.Type === 'StrafeAdditive') strafeAdditive += value;
            else if (effect.Type === 'CrouchAdditive') crouchAdditive += value;
            else multipliers[effect.Type] *= value;
        }
    }
    mobility = Math.max(0, Math.min(rules.MaxMobility, mobility));
    let speed: number;
    if (input.sprint) {
        const baseSprint = Math.max(character.BaseSprintSpeed, sprintBoost);
        speed =
            baseSprint *
            multipliers.SprintMultiplier *
            multipliers.ForwardMultiplier *
            multipliers.GroundedMultiplier;
    } else {
        let baseWalk = evaluateCurve(rules.WalkSpeed, mobility, [0, 130]);
        if (input.direction === 'Strafe') baseWalk *= rules.StrafeMultiplier;
        if (input.posture === 'Crouched') baseWalk *= rules.CrouchMultiplier;
        // Additive bonuses apply to the base lane before multiplicative modifiers.
        if (input.direction === 'Strafe') baseWalk += strafeAdditive;
        if (input.posture === 'Crouched') baseWalk += crouchAdditive;
        speed = baseWalk;
        if (input.direction === 'Forward') speed *= multipliers.ForwardMultiplier;
        if (input.direction === 'Strafe') speed *= multipliers.StrafeMultiplier;
        if (input.posture === 'Crouched') speed *= multipliers.CrouchMultiplier;
        speed *= multipliers.GroundedMultiplier * multipliers.GroundedNonSprintMultiplier;
    }
    let cappedBy: NonNullable<MovementSpeedResult['cappedBy']> = 'ForwardSpeedCap';
    if (input.direction === 'Strafe' && rules.StrafeSpeedCap < rules[cappedBy])
        cappedBy = 'StrafeSpeedCap';
    if (input.posture === 'Crouched' && rules.CrouchSpeedCap < rules[cappedBy])
        cappedBy = 'CrouchSpeedCap';
    const cap = rules[cappedBy];
    return speed > cap ? { mobility, speed: cap, cappedBy } : { mobility, speed };
}
