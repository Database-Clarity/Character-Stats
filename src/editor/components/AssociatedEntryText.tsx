import {
    isRecord,
    resolveLocale,
    type EntitySpec,
    type StatSource,
    type StatSpec,
} from '../../core';
import { useEditor } from '../state/store';
import { entryLocaleTextIds, updateLocaleText } from '../state/localeText';
import { isPreviewAbility, tooltipAbilityContext } from './previewData';
import { Collapse, Modified } from './EditorPrimitives';
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
    const ids = entryLocaleTextIds(locale, stat, collection, entitySpec, entry);
    const savedLocale = originalValues['locale/en.json'];
    if (!ids.length) return null;
    if (!isRecord(savedLocale)) throw new Error('Original English locale must be an object');

    const ability = isPreviewAbility(entry) ? entry : undefined;
    const context = tooltipAbilityContext(source, ability, 100);
    return (
        <section className="entity-associated-text">
            <div className="section-bar">
                <strong>Associated text</strong>
            </div>
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
                                statValue={100}
                                context={context}
                            />
                        </Collapse>
                    </Modified>
                );
            })}
        </section>
    );
}
