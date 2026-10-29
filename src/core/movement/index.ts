import { objectField } from '../fields/builders';
import { movementClassSpec, movementRulesSpec, movementSourceSpec } from '../entities';

export const movementSpec = {
    name: 'Movement',
    fields: [
        objectField('Rules', movementRulesSpec, {
            label: 'Rules',
            help: 'Movement rules shared by every class: walk speed by Mobility tier, state multipliers and speed caps.',
            description: 'Shared movement curves, state multipliers, and caps.',
        }),
    ],
    collections: { Classes: movementClassSpec, Sources: movementSourceSpec },
    localeKeys: ['Overview', 'WalkSpeed', 'StrafeSpeed', 'CrouchSpeed', 'SprintSpeed', 'ADSSpeed'],
};
