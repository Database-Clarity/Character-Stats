import { useEditor } from '../state/store';
import { issueTarget, type ChangeTarget } from '../state/editing';
import { plural } from './textFormat';

export function ValidationPanel({ onGo }: { onGo(target: ChangeTarget): void }) {
    const { issues, sources } = useEditor();
    const errors = issues.filter((i) => i.severity === 'error'),
        warnings = issues.filter((i) => i.severity === 'warning');
    return (
        <details className={`validation ${errors.length ? 'has-errors' : ''}`}>
            <summary aria-live="polite">
                <span className={errors.length ? 'error' : 'success'}>
                    {errors.length ? '!' : '✓'}
                </span>{' '}
                {errors.length ? plural(errors.length, 'error') : 'Sources valid'}
                <span className="muted"> · {plural(warnings.length, 'warning')}</span>
                <span className="validation-hint">Shared core validation</span>
            </summary>
            <div className="validation-issues">
                {!issues.length ? (
                    <p className="success">All sources and English placeholders are valid.</p>
                ) : (
                    issues.map((issue, i) => {
                        const target = issueTarget(issue.path, sources);
                        return (
                            <div className="validation-issue" key={i}>
                                <p className={issue.severity === 'error' ? 'error' : 'warning'}>
                                    <code>{issue.path}</code>: {issue.message}
                                </p>
                                {target && (
                                    <button
                                        type="button"
                                        aria-label={`Go to ${issue.path}`}
                                        onClick={() => onGo(target)}
                                    >
                                        Go to
                                    </button>
                                )}
                            </div>
                        );
                    })
                )}
            </div>
        </details>
    );
}
