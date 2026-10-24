import {
    statRegistry,
    localeFields,
    localeId,
    type SourceSet,
    type LocaleData,
    type StatSource,
} from '../src/core';

export function fixture(): SourceSet {
    return {
        stats: statRegistry.map((spec) => {
            const source: StatSource = {
                Hash: spec.hash,
                Name: spec.name,
                Fields: Object.fromEntries(
                    spec.fields.map((f) => [
                        f.key,
                        f.kind === 'curve'
                            ? {
                                  Domain: f.domain!,
                                  Segments: [
                                      {
                                          Type: 'Constant' as const,
                                          From: f.domain![0],
                                          To: f.domain![1],
                                          Value: 1,
                                      },
                                  ],
                              }
                            : 1,
                    ]),
                ),
            };
            if ('Abilities' in spec.collections) {
                source.Abilities = [
                    {
                        Hash: 1,
                        Name: 'Test ability',
                        BaseCooldown: 100,
                        ChunkEnergyScalar: 0.5,
                        Notes: 'Private note',
                    },
                ];
            }
            if ('SuperAbilities' in spec.collections) {
                source.SuperAbilities = [
                    { Hash: 2, Name: 'Test super', BaseCooldown: 200, ActiveRegenScalar: 1 },
                ];
            }
            if ('Overrides' in spec.collections) {
                source.Overrides = [];
            }
            return source;
        }),
        movement: {
            EnhancedAthleticsHash: 0,
            Classes: [
                {
                    ClassHash: 3655393761,
                    Name: 'Titan',
                    WalkSpeed: [1, 2, 3, 4],
                    StrafeSpeed: [1, 2, 3, 4],
                    CrouchSpeed: [1, 2, 3, 4],
                    Notes: 'Do not export',
                },
            ],
        },
    };
}

export function fixtureLocale(): LocaleData {
    const locale: LocaleData = {
        ChargeBasedScaling: '{{AbilityName}} {{ChargeBasedScaling}} {{ChargeCount}}',
    };
    for (const spec of statRegistry) {
        const entries = localeFields('Abilities' in spec.collections)
            .filter((f) => f.key !== 'ChargeBasedScalingTooltip')
            .map((f) => [f.key, 'Text {{' + spec.fields[0]!.key + '}}{{Percent}}']);
        locale[spec.name] = Object.fromEntries(entries);
    }
    return locale;
}
