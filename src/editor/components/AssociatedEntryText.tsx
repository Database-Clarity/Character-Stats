import { useState } from 'react';
import {
    isRecord,
    resolveLocale,
    type EntitySpec,
    type StatSource,
    type StatSpec,
} from '../../core';
import { useEditor } from '../state/store';
import { LOCALE_FILE } from '../state/paths';
import { entryLocaleTextIds, updateLocaleText } from '../state/localeText';
import { useManifest } from '../manifest';
import { isPreviewAbility, tooltipAbilityContext } from './previewData';
import { Collapse, FieldName, Modified, StatControl } from './EditorPrimitives';
import { LocaleTextField } from './LocaleTextField';
import { sentenceCase } from './textFormat';

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
    const savedLocale = originalValues[LOCALE_FILE];
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
                <StatControl label={`${stat} value`} value={statValue} onChange={setStatValue} />
            )}
            {ids.map((id) => {
                const text = resolveLocale(locale, id) ?? '',
                    old = resolveLocale(savedLocale, id) ?? '',
                    field = id.split('.').at(-1)!;
                return (
                    <Modified
                        key={id}
                        field={id}
                        label={sentenceCase(field)}
                        value={text}
                        saved={old}
                        onRevert={() =>
                            dispatch({
                                type: 'set',
                                file: LOCALE_FILE,
                                value: updateLocaleText(locale, id, old),
                            })
                        }
                    >
                        <Collapse
                            storageKey={`text:${id}`}
                            title={<FieldName spec={{ key: field, label: sentenceCase(field) }} />}
                        >
                            <LocaleTextField
                                id={id}
                                label={sentenceCase(field)}
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
