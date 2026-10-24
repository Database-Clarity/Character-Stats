import { hashField } from '../fields/builders';
import { movementClassSpec } from '../entities';

export const movementSpec = {
    name: 'Movement',
    fields: [
        hashField('EnhancedAthleticsHash', {
            description: 'Enhanced Athletics mod manifest hash; 0 while unknown.',
        }),
    ],
    collections: { Classes: movementClassSpec },
    localeKeys: ['WalkSpeed', 'StrafeSpeed', 'CrouchSpeed', 'Overview'],
};
