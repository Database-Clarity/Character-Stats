import { useState, type FormEvent } from 'react';
import { GitHubDataSource } from '../data';
import { GitHubError, type WorkflowRun } from '../github/client';
import { useEditor } from '../state/store';
import { AutoResizeTextarea } from './AutoResizeTextarea';
import { Modal } from './Modal';
function describe(error: unknown): string {
    const message = error instanceof Error ? error.message : String(error);
    return error instanceof GitHubError && error.status === 404
        ? `${message} The workflow build-data.yml must also exist on the repository's default branch.`
        : message;
}

function startedAt(run: WorkflowRun): string {
    const date = new Date(run.created_at);
    return Number.isNaN(date.getTime()) ? '' : date.toLocaleString();
}

export function PublishDialog({ onClose }: { onClose(): void }) {
    const { source, dirty, itemDrafts } = useEditor();
    const [releaseNotes, setReleaseNotes] = useState('');
    const [busy, setBusy] = useState(false);
    const [dispatched, setDispatched] = useState(false);
    const [runs, setRuns] = useState<WorkflowRun[]>([]);
    const [error, setError] = useState('');
    const [experimental, setExperimental] = useState(false);
    const github = source instanceof GitHubDataSource ? source : undefined;
    const branch = github?.client.repo.branch;
    const onMaster = branch === 'master';
    // Unadded item drafts are not in `dirty` but are not saved either.
    const unsaved = dirty.length + Object.keys(itemDrafts).length;
    const blocked = !github || unsaved > 0 || (!onMaster && !experimental);
    async function refresh() {
        if (!github) return;
        setError('');
        try {
            setRuns(await github.client.listWorkflowRuns());
        } catch (e) {
            setError(describe(e));
        }
    }
    async function publish(event: FormEvent) {
        event.preventDefault();
        if (!github || busy || blocked) return;
        setBusy(true);
        setError('');
        try {
            await github.client.dispatchWorkflow(releaseNotes);
            setDispatched(true);
            await refresh();
        } catch (e) {
            setError(describe(e));
        } finally {
            setBusy(false);
        }
    }
    return (
        <Modal title="Publish data" onClose={onClose} busy={busy}>
            <p>
                <strong>
                    {onMaster
                        ? 'Build data and deploy Pages'
                        : `Experimental data build on ${branch ?? 'the selected branch'}`}
                </strong>
                . Builds from source edits already committed to GitHub. Publishing automatically
                increments the patch version for each changed export. If exports are unchanged
                within the same code-defined major.minor, no version, changelog entry, or commit is
                created. A code-defined major.minor increase signals a new schema/API and publishes
                X.Y.0 even when the generated JSON is unchanged. Data is stored in
                versions/&lt;major&gt;/. On master it also redeploys the site.
            </p>
            {!onMaster && github && (
                <div className="warning" role="note">
                    <p>
                        This commits generated data and a version bump to <code>{branch}</code> and
                        does not deploy Pages. Merging this branch into master later can conflict
                        with master&apos;s own builds. Publish from master for a real release.
                    </p>
                    <label className="check">
                        <input
                            type="checkbox"
                            checked={experimental}
                            disabled={busy || dispatched}
                            onChange={(e) => setExperimental(e.target.checked)}
                        />{' '}
                        Commit an experimental data build and version bump to {branch}
                    </label>
                </div>
            )}
            {unsaved > 0 && (
                <p className="warning">
                    You have unsaved edits. Dispatch is blocked until they are saved (or discarded),
                    because the build only uses what is committed to GitHub.
                </p>
            )}
            {!github && <p className="error">Publishing is unavailable with local dev data.</p>}
            {!dispatched ? (
                <form onSubmit={publish}>
                    <label>
                        Release notes (optional)
                        <AutoResizeTextarea
                            value={releaseNotes}
                            onChange={(e) => setReleaseNotes(e.target.value)}
                            disabled={busy}
                        />
                    </label>
                    <button className="primary" disabled={busy || blocked}>
                        {busy ? 'Dispatching…' : 'Dispatch build workflow'}
                    </button>
                </form>
            ) : (
                <>
                    <p className="success" role="status">
                        Workflow dispatched. The new run may take a few seconds to appear.
                    </p>
                    <button
                        disabled={busy}
                        onClick={() => {
                            setBusy(true);
                            void refresh().finally(() => setBusy(false));
                        }}
                    >
                        Refresh runs
                    </button>
                    <h3>Recent dispatches on this branch</h3>
                    <ul>
                        {runs.map((run) => (
                            <li key={run.id}>
                                <a href={run.html_url} target="_blank" rel="noreferrer">
                                    {run.display_title} #{run.id}
                                </a>{' '}
                                {startedAt(run) && <>({startedAt(run)}) </>}—{' '}
                                {run.conclusion ?? run.status}
                            </li>
                        ))}
                    </ul>
                </>
            )}
            {github && (
                <p>
                    <a href={github.client.actionsUrl} target="_blank" rel="noreferrer">
                        Open Actions workflow runs
                    </a>
                </p>
            )}
            {error && (
                <p className="error" role="alert">
                    {error}
                </p>
            )}
        </Modal>
    );
}
