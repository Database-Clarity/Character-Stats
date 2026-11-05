import type { CurveMode } from './curveValuesConversion';
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
    onModeChange(mode: CurveMode): void;
    onRoundChange(round: number | undefined): void;
    onCompareChange(compare: boolean): void;
}) {
    return (
        <div className="curve-toolbar">
            <div className="toolbar" role="group" aria-label={`${fieldLabel} stored format`}>
                <button
                    aria-pressed={segmented}
                    title="Store the curve as segments. Switching back and forth without edits restores the original."
                    onClick={() => !segmented && onModeChange('segments')}
                >
                    Segments
                </button>
                <button
                    aria-pressed={!segmented}
                    title="Store one value per stat. Switching back and forth without edits restores the original."
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
