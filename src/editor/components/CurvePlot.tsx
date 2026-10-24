import { useState } from 'react';
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
    const [hover, setHover] = useState<number | null>(null);
    const values = plot
        .flatMap((p) => [p.current, ...(compare ? [p.saved] : [])])
        .filter((n): n is number => typeof n === 'number' && Number.isFinite(n));
    const min = Math.min(0, ...values),
        max = Math.max(1, ...values),
        width = 800,
        height = 160;
    const x = (n: number) => 44 + ((n - domain[0]) / (domain[1] - domain[0])) * 740,
        y = (n: number) => 132 - ((n - min) / (max - min)) * 116;
    const line = (key: 'current' | 'saved') =>
        plot
            .filter((p) => typeof p[key] === 'number' && Number.isFinite(p[key]))
            .map((p) => `${x(p.x)},${y(p[key]!)}`)
            .join(' ');
    const point = hover === null ? undefined : plot[hover];
    return (
        <div className="plot">
            <svg
                viewBox={`0 0 ${width} ${height}`}
                preserveAspectRatio="none"
                role="img"
                aria-label={`Curve plot ${domain[0]} to ${domain[1]}; working copy${compare ? ' and saved overlay' : ''}`}
                onPointerMove={(e) => {
                    const box = e.currentTarget.getBoundingClientRect();
                    setHover(
                        Math.max(
                            0,
                            Math.min(
                                plot.length - 1,
                                Math.round(
                                    ((((e.clientX - box.left) / box.width) * width - 44) / 740) *
                                        (plot.length - 1),
                                ),
                            ),
                        ),
                    );
                }}
                onPointerLeave={() => setHover(null)}
            >
                {[0, 0.5, 1].map((f) => (
                    <g key={f}>
                        <line
                            x1={44}
                            x2={784}
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
                    <text key={f} x={44 + 740 * f} y={154} textAnchor={f === 1 ? 'end' : 'middle'}>
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
                                x1={44}
                                x2={784}
                                y1={y(point.current)}
                                y2={y(point.current)}
                                stroke="#bac0cc"
                                strokeDasharray="2 3"
                            />
                        )}
                        <rect
                            x={Math.min(640, x(point.x) + 8)}
                            y={2}
                            width={146}
                            height={24}
                            fill="#23262c"
                        />
                        <text x={Math.min(648, x(point.x) + 16)} y={18} className="plot-value">
                            x {point.x} · y {point.current ?? 'invalid'}
                        </text>
                    </g>
                )}
            </svg>
            <span className="plot-legend">
                <span className="success">― Working copy</span>
                {compare && <span className="info">┄ Saved</span>}
                <span className="muted">Hover for x / y</span>
            </span>
        </div>
    );
}
