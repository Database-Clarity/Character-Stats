import { useState } from 'react';
import {
    isRecord,
    movementSpec,
    type EntitySpec,
    type StatSource,
    type StatSpec,
} from '../../core';
import { updateProperty, useEditor } from '../state/store';
import { ContextPanel } from './ContextPanel';
import { EntityList } from './EntityList';
import { FieldInput } from './FieldInput';
import { TextEditor } from './TextEditor';
export function StatView({
    spec,
    file,
    movement = false,
}: {
    spec: StatSpec;
    file: string;
    movement?: boolean;
}) {
    const { values, originals, dispatch } = useEditor();
    const [tab, setTab] = useState('Fields');
    const [selected, setSelected] = useState<number | null>(null);
    const value = values[file] as Record<string, unknown>;
    const saved = JSON.parse(originals[file]!) as Record<string, unknown>;
    const fieldValues = movement ? value : value.Fields;
    const fields = isRecord(fieldValues) ? fieldValues : {};
    const originalFields = (movement ? saved : saved.Fields) as Record<string, unknown>;
    const collections: Readonly<Record<string, EntitySpec>> = spec.collections;
    const collectionSpec = collections[tab];
    const items = Array.isArray(value[tab]) ? (value[tab] as Record<string, unknown>[]) : [];
    function setValue(next: unknown) {
        dispatch({ type: 'set', file, value: next });
    }
    const statSource = movement
        ? ({
              Hash: 0,
              Name: spec.name,
              Fields: Object.fromEntries(spec.fields.map((f) => [f.key, value[f.key]])),
          } as StatSource)
        : (value as unknown as StatSource);
    return (
        <section>
            <header className="page-heading">
                <div>
                    <h1>{spec.name}</h1>
                    <p className="muted">{file}</p>
                </div>
                {!movement && <span className="badge">{spec.hash}</span>}
            </header>
            <div className="tabs" role="tablist" aria-label={`${spec.name} sections`}>
                {['Fields', ...Object.keys(collections), 'Text'].map((name) => (
                    <button
                        role="tab"
                        aria-selected={tab === name}
                        id={`tab-${name}`}
                        aria-controls={`panel-${name}`}
                        key={name}
                        onClick={() => {
                            setTab(name);
                            setSelected(null);
                        }}
                    >
                        {name}
                    </button>
                ))}
            </div>
            <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
                {tab === 'Fields' && (
                    <div className="fields">
                        {spec.fields
                            .filter((f) => f.kind !== 'localeRef')
                            .map((field) => (
                                <FieldInput
                                    key={field.key}
                                    spec={field}
                                    value={fields?.[field.key]}
                                    saved={originalFields?.[field.key]}
                                    siblings={fields ?? {}}
                                    file={file}
                                    path={`${movement ? '' : 'Fields.'}${field.key}`}
                                    onChange={(next) =>
                                        setValue(
                                            movement
                                                ? updateProperty(value, field.key, next)
                                                : {
                                                      ...value,
                                                      Fields: updateProperty(
                                                          fields ?? {},
                                                          field.key,
                                                          next,
                                                      ),
                                                  },
                                        )
                                    }
                                />
                            ))}
                    </div>
                )}
                {collectionSpec && (
                    <>
                        <EntityList
                            key={tab}
                            spec={collectionSpec}
                            items={items.map((item) => (isRecord(item) ? item : {}))}
                            file={file}
                            collection={tab}
                            selected={selected}
                            onSelect={setSelected}
                            onChange={(next) => setValue({ ...value, [tab]: next })}
                        />
                        {!movement && (
                            <ContextPanel
                                source={statSource}
                                collection={tab}
                                selected={selected === null ? undefined : items[selected]}
                            />
                        )}
                    </>
                )}
                {tab === 'Text' && (
                    <TextEditor
                        spec={spec}
                        source={statSource}
                        {...(movement ? { movementKeys: movementSpec.localeKeys } : {})}
                    />
                )}
            </div>
        </section>
    );
}
export const movementViewSpec: StatSpec = { ...movementSpec, hash: 0 };
