import { useState, type FormEvent } from 'react';
import { GitHubDataSource } from '../data';
import type { WorkflowRun } from '../github/client';
import { useEditor } from '../state/store';
import { Modal } from './Modal';
export function PublishDialog({ onClose }: { onClose(): void }) {
    const { source, dirty } = useEditor();
    const [version, setVersion] = useState('');
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
            await github.client.dispatchWorkflow(version.trim());
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
                . Regenerates the data apps download (versions/&lt;v&gt;/ and update.json) from
                source edits already committed to GitHub. On master it also redeploys the site.
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
                        New schema version (optional)
                        <input
                            placeholder="2.0 for first v2 release"
                            value={version}
                            onChange={(e) => setVersion(e.target.value)}
                            disabled={busy}
                        />
                    </label>
                    <p className="help">
                        The first v2 release must specify schema version 2.0. Leave empty to keep
                        the current version only when update.json already declares 2.0 or newer.
                        Changing the version is a breaking release and creates a new version
                        directory.
                    </p>
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
