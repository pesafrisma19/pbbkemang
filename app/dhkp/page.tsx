"use client"

import { useState, useEffect, useCallback } from "react"
import { supabase } from "@/lib/supabaseClient"
import { Input } from "@/components/ui/Input"
import { Button } from "@/components/ui/Button"
import { Search, Loader2, Database, MapPin, ChevronLeft, ChevronRight, TrendingUp, Home } from "lucide-react"
import Link from "next/link"

type DhkpRecord = {
    id: string;
    nop: string;
    nama_wp: string;
    alamat_wp: string;
    alamat_op: string;
    ketetapan: number;
    kadus: string | null;
    blok: string | null;
    persil: string | null;
    kelas: string | null;
    luas_bumi: number;
    luas_bangunan: number;
}

export default function DhkpPublicPage() {
    const [dhkpQuery, setDhkpQuery] = useState("")
    const [dhkpResults, setDhkpResults] = useState<DhkpRecord[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [totalCount, setTotalCount] = useState(0)

    // Stats State
    const [totalDhkpAmount, setTotalDhkpAmount] = useState(0)
    const [totalDhkpCount, setTotalDhkpCount] = useState(0)
    const [kadusStats, setKadusStats] = useState<Record<string, { count: number; amount: number }>>({})
    const [statsLoading, setStatsLoading] = useState(true)

    // Pagination
    const [currentPage, setCurrentPage] = useState(1)
    const itemsPerPage = 50

    // Fetch Stats
    useEffect(() => {
        const fetchStats = async () => {
            setStatsLoading(true)
            try {
                let hasMore = true;
                let from = 0;
                const pageSize = 1000;
                let allData: any[] = [];

                while (hasMore) {
                    const { data, error } = await supabase
                        .from('dhkp_records')
                        .select('ketetapan, kadus')
                        .range(from, from + pageSize - 1)

                    if (error || !data) break;
                    allData = allData.concat(data);
                    if (data.length < pageSize) hasMore = false;
                    else from += pageSize;
                }

                let total = 0;
                const kStats: Record<string, { count: number; amount: number }> = {};

                allData.forEach(item => {
                    total += Number(item.ketetapan) || 0;
                    const kadusName = item.kadus ? String(item.kadus).trim() : 'Tanpa Kadus';
                    if (!kStats[kadusName]) kStats[kadusName] = { count: 0, amount: 0 };
                    kStats[kadusName].count++;
                    kStats[kadusName].amount += Number(item.ketetapan) || 0;
                })

                setTotalDhkpAmount(total)
                setTotalDhkpCount(allData.length)
                setKadusStats(kStats)
            } catch (err) {
                console.error("Stats fetch error:", err)
            } finally {
                setStatsLoading(false)
            }
        }

        fetchStats()
    }, [])

    // Fetch Data
    const fetchDhkpData = useCallback(async () => {
        setIsLoading(true)
        try {
            let query = supabase.from('dhkp_records').select('id, nop, nama_wp, alamat_wp, alamat_op, ketetapan, kadus, blok, persil, kelas, luas_bumi, luas_bangunan', { count: 'exact' })

            if (dhkpQuery) {
                query = query.or(`nop.ilike.%${dhkpQuery}%,nama_wp.ilike.%${dhkpQuery}%,alamat_op.ilike.%${dhkpQuery}%`)
            }

            const from = (currentPage - 1) * itemsPerPage
            const to = from + itemsPerPage - 1

            const { data, count, error } = await query
                .order('nama_wp', { ascending: true })
                .range(from, to)

            if (error) throw error

            setDhkpResults(data || [])
            if (count !== null) setTotalCount(count)

        } catch (error) {
            console.error("Error fetching DHKP:", error)
        } finally {
            setIsLoading(false)
        }
    }, [dhkpQuery, currentPage])

    useEffect(() => {
        const timeout = setTimeout(() => fetchDhkpData(), 500)
        return () => clearTimeout(timeout)
    }, [dhkpQuery, currentPage, fetchDhkpData])

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setDhkpQuery(e.target.value)
        setCurrentPage(1)
    }

    const renderJenisTanahBadge = (item: DhkpRecord) => {
        if (!item.luas_bumi || !item.ketetapan) return null;
        
        if (item.luas_bangunan > 0) {
            return <span className="bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400 px-2 py-0.5 rounded text-xs font-medium border border-amber-200 dark:border-amber-800 ml-2">Darat</span>;
        }

        const tarif = item.ketetapan / item.luas_bumi;
        
        if (tarif >= 13 && tarif <= 25) {
            return <span className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400 px-2 py-0.5 rounded text-xs font-medium border border-emerald-200 dark:border-emerald-800 ml-2">Sawah</span>;
        } else {
            return <span className="bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400 px-2 py-0.5 rounded text-xs font-medium border border-amber-200 dark:border-amber-800 ml-2">Darat</span>;
        }
    }

    return (
        <div className="min-h-screen bg-background text-foreground pb-20">
            {/* Simple Header */}
            <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
                <div className="container mx-auto px-4 h-16 flex items-center gap-4">
                    <Link href="/">
                        <Button variant="ghost" size="icon" className="rounded-full">
                            <ChevronLeft size={24} />
                        </Button>
                    </Link>
                    <div className="flex items-center gap-3">
                        <div className="bg-primary/10 p-1.5 rounded-lg text-primary">
                            <Database size={20} />
                        </div>
                        <span className="font-bold text-lg tracking-tight">Buku Pintar DHKP</span>
                    </div>
                </div>
            </header>

            <main className="container mx-auto px-4 pt-8 max-w-4xl space-y-8">
                {/* Stats Section */}
                <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
                    <div className="p-5 bg-primary/5 border-b border-border">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 font-bold text-primary">
                                <TrendingUp size={20} />
                                Ringkasan DHKP
                            </div>
                            {statsLoading && <Loader2 className="w-5 h-5 animate-spin text-primary" />}
                        </div>
                        {!statsLoading && (
                            <div className="grid grid-cols-2 gap-4 mt-4">
                                <div className="bg-background rounded-xl p-4 border border-border/50">
                                    <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Total DHKP</div>
                                    <div className="font-extrabold text-2xl text-foreground mt-1">{totalDhkpCount.toLocaleString('id-ID')}</div>
                                    <div className="text-xs text-muted-foreground">Ketetapan</div>
                                </div>
                                <div className="bg-background rounded-xl p-4 border border-border/50">
                                    <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Total Pajak</div>
                                    <div className="font-extrabold text-2xl text-primary mt-1">Rp {totalDhkpAmount.toLocaleString('id-ID')}</div>
                                    <div className="text-xs text-muted-foreground">Nominal</div>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="p-5 grid grid-cols-2 md:grid-cols-3 gap-3 bg-background">
                        {!statsLoading && Object.entries(kadusStats).sort().map(([kadus, stats]) => (
                            <div key={kadus} className="flex flex-col p-3 bg-muted/40 rounded-xl border border-border/50">
                                <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">• Kadus {kadus}</span>
                                <span className="font-bold text-foreground mt-1">{stats.count} DHKP</span>
                                <span className="text-xs text-muted-foreground">Rp {stats.amount.toLocaleString('id-ID')}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Search */}
                <div className="relative group">
                    <div className="absolute -inset-0.5 bg-gradient-to-r from-primary/50 to-primary rounded-xl blur opacity-20 group-focus-within:opacity-40 transition duration-500"></div>
                    <div className="relative bg-background rounded-xl flex items-center p-3 border border-border shadow-sm">
                        <Search className="text-muted-foreground ml-2" size={24} />
                        <Input
                            placeholder="Cari Nama Pemilik Lama atau NOP..."
                            value={dhkpQuery}
                            onChange={handleSearchChange}
                            className="border-none shadow-none focus-visible:ring-0 text-lg h-12"
                        />
                        {isLoading && <Loader2 className="w-6 h-6 animate-spin text-primary mr-2" />}
                    </div>
                </div>

                {/* Results */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between text-sm font-semibold text-muted-foreground uppercase tracking-wider px-2">
                        <span>Hasil Pencarian</span>
                        <span>{Math.min(totalCount, (currentPage - 1) * itemsPerPage + 1)} - {Math.min(totalCount, currentPage * itemsPerPage)} / {totalCount}</span>
                    </div>

                    <div className="grid gap-4">
                        {dhkpResults.length > 0 ? (
                            dhkpResults.map((item) => (
                                <div key={item.id} className="bg-card p-5 rounded-2xl border border-border hover:border-primary/50 transition-colors group shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                    <div className="flex-1">
                                        <h3 className="font-bold text-lg text-foreground mb-2 flex items-center">
                                            {item.nama_wp}
                                            {renderJenisTanahBadge(item)}
                                        </h3>
                                        <div className="text-sm font-mono text-muted-foreground mb-2 bg-muted inline-block px-2 py-0.5 rounded">
                                            {item.nop}
                                        </div>
                                        <div className="space-y-2 mb-2">
                                            <div className="text-sm text-foreground/80 flex items-start gap-2">
                                                <MapPin size={16} className="mt-0.5 text-primary shrink-0" />
                                                <div className="flex flex-col">
                                                    <span className="text-[10px] font-bold uppercase text-muted-foreground">Alamat WP (Pemilik)</span>
                                                    <span>{item.alamat_wp || '-'}</span>
                                                </div>
                                            </div>
                                            <div className="text-sm text-foreground/80 flex items-start gap-2">
                                                <MapPin size={16} className="mt-0.5 text-orange-500 shrink-0" />
                                                <div className="flex flex-col">
                                                    <span className="text-[10px] font-bold uppercase text-muted-foreground">Lokasi OP (Objek Pajak)</span>
                                                    <span>
                                                        {item.alamat_op || '-'}
                                                        {item.kadus && <span className="text-muted-foreground"> • Kadus {item.kadus}</span>}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        {(item.blok || item.persil || item.kelas) && (
                                            <div className="flex flex-wrap gap-1.5 mt-2">
                                                {item.blok && <span className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 px-2 py-0.5 rounded text-xs font-medium">Blok: {item.blok}</span>}
                                                {item.persil && <span className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 px-2 py-0.5 rounded text-xs font-medium">Persil: {item.persil}</span>}
                                                {item.kelas && <span className="bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300 px-2 py-0.5 rounded text-xs font-medium">Kelas: {item.kelas}</span>}
                                            </div>
                                        )}
                                    </div>
                                    <div className="text-left md:text-right w-full md:w-auto bg-muted/30 md:bg-transparent p-3 md:p-0 rounded-xl">
                                        <div className="text-[10px] text-muted-foreground uppercase font-bold mb-1">Ketetapan Pajak</div>
                                        <div className="font-extrabold text-xl text-primary">
                                            Rp {item.ketetapan.toLocaleString('id-ID')}
                                        </div>
                                        <div className="flex gap-3 mt-2 text-xs text-muted-foreground md:justify-end">
                                            <span>Luas Tanah: <strong className="text-foreground">{item.luas_bumi?.toLocaleString('id-ID') || 0} m²</strong></span>
                                            {item.luas_bangunan > 0 && <span>Bgn: <strong className="text-foreground">{item.luas_bangunan.toLocaleString('id-ID')} m²</strong></span>}
                                        </div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            !isLoading && (
                                <div className="text-center py-16 px-4 bg-card border border-dashed border-border rounded-2xl">
                                    <Database className="w-16 h-16 text-muted-foreground/20 mx-auto mb-4" />
                                    <p className="font-semibold text-lg text-foreground">Data tidak ditemukan</p>
                                    <p className="text-muted-foreground mt-2">Coba gunakan kata kunci pencarian yang lain.</p>
                                </div>
                            )
                        )}
                    </div>
                </div>

                {/* Pagination */}
                {totalCount > itemsPerPage && (
                    <div className="flex items-center justify-center gap-4 pt-6 pb-12">
                        <Button
                            variant="outline"
                            className="gap-2 w-32"
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                        >
                            <ChevronLeft size={18} /> Prev
                        </Button>
                        <span className="text-sm font-medium text-muted-foreground min-w-[80px] text-center">
                            Page {currentPage}
                        </span>
                        <Button
                            variant="outline"
                            className="gap-2 w-32"
                            onClick={() => setCurrentPage(p => p + 1)}
                            disabled={currentPage * itemsPerPage >= totalCount}
                        >
                            Next <ChevronRight size={18} />
                        </Button>
                    </div>
                )}
            </main>
        </div>
    )
}
