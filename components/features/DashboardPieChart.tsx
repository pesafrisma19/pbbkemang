"use strict";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

export default function DashboardPieChart({ data }: { data: any[] }) {
    const COLORS = ['#16a34a', '#f97316']; // Green, Orange

    return (
        <ResponsiveContainer width="100%" height={150}>
            <PieChart>
                <Pie
                    data={data}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={60}
                    paddingAngle={2}
                    dataKey="value"
                    stroke="none"
                >
                    {data.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                </Pie>
                <Tooltip
                    formatter={(value: any) => `${value} Warga`}
                    contentStyle={{ borderRadius: '8px', borderColor: 'var(--color-border)', backgroundColor: 'var(--color-card)', color: 'var(--color-foreground)' }}
                    itemStyle={{ color: 'var(--color-foreground)' }}
                />
                <Legend iconType="circle" fontSize={10} verticalAlign="bottom" height={36} />
            </PieChart>
        </ResponsiveContainer>
    );
}
