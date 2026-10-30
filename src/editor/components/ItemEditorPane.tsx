import { useEffect, useMemo, useRef, useState } from 'react';
import { type EntitySpec, type StatSource, type StatSpec } from '../../core';
import { EntityForm } from './EntityForm';
import { AssociatedEntryText } from './AssociatedEntryText';
import { HashIdentity } from './ManifestUI';
import { ItemMenu, type ItemAction } from './ItemMenu';
import type { ManifestTable } from '../manifest';
import { plural } from './textFormat';
import { DraftValidationContext } from './draftValidation';

export function ItemEditorPane({
    spec,
    stat,
    statSpec,
    source,
    collection,
    file,
    selected,
    editorValue,
    saved,
    abilities,
    hash,
    manifestName,
    manifestTable,
    deleted,
    isDraft,
    formKey,
    hasContext,
    contextOpen,
    errors,
    duplicate,
    draftReady,
    actions,
    onToggleContext,
    onBack,
    onAddDraft,
    onDiscardDraft,
    onRestoreDeleted,
    onUseManifestName,
    onChange,
}: {
    spec: EntitySpec;
    stat: string;
    statSpec: StatSpec;
    source: StatSource;
    collection: string;
    file: string;
    selected: string | null;
    editorValue?: Record<string, unknown> | undefined;
    saved: Record<string, unknown>;
    abilities: Record<string, unknown>[];
    hash: number;
    manifestName?: string | undefined;
    manifestTable?: ManifestTable | undefined;
    deleted: boolean;
    isDraft: boolean;
    formKey: number;
    hasContext: boolean;
    contextOpen: boolean;
    errors: number;
    duplicate: boolean;
    draftReady: boolean;
    actions: ItemAction[];
    onToggleContext(): void;
    /** Returns to the item list where list and editor share one column (phones). */
    onBack(): void;
    onAddDraft(): void;
    onDiscardDraft(): void;
    onRestoreDeleted(): void;
    onUseManifestName(): void;
    onChange(value: Record<string, unknown>): void;
}) {
    const [touched, setTouched] = useState<ReadonlySet<string>>(new Set());
    const [attempts, setAttempts] = useState(0);
    const body = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (!isDraft) {
            setTouched(new Set());
            setAttempts(0);
        }
    }, [isDraft]);
    useEffect(() => {
        if (attempts) body.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
    }, [attempts]);
    const validation = useMemo(
        () => (isDraft ? { attempted: attempts > 0, touched } : null),
        [isDraft, attempts, touched],
    );
    function touch(event: { target: EventTarget }) {
        const path =
            event.target instanceof Element
                ? event.target.closest<HTMLElement>('[data-field]')?.dataset.field
                : undefined;
        if (isDraft && path && !touched.has(path)) setTouched(new Set(touched).add(path));
    }
    return (
        <section className="item-editor">
            <header className="pane-header editor-header">
                <button className="list-back" type="button" onClick={onBack}>
                    ← List
                </button>
                <h3 className="editor-title" tabIndex={-1} data-field="">
                    {editorValue ? (
                        Number.isFinite(hash) ? (
                            <HashIdentity
                                hash={hash}
                                name={String(editorValue.Name)}
                                table={manifestTable}
                            />
                        ) : (
                            <strong>{String(editorValue.Name ?? '') || 'New draft'}</strong>
                        )
                    ) : (
                        <strong>Item editor</strong>
                    )}
                </h3>
                <div className="toolbar">
                    {hasContext && (
                        <button
                            className="context-toggle"
                            aria-pressed={contextOpen}
                            onClick={onToggleContext}
                        >
                            {stat === 'Movement' ? 'Speed preview' : 'Context'}
                        </button>
                    )}
                    {editorValue && !isDraft && (
                        <ItemMenu label="Selected item actions" actions={actions} />
                    )}
                </div>
            </header>
            {isDraft && editorValue && (
                <div className="draft-toolbar">
                    <span className="badge">DRAFT</span>
                    <button
                        className="primary"
                        disabled={duplicate}
                        onClick={() =>
                            errors > 0 || !draftReady ? setAttempts(attempts + 1) : onAddDraft()
                        }
                    >
                        Add to list
                    </button>
                    <button onClick={onDiscardDraft}>Discard</button>
                    {duplicate && <span className="error">Hash already in list</span>}
                    {errors > 0 && (
                        <span className="error">{plural(errors, 'validation error')}</span>
                    )}
                </div>
            )}
            <div className="scroll-pane editor-body" ref={body} onBlur={touch}>
                {editorValue ? (
                    deleted ? (
                        <div className="empty-state" data-field="">
                            <p className="warning">This item is deleted.</p>
                            <button onClick={onRestoreDeleted}>Restore item</button>
                        </div>
                    ) : (
                        <>
                            <div data-field="" />
                            {manifestName &&
                                !String(editorValue.Name ?? '')
                                    .toLowerCase()
                                    .startsWith(manifestName.toLowerCase()) && (
                                    <div className="name-warning warning">
                                        Source name differs from manifest:{' '}
                                        <strong>{manifestName}</strong>
                                        <button onClick={onUseManifestName}>
                                            Use manifest name
                                        </button>
                                    </div>
                                )}
                            <DraftValidationContext.Provider value={validation}>
                                <EntityForm
                                    key={formKey}
                                    spec={spec}
                                    value={editorValue}
                                    saved={saved}
                                    file={file}
                                    path={`${collection}:${selected}`}
                                    abilities={abilities}
                                    onChange={onChange}
                                />
                            </DraftValidationContext.Provider>
                            {!isDraft && (
                                <AssociatedEntryText
                                    stat={stat}
                                    collection={collection}
                                    entitySpec={spec}
                                    entry={editorValue}
                                    statSpec={statSpec}
                                    source={source}
                                />
                            )}
                        </>
                    )
                ) : (
                    <p className="empty-state">
                        Select an item from the list.
                        <br />
                        <span className="muted">Right-click a row for actions. / to search.</span>
                    </p>
                )}
            </div>
        </section>
    );
}
