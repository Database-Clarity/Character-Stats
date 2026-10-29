import { type EntitySpec, type StatSource, type StatSpec } from '../../core';
import { EntityForm } from './EntityForm';
import { AssociatedEntryText } from './AssociatedEntryText';
import { HashIdentity } from './ManifestUI';
import { ItemMenu, type ItemAction } from './ItemMenu';
import type { ManifestTable } from '../manifest';
import { plural } from './textFormat';

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
    onAddDraft(): void;
    onDiscardDraft(): void;
    onRestoreDeleted(): void;
    onUseManifestName(): void;
    onChange(value: Record<string, unknown>): void;
}) {
    return (
        <section className="item-editor">
            <header className="pane-header editor-header">
                <div>
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
                </div>
                <div className="toolbar">
                    {hasContext && (
                        <button
                            className="context-toggle"
                            aria-pressed={contextOpen}
                            onClick={onToggleContext}
                        >
                            Context
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
                        disabled={errors > 0 || duplicate || !draftReady}
                        onClick={onAddDraft}
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
            <div className="scroll-pane editor-body">
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
