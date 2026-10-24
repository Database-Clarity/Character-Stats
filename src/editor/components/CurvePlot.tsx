import { useEffect, useRef, useState } from 'react';
import type { Domain } from '../../core';
export default function CurvePlot({
    plot,
    domain,
    compare,
}: {
    plot: { x: number; current: number | undefined; saved: number | undefined }[];
    domain: Domain;
    compare: boolean;
}) {
    const container = useRef<HTMLDivElement>(null);
    const [width, setWidth] = useState(800);
    const [hover, setHover] = useState<{ index: number; x: number; y: number } | null>(null);
    useEffect(() => {
        const observer = new ResizeObserver(([entry]) => {
            if (entry) setWidth(Math.max(1, entry.contentRect.width));
        });
        if (container.current) observer.observe(container.current);
        return () => observer.disconnect();
    }, []);
    const values = plot
        .flatMap((p) => [p.current, ...(compare ? [p.saved] : [])])
        .filter((n): n is number => typeof n === 'number' && Number.isFinite(n));
    const min = Math.min(0, ...values),
        max = Math.max(1, ...values),
        height = 160;
    const left = 52,
        right = width - 16,
        plotWidth = Math.max(1, right - left);
    const x = (n: number) => left + ((n - domain[0]) / (domain[1] - domain[0])) * plotWidth,
        y = (n: number) => 132 - ((n - min) / (max - min)) * 116;
    const line = (key: 'current' | 'saved') =>
        plot
            .filter((p) => typeof p[key] === 'number' && Number.isFinite(p[key]))
            .map((p) => `${x(p.x)},${y(p[key]!)}`)
            .join(' ');
    const point = hover === null ? undefined : plot[hover.index];
    return (
        <div className="plot" ref={container}>
            <svg
                viewBox={`0 0 ${width} ${height}`}
                role="img"
                aria-label={`Curve plot ${domain[0]} to ${domain[1]}; working copy${compare ? ' and saved overlay' : ''}`}
                onPointerMove={(e) => {
                    const box = e.currentTarget.getBoundingClientRect();
                    setHover({
                        x: e.clientX - box.left,
                        y: e.clientY - box.top,
                        index: Math.max(
                            0,
                            Math.min(
                                plot.length - 1,
                                Math.round(
                                    ((e.clientX - box.left - left) / plotWidth) * (plot.length - 1),
                                ),
                            ),
                        ),
                    });
                }}
                onPointerLeave={() => setHover(null)}
            >
                {[0, 0.5, 1].map((f) => (
                    <g key={f}>
                        <line
                            x1={left}
                            x2={right}
                            y1={16 + 116 * f}
                            y2={16 + 116 * f}
                            stroke="#30343b"
                        />
                        <text x={4} y={20 + 116 * f}>
                            {Number(max - (max - min) * f).toFixed(2)}
                        </text>
                    </g>
                ))}
                {[0, 0.25, 0.5, 0.75, 1].map((f) => (
                    <text
                        key={f}
                        x={left + plotWidth * f}
                        y={154}
                        textAnchor={f === 1 ? 'end' : 'middle'}
                    >
                        {domain[0] + (domain[1] - domain[0]) * f}
                    </text>
                ))}
                <polyline
                    points={line('current')}
                    fill="none"
                    stroke="#24ec54"
                    strokeWidth={2}
                    vectorEffect="non-scaling-stroke"
                />
                {compare && (
                    <polyline
                        points={line('saved')}
                        fill="none"
                        stroke="#1cdcfc"
                        strokeDasharray="5 4"
                        vectorEffect="non-scaling-stroke"
                    />
                )}
                {point && (
                    <g>
                        <line
                            x1={x(point.x)}
                            x2={x(point.x)}
                            y1={12}
                            y2={132}
                            stroke="#bac0cc"
                            strokeDasharray="2 3"
                        />
                        {typeof point.current === 'number' && (
                            <line
                                x1={left}
                                x2={right}
                                y1={y(point.current)}
                                y2={y(point.current)}
                                stroke="#bac0cc"
                                strokeDasharray="2 3"
                            />
                        )}
                    </g>
                )}
            </svg>
            {point && hover && (
                <span
                    className="plot-tooltip"
                    style={{
                        left: Math.max(0, Math.min(width - 160, hover.x + 12)),
                        top: Math.max(0, hover.y - 30),
                    }}
                >
                    x {point.x} · y {point.current ?? 'invalid'}
                </span>
            )}
            <span className="plot-legend">
                <span className="success">― Working copy</span>
                {compare && <span className="info">┄ Saved</span>}
                <span className="muted">Hover for x / y</span>
            </span>
        </div>
    );
}
