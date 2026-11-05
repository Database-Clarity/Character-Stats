import { describe, expect, it } from 'vitest';
import { movementSpec, statRegistry, type FieldSpec } from '../src/core';

// Stat-level locale references are edited on the Text tab by locale ID, not as form fields.
function missing(
    property: 'label' | 'help',
    owner: string,
    fields: readonly FieldSpec[],
    stat = false,
): string[] {
    return fields.flatMap((field) => [
        ...(field[property] || (stat && field.kind === 'localeRef')
            ? []
            : [`${owner}.${field.key}`]),
        ...(field.entity ? missing(property, `${owner}.${field.key}`, field.entity.fields) : []),
    ]);
}

function allMissing(property: 'label' | 'help'): string[] {
    return [
        ...statRegistry.flatMap((stat) => [
            ...missing(property, stat.name, stat.fields, true),
            ...Object.entries(stat.collections).flatMap(([name, entity]) =>
                missing(property, `${stat.name}.${name}`, entity.fields),
            ),
        ]),
        ...missing(property, 'Movement', movementSpec.fields),
        ...Object.entries(movementSpec.collections).flatMap(([name, entity]) =>
            missing(property, `Movement.${name}`, entity.fields),
        ),
    ];
}

describe('field labels', () => {
    it('gives every editable field a readable label', () => {
        expect(allMissing('label')).toEqual([]);
    });

    it('gives every editable field author-facing help', () => {
        expect(allMissing('help')).toEqual([]);
    });
});
