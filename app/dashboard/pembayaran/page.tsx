"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabaseClient"
import { Input } from "@/components/ui/Input"
import { Card, CardContent } from "@/components/ui/Card"
import { Toggle } from "@/components/ui/Toggle"
import { Search, MapPin, Loader2, User, CalendarDays } from "lucide-react"

type Tagihan = {
    id: string
    nop: string
    name: string
    location: string
    year: number // New
    amount: number
    paid: boolean
    paidAt: string | null // New: Date Info
}

export default function PembayaranPage() {
    const [searchTerm, setSearchTerm] = useState("")
    const [tagihan, setTagihan] = useState<Tagihan[]>([])
    const [isLoading, setIsLoading] = useState(true)

    // Fetch Data
    const fetchData = async () => {
        setIsLoading(true)
        try {
            const { data, error } = await supabase
                .from('tax_objects')
                .select(`
                    id,
                    nop,
                    location_name,
                    amount_due,
                    status,
                    paid_at,
                    year,
                    citizens (
                        name
                    )
                `)
                .order('nop', { ascending: true })

            if (error) throw error

            if (data) {
                const mapped: Tagihan[] = data.map((item: any) => ({
                    id: item.id,
                    nop: item.nop,
                    name: item.citizens?.name || "Tanpa Nama",
                    location: item.location_name,
                    year: item.year || new Date().getFullYear(),
                    amount: item.amount_due,
                    paid: item.status === 'paid',
                    paidAt: item.paid_at // New
                }))
                setTagihan(mapped)
            }
        } catch (err: any) {
            console.error(err)
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        fetchData()
    }, [])

    const handleToggle = async (id: string, currentStatus: boolean) => {
        const isNowPaid = !currentStatus;
        const now = isNowPaid ? new Date().toISOString() : null;

        // Optimistic UI Update
        const previousData = [...tagihan];
        const newData = tagihan.map(item =>
            item.id === id ? { ...item, paid: isNowPaid, paidAt: now } : item
        )
        setTagihan(newData)

        try {
            const newStatus = isNowPaid ? 'paid' : 'unpaid'
            const { error } = await supabase
                .from('tax_objects')
                .update({
                    status: newStatus,
                    paid_at: now // Update Timestamp
                })
                .eq('id', id)

            if (error) {
                setTagihan(previousData) // Revert
                alert("Gagal update status pembayaran.")
            }
        } catch (err) {
            setTagihan(previousData)
        }
    }

    const filtered = tagihan.filter(t =>
        t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.nop.includes(searchTerm)
    )

    // Helper to format date
    const formatDate = (dateString: string | null) => {
        if (!dateString) return ""
        const d = new Date(dateString)
        return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col gap-2">
                <h2 className="text-2xl font-bold tracking-tight">Eksekusi Pembayaran</h2>
                <p className="text-muted-foreground">Cari WP dan geser toggle untuk mencatat pelunasan (Real-time DB).</p>
            </div>

            <div className="sticky top-0 z-30 pt-2 pb-4 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                <Input
                    placeholder="Scan NOP atau Ketik Nama..."
                    icon={Search}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="shadow-md h-12 text-lg"
                    autoFocus
                />
            </div>

            {isLoading ? (
                <div className="text-center py-12"><Loader2 className="animate-spin inline mr-2" /> Memuat Data Tagihan...</div>
            ) : (
                <div className="grid gap-4">
                    {filtered.map((item) => (
                        <Card key={item.id} className={`transition-all duration-300 ${item.paid ? 'bg-muted/30 border-green-200' : 'opacity-100'}`}>
                            <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <User size={14} className="text-muted-foreground" />
                                        <span className="font-semibold">{item.name}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <MapPin size={14} />
                                        <span>{item.location} • {item.year}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="text-xs font-mono bg-muted inline-block px-2 py-0.5 rounded text-muted-foreground w-fit">
                                            {item.nop}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between sm:justify-end gap-6 w-full sm:w-auto border-t sm:border-t-0 pt-4 sm:pt-0">
                                    <div className="text-right">
                                        <p className="text-sm text-muted-foreground">Total Tagihan</p>
                                        <p className="text-xl font-bold">Rp {Number(item.amount).toLocaleString('id-ID')}</p>

                                        {/* Date Info */}
                                        {item.paid && item.paidAt && (
                                            <div className="text-[10px] text-green-600 flex items-center justify-end gap-1 mt-1">
                                                <CalendarDays size={10} />
                                                Lunas: {formatDate(item.paidAt)}
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex flex-col items-center gap-2 min-w-[80px]">
                                        <Toggle
                                            checked={item.paid}
                                            onCheckedChange={() => handleToggle(item.id, item.paid)}
                                        />
                                        <span className={`text-[10px] font-bold ${item.paid ? 'text-success' : 'text-muted-foreground'}`}>
                                            {item.paid ? 'LUNAS' : 'BELUM'}
                                        </span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                    {filtered.length === 0 && (
                        <div className="text-center py-12 text-muted-foreground">
                            Data tidak ditemukan
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
