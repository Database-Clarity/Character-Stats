import type { EntitySpec } from '../fields/types';
import {
    hashField,
    nameField,
    notesField,
    numberField,
    numberArrayField,
    integerArrayField,
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
    WalkSpeed: number[];
    StrafeSpeed: number[];
    CrouchSpeed: number[];
    Notes?: string;
}

export const abilitySpec: EntitySpec = {
    name: 'Ability',
    fields: [
        hashField(),

        nameField(),

        numberField('BaseCooldown', {
            exclusiveMin: 0,
            round: 3,
            description:
                "This is the 'base cooldown' of the ability. If the " +
                '<CooldownScalars> property is present, this will be scaled by ' +
                'that.',
        }),

        numberField('ChunkEnergyScalar', {
            exclusiveMin: 0.1,
            max: 1,
            round: 3,
            description: 'Scalar for chunk energy gains; greater than 0.1 and at most 1.',
        }),

        numberArrayField('ChargeBasedScaling', {
            minItems: 2,
            items: { exclusiveMin: 0 },
            required: false,
            description:
                'Represents the behavior of certain abilities possessing ' +
                'additional scaling on their cooldown depending on the number of ' +
                "stored ability charges. The array's length represents the number " +
                'of charges an ability has intrinsically. Numbers at every array ' +
                'index represent the Charge Rate scalar for the ability with ' +
                '[index] number of stored ability charges.',
        }),

        notesField(),
    ],
};

export const superAbilitySpec: EntitySpec = {
    name: 'SuperAbility',
    fields: [
        hashField(),

        nameField(),

        numberField('BaseCooldown', {
            exclusiveMin: 0,
            round: 3,
            description:
                "This is the 'base cooldown' of the ability. If the " +
                '<CooldownScalars> property is present, this will be scaled by ' +
                'that.',
        }),

        numberField('ActiveRegenScalar', {
            exclusiveMin: 0,
            exclusiveMax: 2,
            description: 'Active Super regeneration scalar; greater than 0 and less than 2.',
        }),

        notesField(),
    ],
};

export const overrideSpec: EntitySpec = {
    name: 'Override',
    fields: [
        hashField(),

        nameField({
            description:
                'For organization purposes only. Does not necessarily match the ' +
                'inventoryItem entry name from the D2 Manifest.',
        }),

        integerArrayField('Requirements', {
            minItems: 1,
            items: { min: -4294967295, max: 4294967295 },
            description:
                'The inventoryItem hash of each ability that is required to ' +
                'trigger the effects of this <Override>. Only overrides ' +
                '<Abilities> under the same Character Stat as the <Override>. Any ' +
                'one of these will trigger its effect defined in the other ' +
                '<Override> properties. Wildcards: if the requirements array only ' +
                "contains 1 item and it's a 0, any ability tied to this Character " +
                'Stat will have its cooldown overwritten. Negative numbers in the ' +
                'array indicate filters, these will be the inventoryItem hashes of ' +
                'subclasses multiplied by -1. Any abilities tied to the given ' +
                'subclass will have their cooldowns overwritten.',
        }),

        numberField('CooldownOverride', {
            exclusiveMin: 0,
            round: 3,
            required: false,
            description:
                'Overrides the <BaseCooldown> of the abilities listed in the ' +
                '<Requirements> array. This is the first Override property to be ' +
                'applied if multiple are present.',
        }),

        numberArrayField('Scalar', {
            minItems: 1,
            lengthOf: 'Requirements',
            items: { exclusiveMin: 0 },
            required: false,
            description:
                'Length of the array is equal to the length of the <Requirements> ' +
                'array. Each item represents a multiplier to the cooldown time of ' +
                'the abilities (of a subclass) listed in the <Requirements> array ' +
                'at the same array index. Multiple scalars can stack with each ' +
                'other if their requirements are met. If <CooldownOverride> ' +
                'property is specified, <Scalar> is applied after it.',
        }),

        numberArrayField('ChunkEnergyOverride', {
            minItems: 1,
            lengthOf: 'Requirements',
            items: { exclusiveMin: 0.1, max: 1 },
            required: false,
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
    uniqueKey: 'ClassHash',
    fields: [
        hashField('ClassHash', {
            description: 'D2 Manifest class hash.',
        }),

        nameField(),

        numberArrayField('WalkSpeed', {
            minItems: 4,
            maxItems: 4,
            items: { min: 0 },
            description: 'Speed in m/s at 0-3 Enhanced Athletics mods.',
        }),

        numberArrayField('StrafeSpeed', {
            minItems: 4,
            maxItems: 4,
            items: { min: 0 },
            description: 'Speed in m/s at 0-3 Enhanced Athletics mods.',
        }),

        numberArrayField('CrouchSpeed', {
            minItems: 4,
            maxItems: 4,
            items: { min: 0 },
            description: 'Speed in m/s at 0-3 Enhanced Athletics mods.',
        }),

        notesField(),
    ],
};

export const entityRegistry = {
    Ability: abilitySpec,
    SuperAbility: superAbilitySpec,
    Override: overrideSpec,
    MovementClass: movementClassSpec,
} as const;
