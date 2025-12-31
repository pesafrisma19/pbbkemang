"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabaseClient"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card"
import { DollarSign, Users, BarChart2, CheckCircle, XCircle, Loader2, MapPin, AlertCircle } from "lucide-react"
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from 'recharts'

export default function DashboardPage() {
    const [stats, setStats] = useState({
        // Financials (Money)
        totalTarget: 0,
        amountPaid: 0,
        amountUnpaid: 0,

        // Citizens (People)
        citizenTotal: 0,
        citizenPaid: 0,   // All their assets are paid
        citizenUnpaid: 0, // Has at least 1 unpaid asset

        // Assets (Kikitir)
        assetTotal: 0,
        assetPaid: 0,
        assetUnpaid: 0
    })
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        const fetchStats = async () => {
            try {
                // Fetch Citizens with their Tax Objects to calculate per-person compliance
                const { data: citizens, error } = await supabase
                    .from('citizens')
                    .select(`
                        id,
                        tax_objects (
                            id,
                            amount_due,
                            status
                        )
                    `)

                if (error) throw error

                if (citizens) {
                    let totalTarget = 0;
                    let amountPaid = 0;
                    let amountUnpaid = 0;

                    let citizenTotal = citizens.length;
                    let citizenPaid = 0;
                    let citizenUnpaid = 0;

                    let assetTotal = 0;
                    let assetPaid = 0;
                    let assetUnpaid = 0;

                    citizens.forEach(c => {
                        const assets = c.tax_objects || [];

                        // Asset Logic
                        let personHasUnpaid = false;

                        assets.forEach((t: any) => {
                            assetTotal++;
                            totalTarget += t.amount_due;

                            if (t.status === 'paid') {
                                amountPaid += t.amount_due;
                                assetPaid++;
                            } else {
                                amountUnpaid += t.amount_due;
                                assetUnpaid++;
                                personHasUnpaid = true;
                            }
                        });

                        // Citizen Logic
                        if (assets.length > 0) {
                            if (personHasUnpaid) {
                                citizenUnpaid++;
                            } else {
                                citizenPaid++;
                            }
                        } else {
                            // No assets attached? Count as unpaid/inactive for now
                            citizenUnpaid++;
                        }
                    });

                    setStats({
                        totalTarget,
                        amountPaid,
                        amountUnpaid,
                        citizenTotal,
                        citizenPaid,
                        citizenUnpaid,
                        assetTotal,
                        assetPaid,
                        assetUnpaid
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

    // Charts Data
    const moneyChartData = [
        { name: 'Sudah Masuk', amount: stats.amountPaid },
        { name: 'Belum Masuk', amount: stats.amountUnpaid },
    ];

    const peoplePieData = [
        { name: 'Warga Lunas', value: stats.citizenPaid },
        { name: 'Belum Lunas', value: stats.citizenUnpaid },
    ];

    const percentage = stats.totalTarget > 0 ? Math.round((stats.amountPaid / stats.totalTarget) * 100) : 0

    if (isLoading) {
        return <div className="flex h-[50vh] items-center justify-center text-muted-foreground"><Loader2 className="animate-spin mr-2" /> Menghitung Data Real-Time...</div>
    }

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-5 duration-700 pb-12">
            <div>
                <h2 className="text-3xl font-bold tracking-tight text-foreground">Dashboard & Laporan</h2>
                <p className="text-muted-foreground">Ringkasan data real-time penerimaan PBB Desa Kemang.</p>
            </div>

            {/* --- SECTION 1: KEUANGAN (MONEY) --- */}
            <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2 text-foreground/80">
                    <div className="p-1 bg-blue-100 text-blue-600 rounded">
                        <DollarSign size={16} />
                    </div>
                    Data Keuangan
                </h3>
                <div className="grid gap-4 md:grid-cols-3">
                    {/* Total Target */}
                    <Card className="bg-card border-l-4 border-l-blue-500 shadow-sm hover:shadow-md transition-all">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Total Target (Potensi)</CardTitle>
                            <BarChart2 className="h-4 w-4 text-blue-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-foreground">Rp {stats.totalTarget.toLocaleString('id-ID')}</div>
                            <p className="text-xs text-muted-foreground mt-1">
                                Akumulasi semua SPPT terdaftar
                            </p>
                        </CardContent>
                    </Card>

                    {/* Paid */}
                    <Card className="bg-card border-l-4 border-l-green-500 shadow-sm hover:shadow-md transition-all">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Realisasi (Masuk)</CardTitle>
                            <CheckCircle className="h-4 w-4 text-green-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-green-600">Rp {stats.amountPaid.toLocaleString('id-ID')}</div>
                            <div className="flex items-center justify-between mt-1">
                                <p className="text-xs text-muted-foreground">Sudah diterima kas desa</p>
                                <span className="text-xs font-bold bg-green-100 text-green-700 px-2 py-0.5 rounded-full">{percentage}%</span>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Unpaid */}
                    <Card className="bg-card border-l-4 border-l-orange-500 shadow-sm hover:shadow-md transition-all">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Tunggakan (Sisa)</CardTitle>
                            <AlertCircle className="h-4 w-4 text-orange-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-orange-600">Rp {stats.amountUnpaid.toLocaleString('id-ID')}</div>
                            <p className="text-xs text-muted-foreground mt-1">
                                Belum terbayarkan
                            </p>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* --- SECTION 2: POPULASI & ASET (PEOPLE) --- */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">

                {/* LEFT COLUMN: STATS CARDS */}
                <div className="col-span-4 space-y-6">
                    <h3 className="text-lg font-semibold flex items-center gap-2 text-foreground/80">
                        <div className="p-1 bg-purple-100 text-purple-600 rounded">
                            <Users size={16} />
                        </div>
                        Populasi & Kepatuhan
                    </h3>

                    {/* Wajib Pajak Stats */}
                    <div className="grid grid-cols-2 gap-4">
                        <Card className="col-span-2 bg-gradient-to-r from-purple-50 to-white dark:from-slate-900/50 dark:to-slate-900 border-purple-200 dark:border-purple-900">
                            <CardContent className="pt-6 flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-muted-foreground">Total Wajib Pajak (Orang)</p>
                                    <div className="text-4xl font-extrabold text-foreground mt-2">{stats.citizenTotal}</div>
                                </div>
                                <div className="h-12 w-12 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center">
                                    <Users size={24} />
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="bg-card">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Orang Lunas</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-green-600">{stats.citizenPaid}</div>
                                <p className="text-[10px] text-muted-foreground">Semua asetnya lunas</p>
                            </CardContent>
                        </Card>

                        <Card className="bg-card">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Belum Lunas</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-orange-600">{stats.citizenUnpaid}</div>
                                <p className="text-[10px] text-muted-foreground">Ada aset menunggak</p>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="pt-4 border-t border-border"></div>

                    {/* Tax Object Stats */}
                    <h3 className="text-sm font-semibold flex items-center gap-2 text-foreground/80 mb-3">
                        <div className="p-1 bg-slate-100 text-slate-600 rounded">
                            <MapPin size={12} />
                        </div>
                        Detail Objek Pajak (Kikitir/SPPT)
                    </h3>
                    <div className="grid grid-cols-3 gap-3">
                        <div className="bg-muted/30 p-3 rounded-lg border border-border text-center">
                            <div className="text-xl font-bold">{stats.assetTotal}</div>
                            <div className="text-[10px] text-muted-foreground uppercase">Total Kikitir</div>
                        </div>
                        <div className="bg-success/10 p-3 rounded-lg border border-success/20 text-center">
                            <div className="text-xl font-bold text-success">{stats.assetPaid}</div>
                            <div className="text-[10px] text-success/80 uppercase">Kikitir Lunas</div>
                        </div>
                        <div className="bg-warning/10 p-3 rounded-lg border border-warning/20 text-center">
                            <div className="text-xl font-bold text-warning">{stats.assetUnpaid}</div>
                            <div className="text-[10px] text-warning/80 uppercase">Belum Lunas</div>
                        </div>
                    </div>
                </div>

                {/* RIGHT COLUMN: CHARTS */}
                <div className="col-span-3 space-y-6">
                    <Card className="h-full">
                        <CardHeader>
                            <CardTitle className="text-sm">Visualisasi Data</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-8">

                            {/* Bar Chart Money */}
                            <div className="space-y-2">
                                <p className="text-xs text-center font-medium text-muted-foreground">Perbandingan Keuangan (Rupiah)</p>
                                <div className="h-[150px] w-full min-w-0">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={moneyChartData}>
                                            <XAxis dataKey="name" fontSize={11} tickLine={false} axisLine={false} />
                                            <Tooltip
                                                cursor={{ fill: 'transparent' }}
                                                contentStyle={{ borderRadius: '8px', borderColor: 'var(--color-border)', backgroundColor: 'var(--color-card)', color: 'var(--color-foreground)' }}
                                                itemStyle={{ color: 'var(--color-foreground)' }}
                                                labelStyle={{ color: 'var(--color-foreground)' }}
                                                formatter={(value: any) => `Rp ${value.toLocaleString('id-ID')}`}
                                            />
                                            <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                                                {moneyChartData.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={index === 0 ? 'var(--color-success)' : 'var(--color-warning)'} />
                                                ))}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            {/* Pie Chart People */}
                            <div className="space-y-2 border-t pt-6 border-border">
                                <p className="text-xs text-center font-medium text-muted-foreground">Rasio Kepatuhan Warga (Orang)</p>
                                <div className="h-[150px] w-full flex justify-center min-w-0">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={peoplePieData}
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={40}
                                                outerRadius={60}
                                                paddingAngle={5}
                                                dataKey="value"
                                            >
                                                <Cell fill="var(--color-success)" /> {/* Lunas */}
                                                <Cell fill="var(--color-warning)" /> {/* Belum */}
                                            </Pie>
                                            <Tooltip
                                                contentStyle={{ borderRadius: '8px', borderColor: 'var(--color-border)', backgroundColor: 'var(--color-card)', color: 'var(--color-foreground)' }}
                                                itemStyle={{ color: 'var(--color-foreground)' }}
                                                labelStyle={{ color: 'var(--color-foreground)' }}
                                            />
                                            <Legend verticalAlign="bottom" height={36} iconType="circle" />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}
