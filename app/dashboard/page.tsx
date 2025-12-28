"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabaseClient"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card"
import { DollarSign, Users, Target, BarChart2, CheckCircle, XCircle, Loader2 } from "lucide-react"
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

export default function DashboardPage() {
    const [stats, setStats] = useState({
        // Money
        totalTarget: 250000000,
        amountPaid: 0,
        amountUnpaid: 0,

        // Count (SPPT / Kikitir)
        countTotal: 0,
        countPaid: 0,
        countUnpaid: 0,

        // Citizens
        citizenCount: 0
    })
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        const fetchStats = async () => {
            try {
                // 1. Citizen Count
                const { count: citizenCount } = await supabase
                    .from('citizens')
                    .select('*', { count: 'exact', head: true })

                // 2. Tax Objects (The core metrics)
                const { data: taxData, error } = await supabase
                    .from('tax_objects')
                    .select('amount_due, status')

                if (error) throw error

                if (taxData) {
                    let paidSum = 0;
                    let unpaidSum = 0;
                    let paidCount = 0;
                    let unpaidCount = 0;

                    taxData.forEach(t => {
                        if (t.status === 'paid') {
                            paidSum += t.amount_due;
                            paidCount++;
                        } else {
                            unpaidSum += t.amount_due;
                            unpaidCount++;
                        }
                    })

                    setStats({
                        totalTarget: 250000000, // Hardcoded for demo
                        amountPaid: paidSum,
                        amountUnpaid: unpaidSum,
                        countTotal: taxData.length,
                        countPaid: paidCount,
                        countUnpaid: unpaidCount,
                        citizenCount: citizenCount || 0
                    })
                }
            } catch (err) {
                console.error("Error fetching dashboard stats:", err)
            } finally {
                setIsLoading(false)
            }
        }

        fetchStats()
    }, [])

    // Prepared data for Chart
    const chartData = [
        { name: 'Sudah Bayar', amount: stats.amountPaid, count: stats.countPaid },
        { name: 'Belum Bayar', amount: stats.amountUnpaid, count: stats.countUnpaid },
    ];

    const percentage = Math.round((stats.amountPaid / stats.totalTarget) * 100) || 0

    if (isLoading) {
        return <div className="flex h-[50vh] items-center justify-center text-muted-foreground"><Loader2 className="animate-spin mr-2" /> Memuat Data Statistik...</div>
    }

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-5 duration-700">
            <h2 className="text-3xl font-bold tracking-tight">Dashboard Realisasi PBB</h2>

            {/* Top Row: Financial Summary */}
            <div className="grid gap-4 md:grid-cols-3">
                <Card className="bg-gradient-to-br from-blue-50 to-white dark:from-slate-900 border-l-4 border-l-accent-blue">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Realisasi (Uang Masuk)</CardTitle>
                        <DollarSign className="h-4 w-4 text-accent-blue" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-accent-blue">Rp {stats.amountPaid.toLocaleString('id-ID')}</div>
                        <p className="text-xs text-muted-foreground mt-1">
                            {percentage}% dari target Rp {stats.totalTarget.toLocaleString('id-ID')}
                        </p>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-orange-50 to-white dark:from-slate-900 border-l-4 border-l-orange-500">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Potensi (Belum Bayar)</CardTitle>
                        <BarChart2 className="h-4 w-4 text-orange-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-orange-500">Rp {stats.amountUnpaid.toLocaleString('id-ID')}</div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Harus segera ditagih
                        </p>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-green-50 to-white dark:from-slate-900 border-l-4 border-l-green-500">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Warga Terdaftar</CardTitle>
                        <Users className="h-4 w-4 text-green-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.citizenCount} <span className="text-sm font-normal text-muted-foreground">Orang</span></div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Memiliki total {stats.countTotal} kikitir/objek pajak
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Second Row: Detailed Breakdown & Charts */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">

                {/* Left: Detailed Stats Cards */}
                <div className="col-span-3 grid grid-cols-2 gap-4">
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium flex items-center gap-2">
                                <CheckCircle size={16} className="text-green-500" />
                                Transaksi Lunas
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold">{stats.countPaid}</div>
                            <p className="text-xs text-muted-foreground">SPPT/Kikitir Selesai</p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium flex items-center gap-2">
                                <XCircle size={16} className="text-red-500" />
                                Belum Lunas
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold">{stats.countUnpaid}</div>
                            <p className="text-xs text-muted-foreground">SPPT/Kikitir Menunggak</p>
                        </CardContent>
                    </Card>

                    <Card className="col-span-2">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium">Progres Pemasukan</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-end justify-between text-sm mb-2">
                                <span>Tercapai</span>
                                <span className="font-bold">{percentage}%</span>
                            </div>
                            <div className="h-4 w-full bg-muted rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-accent-blue transition-all duration-1000 ease-out"
                                    style={{ width: `${percentage}%` }}
                                ></div>
                            </div>
                            <p className="text-xs text-muted-foreground mt-2 text-center">
                                Target Tahunan: Rp {stats.totalTarget.toLocaleString('id-ID')}
                            </p>
                        </CardContent>
                    </Card>
                </div>

                {/* Right: Chart */}
                <Card className="col-span-4">
                    <CardHeader>
                        <CardTitle>Perbandingan Status Pembayaran</CardTitle>
                    </CardHeader>
                    <CardContent className="pl-0">
                        <div className="h-[250px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                    <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                                    <YAxis
                                        stroke="#888888"
                                        fontSize={12}
                                        tickLine={false}
                                        axisLine={false}
                                        tickFormatter={(value) => `Rp ${value / 1000000}jt`}
                                    />
                                    <Tooltip
                                        cursor={{ fill: 'transparent' }}
                                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                        formatter={(value: any) => [`Rp ${Number(value).toLocaleString('id-ID')}`, 'Nominal']}
                                    />
                                    <Bar dataKey="amount" radius={[4, 4, 0, 0]} barSize={60}>
                                        {chartData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={index === 0 ? '#3b82f6' : '#f97316'} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="text-center text-xs text-muted-foreground mt-2">
                            Grafik perbandingan nominal uang yang sudah masuk vs yang belum.
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
