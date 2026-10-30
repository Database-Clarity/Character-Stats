import { useRef } from 'react';
import { useEditor } from '../state/store';
import { issueTarget, type ChangeTarget } from '../state/editing';
import { issueLocationLabel } from '../state/locationLabels';
import { plural } from './textFormat';

export function ValidationPanel({ onGo }: { onGo(target: ChangeTarget): void }) {
    const { issues, sources } = useEditor();
    const details = useRef<HTMLDetailsElement>(null);
    const errors = issues.filter((i) => i.severity === 'error'),
        warnings = issues.filter((i) => i.severity === 'warning');
    return (
        <details ref={details} className={`validation ${errors.length ? 'has-errors' : ''}`}>
            <summary aria-live="polite">
                <span className={errors.length ? 'error' : 'success'}>
                    {errors.length ? '!' : '✓'}
                </span>{' '}
                {errors.length ? plural(errors.length, 'error') : 'Sources valid'}
                <span className="muted"> · {plural(warnings.length, 'warning')}</span>
            </summary>
            <div className="validation-issues">
                {!issues.length ? (
                    <p className="success">All sources and English placeholders are valid.</p>
                ) : (
                    issues.map((issue, i) => {
                        const target = issueTarget(issue.path, sources),
                            location = issueLocationLabel(issue.path, sources);
                        return (
                            <div className="validation-issue" key={i}>
                                <p
                                    className={issue.severity === 'error' ? 'error' : 'warning'}
                                    title={issue.path}
                                >
                                    <strong>{location}</strong>: {issue.message}
                                </p>
                                {target && (
                                    <button
                                        type="button"
                                        aria-label={`Go to ${location}`}
                                        title={issue.path}
                                        onClick={() => {
                                            details.current?.removeAttribute('open');
                                            onGo(target);
                                        }}
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
