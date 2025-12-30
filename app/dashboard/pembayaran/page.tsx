"use client"

import { useState, useEffect, useCallback } from "react"
import { supabase } from "@/lib/supabaseClient"
import { Input } from "@/components/ui/Input"
import { Button } from "@/components/ui/Button"
import { Toggle } from "@/components/ui/Toggle"
import { Search, Loader2, User, CalendarDays } from "lucide-react"

// --- TYPES ---
type TaxObject = {
    id: string
    nop: string
    location: string
    year: number
    amount: number
    paid: boolean
    paidAt: string | null
    original_name: string | null
    persil: string | null
    blok: string | null
}

type WPGroup = {
    citizen_id: string
    name: string
    address: string
    total_unpaid: number
    tax_objects: TaxObject[]
}

type FilterStatus = 'all' | 'unpaid' | 'paid'

export default function PembayaranPage() {
    const [searchTerm, setSearchTerm] = useState("")
    const [wpGroups, setWpGroups] = useState<WPGroup[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [filterStatus, setFilterStatus] = useState<FilterStatus>('unpaid')

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1)
    const itemsPerPage = 10

    // --- FETCH DATA ---
    const fetchData = useCallback(async () => {
        setIsLoading(true)
        try {
            const { data, error } = await supabase
                .from('citizens')
                .select(`
                    id, name, address,
                    tax_objects (
                        id, nop, location_name, amount_due, status, paid_at, year,
                        original_name, persil, blok
                    )
                `)
                .order('name', { ascending: true })

            if (error) throw error

            if (data) {
                const groups: WPGroup[] = data.map((citizen: any) => {
                    const objects: TaxObject[] = (citizen.tax_objects || []).map((obj: any) => ({
                        id: obj.id,
                        nop: obj.nop,
                        location: obj.location_name,
                        year: obj.year || new Date().getFullYear(),
                        amount: obj.amount_due,
                        paid: obj.status === 'paid',
                        paidAt: obj.paid_at,
                        original_name: obj.original_name,
                        persil: obj.persil,
                        blok: obj.blok
                    }))

                    const totalUnpaid = objects
                        .filter(o => !o.paid)
                        .reduce((sum, o) => sum + o.amount, 0)

                    return {
                        citizen_id: citizen.id,
                        name: citizen.name,
                        address: citizen.address,
                        total_unpaid: totalUnpaid,
                        tax_objects: objects
                    }
                })

                const validGroups = groups.filter(g => g.tax_objects.length > 0)
                setWpGroups(validGroups)
            }
        } catch (err: any) {
            console.error(err)
        } finally {
            setIsLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchData()
    }, [fetchData])

    // --- HANDLE TOGGLE ---
    const handleToggle = async (objectId: string, currentStatus: boolean, citizenId: string) => {
        const isNowPaid = !currentStatus;
        const now = isNowPaid ? new Date().toISOString() : null;

        // Optimistic Update
        const previousGroups = [...wpGroups];
        const newGroups = wpGroups.map(group => {
            if (group.citizen_id !== citizenId) return group;
            const newObjects = group.tax_objects.map(obj =>
                obj.id === objectId ? { ...obj, paid: isNowPaid, paidAt: now } : obj
            );
            const newTotalUnpaid = newObjects.filter(o => !o.paid).reduce((sum, o) => sum + o.amount, 0);
            return { ...group, tax_objects: newObjects, total_unpaid: newTotalUnpaid };
        });

        setWpGroups(newGroups);

        try {
            const newStatus = isNowPaid ? 'paid' : 'unpaid'
            const { error } = await supabase
                .from('tax_objects')
                .update({ status: newStatus, paid_at: now })
                .eq('id', objectId)

            if (error) {
                setWpGroups(previousGroups)
                alert("Gagal update status pembayaran.")
            }
        } catch (err) {
            setWpGroups(previousGroups)
            console.error(err)
        }
    }

    // --- FILTER LOGIC ---
    const filteredGroups = wpGroups.filter(g => {
        if (filterStatus === 'unpaid' && g.total_unpaid === 0) return false;
        if (filterStatus === 'paid' && g.total_unpaid > 0) return false;
        const lowerSearch = searchTerm.toLowerCase()
        if (!lowerSearch) return true;
        if (g.name.toLowerCase().includes(lowerSearch)) return true
        if (g.address?.toLowerCase().includes(lowerSearch)) return true
        return g.tax_objects.some(obj => obj.nop.includes(searchTerm))
    })

    const totalPages = Math.ceil(filteredGroups.length / itemsPerPage)
    const paginatedGroups = filteredGroups.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

    useEffect(() => { setCurrentPage(1) }, [searchTerm, filterStatus])

    const formatDate = (dateString: string | null) => {
        if (!dateString) return ""
        const d = new Date(dateString)
        return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-12">
            <div className="flex flex-col gap-2">
                <h2 className="text-2xl font-bold tracking-tight">Eksekusi Pembayaran</h2>
                <p className="text-muted-foreground">Cari WP dan geser toggle untuk mencatat pelunasan per Kikitir.</p>
            </div>

            <div className="sticky top-0 z-30 pt-2 pb-4 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 space-y-3">
                <Input
                    placeholder="Scan NOP atau Ketik Nama..."
                    icon={Search}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="shadow-md h-12 text-lg"
                />

                {/* Filter Tabs */}
                <div className="flex p-1 bg-muted/50 rounded-lg border w-full sm:w-fit">
                    {['all', 'unpaid', 'paid'].map((status) => (
                        <button
                            key={status}
                            onClick={() => setFilterStatus(status as FilterStatus)}
                            className={`flex-1 sm:flex-none px-4 py-1.5 text-sm font-medium rounded-md transition-all capitalize ${filterStatus === status
                                ? status === 'unpaid' ? 'bg-red-100 text-red-700 shadow-sm border border-red-200 dark:bg-red-900/40 dark:text-red-300 dark:border-red-800'
                                    : status === 'paid' ? 'bg-green-100 text-green-700 shadow-sm border border-green-200 dark:bg-green-900/40 dark:text-green-300 dark:border-green-800'
                                        : 'bg-background text-foreground shadow-sm'
                                : 'text-muted-foreground hover:bg-background/50'
                                }`}
                        >
                            {status === 'all' ? 'Semua' : status === 'unpaid' ? 'Belum Lunas' : 'Lunas'}
                        </button>
                    ))}
                </div>
            </div>

            {isLoading ? (
                <div className="text-center py-12"><Loader2 className="animate-spin inline mr-2" /> Memuat Data Tagihan...</div>
            ) : (
                <div className="grid gap-6">
                    {paginatedGroups.map((group) => (
                        <div key={group.citizen_id} className="border rounded-xl overflow-hidden bg-card text-card-foreground shadow-sm">
                            {/* WP Header */}
                            <div className="bg-muted/30 p-4 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <User size={18} className="text-blue-600 dark:text-blue-400" />
                                        <span className="font-bold text-lg">{group.name}</span>
                                    </div>
                                    <p className="text-sm text-muted-foreground ml-6">{group.address}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Sisa Tagihan</p>
                                    <p className={`text-xl font-bold font-mono ${group.total_unpaid > 0 ? 'text-destructive dark:text-red-400' : 'text-success dark:text-green-400'}`}>
                                        Rp {group.total_unpaid.toLocaleString('id-ID')}
                                    </p>
                                </div>
                            </div>

                            {/* List of Tax Objects */}
                            <div className="divide-y">
                                {group.tax_objects.map((item) => (
                                    <div
                                        key={item.id}
                                        className={`p-4 transition-colors ${item.paid
                                                // LOGIC GABUNGAN: 
                                                // Light Mode: bg-green-50/50
                                                // Dark Mode:  dark:bg-green-900/20
                                                ? 'bg-green-50/50 dark:bg-green-900/20'
                                                : 'hover:bg-muted/20'
                                            }`}
                                    >
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                            {/* Item Details */}
                                            <div className="flex-1 space-y-1">
                                                <div className="flex items-center gap-2 text-sm font-medium">
                                                    {/* NOP Badge: Light(slate-100) vs Dark(slate-800) */}
                                                    <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-xs font-mono">
                                                        {item.nop}
                                                    </span>
                                                    <span>{item.location}</span>
                                                    {/* Year Text: Light(muted) vs Dark(green-300 if paid) */}
                                                    <span className={`text-muted-foreground ${item.paid ? 'dark:text-green-300' : ''}`}>
                                                        • Thn {item.year}
                                                    </span>
                                                </div>

                                                {/* Extra Details: Original Name, Persil, Blok */}
                                                <div className={`flex flex-wrap gap-x-4 gap-y-1 text-xs ml-1 ${item.paid
                                                        ? 'text-muted-foreground dark:text-green-300' // Dark mode jadi hijau teksnya
                                                        : 'text-muted-foreground'
                                                    }`}>
                                                    {item.original_name && (
                                                        <span className="flex items-center gap-1">
                                                            Ex: <span className="text-foreground/80 font-medium">{item.original_name}</span>
                                                        </span>
                                                    )}

                                                    {/* Badge Logic for Blok & Persil */}
                                                    {/* Menggunakan base style + conditional dark mode style */}
                                                    {item.blok && (
                                                        <span className={`px-1.5 rounded border bg-slate-50 border-slate-100 ${item.paid
                                                                ? 'dark:bg-green-900/50 dark:border-green-800'
                                                                : 'dark:bg-slate-900 dark:border-slate-800'
                                                            }`}>
                                                            Blok: {item.blok}
                                                        </span>
                                                    )}
                                                    {item.persil && (
                                                        <span className={`px-1.5 rounded border bg-slate-50 border-slate-100 ${item.paid
                                                                ? 'dark:bg-green-900/50 dark:border-green-800'
                                                                : 'dark:bg-slate-900 dark:border-slate-800'
                                                            }`}>
                                                            Persil: {item.persil}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Action Section */}
                                            <div className="flex items-center justify-between sm:justify-end gap-6 w-full sm:w-auto mt-2 sm:mt-0">
                                                <div className="text-right min-w-[100px]">
                                                    <p className="font-bold text-sm">Rp {Number(item.amount).toLocaleString('id-ID')}</p>
                                                    {item.paid && item.paidAt && (
                                                        // Text Success: Light(green-600) vs Dark(green-400)
                                                        <div className="text-[10px] text-green-600 dark:text-green-400 flex items-center justify-end gap-1">
                                                            <CalendarDays size={10} />
                                                            {formatDate(item.paidAt)}
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="flex flex-col items-center gap-1 min-w-[70px]">
                                                    <Toggle
                                                        checked={item.paid}
                                                        onCheckedChange={() => handleToggle(item.id, item.paid, group.citizen_id)}
                                                    />
                                                    <span className={`text-[10px] font-bold ${item.paid ? 'text-success dark:text-green-400' : 'text-muted-foreground'}`}>
                                                        {item.paid ? 'LUNAS' : 'BELUM'}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}

                    {paginatedGroups.length === 0 && (
                        <div className="text-center py-12 text-muted-foreground">
                            Data tidak ditemukan
                        </div>
                    )}
                </div>
            )}

            {/* Pagination Controls */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between border-t border-dashed pt-6 mt-6">
                    <div className="text-sm text-muted-foreground">
                        Halaman {currentPage} dari {totalPages} ({filteredGroups.length} WP)
                    </div>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={currentPage === 1}
                            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        >
                            Sebelumnya
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={currentPage === totalPages}
                            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                        >
                            Selanjutnya
                        </Button>
                    </div>
                </div>
            )}
        </div>
    )
}
