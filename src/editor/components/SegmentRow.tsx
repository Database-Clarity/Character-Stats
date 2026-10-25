import type { CurveSegment, Domain } from '../../core';
import { Collapse } from './EditorPrimitives';
import { numberStep } from './numberStep';
import { NumberInput } from './NumberInput';

export default function SegmentRow({
    file,
    path,
    fieldLabel,
    segment,
    index,
    segmentCount,
    domain,
    precision,
    onChange,
    onMoveUp,
    onMoveDown,
    onRemove,
}: {
    file: string;
    path: string;
    fieldLabel: string;
    segment: CurveSegment;
    index: number;
    segmentCount: number;
    domain: Domain;
    precision: number;
    onChange(segment: CurveSegment): void;
    onMoveUp(): void;
    onMoveDown(): void;
    onRemove(): void;
}) {
    return (
        <Collapse
            storageKey={`${file}:${path}:segment:${index}`}
            className="segment"
            title={
                <>
                    <span>Segment {index + 1}</span>
                    <span className="muted mono">{segment.Type}</span>
                </>
            }
        >
            <div className="segment-row">
                <label>
                    Type
                    <select
                        aria-label={`${fieldLabel} segment ${index + 1} type`}
                        value={segment.Type}
                        onChange={(event) => {
                            const from =
                                    segment.Type === 'Linear'
                                        ? (segment.Points[0]?.[0] ?? domain[0])
                                        : segment.From,
                                to =
                                    segment.Type === 'Linear'
                                        ? (segment.Points.at(-1)?.[0] ?? domain[1])
                                        : segment.To;
                            onChange(
                                event.target.value === 'Linear'
                                    ? {
                                          Type: 'Linear',
                                          Points: [
                                              [from, 1],
                                              [to, 1],
                                          ],
                                      }
                                    : event.target.value === 'Expression'
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
                        }}
                    >
                        <option>Constant</option>
                        <option>Linear</option>
                        <option>Expression</option>
                    </select>
                </label>
                {segment.Type !== 'Linear' && (
                    <>
                        {(['From', 'To'] as const).map((key) => (
                            <label key={key}>
                                {key}
                                <NumberInput
                                    aria-label={`${fieldLabel} segment ${index + 1} ${key} stat value`}
                                    value={Number.isFinite(segment[key]) ? segment[key] : ''}
                                    step={numberStep(segment[key], { precision }, true)}
                                    constraints={{ min: domain[0], max: domain[1] }}
                                    onChangeValue={(raw) =>
                                        onChange({
                                            ...segment,
                                            [key]: raw === '' ? NaN : Number(raw),
                                        })
                                    }
                                />
                            </label>
                        ))}
                        {segment.Type === 'Constant' ? (
                            <label>
                                Value
                                <NumberInput
                                    aria-label={`${fieldLabel} segment ${index + 1} Value`}
                                    step={numberStep(segment.Value, { precision })}
                                    value={Number.isFinite(segment.Value) ? segment.Value : ''}
                                    onChangeValue={(raw) =>
                                        onChange({
                                            ...segment,
                                            Value: raw === '' ? NaN : Number(raw),
                                        })
                                    }
                                />
                            </label>
                        ) : (
                            <label className="expression">
                                Expression
                                <input
                                    aria-label={`${fieldLabel} segment ${index + 1} Expression`}
                                    value={segment.Expression}
                                    onChange={(event) =>
                                        onChange({
                                            ...segment,
                                            Expression: event.target.value,
                                        })
                                    }
                                />
                            </label>
                        )}
                    </>
                )}
                <div className="toolbar segment-actions">
                    <button
                        className="icon-button"
                        aria-label={`Move segment ${index + 1} up`}
                        disabled={!index}
                        onClick={onMoveUp}
                    >
                        ↑
                    </button>
                    <button
                        className="icon-button"
                        aria-label={`Move segment ${index + 1} down`}
                        disabled={index === segmentCount - 1}
                        onClick={onMoveDown}
                    >
                        ↓
                    </button>
                    <button
                        className="icon-button danger"
                        aria-label={`Remove segment ${index + 1}`}
                        onClick={onRemove}
                    >
                        ×
                    </button>
                </div>
            </div>
            {segment.Type === 'Linear' && (
                <div className="points-grid">
                    {segment.Points.map((point, pointIndex) => (
                        <div className="point-row" key={pointIndex}>
                            <span className="mono muted">{pointIndex}</span>
                            {([0, 1] as const).map((axis) => (
                                <label key={axis}>
                                    {axis === 0 ? 'x' : 'y'}
                                    <NumberInput
                                        aria-label={`${fieldLabel} segment ${index + 1} point ${pointIndex} ${axis === 0 ? 'stat value' : 'Value'}`}
                                        step={numberStep(point[axis], { precision }, axis === 0)}
                                        constraints={
                                            axis === 0
                                                ? { min: domain[0], max: domain[1] }
                                                : undefined
                                        }
                                        value={Number.isFinite(point[axis]) ? point[axis] : ''}
                                        onChangeValue={(raw) =>
                                            onChange({
                                                ...segment,
                                                Points: segment.Points.map((currentPoint, i) =>
                                                    i === pointIndex
                                                        ? axis === 0
                                                            ? [Number(raw), currentPoint[1]]
                                                            : [currentPoint[0], Number(raw)]
                                                        : currentPoint,
                                                ),
                                            })
                                        }
                                    />
                                </label>
                            ))}
                            <button
                                className="icon-button danger"
                                aria-label={`Remove point ${pointIndex}`}
                                onClick={() =>
                                    onChange({
                                        ...segment,
                                        Points: segment.Points.filter((_, i) => i !== pointIndex),
                                    })
                                }
                            >
                                ×
                            </button>
                        </div>
                    ))}
                    <button
                        onClick={() =>
                            onChange({
                                ...segment,
                                Points: [...segment.Points, [domain[1], 1]],
                            })
                        }
                    >
                        + Add point
                    </button>
                </div>
            )}
        </Collapse>
    );
}
