import type { CurveSegment, Domain } from '../../core';
import SegmentRow from './SegmentRow';

export default function SegmentList({
    file,
    path,
    fieldKey,
    segments,
    domain,
    onChange,
}: {
    file: string;
    path: string;
    fieldKey: string;
    segments: CurveSegment[];
    domain: Domain;
    onChange(segments: CurveSegment[]): void;
}) {
    function update(index: number, next: CurveSegment) {
        onChange(segments.map((segment, i) => (index === i ? next : segment)));
    }

    function move(index: number, destination: number) {
        const next = [...segments];
        next.splice(destination, 0, next.splice(index, 1)[0]!);
        onChange(next);
    }

    return (
        <>
            {segments.map((segment, index) => (
                <SegmentRow
                    file={file}
                    path={path}
                    fieldKey={fieldKey}
                    segment={segment}
                    index={index}
                    segmentCount={segments.length}
                    domain={domain}
                    onChange={(next) => update(index, next)}
                    onMoveUp={() => move(index, index - 1)}
                    onMoveDown={() => move(index, index + 1)}
                    onRemove={() => onChange(segments.filter((_, i) => i !== index))}
                    key={index}
                />
            ))}
            <button
                onClick={() =>
                    onChange([
                        ...segments,
                        { Type: 'Constant', From: domain[0], To: domain[1], Value: 1 },
                    ])
                }
            >
                + Add segment
            </button>
        </>
    );
}
