"use client"

import * as React from "react"
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";

const data = [
    { name: 'Terkumpul', value: 85, color: 'var(--accent-blue)' },
    { name: 'Sisa Target', value: 15, color: 'var(--bg-tertiary)' },
];

export function RealisasiChart() {
    const [mounted, setMounted] = React.useState(false);

    React.useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) return <div className="h-[200px] w-full flex items-center justify-center">Loading...</div>;

    return (
        <Card className="overflow-hidden">
            <CardHeader>
                <CardTitle className="text-center text-lg font-medium">Realisasi PBB Tahun Ini</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center justify-center p-6">
                <div className="h-[200px] w-full max-w-[300px] relative">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={data}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={80}
                                paddingAngle={5}
                                dataKey="value"
                                stroke="none"
                            >
                                {data.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                            </Pie>
                            <Tooltip
                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                            />
                        </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <span className="text-3xl font-bold">85%</span>
                        <span className="text-xs text-muted-foreground">Tercapai</span>
                    </div>
                </div>
                <div className="mt-4 text-center">
                    <p className="text-sm text-muted-foreground">Total Terkumpul</p>
                    <p className="text-xl font-bold mt-1">Rp 1.540.000.000</p>
                </div>
            </CardContent>
        </Card>
    )
}
