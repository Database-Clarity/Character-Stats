import { useEffect, useState, type FormEvent } from 'react';
import { GitHubDataSource } from '../data';
import { BranchExistsError, StaleHeadError } from '../github/client';
import { branchNameProblem, defaultBranchName } from '../github/refNames';
import { conflictLabel, summarizeValue } from '../state/locationLabels';
import { alreadyOnRemote, editedSinceMerge, getAtPath, type Resolution } from '../state/merge';
import { useEditor } from '../state/store';
import { AutoResizeTextarea } from './AutoResizeTextarea';
import { Modal } from './Modal';
import { plural } from './textFormat';

function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

const baseName = (path: string) => path.split('/').pop() ?? path;

export function SaveDialog({ onClose }: { onClose(): void }) {
    const state = useEditor();
    const [message, setMessage] = useState('');
    const [mode, setMode] = useState('direct');
    const [branch, setBranch] = useState('');
    const [branchEdited, setBranchEdited] = useState(false);
    const [takenBranches, setTakenBranches] = useState<string[]>([]);
    const [title, setTitle] = useState('');
    const [body, setBody] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [branchChanged, setBranchChanged] = useState(false);
    const [reloadedHead, setReloadedHead] = useState('');
    const [choices, setChoices] = useState<Record<string, Resolution>>({});
    const [success, setSuccess] = useState('');
    const [prUrl, setPrUrl] = useState('');
    const errors = state.issues.filter((issue) => issue.severity === 'error');
    const github = state.source instanceof GitHubDataSource ? state.source : undefined;
    const baseBranch = github?.client.repo.branch;
    const branchProblem = mode === 'pr' ? branchNameProblem(branch.trim()) : undefined;
    const unresolved = state.conflicts.length;

    // The default name needs the existing branches to stay unique; fetch them once in PR mode.
    useEffect(() => {
        if (mode !== 'pr' || !github) return;
        let cancelled = false;
        github.client
            .listBranches()
            .then((names) => !cancelled && setTakenBranches(names))
            .catch(() => undefined);
        return () => {
            cancelled = true;
        };
    }, [mode, github]);
    useEffect(() => {
        if (mode === 'pr' && !branchEdited) setBranch(defaultBranchName(new Date(), takenBranches));
    }, [mode, branchEdited, takenBranches]);

    async function save(event: FormEvent) {
        event.preventDefault();
        if (!github || busy || errors.length || unresolved || !state.dirty.length || branchProblem)
            return;
        setBusy(true);
        setError('');
        setNotice('');
        setBranchChanged(false);
        const source = github;
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
                    if (await adoptOwnCommit(source, files)) return;
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
                    if (commitError instanceof BranchExistsError) {
                        // A lost response may mean our earlier attempt already created this branch.
                        const sha = await existingBranchHead(source, files, commitError.branch);
                        if (!sha) throw commitError;
                        result = { sha, branch: commitError.branch };
                        break;
                    }
                    if (!(commitError instanceof StaleHeadError) || attempt === 2)
                        throw commitError;
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
            if (saveError instanceof StaleHeadError) setBranchChanged(true);
            setError(
                `${committed ? 'The commit succeeded, but creating the PR failed. Your changes are saved on the new branch; open a PR manually. ' : ''}${detail}`,
            );
        } finally {
            setBusy(false);
        }
    }

    /** A save that failed mid-flight may still have landed; if the remote already has our text, adopt it. */
    async function adoptOwnCommit(
        source: GitHubDataSource,
        files: Record<string, string>,
    ): Promise<boolean> {
        let loaded;
        try {
            loaded = await source.load();
        } catch {
            return false;
        }
        if (!alreadyOnRemote(state.dirty, files, loaded.files)) return false;
        state.dispatch({
            type: 'rebase',
            files: loaded.files,
            head: loaded.head,
            preserve: state.dirty,
        });
        state.dispatch({ type: 'saved', files, head: loaded.head, source });
        setSuccess(
            `Your changes are already on ${source.client.repo.branch}: an earlier save reached GitHub. Nothing more to commit.`,
        );
        return true;
    }

    /** Head of `branch` when it already holds exactly our files (an earlier PR-mode save landed). */
    async function existingBranchHead(
        source: GitHubDataSource,
        files: Record<string, string>,
        branch: string,
    ): Promise<string | undefined> {
        try {
            const loaded = await new GitHubDataSource(source.client.forBranch(branch)).load();
            return alreadyOnRemote(state.dirty, files, loaded.files) ? loaded.head : undefined;
        } catch {
            return undefined;
        }
    }

    async function reloadKeepingEdits() {
        if (!github) return;
        setBusy(true);
        setError('');
        try {
            const loaded = await github.load();
            state.dispatch({
                type: 'rebase',
                files: loaded.files,
                head: loaded.head,
                preserve: state.dirty,
            });
            setBranchChanged(false);
            setChoices({});
            setReloadedHead(loaded.head.slice(0, 7));
            setNotice('');
        } catch (reloadError) {
            setError(`Could not reload the branch: ${errorMessage(reloadError)}`);
        } finally {
            setBusy(false);
        }
    }

    function applyChoices() {
        for (const conflict of state.conflicts) {
            const choice = choices[conflict.id];
            if (choice) state.dispatch({ type: 'resolve-conflict', id: conflict.id, choice });
        }
        setChoices({});
    }

    const mergeNotice =
        reloadedHead && !unresolved
            ? state.mergedFiles.length
                ? `Reloaded the branch at ${reloadedHead} and merged remote changes into ${state.mergedFiles.map(baseName).join(', ')}. Your edits were kept; review them in Changes.`
                : `Reloaded the branch at ${reloadedHead}. No remote change overlapped your files.`
            : '';

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
                    {(notice || mergeNotice) && <p role="status">{notice || mergeNotice}</p>}
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
                    {unresolved > 0 && (
                        <section aria-label="Merge conflicts" className="merge-conflicts">
                            <p role="alert" className="error">
                                {plural(unresolved, 'change')} you made also changed on the branch.
                                Choose which value to keep for each; Save stays blocked until all
                                are resolved.
                            </p>
                            {state.conflicts.map((conflict) => (
                                <fieldset key={conflict.id} disabled={busy}>
                                    <legend>
                                        {conflictLabel(
                                            conflict,
                                            state.sources,
                                            state.values[conflict.file],
                                        )}
                                    </legend>
                                    {(
                                        [
                                            [
                                                'ours',
                                                'Keep mine',
                                                getAtPath(
                                                    state.values[conflict.file],
                                                    conflict.path,
                                                ),
                                            ],
                                            ['theirs', 'Take theirs', conflict.theirs],
                                        ] as const
                                    ).map(([choice, label, value]) => (
                                        <label key={choice} className="conflict-choice">
                                            <input
                                                type="radio"
                                                name={`conflict-${conflict.id}`}
                                                checked={choices[conflict.id] === choice}
                                                onChange={() =>
                                                    setChoices((current) => ({
                                                        ...current,
                                                        [conflict.id]: choice,
                                                    }))
                                                }
                                            />{' '}
                                            {label}: <code>{summarizeValue(value)}</code>
                                        </label>
                                    ))}
                                    {editedSinceMerge(state.values[conflict.file], conflict) && (
                                        <p className="help">
                                            You edited this after the reload; your newer edit is
                                            kept either way.
                                        </p>
                                    )}
                                </fieldset>
                            ))}
                            <button
                                type="button"
                                disabled={
                                    busy || state.conflicts.some((c) => choices[c.id] === undefined)
                                }
                                onClick={applyChoices}
                            >
                                Apply choices
                            </button>
                        </section>
                    )}
                    {branchChanged && (
                        <div role="alert" className="error">
                            <p>
                                Branch changed: reload the latest branch to merge its changes into
                                your pending edits (overlapping changes are shown for you to
                                resolve), or cancel this save.
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
                                <p className="help">
                                    Pull request into <code>{baseBranch}</code>
                                </p>
                                <label>
                                    New branch name
                                    <input
                                        required
                                        value={branch}
                                        aria-invalid={!!branchProblem}
                                        onChange={(event) => {
                                            setBranchEdited(true);
                                            setBranch(event.target.value);
                                        }}
                                    />
                                </label>
                                {branchProblem && branch.trim() && (
                                    <p className="error" role="alert">
                                        {branchProblem}
                                    </p>
                                )}
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
                                unresolved > 0 ||
                                !state.dirty.length ||
                                !message.trim() ||
                                (mode === 'pr' && (!!branchProblem || !title.trim()))
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
