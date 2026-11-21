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
    PVPBaseCooldown?: number;
    ChunkEnergyScalar: number;
    PVPChunkEnergyScalar?: number;
    ChargeBasedScaling?: number[];
    Notes?: string;
}

export interface SuperAbility {
    Hash: number;
    Name: string;
    BaseCooldown: number;
    PVPBaseCooldown?: number;
    ActiveRegenScalar: number;
    PVPActiveRegenScalar?: number;
    BaseDuration?: number;
    EnhancedDurationTooltip?: string;
    Notes?: string;
}

export interface Override {
    Hash: number;
    Name: string;
    Requirements: number[];
    CooldownOverride?: number;
    PVPCooldownOverride?: number;
    Scalar?: number[];
    PVPScalar?: number[];
    ChunkEnergyOverride?: number[];
    PVPChunkEnergyOverride?: number[];
    Notes?: string;
}

export interface SuperOverride {
    Hash: number;
    Name: string;
    Requirements: number[];
    CooldownOverride?: number;
    PVPCooldownOverride?: number;
    Scalar?: number[];
    PVPScalar?: number[];
    ActiveRegenOverride?: number[];
    PVPActiveRegenOverride?: number[];
    Notes?: string;
}

export interface MovementClass {
    ClassHash: number;
    Name: string;
    BaseMobility: number;
    BaseMobilityPVP?: number;
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
    MaxMobility: number;
}

export type MovementEffectType =
    | 'Mobility'
    | 'SprintBoost'
    | 'ForwardMultiplier'
    | 'SprintMultiplier'
    | 'StrafeMultiplier'
    | 'CrouchMultiplier'
    | 'StrafeAdditive'
    | 'CrouchAdditive'
    | 'GroundedMultiplier'
    | 'GroundedNonSprintMultiplier'
    | 'OverweightMultiplier'
    | 'ADSMultiplier'
    | 'ADSPenaltyMultiplier';
export interface MovementEffect {
    Type: MovementEffectType;
    Values: number[];
    BoostedValues?: number[];
}

export interface MovementSourceEntry {
    Hash: number;
    Name: string;
    RefType: 'item' | 'itemCategory' | 'buff';
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
            groupBy: true,
            help: 'Cooldown in seconds at stat 0 in PvE (and in PvP unless PvP base cooldown is set), before overrides and the stat curve. Abilities with the same base cooldown are grouped in the list so you can edit them together.',
            label: 'Base cooldown (s)',
            exclusiveMin: 0,
            round: 3,
            description:
                'Base cooldown in seconds at a stat value of 0 in PvE (and in PvP when PVPBaseCooldown is omitted). Applicable CooldownOverride values replace this ' +
                'base first (last matching replacement wins in collection order), then ' +
                'all matching Scalar entries multiply it, then ' +
                'CooldownScalars[min(stat value, 100)] multiplies the result.',
        }),

        numberField('PVPBaseCooldown', {
            help: "Set only if the ability's base cooldown at stat 0 differs in PvP before overrides and the stat curve.",
            label: 'PvP base cooldown (s)',
            exclusiveMin: 0,
            round: 3,
            required: false,
            description:
                'Base cooldown in seconds at a stat value of 0 in PvP when it differs from PvE.',
        }),

        numberField('ChunkEnergyScalar', {
            help: 'How much this ability gains from chunk energy sources in PvE (and in PvP unless PvP chunk energy scalar is set), as a multiplier: 1 is normal.',
            min: 0,
            round: 3,
            label: 'Chunk energy scalar',
            description:
                'Nonnegative scalar for chunk energy gains in PvE (and in PvP when PVPChunkEnergyScalar is omitted).',
        }),

        numberField('PVPChunkEnergyScalar', {
            help: "Set only if the ability's chunk energy scalar differs in PvP (for example, Prismatic abilities receive a 0.8x PvP chunk scalar).",
            min: 0,
            round: 3,
            required: false,
            label: 'PvP chunk energy scalar',
            description:
                'Nonnegative scalar for chunk energy gains in PvP when it differs from PvE.',
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
            groupBy: true,
            help: 'Super cooldown in seconds in PvE (and in PvP unless PvP base cooldown is set). It does not change with the Super stat; overrides can still replace or scale it.',
            label: 'Base cooldown (s)',
            exclusiveMin: 0,
            round: 3,
            description:
                'Fixed Super cooldown in seconds in PvE (and in PvP when PVPBaseCooldown is omitted), independent of the Super stat. Applicable CooldownOverride values replace this ' +
                'base first (last matching replacement wins in collection order), then ' +
                'all matching Scalar entries multiply it.',
        }),

        numberField('PVPBaseCooldown', {
            help: "Set only if the Super's base cooldown differs in PvP.",
            label: 'PvP base cooldown (s)',
            exclusiveMin: 0,
            round: 3,
            required: false,
            description: 'Fixed Super cooldown in seconds in PvP when it differs from PvE.',
        }),

        numberField('ActiveRegenScalar', {
            help: "This Super's active regeneration multiplier in PvE (and in PvP unless PvP active regeneration scalar is set). The Super stat's EnergyGainScalar curve multiplies it.",
            min: 0,
            label: 'Active regeneration scalar',
            description:
                'Nonnegative active Super regeneration scalar in PvE (and in PvP when PVPActiveRegenScalar is omitted), multiplied by EnergyGainScalar.',
        }),

        numberField('PVPActiveRegenScalar', {
            help: "Set only if this Super's active regeneration multiplier differs in PvP (for example, Roaming Supers do not receive their PvE roaming bonus in PvP, and Prismatic Supers receive a 0.9x PvP active regeneration penalty). Multiplied by PVPEnergyGainScalar.",
            min: 0,
            required: false,
            label: 'PvP active regeneration scalar',
            description:
                'Nonnegative active Super regeneration scalar in PvP when it differs from PvE, multiplied by PVPEnergyGainScalar.',
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
            help: "Replaces matching abilities' Base cooldown in PvE (and in PvP unless PvP cooldown override is set), in seconds (at stat 0 for non-Super abilities). If several overrides set one, the last in the source file wins.",
            label: 'Cooldown override (s)',
            exclusiveMin: 0,
            round: 3,
            required: false,
            description:
                'Replacement base cooldown in seconds for matching Requirements in PvE (and in PvP when PVPCooldownOverride is omitted; at a stat value of 0 ' +
                'for non-Super abilities). Applied ' +
                'before all Scalar multipliers and, for non-Super abilities, CooldownScalars[min(stat value, 100)]. ' +
                'If multiple replacements match, the last in collection order wins.',
        }),

        numberField('PVPCooldownOverride', {
            help: "Replaces matching abilities' Base cooldown in PvP only, in seconds (at stat 0 for non-Super abilities).",
            label: 'PvP cooldown override (s)',
            exclusiveMin: 0,
            round: 3,
            required: false,
            description:
                'Replacement base cooldown in seconds for matching Requirements in PvP when it differs from PvE.',
        }),

        numberArrayField('Scalar', {
            help: 'Cooldown multiplier for each requirement row in PvE (and in PvP unless PvP cooldown scalar is set): 0.8 makes the cooldown 20% shorter, 1.25 makes it 25% longer. Applied after the base or override cooldown.',
            minItems: 1,
            lengthOf: 'Requirements',
            items: { exclusiveMin: 0 },
            required: false,
            label: 'Cooldown scalar',
            description:
                'Multiplies the cooldown duration for matching Requirements in PvE (and in PvP when PVPScalar is omitted). After BaseCooldown or ' +
                'CooldownOverride is selected, each active Scalar multiplies the result, then ' +
                'non-Super abilities also multiply it by CooldownScalars[min(stat value, 100)]. ' +
                'A Scalar of 0.8 makes the cooldown 20% shorter; 1.25 makes it 25% longer.',
        }),

        numberArrayField('PVPScalar', {
            help: 'Cooldown multiplier for each requirement row in PvP only, used instead of Cooldown scalar in PvP.',
            minItems: 1,
            lengthOf: 'Requirements',
            items: { exclusiveMin: 0 },
            required: false,
            label: 'PvP cooldown scalar',
            description:
                'Multiplies the cooldown duration for matching Requirements in PvP when it differs from PvE.',
        }),

        numberArrayField('ChunkEnergyOverride', {
            help: "Chunk energy multiplier for each requirement row in PvE (and in PvP unless PvP chunk energy scalar is set), used instead of the ability's Chunk energy scalar.",
            minItems: 1,
            lengthOf: 'Requirements',
            items: { min: 0 },
            required: false,
            label: 'Chunk energy scalar',
            description:
                'Chunk energy scalars for corresponding Requirements, applied in ' +
                'place of ChunkEnergyScalar.',
        }),

        numberArrayField('PVPChunkEnergyOverride', {
            help: 'Chunk energy multiplier for each requirement row in PvP only, used instead of Chunk energy scalar in PvP.',
            minItems: 1,
            lengthOf: 'Requirements',
            items: { min: 0 },
            required: false,
            label: 'PvP chunk energy scalar',
            description:
                'Chunk energy scalars for corresponding Requirements in PvP when they differ from PvE.',
        }),

        notesField(),
    ],
    anyOf: [
        ['CooldownOverride'],
        ['PVPCooldownOverride'],
        ['Scalar'],
        ['PVPScalar'],
        ['ChunkEnergyOverride'],
        ['PVPChunkEnergyOverride'],
    ],
};

export const superOverrideSpec: EntitySpec = {
    name: 'SuperOverride',
    role: 'override',
    fields: [
        hashField('Hash', {
            help: 'Manifest hash of the item that triggers this override, such as an exotic, aspect or subclass. Use Pick item to search.',
        }),

        nameField({
            description:
                'For organization purposes only. Does not necessarily match the ' +
                'inventoryItem entry name from the D2 Manifest.',
        }),

        integerArrayField('Requirements', {
            help: 'Which Supers this override affects. Pick specific Supers, use 0 to match every Super, or a negative subclass hash to match by subclass (apps resolve those; the preview cannot). The scalar columns hold one value per row.',
            label: 'Requirements',
            itemRef: 'ability',
            refSubclassFilters: true,
            minItems: 1,
            items: { min: -4294967295, max: 4294967295 },
            description:
                'Any matching requirement selects this override for Supers: ' +
                '0 is a wildcard, positive values are Super manifest hashes, and negative ' +
                'values are negated subclass hashes requiring consumer-side resolution. ' +
                'Each matching index selects the corresponding parallel-array entry.',
        }),

        numberField('CooldownOverride', {
            help: "Replaces matching Supers' Base cooldown in PvE (and in PvP unless PvP cooldown override is set), in seconds. If several overrides set one, the last in the source file wins.",
            label: 'Cooldown override (s)',
            exclusiveMin: 0,
            round: 3,
            required: false,
            description:
                'Replacement base cooldown in seconds for matching Requirements in PvE (and in PvP when PVPCooldownOverride is omitted).',
        }),

        numberField('PVPCooldownOverride', {
            help: "Replaces matching Supers' Base cooldown in PvP only, in seconds.",
            label: 'PvP cooldown override (s)',
            exclusiveMin: 0,
            round: 3,
            required: false,
            description:
                'Replacement base cooldown in seconds for matching Requirements in PvP when it differs from PvE.',
        }),

        numberArrayField('Scalar', {
            help: 'Cooldown multiplier for each requirement row in PvE (and in PvP unless PvP cooldown scalar is set). Applied after the base or override cooldown.',
            minItems: 1,
            lengthOf: 'Requirements',
            items: { exclusiveMin: 0 },
            required: false,
            label: 'Cooldown scalar',
            description:
                'Multiplies the Super cooldown duration for matching Requirements in PvE (and in PvP when PVPScalar is omitted).',
        }),

        numberArrayField('PVPScalar', {
            help: 'Cooldown multiplier for each requirement row in PvP only.',
            minItems: 1,
            lengthOf: 'Requirements',
            items: { exclusiveMin: 0 },
            required: false,
            label: 'PvP cooldown scalar',
            description:
                'Multiplies the Super cooldown duration for matching Requirements in PvP when it differs from PvE.',
        }),

        numberArrayField('ActiveRegenOverride', {
            help: "Active regeneration scalar for each requirement row in PvE (and in PvP unless PvP active regen override is set), used instead of the Super's Active regeneration scalar (for example, Celestial Nighthawk or Pyrogale Gauntlets removing the Roaming Super bonus).",
            minItems: 1,
            lengthOf: 'Requirements',
            items: { min: 0 },
            required: false,
            label: 'Active regen scalar',
            description:
                "Replacement active Super regeneration scalars for corresponding Requirements in PvE, applied in place of the Super's ActiveRegenScalar.",
        }),

        numberArrayField('PVPActiveRegenOverride', {
            help: 'Active regeneration scalar for each requirement row in PvP only.',
            minItems: 1,
            lengthOf: 'Requirements',
            items: { min: 0 },
            required: false,
            label: 'PvP active regen scalar',
            description:
                'Replacement active Super regeneration scalars for corresponding Requirements in PvP when they differ from PvE.',
        }),

        notesField(),
    ],
    anyOf: [
        ['CooldownOverride'],
        ['PVPCooldownOverride'],
        ['Scalar'],
        ['PVPScalar'],
        ['ActiveRegenOverride'],
        ['PVPActiveRegenOverride'],
    ],
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
        integerField('BaseMobility', {
            help: "The class's hidden Mobility stat with no bonuses, in PvE, and in PvP unless PvP base Mobility is set.",
            label: 'Base Mobility',
            min: 0,
            description:
                'Base hidden Mobility stat in PvE, and in PvP when no PvP value is specified.',
        }),
        integerField('BaseMobilityPVP', {
            help: "Set only if the class's base Mobility stat is different in PvP.",
            label: 'PvP base Mobility',
            min: 0,
            required: false,
            description: 'Base hidden Mobility stat in PvP when it differs from PvE.',
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
            help: 'Forward walking speed in m/s for each hidden Mobility stat value (0–130). Strafe, crouch and ADS speeds are multiples of it.',
            label: 'Walk speed (m/s)',
            domain: [0, 130],
            description: 'Forward walk speed in m/s by hidden Mobility stat (0–130).',
        }),
        curve('JumpHeight', {
            help: "Placeholder for jump height by Mobility stat. Measured apex values aren't published yet, so it isn't exported.",
            label: 'Jump height',
            domain: [0, 130],
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
            help: 'Multiplier on walk speed while aiming down sights. Sources with an ADS effect replace it for their weapon, and ADS penalty multipliers scale its penalty fraction (1 - ADSMultiplier).',
            label: 'ADS multiplier',
            exclusiveMin: 0,
            description:
                'Default walking multiplier while aiming down sights; active source effects can replace it or scale its penalty.',
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
        integerField('MaxMobility', {
            help: "Highest hidden Mobility stat value that has an effect; higher totals count as this value. It can't exceed the Walk speed curve's range.",
            label: 'Max Mobility',
            min: 0,
            max: 130,
            description:
                'Highest effective hidden Mobility stat; capped at the WalkSpeed curve domain.',
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
                    value: 'Mobility',
                    description:
                        'Add hidden Mobility stat points before clamping to [0, MaxMobility].',
                },
                {
                    value: 'SprintBoost',
                    description:
                        'Non-stacking sprint speed floor in m/s (for example 8.5 m/s from movement exotics): raises base sprint speed to max(BaseSprintSpeed, value) before forward/sprint multipliers.',
                },
                {
                    value: 'ForwardMultiplier',
                    description:
                        'Multiply forward walking, standing or crouched, and sprint before the speed cap; never affects strafing.',
                },
                { value: 'SprintMultiplier', description: 'Multiply sprint speed only.' },
                {
                    value: 'StrafeMultiplier',
                    description: 'Multiply strafing speed before the speed cap.',
                },
                {
                    value: 'CrouchMultiplier',
                    description: 'Multiply crouched movement speed before the speed cap.',
                },
                {
                    value: 'StrafeAdditive',
                    description:
                        'Add flat m/s to strafe speed before multipliers and the speed cap.',
                },
                {
                    value: 'CrouchAdditive',
                    description:
                        'Add flat m/s to crouched movement speed before multipliers and the speed cap.',
                },
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
                        'Hip-fire grounded penalty except sprint; mutually exclusive with ADS movement penalty.',
                },
                {
                    value: 'ADSMultiplier',
                    description:
                        'Replace the default ADS multiplier only for the selected held weapon; conflicting selected overrides require an explicit value.',
                },
                {
                    value: 'ADSPenaltyMultiplier',
                    description:
                        'Multiply the weapon ADS movement penalty fraction (1 - ADSMultiplier), yielding 1 - (1 - ADSMultiplier) * product.',
                },
            ],
            {
                label: 'Effect type',
                help: 'What this effect changes, such as Mobility points, a non-stacking sprint boost, or a movement multiplier. Each option in the list explains its effect.',
                description: 'Movement effect to apply.',
            },
        ),
        numberArrayField('Values', {
            help: 'Effect value per stack: the first box is 1 stack, the next 2 stacks, and so on. Use one value if it does not stack. If unknown, enter 0 for Mobility/additive or 1 for multipliers and add a note.',
            label: 'Values',
            minItems: 1,
            description:
                'Entry i is the effect value with i + 1 stacks; length 1 for nonstacking effects. Unknown Mobility/additive values use 0; unknown multipliers use 1.',
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
            help: 'Manifest hash of the item, mod, perk or plug that grants this effect, of an item category when Reference type is item category, or a stable buff ID when Reference type is buff. Use Pick item to search; 0 marks a hash that still needs checking.',
            warnIfZero: true,
            description:
                'Manifest inventory item, plug, mod or perk hash, item-category hash, or stable buff identifier according to RefType; 0 warns that verification is needed.',
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
                {
                    value: 'buff',
                    description:
                        'Global subclass status or combatant buff without a single inventory-item manifest hash (for example Amplified or Speed Booster).',
                },
            ],
            {
                label: 'Reference type',
                help: 'Whether Hash is a specific item, perk or mod, an item category such as all Machine Guns, or a global subclass buff.',
                description: 'Manifest definition table or buff identity used by Hash.',
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
    SuperOverride: superOverrideSpec,
    MovementClass: movementClassSpec,
    MovementRules: movementRulesSpec,
    MovementEffect: movementEffectSpec,
    MovementSource: movementSourceSpec,
} as const;
