import { useState, type FormEvent } from 'react';
import { GitHubDataSource } from '../data';
import type { WorkflowRun } from '../github/client';
import { useEditor } from '../state/store';
import { AutoResizeTextarea } from './AutoResizeTextarea';
import { Modal } from './Modal';
export function PublishDialog({ onClose }: { onClose(): void }) {
    const { source, dirty } = useEditor();
    const [releaseNotes, setReleaseNotes] = useState('');
    const [busy, setBusy] = useState(false);
    const [dispatched, setDispatched] = useState(false);
    const [runs, setRuns] = useState<WorkflowRun[]>([]);
    const [error, setError] = useState('');
    const github = source instanceof GitHubDataSource ? source : undefined;
    async function refresh() {
        if (!github) return;
        setError('');
        try {
            setRuns(await github.client.listWorkflowRuns());
        } catch (e) {
            setError((e as Error).message);
        }
    }
    async function publish(event: FormEvent) {
        event.preventDefault();
        if (!github) return;
        setBusy(true);
        setError('');
        try {
            await github.client.dispatchWorkflow(releaseNotes);
            setDispatched(true);
            await refresh();
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setBusy(false);
        }
    }
    return (
        <Modal title="Publish data" onClose={onClose} busy={busy}>
            <p>
                <strong>
                    {github?.client.repo.branch === 'master'
                        ? 'Build data and deploy Pages'
                        : `Build data on ${github?.client.repo.branch ?? 'the selected branch'} — does not deploy Pages`}
                </strong>
                . Builds from source edits already committed to GitHub. Publishing automatically
                increments the patch version for each changed export. If exports are unchanged
                within the same code-defined major.minor, no version, changelog entry, or commit is
                created. A code-defined major.minor increase signals a new schema/API and publishes
                X.Y.0 even when the generated JSON is unchanged. Data is stored in
                versions/&lt;major&gt;/. On master it also redeploys the site.
            </p>
            {dirty.length > 0 && (
                <p className="warning">
                    You have unsaved edits. Save them first to include them in this build.
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
                    <button className="primary" disabled={!github || busy || dirty.length > 0}>
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
                                — {run.conclusion ?? run.status}
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
