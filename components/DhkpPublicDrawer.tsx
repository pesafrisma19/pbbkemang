"use client"

import { useState, useEffect, useCallback } from "react"
import { supabase } from "@/lib/supabaseClient"
import { Input } from "@/components/ui/Input"
import { Button } from "@/components/ui/Button"
import { Search, Loader2, X, Database, MapPin, ChevronLeft, ChevronRight, TrendingUp } from "lucide-react"

type DhkpRecord = {
    id: string;
    nop: string;
    nama_wp: string;
    alamat_op: string;
    ketetapan: number;
    kadus: string | null;
}

type DhkpPublicDrawerProps = {
    isOpen: boolean;
    onClose: () => void;
}

export function DhkpPublicDrawer({ isOpen, onClose }: DhkpPublicDrawerProps) {
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
        if (!isOpen) return;
        
        const fetchStats = async () => {
            setStatsLoading(true)
            try {
                // Since we can't do direct grouping easily in simple Postgrest without RPC, 
                // we might need to fetch all or use a specific strategy.
                // For a robust approach, we can fetch just ketetapan and kadus.
                // For 5000 rows, this is still extremely fast.
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
    }, [isOpen])

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
        if (!isOpen) return;
        const timeout = setTimeout(() => fetchDhkpData(), 500)
        return () => clearTimeout(timeout)
    }, [dhkpQuery, currentPage, isOpen, fetchDhkpData])

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setDhkpQuery(e.target.value)
        setCurrentPage(1)
    }

    // Disable body scroll when drawer is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden'
        } else {
            document.body.style.overflow = 'unset'
        }
        return () => { document.body.style.overflow = 'unset' }
    }, [isOpen])

    return (
        <div className={`fixed inset-0 z-[100] transition-all duration-500 ease-in-out ${isOpen ? 'visible' : 'invisible'}`}>
            {/* Overlay */}
            <div 
                className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-500 ${isOpen ? 'opacity-100' : 'opacity-0'}`} 
                onClick={onClose}
            ></div>

            {/* Drawer */}
            <div className={`absolute top-0 right-0 h-full w-full md:w-[500px] lg:w-[600px] bg-background border-l border-border shadow-2xl flex flex-col transform transition-transform duration-500 ease-out ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
                
                {/* Header */}
                <div className="p-4 sm:p-6 border-b border-border flex items-center justify-between bg-gradient-to-r from-amber-500/10 to-orange-500/10">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-amber-500/20 rounded-xl text-amber-600 dark:text-amber-500">
                            <Database size={24} />
                        </div>
                        <div>
                            <h2 className="font-bold text-xl text-foreground">Buku Pintar DHKP</h2>
                            <p className="text-xs text-muted-foreground">Data Referensi SPPT Master</p>
                        </div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full hover:bg-black/5 dark:hover:bg-white/10">
                        <X size={24} />
                    </Button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
                    
                    {/* Stats Widget */}
                    <div className="bg-card rounded-2xl border border-amber-200 dark:border-amber-900/50 overflow-hidden shadow-sm">
                        <div className="p-4 bg-amber-50 dark:bg-amber-950/20 flex items-center justify-between border-b border-amber-100 dark:border-amber-900/30">
                            <div className="flex items-center gap-2 font-bold text-amber-800 dark:text-amber-500">
                                <TrendingUp size={18} />
                                Total Ketetapan DHKP
                            </div>
                            {statsLoading ? (
                                <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
                            ) : (
                                <div className="font-extrabold text-lg text-amber-700 dark:text-amber-400">
                                    Rp {totalDhkpAmount.toLocaleString('id-ID')}
                                </div>
                            )}
                        </div>
                        
                        {/* Per Kadus Stats */}
                        <div className="p-4 grid grid-cols-2 gap-3 text-sm">
                            {!statsLoading && Object.entries(kadusStats).sort().map(([kadus, amount]) => (
                                <div key={kadus} className="flex flex-col p-2 bg-muted/40 rounded-lg">
                                    <span className="text-xs text-muted-foreground font-medium uppercase">{kadus}</span>
                                    <span className="font-bold text-foreground mt-1">Rp {amount.toLocaleString('id-ID')}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Search */}
                    <div className="relative group">
                        <div className="absolute -inset-0.5 bg-gradient-to-r from-amber-500 to-orange-500 rounded-xl blur opacity-30 group-focus-within:opacity-60 transition duration-500"></div>
                        <div className="relative bg-background rounded-lg flex items-center p-2 border border-border">
                            <Search className="text-muted-foreground ml-2" size={20} />
                            <Input
                                placeholder="Cari Nama Pemilik Lama atau NOP..."
                                value={dhkpQuery}
                                onChange={handleSearchChange}
                                className="border-none shadow-none focus-visible:ring-0 text-base"
                            />
                            {isLoading && <Loader2 className="w-5 h-5 animate-spin text-amber-500 mr-2" />}
                        </div>
                    </div>

                    {/* Results List */}
                    <div className="space-y-3">
                        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                            Menampilkan {Math.min(totalCount, (currentPage - 1) * itemsPerPage + 1)} - {Math.min(totalCount, currentPage * itemsPerPage)} dari {totalCount} Data
                        </div>

                        {dhkpResults.length > 0 ? (
                            dhkpResults.map((item) => (
                                <div key={item.id} className="bg-card p-4 rounded-xl border border-border hover:border-amber-300 dark:hover:border-amber-700 transition-colors group shadow-sm">
                                    <div className="flex justify-between items-start gap-4">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <h3 className="font-bold text-base text-foreground">{item.nama_wp}</h3>
                                            </div>
                                            <div className="text-xs font-mono text-muted-foreground mb-2 bg-muted inline-block px-2 py-0.5 rounded">
                                                {item.nop}
                                            </div>
                                            <div className="text-sm text-foreground/80 flex items-start gap-1.5 mt-1">
                                                <MapPin size={14} className="mt-0.5 text-amber-500 shrink-0" />
                                                <span className="line-clamp-2">{item.alamat_op}</span>
                                            </div>
                                            {item.kadus && (
                                                <div className="mt-2 inline-block text-[10px] uppercase font-bold bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-800">
                                                    {item.kadus}
                                                </div>
                                            )}
                                        </div>
                                        <div className="text-right shrink-0">
                                            <div className="text-[10px] text-muted-foreground uppercase font-bold mb-1">Ketetapan</div>
                                            <div className="font-extrabold text-amber-600 dark:text-amber-500">
                                                Rp {item.ketetapan.toLocaleString('id-ID')}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            !isLoading && (
                                <div className="text-center py-12 px-4 bg-muted/20 border border-dashed border-border rounded-xl">
                                    <Database className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                                    <p className="font-medium text-foreground">Data tidak ditemukan</p>
                                    <p className="text-sm text-muted-foreground mt-1">Coba gunakan kata kunci pencarian yang lain.</p>
                                </div>
                            )
                        )}
                    </div>

                </div>

                {/* Footer Pagination */}
                {totalCount > itemsPerPage && (
                    <div className="p-4 border-t border-border bg-background flex items-center justify-between">
                        <Button 
                            variant="outline" 
                            size="sm" 
                            className="gap-1"
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                        >
                            <ChevronLeft size={16} /> Prev
                        </Button>
                        <span className="text-sm font-medium">Page {currentPage}</span>
                        <Button 
                            variant="outline" 
                            size="sm" 
                            className="gap-1"
                            onClick={() => setCurrentPage(p => p + 1)}
                            disabled={currentPage * itemsPerPage >= totalCount}
                        >
                            Next <ChevronRight size={16} />
                        </Button>
                    </div>
                )}
            </div>
        </div>
    )
}
