import {
    renderTooltip,
    resolveLocale,
    validatePlaceholders,
    type StatSource,
    type StatSpec,
} from '../../core';
import { useEditor } from '../state/store';
import { updateLocaleText } from '../state/localeText';
import { AutoResizeTextarea } from './AutoResizeTextarea';

export function LocaleTextField({
    id,
    source,
    spec,
    statValue,
    context,
}: {
    id: string;
    source: StatSource;
    spec: StatSpec;
    statValue: number;
    context: Record<string, string | number>;
}) {
    const { locale, dispatch } = useEditor();
    const text = resolveLocale(locale, id) ?? '';
    const issues = validatePlaceholders(
        text,
        spec.fields.map((field) => field.key),
        `locale.${id}`,
    );
    return (
        <>
            <div className="text-entry">
                <label className="text-source">
                    English source
                    <AutoResizeTextarea
                        aria-label={id}
                        rows={4}
                        value={text}
                        aria-invalid={issues.length > 0}
                        onChange={(event) =>
                            dispatch({
                                type: 'set',
                                file: 'locale/en.json',
                                value: updateLocaleText(locale, id, event.target.value),
                            })
                        }
                    />
                </label>
                <div className="preview-column">
                    <h4>Live preview</h4>
                    <div className="tooltip-preview">
                        {renderTooltip(text, source, spec, statValue, context)}
                    </div>
                </div>
            </div>
            {issues.map((issue, index) => (
                <p className="error" key={index}>
                    {issue.message}
                </p>
            ))}
        </>
    );
}
