import { describe, expect, it } from 'vitest';
import { movementSpec, statRegistry, type FieldSpec } from '../src/core';

// Stat-level locale references are edited on the Text tab by locale ID, not as form fields.
function unlabeled(owner: string, fields: readonly FieldSpec[], stat = false): string[] {
    return fields.flatMap((field) => [
        ...(field.label || (stat && field.kind === 'localeRef') ? [] : [`${owner}.${field.key}`]),
        ...(field.entity ? unlabeled(`${owner}.${field.key}`, field.entity.fields) : []),
    ]);
}

describe('field labels', () => {
    it('gives every editable field a readable label', () => {
        const missing = [
            ...statRegistry.flatMap((stat) => [
                ...unlabeled(stat.name, stat.fields, true),
                ...Object.entries(stat.collections).flatMap(([name, entity]) =>
                    unlabeled(`${stat.name}.${name}`, entity.fields),
                ),
            ]),
            ...unlabeled('Movement', movementSpec.fields),
            ...Object.entries(movementSpec.collections).flatMap(([name, entity]) =>
                unlabeled(`Movement.${name}`, entity.fields),
            ),
        ];
        expect(missing).toEqual([]);
    });
});
