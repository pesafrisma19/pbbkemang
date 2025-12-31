"use strict";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

export default function LandingPieChart({ data }: { data: any[] }) {
    const COLORS = ['#16a34a', '#f97316']; // Green, Orange

    return (
        <ResponsiveContainer width="100%" height={220}>
            <PieChart>
                <Pie
                    data={data}
                    cx="50%"
                    cy="50%"
                    innerRadius={65}
                    outerRadius={85}
                    cornerRadius={5}
                    paddingAngle={4}
                    dataKey="value"
                    stroke="none"
                >
                    {data.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                </Pie>
                <Tooltip
                    formatter={(value: any) => `Rp ${Number(value).toLocaleString('id-ID')}`}
                    contentStyle={{
                        borderRadius: '12px',
                        border: '1px solid var(--color-border)',
                        backgroundColor: 'var(--color-card)',
                        color: 'var(--color-foreground)',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                    }}
                    itemStyle={{ color: 'var(--color-foreground)' }}
                />
            </PieChart>
        </ResponsiveContainer>
    );
}
