import { objectField } from '../fields/builders';
import { movementClassSpec, movementRulesSpec, movementSourceSpec } from '../entities';

export const movementSpec = {
    name: 'Movement',
    fields: [
        objectField('Rules', movementRulesSpec, {
            description: 'Shared movement curves, state multipliers, and caps.',
        }),
    ],
    collections: { Classes: movementClassSpec, Sources: movementSourceSpec },
    localeKeys: ['Overview', 'WalkSpeed', 'StrafeSpeed', 'CrouchSpeed', 'SprintSpeed', 'ADSSpeed'],
};
