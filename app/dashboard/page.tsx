"use client"

import { useEffect, useState, useMemo } from "react"
import { supabase } from "@/lib/supabaseClient"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card"
import { DollarSign, Users, BarChart2, CheckCircle, Loader2, MapPin, AlertCircle, Award, Clock, CalendarDays, Filter, CheckCircle2 } from "lucide-react"

export default function DashboardPage() {
    const [allCitizens, setAllCitizens] = useState<any[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [deadline, setDeadline] = useState<string | null>(null)
    const [selectedKampung, setSelectedKampung] = useState<string>("Semua")

    useEffect(() => {
        const fetchDashboardData = async () => {
            try {
                // Fetch Settings via localStorage directly
                const storedDeadline = localStorage.getItem('pbb_deadline')
                if (storedDeadline) setDeadline(storedDeadline)

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

    // Derived Statistics (Simultaneously calculates Global and Specific Kampung)
    const statsData = useMemo(() => {
        const global = {
            totalTarget: 0, amountPaid: 0, amountUnpaid: 0,
            citizenTotal: 0, citizenPaid: 0, citizenUnpaid: 0,
            assetTotal: 0, assetPaid: 0, assetUnpaid: 0,
            topKampungs: [] as any[],
            recentPayments: [] as any[]
        }
        
        const kampung = {
            totalTarget: 0, amountPaid: 0, amountUnpaid: 0,
            citizenTotal: 0, citizenPaid: 0, citizenUnpaid: 0,
            assetTotal: 0, assetPaid: 0, assetUnpaid: 0,
        }

        const kampungRatios: Record<string, { total: number, lunas: number }> = {}

        const todayRaw = new Date()
        // Function to strip time formatting for today matching
        const isToday = (dateString: string) => {
            const d = new Date(dateString)
            return d.getDate() === todayRaw.getDate() && d.getMonth() === todayRaw.getMonth() && d.getFullYear() === todayRaw.getFullYear()
        }

        allCitizens.forEach(c => {
            const assets = c.tax_objects || []
            let personHasUnpaidGlobal = false
            let personHasUnpaidKampung = false

            // Identifiers
            const addr = c.address ? c.address.trim() : ""
            const isSelected = selectedKampung !== "Semua" && addr === selectedKampung

            // Leaderboard Prep
            if (addr) {
                if (!kampungRatios[addr]) kampungRatios[addr] = { total: 0, lunas: 0 }
            }

            assets.forEach((t: any) => {
                // GLOBAL LOGIC
                global.assetTotal++
                global.totalTarget += t.amount_due

                if (addr) kampungRatios[addr].total++

                if (t.status === 'paid') {
                    global.amountPaid += t.amount_due
                    global.assetPaid++
                    if (addr) kampungRatios[addr].lunas++

                    // Check if paid today
                    if (t.paid_at && isToday(t.paid_at)) {
                        global.recentPayments.push({
                            citizenName: c.name,
                            amount: t.amount_due,
                            time: t.paid_at,
                            location: t.location_name
                        })
                    }
                } else {
                    global.amountUnpaid += t.amount_due
                    global.assetUnpaid++
                    personHasUnpaidGlobal = true
                }

                // SPECIFIC KAMPUNG LOGIC (Only calculate if selected)
                if (isSelected) {
                    kampung.assetTotal++
                    kampung.totalTarget += t.amount_due
                    if (t.status === 'paid') {
                        kampung.amountPaid += t.amount_due
                        kampung.assetPaid++
                    } else {
                        kampung.amountUnpaid += t.amount_due
                        kampung.assetUnpaid++
                        personHasUnpaidKampung = true
                    }
                }
            })

            // GLOBAL CITIZEN TALLY
            global.citizenTotal++
            if (assets.length > 0 && !personHasUnpaidGlobal) {
                global.citizenPaid++
            } else {
                global.citizenUnpaid++
            }

            // SPECIFIC KAMPUNG CITIZEN TALLY
            if (isSelected) {
                kampung.citizenTotal++
                if (assets.length > 0 && !personHasUnpaidKampung) {
                    kampung.citizenPaid++
                } else {
                    kampung.citizenUnpaid++
                }
            }
        })

        // Process Recent Payments
        global.recentPayments.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
        global.recentPayments = global.recentPayments.slice(0, 10)

        // Process Leaderboard
        global.topKampungs = Object.keys(kampungRatios)
            .map(k => {
                const total = kampungRatios[k].total
                const lunas = kampungRatios[k].lunas
                const pct = total > 0 ? (lunas / total) * 100 : 0
                return { name: k, pct, total, lunas }
            })
            .filter(k => k.total > 0)
            .sort((a, b) => b.pct - a.pct)
            .slice(0, 3)

        return { global, kampung }
    }, [allCitizens, selectedKampung])

    // UI Helper: Deadline Banner
    const renderDeadlineBox = () => {
        if (!deadline) return null;
        const now = new Date()
        const target = new Date(deadline)
        const diffTime = target.getTime() - now.getTime()
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
        
        let color = "bg-blue-100 text-blue-700 border-blue-200"
        let text = `H-${diffDays}`
        
        if (diffDays < 0) {
            text = "TERLEWAT"
            color = "bg-red-100 text-red-700 border-red-200"
        } else if (diffDays <= 14) {
            text = `H-${diffDays} JATUH TEMPO!`
            color = "bg-red-100 text-red-700 border-red-200"
        } else if (diffDays <= 30) {
            text = `H-${diffDays} (Sebentar Lagi)`
            color = "bg-orange-100 text-orange-700 border-orange-200"
        }

        return (
            <div className={`p-4 rounded-xl border flex items-center justify-between ${color} animate-in zoom-in-95`}>
                <div className="flex items-center gap-3">
                    <CalendarDays className="w-6 h-6" />
                    <div>
                        <p className="text-sm font-semibold uppercase tracking-wider opacity-80">Menuju Jatuh Tempo ({new Date(deadline).toLocaleDateString('id-ID', {day: 'numeric', month: 'long', year: 'numeric'})})</p>
                        <p className="text-2xl font-black">{text}</p>
                    </div>
                </div>
            </div>
        )
    }

    // Extracted Display Component to avoid duplicate JSX code!
    const StatsPanel = ({ stats, prefixTitle }: { stats: any, prefixTitle: string }) => {
        const pctMoney = stats.totalTarget > 0 ? Math.round((stats.amountPaid / stats.totalTarget) * 100) : 0
        const pctWarga = stats.citizenTotal > 0 ? Math.round((stats.citizenPaid / stats.citizenTotal) * 100) : 0
        const pctKikitir = stats.assetTotal > 0 ? Math.round((stats.assetPaid / stats.assetTotal) * 100) : 0
        
        return (
            <div className="space-y-6">
                {/* Money */}
                <div className="grid gap-4 md:grid-cols-3">
                    <Card className="bg-card border-l-4 border-l-blue-500 shadow-sm hover:shadow-md transition-all">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Total Target {prefixTitle}</CardTitle>
                            <BarChart2 className="h-4 w-4 text-blue-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-foreground">Rp {stats.totalTarget.toLocaleString('id-ID')}</div>
                            <p className="text-xs text-muted-foreground mt-1">Akumulasi Murni</p>
                        </CardContent>
                    </Card>

                    <Card className="bg-card border-l-4 border-l-green-500 shadow-sm hover:shadow-md transition-all">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Lunas Masuk {prefixTitle}</CardTitle>
                            <CheckCircle className="h-4 w-4 text-green-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-green-600">Rp {stats.amountPaid.toLocaleString('id-ID')}</div>
                            <div className="flex justify-between items-center mt-1">
                                <span className="text-xs text-muted-foreground">Persentase</span>
                                <span className="text-xs font-bold text-green-700 bg-green-100 px-2 rounded-full">{pctMoney}%</span>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="bg-card border-l-4 border-l-orange-500 shadow-sm hover:shadow-md transition-all">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Sisa Belum {prefixTitle}</CardTitle>
                            <AlertCircle className="h-4 w-4 text-orange-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-orange-600">Rp {stats.amountUnpaid.toLocaleString('id-ID')}</div>
                            <p className="text-xs text-muted-foreground mt-1">Tunggakan aktif</p>
                        </CardContent>
                    </Card>
                </div>

                {/* People and Assets */}
                <div className="grid gap-4 md:grid-cols-2">
                    <Card className="border border-purple-200">
                        <CardHeader className="pb-2 bg-purple-50 rounded-t-lg">
                            <CardTitle className="text-sm font-bold text-purple-700 flex items-center gap-2"><Users size={16}/> Statistik Wajib Pajak (Orang)</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-4 grid grid-cols-3 gap-2 text-center divide-x">
                            <div className="px-2">
                                <p className="text-xs text-muted-foreground uppercase">Total Orang</p>
                                <p className="text-2xl font-black">{stats.citizenTotal}</p>
                            </div>
                            <div className="px-2">
                                <p className="text-xs text-muted-foreground uppercase text-green-600">Terbebas</p>
                                <p className="text-2xl font-bold text-green-600">{stats.citizenPaid}</p>
                                <p className="text-[10px] text-green-600 font-bold bg-green-100 rounded-lg max-w-max mx-auto px-2 mt-1">{pctWarga}%</p>
                            </div>
                            <div className="px-2">
                                <p className="text-xs text-muted-foreground uppercase text-orange-600">Menunggak</p>
                                <p className="text-2xl font-bold text-orange-600">{stats.citizenUnpaid}</p>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border border-slate-200">
                        <CardHeader className="pb-2 bg-slate-50 rounded-t-lg">
                            <CardTitle className="text-sm font-bold text-slate-700 flex items-center gap-2"><MapPin size={16}/> Statistik Kikitir (Bidang)</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-4 grid grid-cols-3 gap-2 text-center divide-x">
                            <div className="px-2">
                                <p className="text-xs text-muted-foreground uppercase">Total Kikitir</p>
                                <p className="text-2xl font-black">{stats.assetTotal}</p>
                            </div>
                            <div className="px-2">
                                <p className="text-xs text-muted-foreground uppercase text-green-600">Lunas</p>
                                <p className="text-2xl font-bold text-green-600">{stats.assetPaid}</p>
                                <p className="text-[10px] text-green-600 font-bold bg-green-100 rounded-lg max-w-max mx-auto px-2 mt-1">{pctKikitir}%</p>
                            </div>
                            <div className="px-2">
                                <p className="text-xs text-muted-foreground uppercase text-orange-600">Tunggakan</p>
                                <p className="text-2xl font-bold text-orange-600">{stats.assetUnpaid}</p>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        )
    }

    if (isLoading) {
        return <div className="flex h-[50vh] items-center justify-center text-muted-foreground"><Loader2 className="animate-spin mr-2" /> Menghitung Data Real-Time...</div>
    }

    return (
        <div className="space-y-10 animate-in fade-in slide-in-from-bottom-5 duration-700 pb-16">
            <div>
                <h2 className="text-3xl font-bold tracking-tight text-foreground">Dashboard & Laporan</h2>
                <p className="text-muted-foreground">Ringkasan data real-time penerimaan PBB Desa Kemang.</p>
            </div>
            
            {renderDeadlineBox()}

            {/* ---> 1. STATS GLOBAL <--- */}
            <div>
                <h3 className="text-lg font-bold flex items-center gap-2 text-foreground mb-4 pb-2 border-b">
                    <DollarSign className="text-blue-600 bg-blue-100 p-1 rounded-md" size={24} />
                    Pencapaian Desa (Global)
                </h3>
                <StatsPanel stats={statsData.global} prefixTitle="(Global)" />
            </div>

            {/* ---> 2. TOP KAMPUNG <--- */}
            <div>
                <h3 className="text-lg font-bold flex items-center gap-2 text-foreground mb-4 pb-2 border-b">
                    <Award className="text-yellow-600 bg-yellow-100 p-1 rounded-md" size={24} />
                    Top 3 Kampung Terbaik
                </h3>
                <div className="grid gap-4 md:grid-cols-3">
                    {statsData.global.topKampungs.map((k, idx) => (
                        <Card key={k.name} className="bg-card shadow-sm border-t-4 border-t-yellow-400 relative overflow-hidden">
                            <div className="absolute -right-4 -bottom-4 opacity-10">
                                <Award size={100} />
                            </div>
                            <CardContent className="p-5 flex flex-col justify-between">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="w-8 h-8 rounded-full bg-yellow-100 text-yellow-700 font-black flex items-center justify-center shadow-sm">
                                        #{idx + 1}
                                    </div>
                                    <span className="text-3xl font-black text-yellow-600">{Math.round(k.pct)}%</span>
                                </div>
                                <div>
                                    <h4 className="text-lg font-bold">{k.name}</h4>
                                    <p className="text-sm text-muted-foreground flex items-center gap-1"><CheckCircle2 size={12} className="text-success"/> Lunas: {k.lunas} dari {k.total} Kikitir</p>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                    {statsData.global.topKampungs.length === 0 && (
                        <div className="col-span-3 p-6 text-center text-muted-foreground border rounded-lg bg-muted/20">Data tidak cukup untuk menampilkan ranking.</div>
                    )}
                </div>
            </div>

            {/* ---> 3. KAMPUNG KHUSUS <--- */}
            <div className="p-6 bg-slate-50 border border-slate-200 rounded-xl space-y-6">
                <div>
                    <h3 className="text-lg font-bold flex items-center gap-2 text-foreground mb-1">
                        <Filter className="text-slate-600 bg-slate-200 p-1 rounded-md" size={24} />
                        Rincian Detail Menyeluruh Per-Kampung
                    </h3>
                    <p className="text-sm text-muted-foreground">Pilih kampung dari kaliber di bawah ini untuk mengintip performa spesifiknya secara lengkap.</p>
                </div>
                
                <select 
                    value={selectedKampung} 
                    onChange={e => setSelectedKampung(e.target.value)}
                    className="w-full md:w-fit px-4 py-3 border border-slate-300 rounded-lg bg-white font-bold text-slate-800 shadow-sm focus:ring focus:ring-blue-200 outline-none"
                >
                    <option value="Semua">-- Pilih Kampung Disini --</option>
                    {uniqueKampungs.map(k => (
                        <option key={k} value={k}>Area Kampung: {k}</option>
                    ))}
                </select>

                {selectedKampung !== "Semua" ? (
                    <div className="pt-4 border-t border-slate-200 animate-in fade-in zoom-in-95 duration-300">
                        <StatsPanel stats={statsData.kampung} prefixTitle={`(${selectedKampung})`} />
                    </div>
                ) : (
                    <div className="pt-2 text-sm text-slate-500 italic">Silakan pilih kampung untuk memunculkan panel analisisnya.</div>
                )}
            </div>

            {/* ---> 4. RECENT PAYMENTS <--- */}
            <div>
                <h3 className="text-lg font-bold flex items-center gap-2 text-foreground mb-4 pb-2 border-b">
                    <Clock className="text-green-600 bg-green-100 p-1 rounded-md" size={24} />
                    Riwayat 10 Pembayaran Terakhir
                </h3>
                <Card className="bg-card shadow-sm">
                    <CardContent className="p-0">
                        {statsData.global.recentPayments.length > 0 ? (
                            <div className="divide-y max-h-[400px] overflow-y-auto">
                                {statsData.global.recentPayments.map((p, idx) => (
                                    <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 hover:bg-green-50/50 transition-colors">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-green-100 text-green-700 font-bold flex items-center justify-center shrink-0">
                                                {idx + 1}
                                            </div>
                                            <div>
                                                <p className="font-bold text-foreground text-sm uppercase">{p.citizenName}</p>
                                                <p className="text-xs font-medium text-slate-500 bg-slate-100 w-fit px-2 py-0.5 rounded-full mt-0.5">{p.location}</p>
                                            </div>
                                        </div>
                                        <div className="mt-2 sm:mt-0 text-left sm:text-right ml-12 sm:ml-0">
                                            <p className="font-black text-green-600 text-base">+ Rp {p.amount.toLocaleString('id-ID')}</p>
                                            <p className="text-[11px] text-muted-foreground/80 font-medium">{new Date(p.time).toLocaleTimeString('id-ID', {hour: '2-digit', minute: '2-digit'})}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="p-8 text-center text-muted-foreground text-sm">
                                Tidak ada aktivitas pelunasan tercatat untuk hari ini.
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

        </div>
    )
}
