import { useState } from 'react';
import {
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
import { isPreviewAbility, previewCollections, tooltipAbilityContext } from './previewData';
import { Collapse, LongPage, Modified, StatControl } from './EditorPrimitives';
function setLocale(locale: LocaleData, id: string, text: string): LocaleData {
    const keys = id.split('.'),
        result = structuredClone(locale);
    let node = result;
    for (const key of keys.slice(0, -1)) {
        if (!isRecord(node[key])) node[key] = {};
        node = node[key] as LocaleData;
    }
    node[keys.at(-1)!] = text;
    return result;
}
function leaves(value: unknown, prefix: string): string[] {
    return typeof value === 'string'
        ? [prefix]
        : isRecord(value)
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
    const { locale, originals, dispatch } = useEditor(),
        [statValue, setStatValue] = useState(100),
        [abilityIndex, setAbilityIndex] = useState(0);
    const saved = JSON.parse(originals['locale/en.json']!) as LocaleData;
    const abilities = previewCollections(source).abilities.filter(isPreviewAbility),
        ability = abilities[abilityIndex];
    const context = tooltipAbilityContext(source, ability, statValue);
    const ids = [
        ...new Set([
            ...(movementKeys
                ? movementKeys.map((key) => `${spec.name}.${key}`)
                : [
                      ...localeFields(
                          Object.values(spec.collections).some(
                              (entity) => entity.role === 'ability',
                          ),
                      ),
                      ...spec.fields.filter((f) => f.kind === 'localeRef'),
                  ].map((f) => localeId(spec.name, f.key))),
            ...leaves(locale[spec.name], spec.name),
        ]),
    ];
    function change(id: string, text: string) {
        dispatch({ type: 'set', file: 'locale/en.json', value: setLocale(locale, id, text) });
    }
    return (
        <section className="text-editor">
            <div className="pinned-controls text-controls">
                {(spec.fields.some((field) => field.kind === 'curve') ||
                    source.Fields.CooldownScalars !== undefined) && (
                    <StatControl
                        label="Preview stat value"
                        value={statValue}
                        onChange={setStatValue}
                    />
                )}
                {abilities.length > 0 && (
                    <label className="inline">
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
                <span className="help">English · live core preview</span>
            </div>
            <LongPage
                label="Text"
                items={ids.map((id) => ({
                    id,
                    label: id.startsWith(spec.name + '.') ? id.slice(spec.name.length + 1) : id,
                }))}
            >
                {ids.map((id) => {
                    const text = resolveLocale(locale, id) ?? '',
                        old = resolveLocale(saved, id) ?? '',
                        issues = validatePlaceholders(
                            text,
                            spec.fields.map((f) => f.key),
                            `locale.${id}`,
                        );
                    return (
                        <div key={id} data-outline={id}>
                            <Modified
                                field={id}
                                value={text}
                                saved={old}
                                onRevert={() => change(id, old)}
                            >
                                <Collapse storageKey={`text:${id}`} title={id}>
                                    <div className="text-entry">
                                        <label className="text-source">
                                            English source
                                            <textarea
                                                aria-label={id}
                                                rows={4}
                                                value={text}
                                                aria-invalid={issues.length > 0}
                                                onChange={(e) => change(id, e.target.value)}
                                            />
                                        </label>
                                        <div className="preview-column">
                                            <h4>Live preview</h4>
                                            <div className="tooltip-preview">
                                                {renderTooltip(
                                                    text,
                                                    source,
                                                    spec,
                                                    statValue,
                                                    context,
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    {issues.map((issue, i) => (
                                        <p className="error" key={i}>
                                            {issue.message}
                                        </p>
                                    ))}
                                </Collapse>
                            </Modified>
                        </div>
                    );
                })}
            </LongPage>
        </section>
    );
}
