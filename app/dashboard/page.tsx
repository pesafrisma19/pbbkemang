"use client"

import { useEffect, useState, useMemo } from "react"
import { supabase } from "@/lib/supabaseClient"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card"
import { DollarSign, Users, BarChart2, CheckCircle, XCircle, Loader2, MapPin, AlertCircle, Award, Clock, CalendarDays, Filter } from "lucide-react"
import dynamic from 'next/dynamic'

const DashboardBarChart = dynamic(() => import('@/components/features/DashboardBarChart'), {
    ssr: false,
    loading: () => <div className="h-[150px] w-full bg-muted/20 animate-pulse rounded-lg"></div>
})

const DashboardPieChart = dynamic(() => import('@/components/features/DashboardPieChart'), {
    ssr: false,
    loading: () => <div className="h-[150px] w-full bg-muted/20 animate-pulse rounded-full"></div>
})

export default function DashboardPage() {
    const [allCitizens, setAllCitizens] = useState<any[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [deadline, setDeadline] = useState<string | null>(null)
    const [selectedKampung, setSelectedKampung] = useState<string>("Semua")

    useEffect(() => {
        const fetchDashboardData = async () => {
            try {
                // Fetch Settings
                const resSets = await fetch('/api/settings')
                const setJson = await resSets.json()
                if (setJson.deadline) setDeadline(setJson.deadline)

                // Fetch Citizens with detailed tax objects
                const { data: citizens, error } = await supabase
                    .from('citizens')
                    .select(`
                        id,
                        name,
                        address,
                        tax_objects (
                            id,
                            amount_due,
                            status,
                            paid_at,
                            location_name
                        )
                    `)

                if (error) throw error
                if (citizens) setAllCitizens(citizens)
                
            } catch (err) {
                console.error("Error fetching dashboard data:", err)
            } finally {
                setIsLoading(false)
            }
        }
        fetchDashboardData()
    }, [])

    // Extract unique kampungs for filter
    const uniqueKampungs = useMemo(() => {
        const set = new Set<string>()
        allCitizens.forEach(c => {
            if (c.address) set.add(c.address.trim())
        })
        return Array.from(set).sort()
    }, [allCitizens])

    // Derived Statistics
    const dashboardStats = useMemo(() => {
        const result = {
            totalTarget: 0, amountPaid: 0, amountUnpaid: 0,
            citizenTotal: 0, citizenPaid: 0, citizenUnpaid: 0,
            assetTotal: 0, assetPaid: 0, assetUnpaid: 0,
            topKampungs: [] as any[],
            recentPayments: [] as any[]
        }

        const filteredCitizens = selectedKampung === "Semua" 
            ? allCitizens 
            : allCitizens.filter(c => c.address === selectedKampung)

        const kampungRatios: Record<string, { total: number, lunas: number }> = {}

        const todayRaw = new Date()
        // Compare dates by wiping out time
        const isToday = (dateString: string) => {
            const d = new Date(dateString)
            return d.getDate() === todayRaw.getDate() && d.getMonth() === todayRaw.getMonth() && d.getFullYear() === todayRaw.getFullYear()
        }

        filteredCitizens.forEach(c => {
            const assets = c.tax_objects || []
            let personHasUnpaid = false

            // Tracking for Leaderboard (only if "Semua" is active usually, but we compute always)
            if (c.address) {
                if (!kampungRatios[c.address]) kampungRatios[c.address] = { total: 0, lunas: 0 }
            }

            assets.forEach((t: any) => {
                result.assetTotal++
                result.totalTarget += t.amount_due

                if (c.address) kampungRatios[c.address].total++

                if (t.status === 'paid') {
                    result.amountPaid += t.amount_due
                    result.assetPaid++
                    if (c.address) kampungRatios[c.address].lunas++

                    // Check if paid today
                    if (t.paid_at && isToday(t.paid_at)) {
                        result.recentPayments.push({
                            citizenName: c.name,
                            amount: t.amount_due,
                            time: t.paid_at,
                            location: t.location_name
                        })
                    }
                } else {
                    result.amountUnpaid += t.amount_due
                    result.assetUnpaid++
                    personHasUnpaid = true
                }
            })

            result.citizenTotal++
            if (assets.length > 0 && !personHasUnpaid) {
                result.citizenPaid++
            } else {
                result.citizenUnpaid++
            }
        })

        // Sort Recent Payments by time (newest first)
        result.recentPayments.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
        // Limit to 10
        result.recentPayments = result.recentPayments.slice(0, 10)

        // Calculate Leaderboard
        result.topKampungs = Object.keys(kampungRatios)
            .map(k => {
                const total = kampungRatios[k].total
                const lunas = kampungRatios[k].lunas
                const pct = total > 0 ? (lunas / total) * 100 : 0
                return { name: k, pct, total, lunas }
            })
            .filter(k => k.total > 0) // Only kampungs with at least 1 tax obj
            .sort((a, b) => b.pct - a.pct) // Highest percentage first
            .slice(0, 3) // Top 3

        return result
    }, [allCitizens, selectedKampung])

    // Charts Data
    const moneyChartData = [
        { name: 'Sudah Masuk', amount: dashboardStats.amountPaid },
        { name: 'Belum Masuk', amount: dashboardStats.amountUnpaid },
    ];

    const peoplePieData = [
        { name: 'Warga Lunas', value: dashboardStats.citizenPaid },
        { name: 'Belum Lunas', value: dashboardStats.citizenUnpaid },
    ];

    const percentage = dashboardStats.totalTarget > 0 ? Math.round((dashboardStats.amountPaid / dashboardStats.totalTarget) * 100) : 0

    // Deadline Calculation
    const getDeadlineInfo = () => {
        if (!deadline) return null;
        const now = new Date()
        const target = new Date(deadline)
        const diffTime = target.getTime() - now.getTime()
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
        
        if (diffDays < 0) return { text: "TERLEWAT", color: "bg-red-100 text-red-700 border-red-200" }
        if (diffDays <= 14) return { text: `H-${diffDays} JATUH TEMPO!`, color: "bg-red-100 text-red-700 border-red-200" }
        if (diffDays <= 30) return { text: `H-${diffDays} (Sebentar Lagi)`, color: "bg-orange-100 text-orange-700 border-orange-200" }
        return { text: `H-${diffDays}`, color: "bg-blue-100 text-blue-700 border-blue-200" }
    }
    const dInfo = getDeadlineInfo()

    if (isLoading) {
        return <div className="flex h-[50vh] items-center justify-center text-muted-foreground"><Loader2 className="animate-spin mr-2" /> Menghitung Data Real-Time...</div>
    }

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-5 duration-700 pb-12">
            <div>
                <h2 className="text-3xl font-bold tracking-tight text-foreground">Dashboard & Laporan</h2>
                <p className="text-muted-foreground">Ringkasan data real-time penerimaan PBB Desa Kemang.</p>
            </div>
            
            {/* Deadline Bar */}
            {deadline && dInfo && (
                <div className={`p-4 rounded-xl border flex items-center justify-between ${dInfo.color} animate-in zoom-in-95`}>
                    <div className="flex items-center gap-3">
                        <CalendarDays className="w-6 h-6" />
                        <div>
                            <p className="text-sm font-semibold uppercase tracking-wider opacity-80">Menuju Jatuh Tempo ({new Date(deadline).toLocaleDateString('id-ID', {day: 'numeric', month: 'long', year: 'numeric'})})</p>
                            <p className="text-2xl font-black">{dInfo.text}</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Filter */}
            <div className="flex items-center gap-3 bg-muted/30 p-2 rounded-lg border w-fit">
                <Filter size={18} className="text-muted-foreground ml-2" />
                <select 
                    value={selectedKampung} 
                    onChange={e => setSelectedKampung(e.target.value)}
                    className="bg-transparent border-none text-sm font-semibold focus:ring-0 cursor-pointer outline-none w-48"
                >
                    <option value="Semua">TAMPILKAN SEMUA AREA</option>
                    {uniqueKampungs.map(k => (
                        <option key={k} value={k}>Kampung • {k}</option>
                    ))}
                </select>
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
                            <div className="text-2xl font-bold text-foreground">Rp {dashboardStats.totalTarget.toLocaleString('id-ID')}</div>
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
                            <div className="text-2xl font-bold text-green-600">Rp {dashboardStats.amountPaid.toLocaleString('id-ID')}</div>
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
                            <div className="text-2xl font-bold text-orange-600">Rp {dashboardStats.amountUnpaid.toLocaleString('id-ID')}</div>
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
                                    <div className="text-4xl font-extrabold text-foreground mt-2">{dashboardStats.citizenTotal}</div>
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
                                <div className="text-2xl font-bold text-green-600">{dashboardStats.citizenPaid}</div>
                                <p className="text-[10px] text-muted-foreground">Semua asetnya lunas</p>
                            </CardContent>
                        </Card>

                        <Card className="bg-card">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Belum Lunas</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-orange-600">{dashboardStats.citizenUnpaid}</div>
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
                            <div className="text-xl font-bold">{dashboardStats.assetTotal}</div>
                            <div className="text-[10px] text-muted-foreground uppercase">Total Kikitir</div>
                        </div>
                        <div className="bg-success/10 p-3 rounded-lg border border-success/20 text-center">
                            <div className="text-xl font-bold text-success">{dashboardStats.assetPaid}</div>
                            <div className="text-[10px] text-success/80 uppercase">Kikitir Lunas</div>
                        </div>
                        <div className="bg-warning/10 p-3 rounded-lg border border-warning/20 text-center">
                            <div className="text-xl font-bold text-warning">{dashboardStats.assetUnpaid}</div>
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
                                <div className="w-full min-w-0">
                                    <DashboardBarChart data={moneyChartData} />
                                </div>
                            </div>

                            {/* Pie Chart People */}
                            <div className="space-y-2 border-t pt-6 border-border">
                                <p className="text-xs text-center font-medium text-muted-foreground">Rasio Kepatuhan Warga (Orang)</p>
                                <div className="w-full flex justify-center min-w-0">
                                    <DashboardPieChart data={peoplePieData} />
                                </div>
                            </div>

                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* --- SECTION 3: RECENT ACTIVITY & LEADERBOARD --- */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
                
                {/* Recent Payments */}
                <div className="col-span-4 space-y-4">
                    <h3 className="text-lg font-semibold flex items-center gap-2 text-foreground/80">
                        <div className="p-1 bg-green-100 text-green-600 rounded">
                            <Clock size={16} />
                        </div>
                        Pembayaran Lunas Hari Ini
                    </h3>
                    <Card className="bg-card">
                        <CardContent className="p-0">
                            {dashboardStats.recentPayments.length > 0 ? (
                                <div className="divide-y max-h-[300px] overflow-y-auto">
                                    {dashboardStats.recentPayments.map((p, idx) => (
                                        <div key={idx} className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors">
                                            <div>
                                                <p className="font-semibold text-sm">{p.citizenName}</p>
                                                <p className="text-xs text-muted-foreground">{p.location}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="font-bold text-green-600 text-sm">+ Rp {p.amount.toLocaleString('id-ID')}</p>
                                                <p className="text-[10px] text-muted-foreground">{new Date(p.time).toLocaleTimeString('id-ID', {hour: '2-digit', minute: '2-digit'})}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="p-8 text-center text-muted-foreground text-sm">
                                    Belum ada catatan pelunasan hari ini.
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Top Kampungs Leaderboard */}
                {selectedKampung === "Semua" && (
                    <div className="col-span-3 space-y-4">
                        <h3 className="text-lg font-semibold flex items-center gap-2 text-foreground/80">
                            <div className="p-1 bg-yellow-100 text-yellow-600 rounded">
                                <Award size={16} />
                            </div>
                            Kampung Paling Kepatuhannya Tinggi
                        </h3>
                        <div className="grid gap-3">
                            {dashboardStats.topKampungs.map((k, idx) => (
                                <Card key={k.name} className="bg-card shadow-sm border-l-4 border-l-yellow-500 relative overflow-hidden">
                                    <div className="absolute top-0 right-0 p-4 opacity-5">
                                        <Award size={64} className="text-yellow-600" />
                                    </div>
                                    <CardContent className="p-4 flex items-center gap-4">
                                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-yellow-100 text-yellow-700 font-bold flex items-center justify-center">
                                            #{idx + 1}
                                        </div>
                                        <div className="flex-1">
                                            <p className="font-bold text-foreground">{k.name}</p>
                                            <div className="w-full bg-muted rounded-full h-1.5 mt-2 mb-1">
                                                <div className="bg-yellow-500 h-1.5 rounded-full" style={{ width: `${k.pct}%` }}></div>
                                            </div>
                                            <div className="flex justify-between text-[10px] text-muted-foreground font-medium">
                                                <span>{k.lunas} Lunas dari {k.total} Kikitir</span>
                                                <span className="text-yellow-600 font-bold">{Math.round(k.pct)}%</span>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                            {dashboardStats.topKampungs.length === 0 && (
                                <Card className="bg-card shadow-sm text-center p-6 text-muted-foreground text-sm">
                                    Belum ada data tersedia.
                                </Card>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
