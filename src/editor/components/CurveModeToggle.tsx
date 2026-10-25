import { NumberInput } from './NumberInput';

export default function CurveModeToggle({
    segmented,
    round,
    compare,
    fieldLabel,
    onModeChange,
    onRoundChange,
    onCompareChange,
}: {
    segmented: boolean;
    round: string;
    compare: boolean;
    fieldLabel: string;
    onModeChange(mode: 'values' | 'segments'): void;
    onRoundChange(round: number | undefined): void;
    onCompareChange(compare: boolean): void;
}) {
    return (
        <div className="curve-toolbar">
            <div className="toolbar">
                <button
                    aria-pressed={segmented}
                    onClick={() => !segmented && onModeChange('segments')}
                >
                    Segments
                </button>
                <button
                    aria-pressed={!segmented}
                    onClick={() => segmented && onModeChange('values')}
                >
                    Values
                </button>
            </div>
            {segmented && (
                <label className="inline rounding">
                    Rounding digits
                    <NumberInput
                        aria-label={`${fieldLabel} rounding digits`}
                        step={1}
                        constraints={{ min: 0, max: 15 }}
                        value={round}
                        onChangeValue={(raw) => onRoundChange(raw === '' ? undefined : Number(raw))}
                    />
                </label>
            )}
            <label className="check">
                <input
                    type="checkbox"
                    checked={compare}
                    onChange={(event) => onCompareChange(event.target.checked)}
                />
                Compare with saved
            </label>
        </div>
    );
}
