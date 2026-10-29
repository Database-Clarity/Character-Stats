import { useState, type FormEvent } from 'react';
import { GitHubDataSource } from '../data';
import { useEditor } from '../state/store';
import { AutoResizeTextarea } from './AutoResizeTextarea';
import { Modal } from './Modal';
import { plural } from './textFormat';

function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

function isStaleHeadError(error: unknown): boolean {
    return errorMessage(error).toLowerCase().includes('branch changed since loading');
}

export function SaveDialog({ onClose }: { onClose(): void }) {
    const state = useEditor();
    const [message, setMessage] = useState('');
    const [mode, setMode] = useState('direct');
    const [branch, setBranch] = useState(`editor/update-${Date.now()}`);
    const [title, setTitle] = useState('');
    const [body, setBody] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [branchChanged, setBranchChanged] = useState(false);
    const [success, setSuccess] = useState('');
    const [prUrl, setPrUrl] = useState('');
    const errors = state.issues.filter((issue) => issue.severity === 'error');

    async function save(event: FormEvent) {
        event.preventDefault();
        if (!(state.source instanceof GitHubDataSource) || errors.length || !state.dirty.length)
            return;
        setBusy(true);
        setError('');
        setNotice('');
        setBranchChanged(false);
        const source = state.source;
        let committed = false;
        try {
            const files = Object.fromEntries(
                state.dirty.map((path) => [path, state.serialized[path]!]),
            );
            let expectedHead = state.head;
            let result: Awaited<ReturnType<typeof source.client.commitFiles>> | undefined;
            for (let attempt = 0; attempt < 3; attempt++) {
                const comparison = await source.client.checkTrackedFiles(expectedHead);
                if (comparison.changed) {
                    setBranchChanged(true);
                    return;
                }
                if (comparison.head !== expectedHead) {
                    expectedHead = comparison.head;
                    state.dispatch({ type: 'fast-forward', head: expectedHead });
                }
                try {
                    result = await source.client.commitFiles(
                        files,
                        message.trim(),
                        expectedHead,
                        mode === 'pr' ? branch.trim() : undefined,
                    );
                    break;
                } catch (commitError) {
                    if (!isStaleHeadError(commitError) || attempt === 2) throw commitError;
                }
            }
            if (!result)
                throw new Error('The save could not be completed because the branch kept moving.');
            committed = true;
            const nextSource = new GitHubDataSource(source.client.forBranch(result.branch));
            state.dispatch({ type: 'saved', files, head: result.sha, source: nextSource });
            setSuccess(
                `Saved ${plural(Object.keys(files).length, 'file')} in one commit on ${result.branch}.`,
            );
            if (mode === 'pr')
                setPrUrl(await source.client.createPR(result.branch, title.trim(), body));
        } catch (saveError) {
            const detail = errorMessage(saveError);
            if (isStaleHeadError(saveError)) setBranchChanged(true);
            setError(
                `${committed ? 'The commit succeeded, but creating the PR failed. Your changes are saved on the new branch; open a PR manually. ' : ''}${detail}`,
            );
        } finally {
            setBusy(false);
        }
    }

    async function reloadKeepingEdits() {
        if (!(state.source instanceof GitHubDataSource)) return;
        setBusy(true);
        setError('');
        try {
            const loaded = await state.source.load();
            state.dispatch({
                type: 'rebase',
                files: loaded.files,
                head: loaded.head,
                preserve: state.dirty,
            });
            setBranchChanged(false);
            setNotice(
                `Reloaded the branch at ${loaded.head.slice(0, 7)}. Your pending edits were kept against the new originals as a rebase attempt; review them before saving again.`,
            );
        } catch (reloadError) {
            setError(`Could not reload the branch: ${errorMessage(reloadError)}`);
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
                        {plural(state.dirty.length, 'file')} will be saved as a single commit.
                        Warnings do not block saving.
                    </p>
                    <p className="help">
                        Save writes sources/ and locale/en.json to the branch, or opens a PR. On
                        master, it redeploys the site and sends English text to Crowdin. It does not
                        change the data apps download; Publish regenerates that data.
                    </p>
                    {notice && <p role="status">{notice}</p>}
                    {errors.length > 0 && (
                        <p role="alert" className="error">
                            Save blocked by {plural(errors.length, 'validation error')}. Close this
                            dialog to fix them.
                        </p>
                    )}
                    {state.source.readOnly && (
                        <p className="error">
                            Local dev data is read-only. Connect to GitHub to save.
                        </p>
                    )}
                    {branchChanged && (
                        <div role="alert" className="error">
                            <p>
                                Branch changed: reload the latest branch (your pending edits will be
                                kept as a rebase attempt), or cancel this save.
                            </p>
                            <button type="button" onClick={reloadKeepingEdits} disabled={busy}>
                                Reload and keep pending edits
                            </button>{' '}
                            <button type="button" onClick={onClose} disabled={busy}>
                                Cancel
                            </button>
                        </div>
                    )}
                    <fieldset disabled={busy || branchChanged}>
                        <label>
                            Commit message
                            <input
                                required
                                value={message}
                                onChange={(event) => setMessage(event.target.value)}
                            />
                        </label>
                        <label>
                            Save method
                            <select value={mode} onChange={(event) => setMode(event.target.value)}>
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
                                        onChange={(event) => setBranch(event.target.value)}
                                    />
                                </label>
                                <label>
                                    Pull request title
                                    <input
                                        required
                                        value={title}
                                        onChange={(event) => setTitle(event.target.value)}
                                    />
                                </label>
                                <label>
                                    Pull request body
                                    <AutoResizeTextarea
                                        rows={4}
                                        value={body}
                                        onChange={(event) => setBody(event.target.value)}
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
                            {busy ? 'Saving...' : 'Save single commit'}
                        </button>
                    </fieldset>
                </form>
            )}
        </Modal>
    );
}
