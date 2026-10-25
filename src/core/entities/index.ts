import type { EntitySpec } from '../fields/types';
import type { Curve } from '../curves';
import {
    hashField,
    nameField,
    notesField,
    numberField,
    numberArrayField,
    integerArrayField,
    integerField,
    enumField,
    objectArrayField,
    curve,
} from '../fields/builders';

export interface Ability {
    Hash: number;
    Name: string;
    BaseCooldown: number;
    ChunkEnergyScalar: number;
    ChargeBasedScaling?: number[];
    Notes?: string;
}

export interface SuperAbility {
    Hash: number;
    Name: string;
    BaseCooldown: number;
    ActiveRegenScalar: number;
    Notes?: string;
}

export interface Override {
    Hash: number;
    Name: string;
    Requirements: number[];
    CooldownOverride?: number;
    Scalar?: number[];
    ChunkEnergyOverride?: number[];
    Notes?: string;
}

export interface MovementClass {
    ClassHash: number;
    Name: string;
    BaseMobilityTier: number;
    BaseMobilityTierPVP?: number;
    BaseSprintSpeed: number;
    Notes?: string;
}

export interface MovementRules {
    WalkSpeed: Curve;
    JumpHeight: Curve;
    StrafeMultiplier: number;
    CrouchMultiplier: number;
    ADSMultiplier: number;
    ForwardSpeedCap: number;
    StrafeSpeedCap: number;
    CrouchSpeedCap: number;
    MaxMobilityTier: number;
}

export type MovementEffectType =
    | 'MobilityTiers'
    | 'ForwardMultiplier'
    | 'SprintMultiplier'
    | 'GroundedMultiplier'
    | 'OverweightMultiplier'
    | 'ADSMultiplier';
export interface MovementEffect {
    Type: MovementEffectType;
    Values: number[];
    BoostedValues?: number[];
}

export interface MovementSourceEntry {
    Hash: number;
    Name: string;
    RefType: 'item' | 'itemCategory';
    Activation: 'Always' | 'WhileHeld' | 'Conditional';
    Effects: MovementEffect[];
    AlsoMatches?: number[];
    BoostRequiresAll?: number[];
    Notes?: string;
}

export const abilitySpec: EntitySpec = {
    name: 'Ability',
    role: 'ability',
    fields: [
        hashField(),

        nameField(),

        numberField('BaseCooldown', {
            exclusiveMin: 0,
            round: 3,
            description:
                'Base cooldown in seconds. Applicable CooldownOverride values replace this ' +
                'base first (last matching replacement wins in collection order), then ' +
                'all matching Scalar entries multiply it, then ' +
                'CooldownScalars[min(stat value, 100)] multiplies the result.',
        }),

        numberField('ChunkEnergyScalar', {
            min: 0,
            round: 3,
            label: 'Chunk energy scalar',
            description: 'Nonnegative scalar for chunk energy gains.',
        }),

        numberArrayField('ChargeBasedScaling', {
            indexLabel: 'Charges stored',
            minItems: 1,
            items: { exclusiveMin: 0 },
            required: false,
            label: 'Charge rate scalar',
            description:
                'Entry i is the charge-rate scalar while i charges are stored ' +
                '(starting at i = 0). Array length is the maximum number of charges. ' +
                'AbilityName, ChargeCount and ChargeBasedScaling tooltip tokens are ' +
                'supplied by the consumer per ability, not properties of the stat.',
        }),

        notesField(),
    ],
};

export const superAbilitySpec: EntitySpec = {
    name: 'SuperAbility',
    role: 'superAbility',
    fields: [
        hashField(),

        nameField(),

        numberField('BaseCooldown', {
            exclusiveMin: 0,
            round: 3,
            description:
                'Fixed Super cooldown in seconds, independent of the Super stat. Applicable CooldownOverride values replace this ' +
                'base first (last matching replacement wins in collection order), then ' +
                'all matching Scalar entries multiply it.',
        }),

        numberField('ActiveRegenScalar', {
            min: 0,
            label: 'Active regeneration scalar',
            description: 'Nonnegative active Super regeneration scalar.',
        }),

        notesField(),
    ],
};

export const overrideSpec: EntitySpec = {
    name: 'Override',
    role: 'override',
    fields: [
        hashField(),

        nameField({
            description:
                'For organization purposes only. Does not necessarily match the ' +
                'inventoryItem entry name from the D2 Manifest.',
        }),

        integerArrayField('Requirements', {
            itemRef: 'ability',
            refSubclassFilters: true,
            minItems: 1,
            items: { min: -4294967295, max: 4294967295 },
            description:
                'Any matching requirement selects this override for abilities in the same stat: ' +
                '0 is a wildcard, positive values are ability manifest hashes, and negative ' +
                'values are negated subclass hashes requiring consumer-side resolution. ' +
                'Each matching index selects the corresponding parallel-array entry.',
        }),

        numberField('CooldownOverride', {
            exclusiveMin: 0,
            round: 3,
            required: false,
            description:
                'Replacement base cooldown in seconds for matching Requirements. Applied ' +
                'before all Scalar multipliers and, for non-Super abilities, CooldownScalars[min(stat value, 100)]. ' +
                'If multiple replacements match, the last in collection order wins.',
        }),

        numberArrayField('Scalar', {
            minItems: 1,
            lengthOf: 'Requirements',
            items: { exclusiveMin: 0 },
            required: false,
            label: 'Cooldown scalar',
            description:
                'Multiplies the cooldown duration for matching Requirements. After BaseCooldown or ' +
                'CooldownOverride is selected, each active Scalar multiplies the result, then ' +
                'non-Super abilities also multiply it by CooldownScalars[min(stat value, 100)]. ' +
                'A Scalar of 0.8 makes the cooldown 20% shorter; 1.25 makes it 25% longer.',
        }),

        numberArrayField('ChunkEnergyOverride', {
            minItems: 1,
            lengthOf: 'Requirements',
            items: { min: 0 },
            required: false,
            label: 'Chunk energy scalar',
            description:
                'Chunk energy scalars for corresponding Requirements, applied in ' +
                'place of ChunkEnergyScalar.',
        }),

        notesField(),
    ],
    anyOf: [['CooldownOverride'], ['Scalar'], ['ChunkEnergyOverride']],
};

export const movementClassSpec: EntitySpec = {
    name: 'MovementClass',
    role: 'movementClass',
    uniqueKey: 'ClassHash',
    fields: [
        hashField('ClassHash', { description: 'D2 Manifest class hash.' }),
        nameField(),
        integerField('BaseMobilityTier', {
            min: 0,
            description:
                'Base hidden Mobility tier in PvE, and in PvP when no PvP value is specified.',
        }),
        integerField('BaseMobilityTierPVP', {
            min: 0,
            required: false,
            description: 'Base hidden Mobility tier in PvP when it differs from PvE.',
        }),
        numberField('BaseSprintSpeed', {
            exclusiveMin: 0,
            description: 'Base sprint speed in m/s, independent of Mobility.',
        }),
        notesField(),
    ],
};

export const movementRulesSpec: EntitySpec = {
    name: 'MovementRules',
    fields: [
        curve('WalkSpeed', {
            domain: [0, 13],
            description: 'Forward walk speed in m/s by hidden Mobility tier.',
        }),
        curve('JumpHeight', {
            domain: [0, 13],
            published: false,
            description: 'Unpublished jump-height placeholder; measured values are not available.',
        }),
        numberField('StrafeMultiplier', {
            exclusiveMin: 0,
            description: 'Multiplier for left, right, and backward walking.',
        }),
        numberField('CrouchMultiplier', {
            exclusiveMin: 0,
            description: 'Multiplier for crouched walking.',
        }),
        numberField('ADSMultiplier', {
            exclusiveMin: 0,
            description:
                'Default walking multiplier while aiming down sights; active source effects can replace it.',
        }),
        numberField('ForwardSpeedCap', {
            exclusiveMin: 0,
            description: 'Maximum forward movement speed, including sprint, in m/s.',
        }),
        numberField('StrafeSpeedCap', {
            exclusiveMin: 0,
            description: 'Maximum strafe speed in m/s, including while aiming down sights.',
        }),
        numberField('CrouchSpeedCap', {
            exclusiveMin: 0,
            description: 'Maximum crouched movement speed in m/s.',
        }),
        integerField('MaxMobilityTier', {
            min: 0,
            max: 13,
            description:
                'Highest effective hidden Mobility tier; capped at the WalkSpeed curve domain.',
        }),
    ],
};

export const movementEffectSpec: EntitySpec = {
    name: 'MovementEffect',
    uniqueKey: 'Type',
    fields: [
        enumField(
            'Type',
            [
                {
                    value: 'MobilityTiers',
                    description: 'Add hidden Mobility tiers before clamping to the tier cap.',
                },
                {
                    value: 'ForwardMultiplier',
                    description:
                        'Multiply forward walking, standing or crouched, and sprint before the speed cap; never affects strafing.',
                },
                { value: 'SprintMultiplier', description: 'Multiply sprint speed only.' },
                {
                    value: 'GroundedMultiplier',
                    description:
                        'Multiply all grounded movement, including sprint; does not affect jump height.',
                },
                {
                    value: 'OverweightMultiplier',
                    description:
                        'Multiply grounded movement except sprint; does not affect jump height.',
                },
                {
                    value: 'ADSMultiplier',
                    description:
                        'Replace the default ADS multiplier only for the selected held weapon; conflicting selected overrides require an explicit value.',
                },
            ],
            { description: 'Movement effect to apply.' },
        ),
        numberArrayField('Values', {
            minItems: 1,
            description:
                'Entry i is the effect value with i + 1 stacks; length 1 for nonstacking effects. Unknown tiers use 0; unknown multipliers use 1.',
        }),
        numberArrayField('BoostedValues', {
            minItems: 1,
            lengthOf: 'Values',
            required: false,
            description:
                'Replacement values when every BoostRequiresAll hash is equipped; length must match Values.',
        }),
    ],
};

export const movementSourceSpec: EntitySpec = {
    name: 'MovementSource',
    fields: [
        hashField('Hash', {
            warnIfZero: true,
            description:
                'Manifest inventory item, plug, mod or perk hash, or item-category hash according to RefType; 0 warns that verification is needed.',
        }),
        nameField(),
        enumField(
            'RefType',
            [
                {
                    value: 'item',
                    description:
                        'DestinyInventoryItemDefinition hash (inventory item, plug, mod or perk).',
                },
                { value: 'itemCategory', description: 'DestinyItemCategoryDefinition hash.' },
            ],
            { description: 'Manifest definition table used by Hash.' },
        ),
        integerArrayField('AlsoMatches', {
            itemRef: 'item',
            minItems: 1,
            items: { min: 1, max: 4294967295 },
            required: false,
            description:
                'Other inventory-item or plug hashes that activate this same source. Hash remains the primary identity; apply the source only once.',
        }),
        enumField(
            'Activation',
            [
                { value: 'Always', description: 'Active while equipped.' },
                { value: 'WhileHeld', description: 'Active while the matching weapon is readied.' },
                {
                    value: 'Conditional',
                    description: 'Active only while the localized Condition is satisfied.',
                },
            ],
            { description: 'When this source applies; callers select active sources.' },
        ),
        objectArrayField('Effects', movementEffectSpec, {
            minItems: 1,
            description: 'Effects from this source, with at most one entry for each effect type.',
        }),
        integerArrayField('BoostRequiresAll', {
            itemRef: 'item',
            minItems: 1,
            items: { min: 1, max: 4294967295 },
            required: false,
            description:
                'All listed inventory-item hashes must be equipped before BoostedValues apply.',
        }),
        notesField(),
    ],
};

export const entityRegistry = {
    Ability: abilitySpec,
    SuperAbility: superAbilitySpec,
    Override: overrideSpec,
    MovementClass: movementClassSpec,
    MovementRules: movementRulesSpec,
    MovementEffect: movementEffectSpec,
    MovementSource: movementSourceSpec,
} as const;
