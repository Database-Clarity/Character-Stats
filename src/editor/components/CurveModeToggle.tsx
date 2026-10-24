export default function CurveModeToggle({
    segmented,
    round,
    compare,
    fieldKey,
    onModeChange,
    onRoundChange,
    onCompareChange,
}: {
    segmented: boolean;
    round: string;
    compare: boolean;
    fieldKey: string;
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
                    <input
                        aria-label={`${fieldKey} rounding digits`}
                        type="number"
                        min={0}
                        max={15}
                        value={round}
                        onChange={(event) =>
                            onRoundChange(
                                event.target.value === '' ? undefined : Number(event.target.value),
                            )
                        }
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
