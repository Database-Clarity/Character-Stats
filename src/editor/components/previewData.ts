import {
    effectiveCooldown,
    effectiveSuperDuration,
    type StatSource,
    collectionItems,
    isAbilityRole,
    isRecord,
    statRegistry,
    validateEntity,
    abilitySpec,
    superAbilitySpec,
    overrideSpec,
    type Ability,
    type SuperAbility,
    type Override,
} from '../../core';

export function isPreviewAbility(
    value: unknown,
): value is Record<string, unknown> & (Ability | SuperAbility) {
    return (
        isRecord(value) &&
        [abilitySpec, superAbilitySpec].some((spec) =>
            validateEntity(spec, value).every((issue) => issue.severity !== 'error'),
        )
    );
}

export function isPreviewOverride(value: unknown): value is Record<string, unknown> & Override {
    return (
        isRecord(value) &&
        validateEntity(overrideSpec, value).every((issue) => issue.severity !== 'error')
    );
}

export function previewCollections(source: unknown) {
    const stat = isRecord(source)
        ? statRegistry.find((spec) => spec.name === source.Name)
        : undefined;
    const collections = stat?.collections ?? {};
    return {
        collections,
        abilities: collectionItems(source, collections, (entity) => isAbilityRole(entity.role)),
        overrides: collectionItems(
            source,
            collections,
            (entity) => entity.role === 'override',
        ).filter(isPreviewOverride),
    };
}

export function tooltipAbilityContext(
    source: StatSource,
    ability: Ability | SuperAbility | undefined,
    statValue: number,
    manifestName?: string,
) {
    const context: Record<string, string | number> = {};
    if (!ability) return context;
    if (manifestName) context.AbilityName = manifestName;
    try {
        const cooldown = effectiveCooldown(source, ability, statValue, []).cooldown;
        if (Number.isFinite(cooldown)) context.Cooldown = cooldown;
    } catch {
        // Invalid source curves have no calculated preview.
    }
    if ('ActiveRegenScalar' in ability && ability.BaseDuration !== undefined) {
        try {
            const duration = effectiveSuperDuration(source, ability, statValue);
            if (duration !== undefined) {
                context.BaseDuration = ability.BaseDuration;
                context.SuperDuration = duration;
            }
        } catch {
            // Invalid source curves have no calculated duration preview.
        }
    }
    if ('ChargeBasedScaling' in ability && ability.ChargeBasedScaling?.length) {
        context.ChargeCount = 0;
        context.ChargeBasedScaling = ability.ChargeBasedScaling[0]!;
    }
    return context;
}

/** Display-only speed formatting; never round values returned by the core calculator. */
export function formatMovementSpeed(speed: number): string {
    const rounded = Math.round((speed + Number.EPSILON * Math.max(1, Math.abs(speed))) * 100) / 100;
    return rounded.toFixed(2);
}
