import { useState } from 'react';
import {
    isRecord,
    resolveLocale,
    type EntitySpec,
    type StatSource,
    type StatSpec,
} from '../../core';
import { useEditor } from '../state/store';
import { entryLocaleTextIds, updateLocaleText } from '../state/localeText';
import { useManifest } from '../manifest';
import { isPreviewAbility, tooltipAbilityContext } from './previewData';
import { Collapse, Modified, StatControl } from './EditorPrimitives';
import { LocaleTextField } from './LocaleTextField';

export function AssociatedEntryText({
    stat,
    collection,
    entitySpec,
    entry,
    statSpec,
    source,
}: {
    stat: string;
    collection: string;
    entitySpec: EntitySpec;
    entry: Record<string, unknown>;
    statSpec: StatSpec;
    source: StatSource;
}) {
    const { locale, originalValues, dispatch } = useEditor();
    const [statValue, setStatValue] = useState(100);
    const { lookup, status } = useManifest();
    const ids = entryLocaleTextIds(locale, stat, collection, entitySpec, entry);
    const savedLocale = originalValues['locale/en.json'];
    if (!ids.length) return null;
    if (!isRecord(savedLocale)) throw new Error('Original English locale must be an object');

    const ability = isPreviewAbility(entry) ? entry : undefined;
    const manifestName =
        status.state === 'ready' && ability ? lookup(ability.Hash, 'item')?.name : undefined;
    const context = tooltipAbilityContext(source, ability, statValue, manifestName);
    return (
        <section className="entity-associated-text">
            <div className="section-bar">
                <strong>Associated text</strong>
            </div>
            {ability?.BaseDuration !== undefined && (
                <StatControl label="Preview stat value" value={statValue} onChange={setStatValue} />
            )}
            {ids.map((id) => {
                const text = resolveLocale(locale, id) ?? '',
                    old = resolveLocale(savedLocale, id) ?? '',
                    field = id.split('.').at(-1)!;
                return (
                    <Modified
                        key={id}
                        field={id}
                        value={text}
                        saved={old}
                        onRevert={() =>
                            dispatch({
                                type: 'set',
                                file: 'locale/en.json',
                                value: updateLocaleText(locale, id, old),
                            })
                        }
                    >
                        <Collapse storageKey={`text:${id}`} title={field}>
                            <LocaleTextField
                                id={id}
                                source={source}
                                spec={statSpec}
                                statValue={statValue}
                                context={context}
                            />
                        </Collapse>
                    </Modified>
                );
            })}
        </section>
    );
}
