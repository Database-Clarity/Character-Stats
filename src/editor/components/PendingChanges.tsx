import { useEditor } from '../state/store';
import type { EditorChange } from '../state/editing';
import { Collapse } from './EditorPrimitives';
import { Modal } from './Modal';
import { formatChangeValue, structuredDiff, type StructuredChange } from './structuredDiff';
function lineDiff(before: string, after: string): { type: string; text: string }[] {
    const a = before.replace(/\r\n/g, '\n').split('\n'),
        b = after.replace(/\r\n/g, '\n').split('\n');
    let start = 0,
        end = 0;
    while (start < a.length && start < b.length && a[start] === b[start]) start++;
    while (
        end < a.length - start &&
        end < b.length - start &&
        a[a.length - end - 1] === b[b.length - end - 1]
    )
        end++;
    return [
        ...a.slice(Math.max(0, start - 3), start).map((text) => ({ type: ' ', text })),
        ...a.slice(start, a.length - end).map((text) => ({ type: '-', text })),
        ...b.slice(start, b.length - end).map((text) => ({ type: '+', text })),
        ...a.slice(a.length - end, a.length - end + 3).map((text) => ({ type: ' ', text })),
    ];
}
const preview = (value: unknown) => formatChangeValue(value);
function DiffEntries({ changes }: { changes: StructuredChange[] }) {
    return (
        <ul>
            {changes.map((entry) => (
                <li key={entry.label}>
                    <strong>{entry.label}:</strong> {formatChangeValue(entry.before)}{' '}
                    {String.fromCharCode(0x2192)} {formatChangeValue(entry.after)}
                </li>
            ))}
        </ul>
    );
}
function ChangeRows({
    changes,
    onGo,
}: {
    changes: EditorChange[];
    onGo(change: EditorChange): void;
}) {
    return (
        <>
            {changes.map((change) => (
                <div className="change-row" key={change.id}>
                    <span className={`row-status ${change.kind}`}>
                        {change.kind === 'modified' ? '●' : change.kind === 'added' ? '+' : '−'}
                    </span>
                    <div>
                        <strong>{change.field || change.kind + ' item'}</strong>
                        {(() => {
                            const diff = structuredDiff(change.before, change.after);
                            return diff ? (
                                <div className="structured-diff mono">
                                    {diff.formatChange && <p>Curve format: {diff.formatChange}</p>}
                                    {diff.changes.length ? (
                                        <>
                                            <DiffEntries changes={diff.changes.slice(0, 12)} />
                                            {diff.changes.length > 12 && (
                                                <details>
                                                    <summary>
                                                        Show {diff.changes.length - 12} more changed
                                                        entries
                                                    </summary>
                                                    <DiffEntries changes={diff.changes.slice(12)} />
                                                </details>
                                            )}
                                        </>
                                    ) : (
                                        <p>No changed entries.</p>
                                    )}
                                    <details>
                                        <summary>Show full old and new values</summary>
                                        <div>
                                            <strong>Old</strong>
                                            <pre>{formatChangeValue(change.before, true)}</pre>
                                        </div>
                                        <div>
                                            <strong>New</strong>
                                            <pre>{formatChangeValue(change.after, true)}</pre>
                                        </div>
                                    </details>
                                </div>
                            ) : (
                                <div className="change-values mono">
                                    <span title={preview(change.before)}>
                                        {preview(change.before)}
                                    </span>
                                    <span>{String.fromCharCode(0x2192)}</span>
                                    <span title={preview(change.after)}>
                                        {preview(change.after)}
                                    </span>
                                </div>
                            );
                        })()}
                    </div>
                    <button onClick={() => onGo(change)}>Go to</button>
                </div>
            ))}
        </>
    );
}
export function PendingChanges({
    onClose,
    onGo,
}: {
    onClose(): void;
    onGo(change: EditorChange): void;
}) {
    const { dirty, originals, serialized, dispatch, changes } = useEditor();
    function discard(file?: string) {
        if (
            window.confirm(
                file ? `Discard all changes to ${file}?` : 'Discard all pending changes?',
            )
        )
            dispatch(file ? { type: 'discard', file } : { type: 'discard' });
    }
    return (
        <Modal title={`Changes (${changes.length})`} onClose={onClose} className="changes-dialog">
            <div className="section-bar">
                <p className="muted">
                    {changes.length} changes · {dirty.length} files
                </p>
                <button className="danger" disabled={!dirty.length} onClick={() => discard()}>
                    Discard all
                </button>
            </div>
            <div className="toolbar change-collapse-actions">
                <button
                    onClick={(e) =>
                        e.currentTarget
                            .closest('dialog')
                            ?.querySelectorAll('details')
                            .forEach((d) => (d.open = false))
                    }
                >
                    Collapse all
                </button>
                <button
                    onClick={(e) =>
                        e.currentTarget
                            .closest('dialog')
                            ?.querySelectorAll('details')
                            .forEach((d) => (d.open = true))
                    }
                >
                    Expand all
                </button>
            </div>
            {!changes.length && <p className="empty-state">No pending changes.</p>}
            {[...new Set(changes.map((c) => c.stat))].map((stat) => (
                <Collapse
                    key={stat}
                    storageKey={`changes:${stat}`}
                    title={
                        <>
                            {stat}
                            <span className="count-badge">
                                {changes.filter((c) => c.stat === stat).length}
                            </span>
                        </>
                    }
                >
                    {[...new Set(changes.filter((c) => c.stat === stat).map((c) => c.tab))].map(
                        (tab) => (
                            <Collapse key={tab} storageKey={`changes:${stat}:${tab}`} title={tab}>
                                {[
                                    ...new Set(
                                        changes
                                            .filter((c) => c.stat === stat && c.tab === tab)
                                            .map((c) => c.item),
                                    ),
                                ].map((item) => {
                                    const group = changes.filter(
                                        (c) => c.stat === stat && c.tab === tab && c.item === item,
                                    );
                                    return item ? (
                                        <Collapse
                                            key={`item:${item}`}
                                            storageKey={`changes:${stat}:${tab}:${item}`}
                                            title={item}
                                        >
                                            <ChangeRows changes={group} onGo={onGo} />
                                        </Collapse>
                                    ) : (
                                        <ChangeRows key="no-item" changes={group} onGo={onGo} />
                                    );
                                })}
                            </Collapse>
                        ),
                    )}
                </Collapse>
            ))}
            {dirty.map((file) => (
                <Collapse
                    key={file}
                    storageKey={`diff:${file}`}
                    title={`File diff · ${file}`}
                    initiallyOpen={false}
                >
                    <button className="danger" onClick={() => discard(file)}>
                        Discard file
                    </button>
                    <pre className="diff">
                        {lineDiff(originals[file]!, serialized[file]!).map((line, i) => (
                            <span
                                className={
                                    line.type === '+' ? 'added' : line.type === '-' ? 'removed' : ''
                                }
                                key={i}
                            >
                                {line.type} {line.text}
                                {'\n'}
                            </span>
                        ))}
                    </pre>
                </Collapse>
            ))}
        </Modal>
    );
}
