import { readFile } from 'node:fs/promises';
import { describe, it, expect } from 'vitest';
import {
    exportSources,
    generateSchema,
    serializeSchema,
    statRegistry,
    serializeSource,
    parseStatSource,
    parseMovementSource,
    abilitySpec,
    exportEntity,
    validateField,
    fieldSchema,
    healthSpec,
    validateSources,
} from '../src/core';
import { validateExport } from '../src/cli/io';
import { fixture } from './fixtures';
describe('exports and generated schema', () => {
    it('exports manifest hash keys, locale IDs, expanded curves and no editor-only fields', () => {
        const sources = fixture();
        const result = exportSources(sources);
        expect(Object.keys(result).sort()).toEqual(
            [...statRegistry.map((s) => String(s.hash)), 'Movement'].sort(),
        );
        const melee = result['4244567218'] as Record<string, unknown>;
        expect(melee.CooldownScalars).toHaveLength(101);
        expect(melee.MeleeDamageIncrease).toHaveLength(100);
        expect(melee.Overview).toBe('Melee.Overview');
        expect(melee.ChargeBasedScalingTooltip).toBe('ChargeBasedScaling');
        expect(melee.Abilities).toEqual([
            { Hash: 1, Name: 'Test ability', BaseCooldown: 100, ChunkEnergyScalar: 0.5 },
        ]);
        expect(JSON.stringify(result)).not.toContain('Notes');
        expect(result.Movement).toMatchObject({
            Overview: 'Movement.Overview',
            WalkSpeed: 'Movement.WalkSpeed',
            Rules: { WalkSpeed: [5, 5.2, 5.4, 5.6, 5.8, 6, 6.2, 6.4, 6.6, 6.8, 7, 7.2, 7.4, 7.6] },
        });
        expect(JSON.stringify(result)).not.toContain('JumpHeight');
        expect(validateExport(result, generateSchema())).toEqual([]);
    });
    it('supports the single top-level placement switch in both export and schema', () => {
        const data = exportSources(fixture(), { placement: 'topLevel' });
        expect((data['4244567218'] as Record<string, unknown>).Abilities).toBeUndefined();
        expect(data.Abilities).toHaveProperty('4244567218');
        expect(validateExport(data, generateSchema({ placement: 'topLevel' }))).toEqual([]);
    });
    it('rounds base cooldown and rejects invalid exports', () => {
        expect(
            exportEntity(abilitySpec, {
                Hash: 1,
                Name: 'A',
                BaseCooldown: 1.23456,
                ChunkEnergyScalar: 0.5,
            }).BaseCooldown,
        ).toBe(1.235);
        const data = exportSources(fixture());
        (data['392767087'] as Record<string, unknown>).FlinchResistance = [1];
        expect(validateExport(data, generateSchema()).length).toBeGreaterThan(0);
    });
    it('uses configurable default rounding while respecting an explicit curve Round', () => {
        const sources = fixture();
        const melee = sources.stats.find((s) => s.Name === 'Melee')!;
        melee.Fields.CooldownScalars = {
            Domain: [0, 100],
            Segments: [{ Type: 'Constant', From: 0, To: 100, Value: 1.23456 }],
        };
        const result = exportSources(sources, { rounding: 1 });
        expect((result['4244567218'] as Record<string, unknown>).CooldownScalars).toEqual(
            Array(101).fill(1.2),
        );
    });
    it('is deterministic and committed schema.json equals generated output', async () => {
        const first = serializeSchema();
        expect(serializeSchema()).toBe(first);
        expect(await readFile('schema.json', 'utf8')).toBe(first);
        expect(first).toContain('CBSD_example.md');
        expect(first).not.toContain('stat point.s');
        const superDef = (generateSchema().definitions as Record<string, Record<string, unknown>>)
            .Super!;
        expect(superDef.required).not.toContain('CooldownScalars');
        expect(superDef.properties).not.toHaveProperty('CooldownScalars');
    });
    it('derives index mappings from domains without repeating Health fallback sentences', () => {
        for (const domain of [
            [0, 100],
            [0, 200],
            [101, 200],
        ] as const) {
            expect(
                fieldSchema({ key: 'Curve', kind: 'curve', description: 'Example.', domain })
                    .description,
            ).toBe(
                `Example. Stat values ${domain[0]}-${domain[1]}: index = stat value${domain[0] === 0 ? '' : ' - 101'}.`,
            );
        }
        const flinch = fieldSchema(
            healthSpec.fields.find((field) => field.key === 'FlinchResistance')!,
        );
        expect(String(flinch.description).match(/Stat values above 100/g)).toHaveLength(1);
        const shield = fieldSchema(
            healthSpec.fields.find((field) => field.key === 'PVEBonusShieldHP')!,
        );
        expect(String(shield.description).match(/Below 101/g)).toHaveLength(1);
        expect(flinch.minItems).toBe(101);
        expect(shield.minItems).toBe(100);
        expect(generateSchema().$id).toBe(
            'https://github.com/Database-Clarity/Character-Stats/blob/master/schema.json',
        );
        expect(serializeSchema()).not.toContain('"abilityKind"');
        expect(serializeSchema()).not.toContain('"role"');
    });
    it('declarative field additions drive validation, schema and export', () => {
        const spec = {
            key: 'New',
            kind: 'number' as const,
            required: true,
            min: 1,
            description: 'A new field.',
        };
        expect(validateField(spec, 0)).not.toEqual([]);
        expect(exportEntity({ name: 'NewEntity', fields: [spec] }, { New: 2 })).toEqual({ New: 2 });
        expect(fieldSchema(spec)).toMatchObject({
            type: 'number',
            minimum: 1,
            description: 'A new field.',
        });
    });
});
describe('source parsing and stable serialization', () => {
    it('returns parse errors instead of throwing', () => {
        expect(parseStatSource('{bad').issues.length).toBe(1);
        expect(parseMovementSource('null').issues.length).toBe(1);
    });
    it('leaves parsed source members unknown until content validation', () => {
        const parsed = parseStatSource('{"Name":"Grenade","Fields":null,"Abilities":[null]}');
        expect(parsed.issues).toEqual([]);
        expect(validateSources({ stats: [parsed.value], movement: {} })).toContainEqual(
            expect.objectContaining({ path: 'stats[0].Fields', severity: 'error' }),
        );
    });
    it('sorts entities and round trips without mutating curve points', () => {
        const source = fixture().stats.find((s) => s.Name === 'Melee')!;
        source.Abilities = [
            { Hash: 2, Name: 'Zulu', BaseCooldown: 1, ChunkEnergyScalar: 1 },
            { Hash: 1, Name: 'Alpha', BaseCooldown: 2, ChunkEnergyScalar: 0.5 },
        ];
        const before = JSON.stringify(source);
        const text = serializeSource(source);
        expect(text.endsWith('\n')).toBe(true);
        expect(text).not.toContain('\r');
        expect(text.indexOf('Alpha')).toBeLessThan(text.indexOf('Zulu'));
        expect(text).toContain('    "Hash"');
        expect(serializeSource(parseStatSource(text).value!)).toBe(text);
        expect(JSON.stringify(source)).toBe(before);
    });
});
