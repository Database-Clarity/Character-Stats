import { useEffect, useRef, useState } from 'react';
import type { CurveSegment, Domain } from '../../core';
import { domainTicks } from './curveValueRange';
import {
    INLINE_DEFAULT_HEIGHT,
    INLINE_HEIGHT_RANGE,
    MODAL_DEFAULT_HEIGHT,
    MODAL_HEIGHT_RANGE,
    X_WIDTH_RANGE,
    adaptiveTickCount,
    applyPlotPreferences,
    builtInPlotPreferences,
    clampPlotHeight,
    clampXRange,
    clampXWidth,
    clearPlotDefault,
    domainXToPixel,
    extractPlotPreferences,
    formatPlotDelta,
    formatPlotNumber,
    isPlotViewAtDefault,
    isPlotZoomed,
    loadPlotDefault,
    matchesPlotPreferences,
    panXRange,
    pixelToDomainX,
    plotValueAxis,
    savePlotDefault,
    segmentBoundaryXs,
    subscribePlotDefault,
    transformPlotPoints,
    visiblePlotPoints,
    yAxisMargin,
    zoomXRange,
    type PlotPoint,
    type PlotViewPreferences,
    type PlotViewState,
} from './curvePlotView';
import { Modal } from './Modal';

function PlotSurface({
    plot,
    domain,
    compare,
    fieldLabel,
    reciprocalLabel,
    segments,
    view,
    onZoomRange,
    onResetZoom,
}: {
    plot: readonly PlotPoint[];
    domain: Domain;
    compare: boolean;
    fieldLabel: string;
    reciprocalLabel?: string;
    segments?: readonly CurveSegment[];
    view: PlotViewState;
    onZoomRange(next: [number, number]): void;
    onResetZoom(): void;
}) {
    const canvasRef = useRef<HTMLDivElement>(null);
    const [width, setWidth] = useState(800);
    const [hover, setHover] = useState<{ domainX: number; x: number; y: number } | null>(null);
    const [drag, setDrag] = useState<{
        startPx: number;
        currentPx: number;
        pointerId: number;
    } | null>(null);

    useEffect(() => {
        const element = canvasRef.current;
        if (!element || typeof ResizeObserver === 'undefined') return;
        const observer = new ResizeObserver(([entry]) => {
            if (entry) setWidth(Math.max(1, entry.contentRect.width));
        });
        observer.observe(element);
        return () => observer.disconnect();
    }, []);

    const reciprocal = Boolean(reciprocalLabel && view.reciprocal);
    const plotted = transformPlotPoints(plot, reciprocal);
    const xRange = clampXRange(domain, view.xRange[0], view.xRange[1]);
    const visible = visiblePlotPoints(plotted, xRange);
    const height = view.height;
    const plotTop = 12;
    const plotBottom = Math.max(plotTop + 1, height - 24);
    const plotHeight = Math.max(1, plotBottom - plotTop);

    const yTickTarget = adaptiveTickCount(plotHeight, 28, 3, 10);
    const { min, max, ticks, decimals } = plotValueAxis(
        visible,
        compare,
        view.includeZero,
        yTickTarget,
    );
    const left = yAxisMargin(ticks, decimals);
    const right = Math.max(left + 1, width - 16);
    const plotWidth = Math.max(1, right - left);

    const xTickTarget = adaptiveTickCount(plotWidth, 90, 2, 10);
    const xTicks = domainTicks(xRange, xTickTarget);
    const boundaries = view.showBoundaries ? segmentBoundaryXs(segments, xRange) : [];

    const x = (n: number) => domainXToPixel(n, xRange, left, plotWidth);
    const y = (n: number) => plotBottom - ((n - min) / (max - min)) * plotHeight;

    const line = (key: 'current' | 'saved') =>
        visible
            .filter((p) => typeof p[key] === 'number' && Number.isFinite(p[key]))
            .map((p) => `${x(p.x)},${y(p[key]!)}`)
            .join(' ');

    const point = hover === null ? undefined : visible.find((p) => p.x === hover.domainX);
    const rawPoint =
        hover === null || !reciprocal ? undefined : plot.find((p) => p.x === hover.domainX);
    const dragActive = drag !== null && Math.abs(drag.currentPx - drag.startPx) >= 6;
    const dragLeft = dragActive
        ? Math.max(left, Math.min(right, Math.min(drag.startPx, drag.currentPx)))
        : 0;
    const dragRight = dragActive
        ? Math.max(left, Math.min(right, Math.max(drag.startPx, drag.currentPx)))
        : 0;
    const dragRange = dragActive
        ? clampXRange(
              domain,
              pixelToDomainX(dragLeft, left, plotWidth, xRange),
              pixelToDomainX(dragRight, left, plotWidth, xRange),
          )
        : null;

    const canZoom = domain[1] > domain[0];
    const valueFormat = reciprocal
        ? { maxDecimals: 4, invalidLabel: 'undefined' }
        : { invalidLabel: 'invalid' };
    const delta =
        compare && point
            ? formatPlotDelta(point.current, point.saved, reciprocal ? 4 : undefined)
            : undefined;
    const tooltipWidth = compare || reciprocal ? 240 : 156;
    const tooltipLeft =
        hover === null
            ? 0
            : hover.x + 12 + tooltipWidth > width
              ? Math.max(0, hover.x - tooltipWidth - 12)
              : Math.max(0, Math.min(width - tooltipWidth, hover.x + 12));

    return (
        <div className={`plot-stage${view.xWidthPercent < 100 ? ' is-squished' : ''}`}>
            <div
                className="plot-canvas"
                ref={canvasRef}
                style={{ width: `${view.xWidthPercent}%`, height }}
            >
                <svg
                    viewBox={`0 0 ${width} ${height}`}
                    style={{ height }}
                    className={canZoom ? 'is-zoomable' : undefined}
                    role="img"
                    aria-label={`${fieldLabel}${reciprocal ? ` (${reciprocalLabel})` : ''} curve plot ${xRange[0]} to ${xRange[1]}; working copy${compare ? ' and saved overlay' : ''}`}
                    onPointerDown={(e) => {
                        if (e.button !== 0 || !canZoom) return;
                        const box = e.currentTarget.getBoundingClientRect();
                        const px = e.clientX - box.left;
                        e.currentTarget.setPointerCapture?.(e.pointerId);
                        setDrag({ startPx: px, currentPx: px, pointerId: e.pointerId });
                    }}
                    onPointerMove={(e) => {
                        const box = e.currentTarget.getBoundingClientRect();
                        const px = e.clientX - box.left;
                        const py = e.clientY - box.top;
                        setHover({
                            x: px,
                            y: py,
                            domainX: pixelToDomainX(px, left, plotWidth, xRange),
                        });
                        if (drag && e.pointerId === drag.pointerId) {
                            setDrag({ ...drag, currentPx: px });
                        }
                    }}
                    onPointerUp={(e) => {
                        if (!drag || e.pointerId !== drag.pointerId) return;
                        e.currentTarget.releasePointerCapture?.(e.pointerId);
                        if (Math.abs(drag.currentPx - drag.startPx) >= 6) {
                            const startX = pixelToDomainX(drag.startPx, left, plotWidth, xRange);
                            const endX = pixelToDomainX(drag.currentPx, left, plotWidth, xRange);
                            if (startX !== endX) {
                                onZoomRange(clampXRange(domain, startX, endX));
                            }
                        }
                        setDrag(null);
                    }}
                    onPointerCancel={(e) => {
                        if (drag && e.pointerId === drag.pointerId) {
                            e.currentTarget.releasePointerCapture?.(e.pointerId);
                            setDrag(null);
                        }
                    }}
                    onPointerLeave={() => {
                        if (!drag) setHover(null);
                    }}
                    onDoubleClick={() => {
                        if (isPlotZoomed(xRange, domain)) onResetZoom();
                    }}
                >
                    {xTicks.map((tick) => {
                        const tx = x(tick);
                        const anchor =
                            tx - left < 18 ? 'start' : right - tx < 18 ? 'end' : 'middle';
                        return (
                            <g key={`x-${tick}`}>
                                <line
                                    x1={tx}
                                    x2={tx}
                                    y1={plotTop}
                                    y2={plotBottom}
                                    stroke="#242830"
                                />
                                <text x={tx} y={height - 6} textAnchor={anchor}>
                                    {tick}
                                </text>
                            </g>
                        );
                    })}
                    {ticks.map((tick) => (
                        <g key={`y-${tick}`}>
                            <line x1={left} x2={right} y1={y(tick)} y2={y(tick)} stroke="#30343b" />
                            <text x={left - 8} y={y(tick) + 4} textAnchor="end">
                                {tick.toFixed(decimals)}
                            </text>
                        </g>
                    ))}
                    {boundaries.map((boundary) => (
                        <line
                            key={`seg-${boundary}`}
                            x1={x(boundary)}
                            x2={x(boundary)}
                            y1={plotTop}
                            y2={plotBottom}
                            stroke="#5a6373"
                            strokeDasharray="3 3"
                        />
                    ))}
                    {dragActive && (
                        <rect
                            className="plot-selection"
                            x={dragLeft}
                            y={plotTop}
                            width={Math.max(1, dragRight - dragLeft)}
                            height={plotHeight}
                        />
                    )}
                    {compare && (
                        <polyline
                            points={line('saved')}
                            fill="none"
                            stroke="#1cdcfc"
                            strokeDasharray="5 4"
                            vectorEffect="non-scaling-stroke"
                        />
                    )}
                    <polyline
                        points={line('current')}
                        fill="none"
                        stroke="#24ec54"
                        strokeWidth={2}
                        vectorEffect="non-scaling-stroke"
                    />
                    {view.showPoints &&
                        visible.map((p) => (
                            <g key={`pt-${p.x}`}>
                                {compare &&
                                    typeof p.saved === 'number' &&
                                    Number.isFinite(p.saved) && (
                                        <circle
                                            cx={x(p.x)}
                                            cy={y(p.saved)}
                                            r={2.5}
                                            fill="#1cdcfc"
                                        />
                                    )}
                                {typeof p.current === 'number' && Number.isFinite(p.current) && (
                                    <circle cx={x(p.x)} cy={y(p.current)} r={2.5} fill="#24ec54" />
                                )}
                            </g>
                        ))}
                    {point && !dragActive && (
                        <g>
                            <line
                                x1={x(point.x)}
                                x2={x(point.x)}
                                y1={plotTop}
                                y2={plotBottom}
                                stroke="#bac0cc"
                                strokeDasharray="2 3"
                            />
                            {typeof point.current === 'number' &&
                                Number.isFinite(point.current) && (
                                    <>
                                        <line
                                            x1={left}
                                            x2={right}
                                            y1={y(point.current)}
                                            y2={y(point.current)}
                                            stroke="#bac0cc"
                                            strokeDasharray="2 3"
                                        />
                                        <circle
                                            cx={x(point.x)}
                                            cy={y(point.current)}
                                            r={4}
                                            fill="#24ec54"
                                            stroke="#12151a"
                                            strokeWidth={1.5}
                                        />
                                    </>
                                )}
                            {compare &&
                                typeof point.saved === 'number' &&
                                Number.isFinite(point.saved) && (
                                    <circle
                                        cx={x(point.x)}
                                        cy={y(point.saved)}
                                        r={3.5}
                                        fill="#1cdcfc"
                                        stroke="#12151a"
                                        strokeWidth={1.5}
                                    />
                                )}
                        </g>
                    )}
                </svg>
                {hover && dragRange && (
                    <span
                        className="plot-tooltip"
                        style={{
                            left: tooltipLeft,
                            top: Math.max(0, hover.y - 30),
                        }}
                    >
                        Zoom x {dragRange[0]}–{dragRange[1]}
                    </span>
                )}
                {point && hover && !dragRange && (
                    <span
                        className="plot-tooltip"
                        style={{
                            left: tooltipLeft,
                            top: Math.max(0, hover.y - 30),
                        }}
                    >
                        x {point.x} · {reciprocal ? '1/y' : 'y'}{' '}
                        {formatPlotNumber(point.current, valueFormat)}
                        {compare ? (
                            <>
                                {' '}
                                · saved {formatPlotNumber(point.saved, valueFormat)}
                                {delta !== undefined && ` (${delta})`}
                            </>
                        ) : (
                            reciprocal && rawPoint && <> · y {formatPlotNumber(rawPoint.current)}</>
                        )}
                    </span>
                )}
            </div>
        </div>
    );
}

function PlotControls({
    fieldLabel,
    reciprocalLabel,
    domain,
    view,
    defaults,
    hasSavedDefault,
    heightRange,
    hasSegments,
    compare,
    onCompareChange,
    onChange,
    onReset,
    onSetDefault,
    onClearDefault,
}: {
    fieldLabel: string;
    reciprocalLabel?: string;
    domain: Domain;
    view: PlotViewState;
    defaults: PlotViewPreferences;
    hasSavedDefault: boolean;
    heightRange: readonly [number, number];
    hasSegments: boolean;
    compare?: boolean;
    onCompareChange?(compare: boolean): void;
    onChange(next: PlotViewState): void;
    onReset(): void;
    onSetDefault(): void;
    onClearDefault(): void;
}) {
    const xRange = clampXRange(domain, view.xRange[0], view.xRange[1]);
    const [fromDraft, setFromDraft] = useState(String(xRange[0]));
    const [toDraft, setToDraft] = useState(String(xRange[1]));

    useEffect(() => {
        setFromDraft(String(xRange[0]));
        setToDraft(String(xRange[1]));
    }, [xRange[0], xRange[1]]);

    const canZoom = domain[1] > domain[0];
    const zoomed = isPlotZoomed(xRange, domain);
    const span = xRange[1] - xRange[0];
    const panStep = Math.max(1, Math.round(span * 0.25));

    function commitRange(rawFrom: string, rawTo: string) {
        const parsedFrom = rawFrom.trim() === '' ? domain[0] : Number(rawFrom);
        const parsedTo = rawTo.trim() === '' ? domain[1] : Number(rawTo);
        const next = clampXRange(domain, parsedFrom, parsedTo);
        setFromDraft(String(next[0]));
        setToDraft(String(next[1]));
        onChange({ ...view, xRange: next });
    }

    return (
        <div className="plot-controls" role="group" aria-label={`${fieldLabel} plot view controls`}>
            <label className="plot-slider">
                <span>X width</span>
                <input
                    type="range"
                    aria-label={`${fieldLabel} X-axis width`}
                    min={X_WIDTH_RANGE[0]}
                    max={X_WIDTH_RANGE[1]}
                    step={5}
                    value={view.xWidthPercent}
                    onChange={(e) =>
                        onChange({ ...view, xWidthPercent: clampXWidth(Number(e.target.value)) })
                    }
                />
                <span className="mono plot-slider-value">{view.xWidthPercent}%</span>
            </label>
            <label className="plot-slider">
                <span>Height</span>
                <input
                    type="range"
                    aria-label={`${fieldLabel} plot height`}
                    min={heightRange[0]}
                    max={heightRange[1]}
                    step={10}
                    value={view.height}
                    onChange={(e) =>
                        onChange({
                            ...view,
                            height: clampPlotHeight(Number(e.target.value), heightRange),
                        })
                    }
                />
                <span className="mono plot-slider-value">{view.height}px</span>
            </label>
            {canZoom && (
                <div className="plot-range-group">
                    <span className="plot-control-label">X range</span>
                    <input
                        type="number"
                        inputMode="numeric"
                        aria-label={`${fieldLabel} X range start`}
                        min={domain[0]}
                        max={domain[1]}
                        step={1}
                        value={fromDraft}
                        onChange={(e) => setFromDraft(e.target.value)}
                        onBlur={() => commitRange(fromDraft, toDraft)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') commitRange(fromDraft, toDraft);
                        }}
                    />
                    <span className="muted">–</span>
                    <input
                        type="number"
                        inputMode="numeric"
                        aria-label={`${fieldLabel} X range end`}
                        min={domain[0]}
                        max={domain[1]}
                        step={1}
                        value={toDraft}
                        onChange={(e) => setToDraft(e.target.value)}
                        onBlur={() => commitRange(fromDraft, toDraft)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') commitRange(fromDraft, toDraft);
                        }}
                    />
                    <button
                        type="button"
                        className="plot-mini-button"
                        aria-label={`Zoom out ${fieldLabel} X range`}
                        title="Zoom out X-axis"
                        disabled={!zoomed}
                        onClick={() => onChange({ ...view, xRange: zoomXRange(domain, xRange, 2) })}
                    >
                        −
                    </button>
                    <button
                        type="button"
                        className="plot-mini-button"
                        aria-label={`Zoom in ${fieldLabel} X range`}
                        title="Zoom in X-axis"
                        disabled={span <= 1}
                        onClick={() =>
                            onChange({ ...view, xRange: zoomXRange(domain, xRange, 0.5) })
                        }
                    >
                        +
                    </button>
                    <button
                        type="button"
                        className="plot-mini-button"
                        aria-label={`Pan ${fieldLabel} X range left`}
                        title="Pan left"
                        disabled={xRange[0] <= domain[0]}
                        onClick={() =>
                            onChange({ ...view, xRange: panXRange(domain, xRange, -panStep) })
                        }
                    >
                        ◀
                    </button>
                    <button
                        type="button"
                        className="plot-mini-button"
                        aria-label={`Pan ${fieldLabel} X range right`}
                        title="Pan right"
                        disabled={xRange[1] >= domain[1]}
                        onClick={() =>
                            onChange({ ...view, xRange: panXRange(domain, xRange, panStep) })
                        }
                    >
                        ▶
                    </button>
                </div>
            )}
            <div className="plot-toggles">
                {reciprocalLabel && (
                    <label className="check">
                        <input
                            type="checkbox"
                            checked={view.reciprocal}
                            onChange={(e) => onChange({ ...view, reciprocal: e.target.checked })}
                        />
                        {reciprocalLabel}
                    </label>
                )}
                <label className="check">
                    <input
                        type="checkbox"
                        checked={view.includeZero}
                        onChange={(e) => onChange({ ...view, includeZero: e.target.checked })}
                    />
                    Y from 0
                </label>
                <label className="check">
                    <input
                        type="checkbox"
                        checked={view.showPoints}
                        onChange={(e) => onChange({ ...view, showPoints: e.target.checked })}
                    />
                    Points
                </label>
                {hasSegments && (
                    <label className="check">
                        <input
                            type="checkbox"
                            checked={view.showBoundaries}
                            onChange={(e) =>
                                onChange({ ...view, showBoundaries: e.target.checked })
                            }
                        />
                        Segments
                    </label>
                )}
                {onCompareChange && compare !== undefined && (
                    <label className="check">
                        <input
                            type="checkbox"
                            checked={compare}
                            onChange={(e) => onCompareChange(e.target.checked)}
                        />
                        Compare with saved
                    </label>
                )}
                <button
                    type="button"
                    className="plot-reset-button"
                    title="Use these view settings as the default for graphs"
                    disabled={matchesPlotPreferences(view, defaults, Boolean(reciprocalLabel))}
                    onClick={onSetDefault}
                >
                    Set as default
                </button>
                {hasSavedDefault && (
                    <button
                        type="button"
                        className="plot-reset-button"
                        title="Remove saved default view settings and return to built-in defaults"
                        onClick={onClearDefault}
                    >
                        Clear default
                    </button>
                )}
                <button
                    type="button"
                    className="plot-reset-button"
                    title="Reset this graph to the default view"
                    disabled={isPlotViewAtDefault(view, domain, defaults, Boolean(reciprocalLabel))}
                    onClick={onReset}
                >
                    Reset
                </button>
            </div>
        </div>
    );
}

export default function CurvePlot({
    plot,
    domain,
    compare,
    fieldLabel = 'Curve',
    reciprocalLabel,
    segments,
    onCompareChange,
}: {
    plot: PlotPoint[];
    domain: Domain;
    compare: boolean;
    fieldLabel?: string;
    reciprocalLabel?: string;
    segments?: readonly CurveSegment[];
    onCompareChange?(compare: boolean): void;
}) {
    const hasReciprocal = Boolean(reciprocalLabel);
    const builtInInline = builtInPlotPreferences(INLINE_DEFAULT_HEIGHT);
    const builtInModal = builtInPlotPreferences(MODAL_DEFAULT_HEIGHT);

    const [savedInlineDefault, setSavedInlineDefault] = useState<PlotViewPreferences | null>(() =>
        loadPlotDefault('inline'),
    );
    const [savedModalDefault, setSavedModalDefault] = useState<PlotViewPreferences | null>(() =>
        loadPlotDefault('modal'),
    );
    const inlineDefaults = savedInlineDefault ?? builtInInline;
    const modalDefaults = savedModalDefault ?? builtInModal;
    const inlineDefaultsRef = useRef(inlineDefaults);
    inlineDefaultsRef.current = inlineDefaults;
    const modalDefaultsRef = useRef(modalDefaults);
    modalDefaultsRef.current = modalDefaults;

    const [inlineView, setInlineView] = useState<PlotViewState>(() =>
        applyPlotPreferences(domain, loadPlotDefault('inline') ?? builtInInline),
    );
    const [showInlineControls, setShowInlineControls] = useState(false);
    const [expanded, setExpanded] = useState(false);
    const [modalView, setModalView] = useState<PlotViewState>(() =>
        applyPlotPreferences(domain, loadPlotDefault('modal') ?? builtInModal),
    );

    useEffect(
        () =>
            subscribePlotDefault('inline', (nextSaved) => {
                const prevDefaults = inlineDefaultsRef.current;
                const nextDefaults = nextSaved ?? builtInPlotPreferences(INLINE_DEFAULT_HEIGHT);
                setSavedInlineDefault(nextSaved);
                setInlineView((prev) =>
                    matchesPlotPreferences(prev, prevDefaults, hasReciprocal)
                        ? { ...nextDefaults, xRange: prev.xRange }
                        : prev,
                );
            }),
        [hasReciprocal],
    );

    useEffect(
        () =>
            subscribePlotDefault('modal', (nextSaved) => {
                const prevDefaults = modalDefaultsRef.current;
                const nextDefaults = nextSaved ?? builtInPlotPreferences(MODAL_DEFAULT_HEIGHT);
                setSavedModalDefault(nextSaved);
                setModalView((prev) =>
                    matchesPlotPreferences(prev, prevDefaults, hasReciprocal)
                        ? { ...nextDefaults, xRange: prev.xRange }
                        : prev,
                );
            }),
        [hasReciprocal],
    );

    useEffect(() => {
        setInlineView((prev) => ({
            ...prev,
            xRange: clampXRange(domain, prev.xRange[0], prev.xRange[1]),
        }));
        setModalView((prev) => ({
            ...prev,
            xRange: clampXRange(domain, prev.xRange[0], prev.xRange[1]),
        }));
    }, [domain[0], domain[1]]);

    const hasSegments = (segments?.length ?? 0) > 1;
    const inlineZoomed = isPlotZoomed(inlineView.xRange, domain);
    const inlineCustom = !isPlotViewAtDefault(inlineView, domain, inlineDefaults, hasReciprocal);

    function openEnlarged() {
        const xRange = clampXRange(domain, inlineView.xRange[0], inlineView.xRange[1]);
        const inlineModified = !matchesPlotPreferences(inlineView, inlineDefaults, hasReciprocal);
        if (savedModalDefault && !inlineModified) {
            setModalView({ ...savedModalDefault, xRange });
        } else {
            setModalView({
                ...inlineView,
                height: clampPlotHeight(
                    Math.max(modalDefaults.height, inlineView.height),
                    MODAL_HEIGHT_RANGE,
                ),
                xRange,
            });
        }
        setExpanded(true);
    }

    function saveInlineAsDefault() {
        const next = extractPlotPreferences(inlineView, INLINE_HEIGHT_RANGE, {
            hasReciprocal,
            previousReciprocal: savedInlineDefault?.reciprocal ?? false,
        });
        savePlotDefault('inline', next);
    }

    function saveModalAsDefault() {
        const next = extractPlotPreferences(modalView, MODAL_HEIGHT_RANGE, {
            hasReciprocal,
            previousReciprocal: savedModalDefault?.reciprocal ?? false,
        });
        savePlotDefault('modal', next);
    }

    return (
        <div className="plot">
            {showInlineControls && (
                <PlotControls
                    fieldLabel={fieldLabel}
                    {...(reciprocalLabel ? { reciprocalLabel } : {})}
                    domain={domain}
                    view={inlineView}
                    defaults={inlineDefaults}
                    hasSavedDefault={savedInlineDefault !== null}
                    heightRange={INLINE_HEIGHT_RANGE}
                    hasSegments={hasSegments}
                    onChange={setInlineView}
                    onReset={() => setInlineView(applyPlotPreferences(domain, inlineDefaults))}
                    onSetDefault={saveInlineAsDefault}
                    onClearDefault={() => clearPlotDefault('inline')}
                />
            )}
            <PlotSurface
                plot={plot}
                domain={domain}
                compare={compare}
                fieldLabel={fieldLabel}
                {...(reciprocalLabel ? { reciprocalLabel } : {})}
                {...(segments ? { segments } : {})}
                view={inlineView}
                onZoomRange={(xRange) => setInlineView((prev) => ({ ...prev, xRange }))}
                onResetZoom={() =>
                    setInlineView((prev) => ({ ...prev, xRange: [domain[0], domain[1]] }))
                }
            />
            <div className="plot-legend">
                <span className="success">― Working copy</span>
                {compare && <span className="info">┄ Saved</span>}
                {reciprocalLabel && inlineView.reciprocal && (
                    <span className="muted mono">{reciprocalLabel}</span>
                )}
                {inlineZoomed && (
                    <span className="muted mono">
                        x {inlineView.xRange[0]}–{inlineView.xRange[1]}
                    </span>
                )}
                {inlineView.xWidthPercent < 100 && (
                    <span className="muted mono">width {inlineView.xWidthPercent}%</span>
                )}
                <span className="plot-legend-actions">
                    <span className="muted plot-hint">
                        {domain[1] > domain[0]
                            ? 'Drag to zoom · Hover for x / y'
                            : 'Hover for x / y'}
                    </span>
                    {inlineZoomed && (
                        <button
                            type="button"
                            className="plot-action-button"
                            onClick={() =>
                                setInlineView((prev) => ({
                                    ...prev,
                                    xRange: [domain[0], domain[1]],
                                }))
                            }
                        >
                            Reset zoom
                        </button>
                    )}
                    {reciprocalLabel && (
                        <button
                            type="button"
                            className="plot-action-button"
                            aria-pressed={inlineView.reciprocal}
                            aria-label={`Toggle ${fieldLabel} ${reciprocalLabel}`}
                            title={`Plot ${reciprocalLabel}`}
                            onClick={() =>
                                setInlineView((prev) => ({
                                    ...prev,
                                    reciprocal: !prev.reciprocal,
                                }))
                            }
                        >
                            1/y
                        </button>
                    )}
                    <button
                        type="button"
                        className="plot-action-button"
                        aria-expanded={showInlineControls}
                        aria-pressed={showInlineControls || inlineCustom}
                        aria-label={`Toggle ${fieldLabel} plot view controls`}
                        onClick={() => setShowInlineControls((open) => !open)}
                    >
                        View
                    </button>
                    <button
                        type="button"
                        className="plot-action-button"
                        aria-label={`Enlarge ${fieldLabel} plot`}
                        onClick={openEnlarged}
                    >
                        Enlarge
                    </button>
                </span>
            </div>
            {expanded && (
                <Modal
                    title={`${fieldLabel}${reciprocalLabel && modalView.reciprocal ? ` — ${reciprocalLabel}` : ''} (${domain[0]}–${domain[1]})`}
                    className="plot-modal"
                    focusInput={false}
                    onClose={() => setExpanded(false)}
                >
                    <PlotControls
                        fieldLabel={fieldLabel}
                        {...(reciprocalLabel ? { reciprocalLabel } : {})}
                        domain={domain}
                        view={modalView}
                        defaults={modalDefaults}
                        hasSavedDefault={savedModalDefault !== null}
                        heightRange={MODAL_HEIGHT_RANGE}
                        hasSegments={hasSegments}
                        compare={compare}
                        {...(onCompareChange ? { onCompareChange } : {})}
                        onChange={setModalView}
                        onReset={() => setModalView(applyPlotPreferences(domain, modalDefaults))}
                        onSetDefault={saveModalAsDefault}
                        onClearDefault={() => clearPlotDefault('modal')}
                    />
                    <PlotSurface
                        plot={plot}
                        domain={domain}
                        compare={compare}
                        fieldLabel={fieldLabel}
                        {...(reciprocalLabel ? { reciprocalLabel } : {})}
                        {...(segments ? { segments } : {})}
                        view={modalView}
                        onZoomRange={(xRange) => setModalView((prev) => ({ ...prev, xRange }))}
                        onResetZoom={() =>
                            setModalView((prev) => ({ ...prev, xRange: [domain[0], domain[1]] }))
                        }
                    />
                    <div className="plot-legend">
                        <span className="success">― Working copy</span>
                        {compare && <span className="info">┄ Saved</span>}
                        {reciprocalLabel && modalView.reciprocal && (
                            <span className="muted mono">{reciprocalLabel}</span>
                        )}
                        {hasSegments && modalView.showBoundaries && (
                            <span className="muted">┆ Segment boundary</span>
                        )}
                        <span className="plot-legend-actions">
                            <span className="muted plot-hint">
                                {domain[1] > domain[0]
                                    ? 'Drag to zoom · Double-click to reset · Hover for x / y'
                                    : 'Hover for x / y'}
                            </span>
                        </span>
                    </div>
                </Modal>
            )}
        </div>
    );
}
