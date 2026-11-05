import { healthSpec } from './health';
import { meleeSpec } from './melee';
import { grenadeSpec } from './grenade';
import { superSpec } from './super';
import { classSpec } from './class';
import { weaponsSpec } from './weapons';
export * from './types';
export * from './shared';
export { healthSpec };
export { meleeSpec };
export { grenadeSpec };
export { superSpec };
export { classSpec };
export { weaponsSpec };

export const statRegistry = [
    healthSpec,
    meleeSpec,
    grenadeSpec,
    superSpec,
    classSpec,
    weaponsSpec,
] as const;
