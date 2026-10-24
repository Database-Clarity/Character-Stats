import { useState, type FormEvent } from 'react';
import { GitHubDataSource } from '../data';
import { useEditor } from '../state/store';
import { Modal } from './Modal';
export function SaveDialog({ onClose }: { onClose(): void }) {
    const state = useEditor();
    const [message, setMessage] = useState('');
    const [mode, setMode] = useState('direct');
    const [branch, setBranch] = useState(`editor/update-${Date.now()}`);
    const [title, setTitle] = useState('');
    const [body, setBody] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [prUrl, setPrUrl] = useState('');
    const errors = state.issues.filter((issue) => issue.severity === 'error');
    async function save(event: FormEvent) {
        event.preventDefault();
        if (!(state.source instanceof GitHubDataSource) || errors.length || !state.dirty.length)
            return;
        setBusy(true);
        setError('');
        const source = state.source;
        let committed = false;
        try {
            const files = Object.fromEntries(
                state.dirty.map((path) => [path, state.serialized[path]!]),
            );
            const result = await source.client.commitFiles(
                files,
                message.trim(),
                state.head,
                mode === 'pr' ? branch.trim() : undefined,
            );
            committed = true;
            const nextSource = new GitHubDataSource(source.client.forBranch(result.branch));
            state.dispatch({ type: 'saved', files, head: result.sha, source: nextSource });
            setSuccess(
                `Saved ${Object.keys(files).length} file(s) in one commit on ${result.branch}.`,
            );
            if (mode === 'pr')
                setPrUrl(await source.client.createPR(result.branch, title.trim(), body));
        } catch (e) {
            setError(
                `${committed ? 'The commit succeeded, but creating the PR failed. Your changes are saved on the new branch; open a PR manually. ' : ''}${(e as Error).message}`,
            );
        } finally {
            setBusy(false);
        }
    }
    return (
        <Modal title="Save changes" onClose={onClose} busy={busy}>
            {success ? (
                <>
                    <p role="status" className="success">
                        {success}
                    </p>
                    {prUrl && (
                        <p>
                            <a href={prUrl} target="_blank" rel="noreferrer">
                                Open pull request
                            </a>
                        </p>
                    )}
                    {error && (
                        <p className="error" role="alert">
                            {error}
                        </p>
                    )}
                    <button onClick={onClose}>Done</button>
                </>
            ) : (
                <form onSubmit={save}>
                    <p>
                        {state.dirty.length} file(s) will be saved as a single commit. Warnings do
                        not block saving.
                    </p>
                    {errors.length > 0 && (
                        <p role="alert" className="error">
                            Save blocked by {errors.length} validation error(s). Close this dialog
                            to fix them.
                        </p>
                    )}
                    {state.source.readOnly && (
                        <p className="error">
                            Local dev data is read-only. Connect to GitHub to save.
                        </p>
                    )}
                    <fieldset disabled={busy}>
                        <label>
                            Commit message
                            <input
                                required
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                            />
                        </label>
                        <label>
                            Save method
                            <select value={mode} onChange={(e) => setMode(e.target.value)}>
                                <option value="direct">Direct commit to current branch</option>
                                <option value="pr">New branch + pull request</option>
                            </select>
                        </label>
                        {mode === 'pr' && (
                            <>
                                <label>
                                    New branch name
                                    <input
                                        required
                                        value={branch}
                                        onChange={(e) => setBranch(e.target.value)}
                                    />
                                </label>
                                <label>
                                    Pull request title
                                    <input
                                        required
                                        value={title}
                                        onChange={(e) => setTitle(e.target.value)}
                                    />
                                </label>
                                <label>
                                    Pull request body
                                    <textarea
                                        rows={4}
                                        value={body}
                                        onChange={(e) => setBody(e.target.value)}
                                    />
                                </label>
                            </>
                        )}
                        {error && (
                            <p className="error" role="alert">
                                {error}
                            </p>
                        )}
                        <button
                            className="primary"
                            type="submit"
                            disabled={
                                state.source.readOnly ||
                                errors.length > 0 ||
                                !state.dirty.length ||
                                !message.trim() ||
                                (mode === 'pr' && (!branch.trim() || !title.trim()))
                            }
                        >
                            {busy ? 'Saving…' : 'Save single commit'}
                        </button>
                    </fieldset>
                </form>
            )}
        </Modal>
    );
}
