import { describe, expect, it } from 'vitest';
import {
    abilitySpec,
    superAbilitySpec,
    overrideSpec,
    movementClassSpec,
    movementRulesSpec,
    movementEffectSpec,
    movementSourceSpec,
    type MovementRules,
    type MovementEffect,
    type MovementSourceEntry,
    type Ability,
    type SuperAbility,
    type Override,
    type MovementClass,
} from '../src/core';

// Record<keyof T, true> makes TypeScript check every interface key, including optional fields.
const abilityKeys = {
    Hash: true,
    Name: true,
    BaseCooldown: true,
    ChunkEnergyScalar: true,
    ChargeBasedScaling: true,
    Notes: true,
} satisfies Record<keyof Ability, true>;

const superAbilityKeys = {
    Hash: true,
    Name: true,
    BaseCooldown: true,
    ActiveRegenScalar: true,
    Notes: true,
} satisfies Record<keyof SuperAbility, true>;

const overrideKeys = {
    Hash: true,
    Name: true,
    Requirements: true,
    CooldownOverride: true,
    Scalar: true,
    ChunkEnergyOverride: true,
    Notes: true,
} satisfies Record<keyof Override, true>;

const movementClassKeys = {
    ClassHash: true,
    Name: true,
    BaseMobilityTier: true,
    BaseMobilityTierPVP: true,
    BaseSprintSpeed: true,
    Notes: true,
} satisfies Record<keyof MovementClass, true>;

const movementRulesKeys = {
    WalkSpeed: true,
    JumpHeight: true,
    StrafeMultiplier: true,
    CrouchMultiplier: true,
    ADSMultiplier: true,
    ForwardSpeedCap: true,
    StrafeSpeedCap: true,
    CrouchSpeedCap: true,
    MaxMobilityTier: true,
} satisfies Record<keyof MovementRules, true>;
const movementEffectKeys = { Type: true, Values: true, BoostedValues: true } satisfies Record<
    keyof MovementEffect,
    true
>;
const movementSourceKeys = {
    Hash: true,
    Name: true,
    RefType: true,
    Activation: true,
    Effects: true,
    AlsoMatches: true,
    BoostRequiresAll: true,
    Notes: true,
} satisfies Record<keyof MovementSourceEntry, true>;

describe('explicit entity interfaces', () => {
    it.each([
        { name: 'Ability', spec: abilitySpec, keys: abilityKeys },
        { name: 'SuperAbility', spec: superAbilitySpec, keys: superAbilityKeys },
        { name: 'Override', spec: overrideSpec, keys: overrideKeys },
        { name: 'MovementClass', spec: movementClassSpec, keys: movementClassKeys },
        { name: 'MovementRules', spec: movementRulesSpec, keys: movementRulesKeys },
        { name: 'MovementEffect', spec: movementEffectSpec, keys: movementEffectKeys },
        { name: 'MovementSource', spec: movementSourceSpec, keys: movementSourceKeys },
    ])('keeps the $name interface keys in sync with its spec', ({ spec, keys }) => {
        expect(spec.fields.map((field) => field.key).sort()).toEqual(Object.keys(keys).sort());
    });
});
