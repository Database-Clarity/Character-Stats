import { lazy, Suspense, useId, useState } from 'react';

import {
    expandCurve,
    isRecord,
    validateField,
    type Curve,
    type CurveSegment,
    type FieldSpec,
} from '../../core';
import { useEditor } from '../state/store';
import { JsonInput } from './JsonInput';

const CurvePlot = lazy(() => import('./CurvePlot'));

export function CurveEditor({
    spec,
    value,
    saved,
    file,
    path,
    onChange,
}: {
    spec: FieldSpec;
    value: unknown;
    saved: unknown;
    file: string;
    path: string;
    onChange(value: unknown): void;
}) {
    const id = useId();
    const { dispatch, drafts } = useEditor();
    const [compare, setCompare] = useState(false);
    const [message, setMessage] = useState('');
    const domain = spec.domain!;
    const curve = value as Curve;
    const raw =
        !isRecord(value) ||
        !Array.isArray(value.Segments) ||
        !value.Segments.every(
            (segment) =>
                isRecord(segment) &&
                ['Constant', 'Expression', 'Linear'].includes(String(segment.Type)) &&
                (segment.Type !== 'Linear' ||
                    (Array.isArray(segment.Points) &&
                        segment.Points.every(
                            (point) => Array.isArray(point) && point.length === 2,
                        ))),
        );
    const invalidDraft = Object.entries(drafts).some(
        ([key, draft]) => key.startsWith(`${file}:${path}`) && draft.error,
    );
    const issues = validateField(spec, value);
    function samples(input: unknown): number[] {
        try {
            return expandCurve(input as Curve, domain);
        } catch {
            return [];
        }
    }
    const current = samples(value),
        original = compare ? samples(saved) : [];
    const plot = Array.from({ length: domain[1] - domain[0] + 1 }, (_, i) => ({
        x: domain[0] + i,
        current: current[i],
        saved: original[i],
    }));
    const segments = !raw ? (curve as Extract<Curve, { Segments: CurveSegment[] }>).Segments : [];
    function setSegments(next: CurveSegment[]) {
        onChange({ ...(isRecord(value) ? value : {}), Segments: next });
    }
    function update(index: number, next: CurveSegment) {
        setSegments(segments.map((s, i) => (i === index ? next : s)));
    }
    function mode(next: 'raw' | 'segments') {
        try {
            if (invalidDraft) throw new Error('The JSON draft is not valid.');
            const values = expandCurve(curve, domain);
            onChange(
                next === 'raw'
                    ? { Values: values }
                    : {
                          Domain: domain,
                          Round: spec.round ?? 3,
                          Segments: [
                              { Type: 'Linear', Points: values.map((y, i) => [domain[0] + i, y]) },
                          ],
                      },
            );
            dispatch({ type: 'clear-drafts', prefix: `${file}:${path}` });
            setMessage('');
        } catch (error) {
            setMessage(`Fix the curve before converting: ${(error as Error).message}`);
        }
    }
    return (
        <section className="curve card" aria-labelledby={id}>
            <h3 id={id}>
                {spec.label ?? spec.key}{' '}
                <small>
                    {domain[0]}–{domain[1]}
                </small>
            </h3>
            <p className="help">{spec.description}</p>
            <div className="toolbar">
                <button type="button" aria-pressed={!raw} onClick={() => raw && mode('segments')}>
                    Segments
                </button>
                <button type="button" aria-pressed={raw} onClick={() => !raw && mode('raw')}>
                    Raw values
                </button>
                <label className="check">
                    <input
                        type="checkbox"
                        checked={compare}
                        onChange={(e) => setCompare(e.target.checked)}
                    />
                    Compare with saved
                </label>
            </div>
            <div className="plot" aria-label={`${spec.key} curve plot`} role="img">
                <Suspense fallback={<p>Loading plot?</p>}>
                    <CurvePlot plot={plot} domain={domain} compare={compare} />
                </Suspense>
            </div>
            {raw ? (
                <JsonInput
                    file={file}
                    path={path}
                    label={`${spec.key} raw curve JSON`}
                    value={value}
                    onChange={onChange}
                />
            ) : (
                <>
                    <label className="inline">
                        Rounding digits
                        <input
                            aria-label={`${spec.key} rounding digits`}
                            type="number"
                            value={(value as { Round?: number }).Round ?? ''}
                            onChange={(e) => {
                                const next = { ...(value as Record<string, unknown>) };
                                if (e.target.value === '') delete next.Round;
                                else next.Round = Number(e.target.value);
                                onChange(next);
                            }}
                        />
                    </label>
                    {segments.map((segment, index) => (
                        <fieldset key={index} className="segment">
                            <legend>Segment {index + 1}</legend>
                            <label>
                                Type
                                <select
                                    value={segment.Type}
                                    onChange={(e) => {
                                        const from =
                                            segment.Type === 'Linear'
                                                ? (segment.Points[0]?.[0] ?? domain[0])
                                                : segment.From;
                                        const to =
                                            segment.Type === 'Linear'
                                                ? (segment.Points.at(-1)?.[0] ?? domain[1])
                                                : segment.To;
                                        update(
                                            index,
                                            e.target.value === 'Linear'
                                                ? {
                                                      Type: 'Linear',
                                                      Points: [
                                                          [from, 1],
                                                          [to, 1],
                                                      ],
                                                  }
                                                : e.target.value === 'Expression'
                                                  ? {
                                                        Type: 'Expression',
                                                        From: from,
                                                        To: to,
                                                        Expression: '1',
                                                    }
                                                  : {
                                                        Type: 'Constant',
                                                        From: from,
                                                        To: to,
                                                        Value: 1,
                                                    },
                                        );
                                        dispatch({
                                            type: 'clear-drafts',
                                            prefix: `${file}:${path}.Segments[${index}]`,
                                        });
                                    }}
                                >
                                    <option>Constant</option>
                                    <option>Linear</option>
                                    <option>Expression</option>
                                </select>
                            </label>
                            {segment.Type === 'Linear' ? (
                                <JsonInput
                                    file={file}
                                    path={`${path}.Segments[${index}].Points`}
                                    label={`Segment ${index + 1} points [x, y]`}
                                    value={segment.Points}
                                    onChange={(next) =>
                                        update(index, {
                                            ...segment,
                                            Points: next as [number, number][],
                                        })
                                    }
                                />
                            ) : (
                                <>
                                    <div className="row">
                                        {(['From', 'To'] as const).map((key) => (
                                            <label key={key}>
                                                {key}
                                                <input
                                                    aria-label={`${spec.key} segment ${index + 1} ${key}`}
                                                    type="number"
                                                    value={
                                                        Number.isFinite(segment[key])
                                                            ? segment[key]
                                                            : ''
                                                    }
                                                    onChange={(e) =>
                                                        update(index, {
                                                            ...segment,
                                                            [key]:
                                                                e.target.value === ''
                                                                    ? NaN
                                                                    : Number(e.target.value),
                                                        })
                                                    }
                                                />
                                            </label>
                                        ))}
                                    </div>
                                    {segment.Type === 'Constant' ? (
                                        <label>
                                            Value
                                            <input
                                                aria-label={`${spec.key} segment ${index + 1} Value`}
                                                type="number"
                                                step="any"
                                                value={
                                                    Number.isFinite(segment.Value)
                                                        ? segment.Value
                                                        : ''
                                                }
                                                onChange={(e) =>
                                                    update(index, {
                                                        ...segment,
                                                        Value:
                                                            e.target.value === ''
                                                                ? NaN
                                                                : Number(e.target.value),
                                                    })
                                                }
                                            />
                                        </label>
                                    ) : (
                                        <label>
                                            Expression
                                            <input
                                                aria-label={`${spec.key} segment ${index + 1} Expression`}
                                                value={segment.Expression}
                                                onChange={(e) =>
                                                    update(index, {
                                                        ...segment,
                                                        Expression: e.target.value,
                                                    })
                                                }
                                            />
                                        </label>
                                    )}
                                </>
                            )}
                            <div className="toolbar">
                                <button
                                    disabled={index === 0}
                                    onClick={() => {
                                        const next = [...segments];
                                        [next[index - 1], next[index]] = [
                                            next[index]!,
                                            next[index - 1]!,
                                        ];
                                        setSegments(next);
                                        dispatch({
                                            type: 'clear-drafts',
                                            prefix: `${file}:${path}.Segments`,
                                        });
                                    }}
                                >
                                    Move up
                                </button>
                                <button
                                    disabled={index === segments.length - 1}
                                    onClick={() => {
                                        const next = [...segments];
                                        [next[index], next[index + 1]] = [
                                            next[index + 1]!,
                                            next[index]!,
                                        ];
                                        setSegments(next);
                                        dispatch({
                                            type: 'clear-drafts',
                                            prefix: `${file}:${path}.Segments`,
                                        });
                                    }}
                                >
                                    Move down
                                </button>
                                <button
                                    className="danger"
                                    onClick={() => {
                                        setSegments(segments.filter((_, i) => i !== index));
                                        dispatch({
                                            type: 'clear-drafts',
                                            prefix: `${file}:${path}.Segments`,
                                        });
                                    }}
                                >
                                    Remove segment
                                </button>
                            </div>
                        </fieldset>
                    ))}
                    <button
                        onClick={() =>
                            setSegments([
                                ...segments,
                                { Type: 'Constant', From: domain[0], To: domain[1], Value: 1 },
                            ])
                        }
                    >
                        Add segment
                    </button>
                </>
            )}
            {message && (
                <p className="error" role="alert">
                    {message}
                </p>
            )}
            {issues.length > 0 && (
                <details open className="issues">
                    <summary>{issues.length} curve issue(s)</summary>
                    <ul>
                        {issues.map((issue, i) => (
                            <li key={i} className="error">
                                {issue.message}
                            </li>
                        ))}
                    </ul>
                </details>
            )}
        </section>
    );
}
