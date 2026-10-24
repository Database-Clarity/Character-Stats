import { useEditor } from '../state/store';
import { Modal } from './Modal';
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
export function PendingChanges({ onClose }: { onClose(): void }) {
    const { dirty, originals, serialized, dispatch, drafts } = useEditor();
    function discard(file?: string) {
        if (
            window.confirm(
                file ? `Discard all changes to ${file}?` : 'Discard all pending changes?',
            )
        )
            dispatch(file ? { type: 'discard', file } : { type: 'discard' });
    }
    return (
        <Modal title="Pending changes" onClose={onClose}>
            <p>
                {dirty.length} changed file(s). Diffs compare the original file with the stable
                serialization that will be committed.
            </p>
            {dirty.length > 0 && (
                <button className="danger" onClick={() => discard()}>
                    Discard all
                </button>
            )}
            {dirty.map((file) => (
                <section className="change-file" key={file}>
                    <div className="toolbar">
                        <h3>{file}</h3>
                        <button className="danger" onClick={() => discard(file)}>
                            Discard file
                        </button>
                    </div>
                    {Object.entries(drafts)
                        .filter(([key, draft]) => key.startsWith(file + ':') && draft.error)
                        .map(([key, draft]) => (
                            <p className="error" key={key}>
                                Unparsed draft at {key}: {draft.error}
                            </p>
                        ))}
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
                </section>
            ))}
        </Modal>
    );
}
