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
    alamat_op: string;
    ketetapan: number;
    kadus: string | null;
}

export default function DhkpPublicPage() {
    const [dhkpQuery, setDhkpQuery] = useState("")
    const [dhkpResults, setDhkpResults] = useState<DhkpRecord[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [totalCount, setTotalCount] = useState(0)
    
    // Stats State
    const [totalDhkpAmount, setTotalDhkpAmount] = useState(0)
    const [kadusStats, setKadusStats] = useState<Record<string, number>>({})
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
                const kStats: Record<string, number> = {};

                allData.forEach(item => {
                    total += Number(item.ketetapan) || 0;
                    const kadusName = item.kadus ? String(item.kadus).trim() : 'Tanpa Kadus';
                    if (!kStats[kadusName]) kStats[kadusName] = 0;
                    kStats[kadusName] += Number(item.ketetapan) || 0;
                })

                setTotalDhkpAmount(total)
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
            let query = supabase.from('dhkp_records').select('id, nop, nama_wp, alamat_op, ketetapan, kadus', { count: 'exact' })

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
                    <div className="p-5 bg-primary/5 flex items-center justify-between border-b border-border">
                        <div className="flex items-center gap-2 font-bold text-primary">
                            <TrendingUp size={20} />
                            Total Ketetapan DHKP
                        </div>
                        {statsLoading ? (
                            <Loader2 className="w-5 h-5 animate-spin text-primary" />
                        ) : (
                            <div className="font-extrabold text-xl text-primary">
                                Rp {totalDhkpAmount.toLocaleString('id-ID')}
                            </div>
                        )}
                    </div>
                    
                    <div className="p-5 grid grid-cols-2 md:grid-cols-4 gap-4 bg-background">
                        {!statsLoading && Object.entries(kadusStats).sort().map(([kadus, amount]) => (
                            <div key={kadus} className="flex flex-col p-3 bg-muted/40 rounded-xl border border-border/50">
                                <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{kadus}</span>
                                <span className="font-bold text-foreground mt-1">Rp {amount.toLocaleString('id-ID')}</span>
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
                                        <div className="flex flex-wrap items-center gap-2 mb-2">
                                            <h3 className="font-bold text-lg text-foreground">{item.nama_wp}</h3>
                                            {item.kadus && (
                                                <span className="text-[10px] uppercase font-bold bg-primary/10 text-primary px-2.5 py-1 rounded-full border border-primary/20">
                                                    {item.kadus}
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-sm font-mono text-muted-foreground mb-2 bg-muted inline-block px-2 py-0.5 rounded">
                                            {item.nop}
                                        </div>
                                        <div className="text-sm text-foreground/80 flex items-start gap-2">
                                            <MapPin size={16} className="mt-0.5 text-primary shrink-0" />
                                            <span>{item.alamat_op}</span>
                                        </div>
                                    </div>
                                    <div className="text-left md:text-right w-full md:w-auto bg-muted/30 md:bg-transparent p-3 md:p-0 rounded-xl">
                                        <div className="text-[10px] text-muted-foreground uppercase font-bold mb-1">Ketetapan Pajak</div>
                                        <div className="font-extrabold text-xl text-primary">
                                            Rp {item.ketetapan.toLocaleString('id-ID')}
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
