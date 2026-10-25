import { useState } from 'react';
import {
    localeFields,
    localeId,
    resolveLocale,
    type LocaleData,
    type StatSource,
    type StatSpec,
} from '../../core';
import { useEditor } from '../state/store';
import { localeEntryLabel, localeTextIds, updateLocaleText } from '../state/localeText';
import { isPreviewAbility, previewCollections, tooltipAbilityContext } from './previewData';
import { Collapse, LongPage, Modified, StatControl } from './EditorPrimitives';
import { LocaleTextField } from './LocaleTextField';
export function TextEditor({
    spec,
    source,
    entrySource,
    movementKeys,
}: {
    spec: StatSpec;
    source: StatSource;
    entrySource: Record<string, unknown>;
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
            ...localeTextIds(locale, spec.name),
        ]),
    ];
    function change(id: string, text: string) {
        dispatch({
            type: 'set',
            file: 'locale/en.json',
            value: updateLocaleText(locale, id, text),
        });
    }
    const labels = new Map(
        ids.map((id) => [id, localeEntryLabel(id, spec.name, spec.collections, entrySource)]),
    );
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
                items={ids.map((id) => {
                    const label = labels.get(id) ?? id;
                    return {
                        id,
                        label:
                            label === id && id.startsWith(spec.name + '.')
                                ? id.slice(spec.name.length + 1)
                                : label,
                    };
                })}
            >
                {ids.map((id) => {
                    const text = resolveLocale(locale, id) ?? '',
                        old = resolveLocale(saved, id) ?? '',
                        label = labels.get(id) ?? id;
                    return (
                        <div key={id} data-outline={id}>
                            <Modified
                                field={id}
                                value={text}
                                saved={old}
                                onRevert={() => change(id, old)}
                            >
                                <Collapse storageKey={`text:${id}`} title={label}>
                                    <LocaleTextField
                                        id={id}
                                        source={source}
                                        spec={spec}
                                        statValue={statValue}
                                        context={context}
                                    />
                                </Collapse>
                            </Modified>
                        </div>
                    );
                })}
            </LongPage>
        </section>
    );
}
