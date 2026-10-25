import { useId, useState } from 'react';
import {
    expandCurve,
    isRecord,
    validateField,
    type Curve,
    type CurveSegment,
    type FieldSpec,
} from '../../core';
import { Collapse } from './EditorPrimitives';
import CurveModeToggle from './CurveModeToggle';
import CurvePlot from './CurvePlot';
import SegmentList from './SegmentList';
import { valuesToSegments } from './curveValuesConversion';
import { numberStep } from './numberStep';
import { NumberInput } from './NumberInput';

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
    const id = useId(),
        domain = spec.domain!;
    const [compare, setCompare] = useState(false),
        [message, setMessage] = useState('');
    function samples(input: unknown): number[] {
        try {
            return expandCurve(input as Curve, domain);
        } catch {
            return [];
        }
    }
    const current = samples(value),
        original = compare ? samples(saved) : [];
    const precision =
        isRecord(value) && typeof value.Round === 'number' ? value.Round : (spec.precision ?? 3);
    const segmented = isRecord(value) && Array.isArray(value.Segments);
    const segments = segmented ? (value.Segments as CurveSegment[]) : [];
    const issues = validateField(spec, value);

    function setSegments(next: CurveSegment[]) {
        onChange({
            Domain: domain,
            ...(isRecord(value) && typeof value.Round === 'number' ? { Round: value.Round } : {}),
            Segments: next,
        });
    }

    function mode(next: 'values' | 'segments') {
        try {
            const values = expandCurve(value as Curve, domain);
            if (next === 'values') {
                onChange({ Values: values });
            } else {
                const result = valuesToSegments(values, domain);
                if (!('curve' in result)) {
                    setMessage(
                        `Cannot convert to Segments without losing precision: ${result.reason}`,
                    );
                    return;
                }
                onChange(result.curve);
            }
            setMessage('');
        } catch (error) {
            setMessage(`Fix the curve before converting: ${(error as Error).message}`);
        }
    }

    function setRound(round: number | undefined) {
        if (!isRecord(value)) return;
        const next = { ...value };
        if (round === undefined) delete next.Round;
        else next.Round = round;
        onChange(next);
    }

    return (
        <Collapse
            storageKey={`${file}:${path}`}
            className="curve"
            title={
                <>
                    <strong id={id} title={spec.description}>
                        {spec.label ?? spec.key}
                    </strong>
                    <span className="mono muted">
                        {domain[0]}–{domain[1]}
                    </span>
                </>
            }
        >
            <CurveModeToggle
                segmented={segmented}
                round={isRecord(value) ? String(value.Round ?? '') : ''}
                compare={compare}
                fieldLabel={spec.label ?? spec.key}
                onModeChange={mode}
                onRoundChange={setRound}
                onCompareChange={setCompare}
            />
            <p className="help curve-description sr-only">{spec.description}</p>
            <CurvePlot
                plot={Array.from({ length: domain[1] - domain[0] + 1 }, (_, i) => ({
                    x: domain[0] + i,
                    current: current[i],
                    saved: original[i],
                }))}
                domain={domain}
                compare={compare}
            />
            {segmented ? (
                <SegmentList
                    file={file}
                    path={path}
                    fieldLabel={spec.label ?? spec.key}
                    segments={segments}
                    domain={domain}
                    precision={precision}
                    onChange={setSegments}
                />
            ) : (
                <div className="raw-values">
                    {(isRecord(value) && Array.isArray(value.Values) ? value.Values : current).map(
                        (n, i) => (
                            <label key={i}>
                                {domain[0] + i}
                                <NumberInput
                                    step={numberStep(n, { ...spec, precision })}
                                    aria-label={`${spec.label ?? spec.key} value ${domain[0] + i}`}
                                    constraints={spec}
                                    value={Number.isFinite(n) ? Number(n) : ''}
                                    onChangeValue={(raw) =>
                                        onChange({
                                            Values: (isRecord(value) && Array.isArray(value.Values)
                                                ? value.Values
                                                : current
                                            ).map((v, j) =>
                                                i === j ? (raw === '' ? NaN : Number(raw)) : v,
                                            ),
                                        })
                                    }
                                />
                            </label>
                        ),
                    )}
                </div>
            )}
            {message && (
                <p className="error" role="alert">
                    {message}
                </p>
            )}
            {issues.length > 0 && (
                <details open className="issues">
                    <summary>{issues.length} curve issue(s)</summary>
                    {issues.map((issue, i) => (
                        <p key={i} className="error">
                            {issue.message}
                        </p>
                    ))}
                </details>
            )}
            <details className="view-json">
                <summary>View JSON</summary>
                <pre>{JSON.stringify(value, null, 2)}</pre>
            </details>
        </Collapse>
    );
}
