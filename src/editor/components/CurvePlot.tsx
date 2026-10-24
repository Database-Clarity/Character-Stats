import {
    Line,
    LineChart,
    CartesianGrid,
    Tooltip,
    XAxis,
    YAxis,
    ResponsiveContainer,
    Legend,
} from 'recharts';
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
    return (
        <ResponsiveContainer width="100%" height={220} minWidth={1}>
            <LineChart data={plot}>
                <CartesianGrid stroke="#33423b" />
                <XAxis dataKey="x" type="number" domain={[domain[0], domain[1]]} tickCount={6} />
                <YAxis width={55} />
                <Tooltip contentStyle={{ background: '#17251f', borderColor: '#52675b' }} />
                <Legend />
                <Line
                    dataKey="current"
                    name="Working copy"
                    dot={false}
                    stroke="#72e5aa"
                    isAnimationActive={false}
                />
                {compare && (
                    <Line
                        dataKey="saved"
                        name="Saved"
                        dot={false}
                        stroke="#e7bf76"
                        strokeDasharray="5 5"
                        isAnimationActive={false}
                    />
                )}
            </LineChart>
        </ResponsiveContainer>
    );
}
