import { useId } from 'react';
import { useEditor } from '../state/store';
export function JsonInput({
    file,
    path,
    label,
    value,
    onChange,
    optional = false,
}: {
    file: string;
    path: string;
    label: string;
    value: unknown;
    onChange(value: unknown): void;
    optional?: boolean;
}) {
    const id = useId();
    const { drafts, dispatch } = useEditor();
    const key = `${file}:${path}`;
    const draft = drafts[key];
    return (
        <div className="json-input">
            <label htmlFor={id}>{label}</label>
            <textarea
                id={id}
                spellCheck={false}
                rows={5}
                value={draft?.text ?? (value === undefined ? '' : JSON.stringify(value, null, 2))}
                aria-invalid={!!draft?.error}
                aria-describedby={draft?.error ? id + '-error' : undefined}
                onChange={(event) => {
                    const text = event.target.value;
                    try {
                        const next: unknown =
                            optional && !text.trim() ? undefined : JSON.parse(text);
                        dispatch({ type: 'draft', key, draft: { text, error: '' } });
                        onChange(next);
                    } catch (error) {
                        dispatch({
                            type: 'draft',
                            key,
                            draft: { text, error: (error as Error).message },
                        });
                    }
                }}
            />
            {draft?.error && (
                <p className="error" id={id + '-error'} role="alert">
                    {draft.error}
                </p>
            )}
        </div>
    );
}
