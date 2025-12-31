"use strict";
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

export default function DashboardBarChart({ data }: { data: any[] }) {
    const COLORS = ['#16a34a', '#f97316']; // Green, Orange

    return (
        <ResponsiveContainer width="100%" height={150}>
            <BarChart data={data}>
                <XAxis dataKey="name" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip
                    cursor={{ fill: 'transparent' }}
                    contentStyle={{ borderRadius: '8px', borderColor: 'var(--color-border)', backgroundColor: 'var(--color-card)', color: 'var(--color-foreground)' }}
                    itemStyle={{ color: 'var(--color-foreground)' }}
                    labelStyle={{ color: 'var(--color-foreground)' }}
                    formatter={(value: any) => `Rp ${value.toLocaleString('id-ID')}`}
                />
                <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                    {data.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                </Bar>
            </BarChart>
        </ResponsiveContainer>
    );
}
