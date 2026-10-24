import type { Ability, SuperAbility, Override, MovementEffectType } from './entities';
import type { StatSource, MovementSource } from './sources';
import movementData from '../../sources/movement.json';
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

export interface MovementSpeedInput {
    classHash: number;
    activity: 'PVE' | 'PVP';
    /** Active sources only; callers resolve held/category/conditional activation. */
    sources: readonly { hash: number; stacks?: number; boosted?: boolean }[];
    direction: 'Forward' | 'Strafe';
    posture: 'Standing' | 'Crouched';
    sprint?: boolean;
    /** Hashes from sources belonging to the single weapon whose ADS speed is requested. */
    heldWeaponSources?: readonly number[];
    ads?: boolean;
    adsMultiplierOverride?: number;
}

export interface MovementSpeedResult {
    tier: number;
    speed: number;
    cappedBy?: 'ForwardSpeedCap' | 'StrafeSpeedCap' | 'CrouchSpeedCap';
}

/** Uses current repository rules by default; pass edited rules as the second argument for previews. */
export function movementSpeed(
    input: MovementSpeedInput,
    source: MovementSource = movementData as unknown as MovementSource,
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
    if (input.ads && input.sprint) throw new Error('Cannot aim down sights while sprinting');
    if (
        input.adsMultiplierOverride !== undefined &&
        (!Number.isFinite(input.adsMultiplierOverride) || input.adsMultiplierOverride <= 0)
    ) {
        throw new Error('ADS multiplier override must be finite and positive');
    }
    const rules = source.Rules;
    let tier =
        input.activity === 'PVP'
            ? (character.BaseMobilityTierPVP ?? character.BaseMobilityTier)
            : character.BaseMobilityTier;
    const multipliers: Record<
        Exclude<MovementEffectType, 'MobilityTiers' | 'ADSMultiplier'>,
        number
    > = {
        ForwardMultiplier: 1,
        SprintMultiplier: 1,
        GroundedMultiplier: 1,
    };
    const seen = new Set<number>();
    const heldWeaponSources = new Set(input.heldWeaponSources ?? []);
    const adsMultipliers = new Set<number>();
    for (const active of input.sources) {
        if (seen.has(active.hash))
            throw new Error('Duplicate active movement source ' + active.hash);
        seen.add(active.hash);
        const entry = source.Sources.find((candidate) => candidate.Hash === active.hash);
        if (!entry) throw new Error('Unknown movement source ' + active.hash);
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
            if (effect.Type === 'MobilityTiers') tier += value;
            else if (effect.Type === 'ADSMultiplier') {
                if (heldWeaponSources.has(active.hash)) adsMultipliers.add(value);
            } else multipliers[effect.Type] *= value;
        }
    }
    for (const hash of heldWeaponSources) {
        if (!seen.has(hash))
            throw new Error('Held weapon source must be present in active sources: ' + hash);
    }
    if (input.ads && adsMultipliers.size > 1 && input.adsMultiplierOverride === undefined) {
        throw new Error(
            'Conflicting ADS multipliers for the selected held weapon; select one weapon or provide an explicit override',
        );
    }
    const adsMultiplier =
        input.adsMultiplierOverride ?? adsMultipliers.values().next().value ?? rules.ADSMultiplier;
    tier = Math.max(0, Math.min(rules.MaxMobilityTier, tier));
    let speed = input.sprint
        ? character.BaseSprintSpeed * multipliers.SprintMultiplier
        : evaluateCurve(rules.WalkSpeed, tier, [0, 13]);
    if (!input.sprint && input.direction === 'Forward') speed *= multipliers.ForwardMultiplier;
    if (input.direction === 'Strafe') speed *= rules.StrafeMultiplier;
    if (input.posture === 'Crouched') speed *= rules.CrouchMultiplier;
    if (input.ads) speed *= adsMultiplier;
    speed *= multipliers.GroundedMultiplier;
    let cappedBy: NonNullable<MovementSpeedResult['cappedBy']> = 'ForwardSpeedCap';
    if (input.direction === 'Strafe' && rules.StrafeSpeedCap < rules[cappedBy])
        cappedBy = 'StrafeSpeedCap';
    if (input.posture === 'Crouched' && rules.CrouchSpeedCap < rules[cappedBy])
        cappedBy = 'CrouchSpeedCap';
    const cap = rules[cappedBy];
    return speed > cap ? { tier, speed: cap, cappedBy } : { tier, speed };
}
