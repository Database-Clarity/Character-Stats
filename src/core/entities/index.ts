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
    localeField,
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
    BaseDuration?: number;
    EnhancedDurationTooltip?: string;
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
    | 'GroundedNonSprintMultiplier'
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
        hashField('Hash', {
            help: "The ability's Destiny manifest item hash. Use Pick item to search the manifest instead of typing it.",
        }),

        nameField(),

        numberField('BaseCooldown', {
            help: 'Cooldown in seconds at stat 0, before overrides and the stat curve. Abilities with the same base cooldown are grouped in the list so you can edit them together.',
            label: 'Base cooldown (s)',
            exclusiveMin: 0,
            round: 3,
            description:
                'Base cooldown in seconds at a stat value of 0. Applicable CooldownOverride values replace this ' +
                'base first (last matching replacement wins in collection order), then ' +
                'all matching Scalar entries multiply it, then ' +
                'CooldownScalars[min(stat value, 100)] multiplies the result.',
        }),

        numberField('ChunkEnergyScalar', {
            help: 'How much this ability gains from chunk energy sources, as a multiplier: 1 is normal.',
            min: 0,
            round: 3,
            label: 'Chunk energy scalar',
            description: 'Nonnegative scalar for chunk energy gains.',
        }),

        numberArrayField('ChargeBasedScaling', {
            help: 'For abilities with several charges: the recharge-rate multiplier for each number of charges currently stored, starting at 0 stored. Add one value per count; the number of values is the maximum charges. In text, 1.415 shows as 41.5% through {{ChargeBasedScaling|ChargeList}}.',
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
        hashField('Hash', {
            help: "The Super's Destiny manifest item hash. Use Pick item to search the manifest instead of typing it.",
        }),

        nameField(),

        numberField('BaseCooldown', {
            help: 'Super cooldown in seconds. It does not change with the Super stat; overrides can still replace or scale it.',
            label: 'Base cooldown (s)',
            exclusiveMin: 0,
            round: 3,
            description:
                'Fixed Super cooldown in seconds, independent of the Super stat. Applicable CooldownOverride values replace this ' +
                'base first (last matching replacement wins in collection order), then ' +
                'all matching Scalar entries multiply it.',
        }),

        numberField('ActiveRegenScalar', {
            help: "This Super's own active regeneration multiplier. The Super stat's Active regeneration scalar curve multiplies it.",
            min: 0,
            label: 'Active regeneration scalar',
            description: 'Nonnegative active Super regeneration scalar.',
        }),

        numberField('BaseDuration', {
            help: 'How long the Super lasts, in seconds. Fill in only for Supers measured to last longer with an enhanced Super stat; it enables Super duration increase for this Super.',
            exclusiveMin: 0,
            round: 2,
            required: false,
            label: 'Base duration (s)',
            description:
                'Base active duration in seconds. Set only for Supers with a measured ' +
                'duration benefit from enhanced Super stat.',
        }),

        localeField('EnhancedDurationTooltip', {
            help: "Locale ID of the text that explains this Super's longer duration when the Super stat is enhanced. Set it together with Base duration.",
            label: 'Enhanced duration tooltip',
            required: false,
            description:
                'Locale ID for the enhanced-duration tooltip. Set only for Supers with ' +
                'a measured duration benefit.',
        }),

        notesField(),
    ],
};

export const overrideSpec: EntitySpec = {
    name: 'Override',
    role: 'override',
    fields: [
        hashField('Hash', {
            help: 'Manifest hash of the item that triggers this override, such as an aspect, fragment, exotic or subclass. Use Pick item to search.',
        }),

        nameField({
            description:
                'For organization purposes only. Does not necessarily match the ' +
                'inventoryItem entry name from the D2 Manifest.',
        }),

        integerArrayField('Requirements', {
            help: 'Which abilities this override affects. Pick specific abilities, use 0 to match every ability in this stat, or a negative subclass hash to match by subclass (apps resolve those; the preview cannot). The scalar columns hold one value per row.',
            label: 'Requirements',
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
            help: "Replaces matching abilities' Base cooldown, in seconds (at stat 0 for non-Super abilities). If several overrides set one, the last in the source file wins.",
            label: 'Cooldown override (s)',
            exclusiveMin: 0,
            round: 3,
            required: false,
            description:
                'Replacement base cooldown in seconds for matching Requirements (at a stat value of 0 ' +
                'for non-Super abilities). Applied ' +
                'before all Scalar multipliers and, for non-Super abilities, CooldownScalars[min(stat value, 100)]. ' +
                'If multiple replacements match, the last in collection order wins.',
        }),

        numberArrayField('Scalar', {
            help: 'Cooldown multiplier for each requirement row: 0.8 makes the cooldown 20% shorter, 1.25 makes it 25% longer. Applied after the base or override cooldown.',
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
            help: "Chunk energy multiplier for each requirement row, used instead of the ability's Chunk energy scalar.",
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
        hashField('ClassHash', {
            label: 'Class hash',
            help: 'Manifest hash of the class (Titan, Hunter or Warlock). Use Pick item to search.',
            description: 'D2 Manifest class hash.',
        }),
        nameField(),
        integerField('BaseMobilityTier', {
            help: "The class's hidden Mobility tier with no bonuses, in PvE, and in PvP unless PvP base Mobility tier is set.",
            label: 'Base Mobility tier',
            min: 0,
            description:
                'Base hidden Mobility tier in PvE, and in PvP when no PvP value is specified.',
        }),
        integerField('BaseMobilityTierPVP', {
            help: "Set only if the class's base Mobility tier is different in PvP.",
            label: 'PvP base Mobility tier',
            min: 0,
            required: false,
            description: 'Base hidden Mobility tier in PvP when it differs from PvE.',
        }),
        numberField('BaseSprintSpeed', {
            help: 'Sprint speed in m/s before multipliers. Mobility does not affect sprint.',
            label: 'Base sprint speed (m/s)',
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
            help: 'Forward walking speed in m/s for each hidden Mobility tier (0–13). Strafe, crouch and ADS speeds are multiples of it.',
            label: 'Walk speed (m/s)',
            domain: [0, 13],
            description: 'Forward walk speed in m/s by hidden Mobility tier.',
        }),
        curve('JumpHeight', {
            help: "Placeholder for jump height by Mobility tier. Measured values aren't available yet, so it isn't exported.",
            label: 'Jump height',
            domain: [0, 13],
            published: false,
            description: 'Unpublished jump-height placeholder; measured values are not available.',
        }),
        numberField('StrafeMultiplier', {
            help: 'Multiplier on walk speed when moving left, right or backward: 0.85 is 85% of walk speed.',
            label: 'Strafe multiplier',
            exclusiveMin: 0,
            description: 'Multiplier for left, right, and backward walking.',
        }),
        numberField('CrouchMultiplier', {
            help: 'Multiplier on walk speed while crouched.',
            label: 'Crouch multiplier',
            exclusiveMin: 0,
            description: 'Multiplier for crouched walking.',
        }),
        numberField('ADSMultiplier', {
            help: 'Multiplier on walk speed while aiming down sights. Sources with an ADS effect replace it for their weapon.',
            label: 'ADS multiplier',
            exclusiveMin: 0,
            description:
                'Default walking multiplier while aiming down sights; active source effects can replace it.',
        }),
        numberField('ForwardSpeedCap', {
            help: 'Highest forward speed in m/s, including sprint. Faster speeds are capped.',
            label: 'Forward speed cap (m/s)',
            exclusiveMin: 0,
            description: 'Maximum forward movement speed, including sprint, in m/s.',
        }),
        numberField('StrafeSpeedCap', {
            help: 'Highest sideways or backward speed in m/s, including while aiming down sights.',
            label: 'Strafe speed cap (m/s)',
            exclusiveMin: 0,
            description: 'Maximum strafe speed in m/s, including while aiming down sights.',
        }),
        numberField('CrouchSpeedCap', {
            help: 'Highest crouched speed in m/s.',
            label: 'Crouch speed cap (m/s)',
            exclusiveMin: 0,
            description: 'Maximum crouched movement speed in m/s.',
        }),
        integerField('MaxMobilityTier', {
            help: "Highest hidden Mobility tier that has an effect; higher totals count as this tier. It can't exceed the Walk speed curve's range.",
            label: 'Max Mobility tier',
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
                    value: 'GroundedNonSprintMultiplier',
                    description:
                        'Multiply grounded movement except sprint; does not affect jump height.',
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
            {
                label: 'Effect type',
                help: 'What this effect changes, such as Mobility tiers or a forward speed multiplier. Each option in the list explains its effect.',
                description: 'Movement effect to apply.',
            },
        ),
        numberArrayField('Values', {
            help: 'Effect value per stack: the first box is 1 stack, the next 2 stacks, and so on. Use one value if it does not stack. If unknown, enter 0 for tiers or 1 for multipliers and add a note.',
            label: 'Values',
            minItems: 1,
            description:
                'Entry i is the effect value with i + 1 stacks; length 1 for nonstacking effects. Unknown tiers use 0; unknown multipliers use 1.',
        }),
        numberArrayField('BoostedValues', {
            help: 'Values used instead of Values when every item in Boost requires all is equipped. Needs the same number of entries as Values.',
            label: 'Boosted values',
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
            help: 'Manifest hash of the item, mod, perk or plug that grants this effect, or of an item category when Reference type is item category. Use Pick item to search; 0 marks a hash that still needs checking.',
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
            {
                label: 'Reference type',
                help: 'Whether Hash is a specific item, perk or mod, or an item category such as all Machine Guns.',
                description: 'Manifest definition table used by Hash.',
            },
        ),
        integerArrayField('AlsoMatches', {
            help: 'Other item or perk hashes that trigger this same source, such as variants of the same perk. The source still applies only once.',
            label: 'Also matches',
            itemRef: 'item',
            minItems: 1,
            uniqueItems: true,
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
            {
                label: 'Activation',
                help: 'When this source applies: Always (while equipped), WhileHeld (only while that weapon is out) or Conditional (only while its Condition text is true). Tick sources in the Speed preview to test them.',
                description: 'When this source applies; callers select active sources.',
            },
        ),
        objectArrayField('Effects', movementEffectSpec, {
            help: 'The movement changes this source makes. Add at most one effect of each type.',
            label: 'Effects',
            minItems: 1,
            description: 'Effects from this source, with at most one entry for each effect type.',
        }),
        integerArrayField('BoostRequiresAll', {
            help: 'Items that must all be equipped for Boosted values to apply.',
            label: 'Boost requires all',
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
