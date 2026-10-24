import { useState } from 'react';
import {
    effectiveCooldown,
    isRecord,
    localeFields,
    localeId,
    renderTooltip,
    resolveLocale,
    validatePlaceholders,
    type LocaleData,
    type StatSource,
    type StatSpec,
} from '../../core';
import { useEditor } from '../state/store';
function setLocale(locale: LocaleData, id: string, text: string): LocaleData {
    const keys = id.split('.');
    const result = structuredClone(locale);
    let node = result;
    for (const key of keys.slice(0, -1)) {
        if (!isRecord(node[key])) node[key] = {};
        node = node[key] as LocaleData;
    }
    node[keys.at(-1)!] = text;
    return result;
}
function leaves(value: unknown, prefix: string): string[] {
    if (typeof value === 'string') return [prefix];
    return isRecord(value)
        ? Object.entries(value).flatMap(([key, next]) => leaves(next, `${prefix}.${key}`))
        : [];
}
export function TextEditor({
    spec,
    source,
    movementKeys,
}: {
    spec: StatSpec;
    source: StatSource;
    movementKeys?: readonly string[];
}) {
    const { locale, dispatch } = useEditor();
    const [statValue, setStatValue] = useState(100);
    const [abilityIndex, setAbilityIndex] = useState(0);
    const collectionItems = Array.isArray(source.Abilities)
        ? source.Abilities
        : Array.isArray(source.SuperAbilities)
          ? source.SuperAbilities
          : [];
    const abilities = collectionItems.filter(isRecord);
    const ability = abilities[abilityIndex];
    const context: Record<string, string | number> = {};
    if (ability) {
        context.AbilityName = ability.Name;
        try {
            context.Cooldown = effectiveCooldown(source, ability, statValue).cooldown;
        } catch {
            /* Invalid drafts have no cooldown preview. */
        }
        if ('ChargeBasedScaling' in ability && ability.ChargeBasedScaling?.length) {
            context.ChargeCount = 0;
            context.ChargeBasedScaling = ability.ChargeBasedScaling[0]!;
        }
    }
    const ids = [
        ...new Set([
            ...(movementKeys
                ? movementKeys.map((key) => `${spec.name}.${key}`)
                : [
                      ...localeFields('Abilities' in spec.collections),
                      ...spec.fields.filter((f) => f.kind === 'localeRef'),
                  ].map((f) => localeId(spec.name, f.key))),
            ...leaves(locale[spec.name], spec.name),
        ]),
    ];
    return (
        <section className="text-editor">
            <div className="card">
                <label>
                    Preview stat value: {statValue}
                    <input
                        aria-label="Preview stat value"
                        type="range"
                        min={0}
                        max={200}
                        value={statValue}
                        onChange={(e) => setStatValue(Number(e.target.value))}
                    />
                </label>
                {abilities.length > 0 && (
                    <label>
                        Preview ability
                        <select
                            value={abilityIndex}
                            onChange={(e) => setAbilityIndex(Number(e.target.value))}
                        >
                            {abilities.map((a, i) => (
                                <option key={i} value={i}>
                                    {a.Name}
                                </option>
                            ))}
                        </select>
                    </label>
                )}
                <p className="help">
                    English source only. Placeholders are checked by the shared core; unknown or
                    unavailable values remain visible in the preview.
                </p>
            </div>
            {ids.map((id) => {
                const text = resolveLocale(locale, id) ?? '';
                const issues = validatePlaceholders(
                    text,
                    spec.fields.map((f) => f.key),
                    `locale.${id}`,
                );
                return (
                    <section className="card" key={id}>
                        <label>
                            {id}
                            <textarea
                                rows={5}
                                value={text}
                                aria-invalid={issues.length > 0}
                                onChange={(e) =>
                                    dispatch({
                                        type: 'set',
                                        file: 'locale/en.json',
                                        value: setLocale(locale, id, e.target.value),
                                    })
                                }
                            />
                        </label>
                        {issues.map((issue, i) => (
                            <p className="error" key={i}>
                                {issue.message}
                            </p>
                        ))}
                        <h4>Live preview</h4>
                        <div className="tooltip-preview">
                            {renderTooltip(text, source, spec, statValue, context)}
                        </div>
                    </section>
                );
            })}
        </section>
    );
}
