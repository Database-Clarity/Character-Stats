import { useEffect, useRef, useState } from 'react';
import {
    isRecord,
    movementRulesSpec,
    movementSpec,
    type FieldSpec,
    type StatSource,
    type StatSpec,
} from '../../core';
import { updateProperty, useEditor } from '../state/store';
import { changeAffectsStat, type ChangeTarget } from '../state/editing';
import { EntityList } from './EntityList';
import { FieldInput } from './FieldInput';
import { LongPage, Collapse, FieldName } from './EditorPrimitives';
import { TextEditor } from './TextEditor';
import { MovementContext } from './MovementContext';
import type { EditorNavigationSelection, NavigationMode } from './navigationHistory';
import { collectionLabel } from './textFormat';
export interface NavigationRequest extends ChangeTarget {
    sequence: number;
}
export function StatView({
    spec,
    file,
    movement = false,
    request,
    selection,
    onNavigate,
}: {
    spec: StatSpec;
    file: string;
    movement?: boolean;
    request: NavigationRequest | null;
    selection: EditorNavigationSelection;
    onNavigate(selection: EditorNavigationSelection, mode: NavigationMode): void;
}) {
    const { values, originals, dispatch, changes } = useEditor(),
        tab = selection.tab,
        selected = selection.itemKey,
        root = useRef<HTMLElement>(null);
    const value = values[file] as Record<string, unknown>,
        saved = JSON.parse(originals[file]!) as Record<string, unknown>;
    const fields = (movement ? value : isRecord(value.Fields) ? value.Fields : {}) as Record<
            string,
            unknown
        >,
        originalFields = (movement ? saved : saved.Fields) as Record<string, unknown>;
    const collectionSpec = spec.collections[tab],
        items = (Array.isArray(value[tab]) ? value[tab] : []).filter(isRecord);
    function setValue(next: unknown) {
        dispatch({ type: 'set', file, value: next });
    }
    const source = movement
        ? ({
              Hash: 0,
              Name: spec.name,
              Fields: Object.fromEntries(spec.fields.map((f) => [f.key, value[f.key]])),
          } as StatSource)
        : (value as unknown as StatSource);
    useEffect(() => {
        if (
            !request ||
            request.stat !== spec.name ||
            tab !== request.tab ||
            selected !== (request.itemKey ?? null)
        )
            return;
        const timer = setTimeout(() => {
            // Validation paths can point below the deepest control, so use the closest ancestor.
            const field = Array.from(
                root.current?.querySelectorAll<HTMLElement>('[data-field]') ?? [],
            )
                .filter(
                    (el) =>
                        el.dataset.field === request.field ||
                        (!!el.dataset.field && request.field.startsWith(el.dataset.field + '.')),
                )
                .sort((a, b) => b.dataset.field!.length - a.dataset.field!.length)[0];
            if (!field) return;
            let ancestor: HTMLElement | null = field;
            while (ancestor) {
                if (ancestor instanceof HTMLDetailsElement) ancestor.open = true;
                ancestor = ancestor.parentElement;
            }
            const section = field.querySelector('details');
            if (section) section.open = true;
            field.scrollIntoView({ block: 'center', behavior: 'smooth' });
            field.classList.remove('change-highlight');
            void field.offsetWidth;
            field.classList.add('change-highlight');
            const input =
                field.querySelector<HTMLElement>('input,textarea,select') ??
                field.querySelector<HTMLElement>('button:not(.revert-field)');
            input?.focus({ preventScroll: true });
        }, 80);
        return () => clearTimeout(timer);
    }, [request, tab, selected, spec.name]);
    const visible = spec.fields.filter((f) => f.kind !== 'localeRef');
    return (
        <section className="stat-view" ref={root}>
            <header className="page-heading">
                <h1>{spec.name}</h1>
                <code className="muted">{file}</code>
                {!movement && <span className="mono muted">{spec.hash}</span>}
            </header>
            <div
                className="tabs"
                role="tablist"
                aria-label={`${spec.name} sections`}
                onKeyDown={(e) => {
                    if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) {
                        e.preventDefault();
                        const buttons = Array.from(
                            e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]'),
                        );
                        const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
                        const next =
                            buttons[
                                e.key === 'Home'
                                    ? 0
                                    : e.key === 'End'
                                      ? buttons.length - 1
                                      : (index +
                                            (e.key === 'ArrowRight' ? 1 : -1) +
                                            buttons.length) %
                                        buttons.length
                            ];
                        next?.click();
                        next?.focus();
                    }
                }}
            >
                {['Fields', ...Object.keys(spec.collections), 'Text'].map((name) => {
                    const count = changes.filter(
                        (c) => changeAffectsStat(c, spec.name) && c.tab === name,
                    ).length;
                    return (
                        <button
                            role="tab"
                            aria-selected={tab === name}
                            tabIndex={tab === name ? 0 : -1}
                            id={`tab-${name}`}
                            aria-controls={`panel-${name}`}
                            key={name}
                            onClick={() => {
                                onNavigate({ stat: spec.name, tab: name, itemKey: null }, 'click');
                            }}
                        >
                            {movement && name === 'Fields' ? 'Rules' : collectionLabel(name)}
                            {count > 0 && <span className="count-badge">{count}</span>}
                        </button>
                    );
                })}
            </div>
            <div
                className="tab-panel"
                role="tabpanel"
                id={`panel-${tab}`}
                aria-labelledby={`tab-${tab}`}
            >
                {tab === 'Fields' &&
                    (movement ? (
                        <MovementRules
                            value={value}
                            saved={saved}
                            file={file}
                            onChange={setValue}
                        />
                    ) : (
                        <FieldsPage
                            fields={visible}
                            values={fields}
                            saved={originalFields}
                            file={file}
                            pathPrefix="Fields."
                            onChange={(next) => setValue({ ...value, Fields: next })}
                        />
                    ))}
                {collectionSpec && (
                    <EntityList
                        key={`${tab}:${request?.sequence ?? 0}`}
                        spec={collectionSpec}
                        items={items}
                        file={file}
                        collection={tab}
                        stat={spec.name}
                        statSpec={spec}
                        source={source}
                        entrySource={value}
                        {...(movement ? { context: <MovementContext value={value} /> } : {})}
                        selected={selected}
                        groupMembers={selection.groupMembers}
                        onSelect={(key) =>
                            onNavigate({ stat: spec.name, tab, itemKey: key }, 'sync')
                        }
                        onNavigate={(key, mode) =>
                            onNavigate({ stat: spec.name, tab, itemKey: key }, mode)
                        }
                        onNavigateGroup={(memberIds) =>
                            onNavigate(
                                {
                                    stat: spec.name,
                                    tab,
                                    itemKey: null,
                                    groupMembers: memberIds,
                                },
                                'click',
                            )
                        }
                        onOpenMember={(collection, key) => {
                            onNavigate({ stat: spec.name, tab: collection, itemKey: key }, 'click');
                        }}
                        onChange={(next) => setValue({ ...value, [tab]: next })}
                    />
                )}{' '}
                {tab === 'Text' && (
                    <TextEditor
                        spec={spec}
                        source={source}
                        entrySource={value}
                        {...(movement ? { movementKeys: movementSpec.localeKeys } : {})}
                    />
                )}
            </div>
        </section>
    );
}
/** Top-level field list with an outline; curves render directly, other fields in a section. */
function FieldsPage({
    fields,
    values,
    saved,
    file,
    pathPrefix,
    fieldPathPrefix = '',
    onChange,
}: {
    fields: readonly FieldSpec[];
    values: Record<string, unknown>;
    saved: Record<string, unknown>;
    file: string;
    pathPrefix: string;
    fieldPathPrefix?: string;
    onChange(values: Record<string, unknown>): void;
}) {
    return (
        <LongPage
            label="Fields"
            items={fields.map((f) => ({ id: f.key, label: f.label ?? f.key }))}
        >
            {fields.map((field) => {
                const input = (
                    <FieldInput
                        spec={field}
                        value={values[field.key]}
                        saved={saved[field.key]}
                        siblings={values}
                        file={file}
                        path={`${pathPrefix}${field.key}`}
                        fieldPath={`${fieldPathPrefix}${field.key}`}
                        onChange={(next) => onChange(updateProperty(values, field.key, next))}
                    />
                );
                return (
                    <div key={field.key} data-outline={field.key}>
                        {field.kind === 'curve' ? (
                            input
                        ) : (
                            <Collapse
                                storageKey={`${file}:${field.group ?? field.key}`}
                                title={field.group ?? <FieldName spec={field} />}
                            >
                                {input}
                            </Collapse>
                        )}
                    </div>
                );
            })}
        </LongPage>
    );
}
function MovementRules({
    value,
    saved,
    file,
    onChange,
}: {
    value: Record<string, unknown>;
    saved: Record<string, unknown>;
    file: string;
    onChange(value: unknown): void;
}) {
    const [contextOpen, setContextOpen] = useState(false);
    const rules = isRecord(value.Rules) ? value.Rules : {},
        savedRules = isRecord(saved.Rules) ? saved.Rules : {};
    return (
        <div className={`entity-layout movement-rules-layout${contextOpen ? ' context-open' : ''}`}>
            <section className="item-editor">
                <header className="pane-header movement-rules-header">
                    <strong>Rules</strong>
                    <button
                        className="context-toggle"
                        aria-pressed={contextOpen}
                        onClick={() => setContextOpen(!contextOpen)}
                    >
                        Speed preview
                    </button>
                </header>
                <FieldsPage
                    fields={movementRulesSpec.fields}
                    values={rules}
                    saved={savedRules}
                    file={file}
                    pathPrefix="Rules."
                    fieldPathPrefix="Rules."
                    onChange={(next) => onChange(updateProperty(value, 'Rules', next))}
                />
            </section>
            <div className="context-slot">
                <button
                    className="context-close icon-button"
                    aria-label="Close speed preview"
                    onClick={() => setContextOpen(false)}
                >
                    ×
                </button>
                <MovementContext value={value} />
            </div>
        </div>
    );
}
export const movementViewSpec: StatSpec = { ...movementSpec, hash: 0 };
