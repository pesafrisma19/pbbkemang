"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { supabase } from "@/lib/supabaseClient"
import { Input } from "@/components/ui/Input"
import { SimpleAccordion } from "@/components/ui/Accordion"
import { Badge } from "@/components/ui/Badge"
import { Toggle } from "@/components/ui/Toggle"
import { Button } from "@/components/ui/Button"
import { Modal } from "@/components/ui/Modal"
import { Search, Loader2, User, CalendarDays, Users, Phone, X, AlertTriangle, CheckCircle } from "lucide-react"

// Grouped Structure
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
    group_id: string | null
    rt: string | null
    rw: string | null
    total_unpaid: number
    tax_objects: TaxObject[]
    isGroupMember?: boolean // Flag for related group members
}

type FilterStatus = 'all' | 'unpaid' | 'paid'

export default function PembayaranPage() {
    const [searchTerm, setSearchTerm] = useState("")
    const [allData, setAllData] = useState<WPGroup[]>([]) // Store all data
    const [isLoading, setIsLoading] = useState(true)
    const [filterStatus, setFilterStatus] = useState<FilterStatus>('unpaid')
    const [filterKampung, setFilterKampung] = useState<string | null>(null)
    const [filterRW, setFilterRW] = useState<string | null>(null)
    const [filterRT, setFilterRT] = useState<string | null>(null)

    // Confirmation Modal State
    const [pendingToggle, setPendingToggle] = useState<{
        objectId: string
        currentStatus: boolean
        citizenId: string
        assetLocation: string
        assetAmount: number
        citizenName: string
    } | null>(null)

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1)
    const itemsPerPage = 10

    // Fetch Data
    const fetchData = useCallback(async () => {
        setIsLoading(true)
        try {
            // Fetch Citizens with their Tax Objects including group_id, rt, rw
            const { data, error } = await supabase
                .from('citizens')
                .select(`
                    id,
                    name,
                    address,
                    group_id,
                    rt,
                    rw,
                    tax_objects (
                        id,
                        nop,
                        location_name,
                        amount_due,
                        status,
                        paid_at,
                        year,
                        original_name,
                        persil,
                        blok
                    )
                `)
                .order('group_id', { ascending: true, nullsFirst: false })
                .order('created_at', { ascending: true })

            if (error) throw error

            if (data) {
                const groups: WPGroup[] = data.map((citizen: any) => {
                    const objects: TaxObject[] = (citizen.tax_objects || []).map((obj: any) => ({
                        id: obj.id,
                        nop: String(obj.nop).startsWith('TANPA-NOP') ? obj.nop : String(obj.nop).replace(/\D/g, ''),
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
                        group_id: citizen.group_id,
                        rt: citizen.rt,
                        rw: citizen.rw,
                        total_unpaid: totalUnpaid,
                        tax_objects: objects
                    }
                })

                const validGroups = groups.filter(g => g.tax_objects.length > 0)
                setAllData(validGroups)
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

    // Request Toggle (opens confirmation modal instead of toggling directly)
    const requestToggle = (objectId: string, currentStatus: boolean, citizenId: string, assetLocation: string, assetAmount: number, citizenName: string) => {
        setPendingToggle({ objectId, currentStatus, citizenId, assetLocation, assetAmount, citizenName })
    }

    // Execute Toggle Payment (called after user confirms)
    const executeToggle = async () => {
        if (!pendingToggle) return;
        const { objectId, currentStatus, citizenId } = pendingToggle;
        setPendingToggle(null); // Close modal immediately

        const isNowPaid = !currentStatus;
        const now = isNowPaid ? new Date().toISOString() : null;

        // Optimistic Update
        const previousData = [...allData];

        const newData = allData.map(group => {
            if (group.citizen_id !== citizenId) return group;

            const newObjects = group.tax_objects.map(obj =>
                obj.id === objectId ? { ...obj, paid: isNowPaid, paidAt: now } : obj
            );

            const newTotalUnpaid = newObjects
                .filter(o => !o.paid)
                .reduce((sum, o) => sum + o.amount, 0);

            return { ...group, tax_objects: newObjects, total_unpaid: newTotalUnpaid };
        });

        setAllData(newData);

        try {
            const newStatus = isNowPaid ? 'paid' : 'unpaid'
            const { error } = await supabase
                .from('tax_objects')
                .update({
                    status: newStatus,
                    paid_at: now
                })
                .eq('id', objectId)

            if (error) {
                setAllData(previousData)
                alert("Gagal update status pembayaran.")
            }
        } catch (err) {
            setAllData(previousData)
            console.error(err)
        }
    }


    // Calculate Group Stats
    const groupStats = useMemo(() => {
        const stats: Record<string, number> = {}
        allData.forEach(g => {
            if (g.group_id) {
                stats[g.group_id] = (stats[g.group_id] || 0) + g.total_unpaid
            }
        })
        return stats
    }, [allData])

    // Unique Kampungs, RWs, RTs
    const uniqueKampungs = useMemo(() => {
        const set = new Set<string>()
        allData.forEach(d => {
            if (d.address) set.add(d.address.trim())
        })
        return Array.from(set).sort()
    }, [allData])

    const uniqueRWs = useMemo(() => {
        const set = new Set<string>()
        allData.forEach(d => {
            if ((!filterKampung || d.address === filterKampung) && d.rw) set.add(d.rw.trim())
        })
        return Array.from(set).sort((a, b) => Number(a) - Number(b))
    }, [allData, filterKampung])

    const uniqueRTs = useMemo(() => {
        const set = new Set<string>()
        allData.forEach(d => {
            if ((!filterKampung || d.address === filterKampung) && (!filterRW || d.rw === filterRW) && d.rt) set.add(d.rt.trim())
        })
        return Array.from(set).sort((a, b) => Number(a) - Number(b))
    }, [allData, filterKampung, filterRW])

    useEffect(() => {
        setFilterRW(null)
        setFilterRT(null)
    }, [filterKampung])

    useEffect(() => {
        setFilterRT(null)
    }, [filterRW])

    const filteredResults = useMemo(() => {
        const lowerSearch = searchTerm.toLowerCase().trim()
        const cleanSearch = searchTerm.replace(/\D/g, '')

        const matchedGroupKeys = new Set<string>()

        if (lowerSearch) {
            allData.forEach(wp => {
                const matchSearch = wp.name.toLowerCase().includes(lowerSearch) ||
                    (wp.address?.toLowerCase().includes(lowerSearch)) ||
                    (wp.group_id && wp.group_id.toLowerCase().includes(lowerSearch)) ||
                    wp.tax_objects.some(obj =>
                        (cleanSearch && obj.nop.includes(cleanSearch)) ||
                        (obj.original_name && obj.original_name.toLowerCase().includes(lowerSearch)) ||
                        (obj.persil && obj.persil.toLowerCase().includes(lowerSearch)) ||
                        (obj.blok && obj.blok.toLowerCase().includes(lowerSearch))
                    )
                if (matchSearch && wp.group_id) {
                    matchedGroupKeys.add(`${wp.group_id}-${wp.address}`)
                }
            })
        }

        const checkStatus = (g: WPGroup) => {
            if (filterStatus === 'unpaid' && g.total_unpaid === 0) return false;
            if (filterStatus === 'paid' && g.total_unpaid > 0) return false;
            return true;
        }

        const checkArea = (g: WPGroup) => {
            if (filterKampung && g.address !== filterKampung) return false;
            if (filterRW && g.rw !== filterRW) return false;
            if (filterRT && g.rt !== filterRT) return false;
            return true;
        }

        const filteredCitizens = allData.filter(g => {
            if (!checkArea(g) || !checkStatus(g)) return false;

            if (!lowerSearch) return true;

            const groupKey = g.group_id ? `${g.group_id}-${g.address}` : null;
            if (groupKey && matchedGroupKeys.has(groupKey)) return true;

            // Jika dia single atau orphan, cek apakah dia cocok persis
            const matchSearch = g.name.toLowerCase().includes(lowerSearch) ||
                (g.address?.toLowerCase().includes(lowerSearch)) ||
                (g.group_id && g.group_id.toLowerCase().includes(lowerSearch)) ||
                g.tax_objects.some(obj =>
                    (cleanSearch && obj.nop.includes(cleanSearch)) ||
                    (obj.original_name && obj.original_name.toLowerCase().includes(lowerSearch)) ||
                    (obj.persil && obj.persil.toLowerCase().includes(lowerSearch)) ||
                    (obj.blok && obj.blok.toLowerCase().includes(lowerSearch))
                )
            
            return matchSearch;
        })

        const groupedData: any[] = [];
        const groupsMap = new Map<string, WPGroup[]>();
        const orphans: WPGroup[] = [];

        filteredCitizens.forEach(wp => {
            if (wp.group_id) {
                const groupKey = `${wp.group_id}-${wp.address}`;
                if (!groupsMap.has(groupKey)) groupsMap.set(groupKey, []);
                groupsMap.get(groupKey)?.push(wp);
            } else {
                orphans.push(wp);
            }
        });

        const sortedGroupKeys = Array.from(groupsMap.keys()).sort((a, b) => {
            const idA = a.split('-')[0];
            const idB = b.split('-')[0];
            return String(idA).localeCompare(String(idB), undefined, { numeric: true });
        });

        sortedGroupKeys.forEach(gk => {
            groupedData.push({ type: 'group', id: gk, members: groupsMap.get(gk) });
        });
        orphans.forEach(wp => {
            groupedData.push({ type: 'single', wp });
        });

        return groupedData;
    }, [allData, searchTerm, filterStatus, filterKampung, filterRW, filterRT])

    // Pagination Logic
    const totalPages = Math.ceil(filteredResults.length / itemsPerPage)
    const paginatedItems = filteredResults.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    )
    // Prepare items for SimpleAccordion
    
    // Reset page on search or filter change
    useEffect(() => {
        setCurrentPage(1)
    }, [searchTerm, filterStatus, filterKampung, filterRW, filterRT])

    // Helper to format date
    const formatDate = (dateString: string | null) => {
        if (!dateString) return ""
        const d = new Date(dateString)
        return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    }

    const items = paginatedItems.map((item: any) => {
        if (item.type === 'group') {
            const members = item.members as WPGroup[];
            const primaryWp = members[0];
            const displayGroupId = item.id.split('-')[0];
            const address = primaryWp.address;
            const totalUnpaid = members.reduce((sum, m) => sum + m.total_unpaid, 0);

            return {
                id: `group-${item.id}`,
                title: (
                    <div className="flex items-center justify-between w-full pr-4">
                        <div className="text-left">
                            <div className="flex items-center gap-2">
                                <Users size={16} className="text-blue-600 hidden sm:block" />
                                <p className="font-semibold">{primaryWp.name}</p>
                                <Badge variant="outline" className="text-[10px] h-5 px-1 bg-blue-50 text-blue-700 border-blue-200">
                                    Grp {displayGroupId}
                                </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                {address} • {members.length} Warga
                            </p>
                        </div>
                        <div className="text-right flex flex-col items-end gap-1">
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Sisa Tagihan</p>
                            <span className={`font-bold text-sm block ${totalUnpaid > 0 ? 'text-destructive' : 'text-success'}`}>
                                Rp {totalUnpaid.toLocaleString('id-ID')}
                            </span>
                        </div>
                    </div>
                ),
                content: (
                    <div className="space-y-4 pt-3 border-t border-border mt-2">
                        {members.map(wp => (
                            <div key={wp.citizen_id} className="bg-background rounded-xl border border-border/50 p-4 shadow-sm">
                                <div className="flex justify-between items-start border-b pb-3 mb-3 bg-muted/20 -mx-4 -mt-4 p-4 rounded-t-xl">
                                    <div className="flex items-center gap-2">
                                        <User size={16} className="text-blue-600" />
                                        <p className="font-semibold text-sm">{wp.name}</p>
                                    </div>
                                    <div className="text-right">
                                        <span className={`font-bold text-sm ${wp.total_unpaid > 0 ? 'text-destructive' : 'text-success'}`}>
                                            Menunggak Rp {wp.total_unpaid.toLocaleString('id-ID')}
                                        </span>
                                    </div>
                                </div>
                                
                                {wp.tax_objects.length > 0 ? (
                                    <div className="space-y-2">
                                        {wp.tax_objects.map((asset) => (
                                            <div key={asset.id} className={`flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg gap-3 border transition-colors ${asset.paid ? 'bg-success/10 border-success/20' : 'bg-muted/40'}`}>
                                                <div className="flex-1">
                                                    <p className="text-xs font-medium">{asset.location} <span className="text-muted-foreground font-normal text-[10px]">• Thn {asset.year}</span></p>
                                                    <p className="text-[10px] font-mono text-muted-foreground flex gap-1 mt-0.5 whitespace-nowrap overflow-x-auto">
                                                        {asset.nop.startsWith('TANPA-NOP') ? (
                                                            <span className="bg-orange-50 text-orange-600 border-orange-200 border px-1.5 py-0.5 rounded text-[9px] uppercase font-bold tracking-wider">
                                                                NOP BELUM ADA
                                                            </span>
                                                        ) : (
                                                            <span>{asset.nop}</span>
                                                        )}
                                                        {asset.blok && <span>• Blok {asset.blok}</span>}
                                                        {asset.persil && <span>• Persil {asset.persil}</span>}
                                                    </p>
                                                    {asset.original_name && <p className="text-[10px] font-semibold italic mt-0.5">Ex: {asset.original_name}</p>}
                                                </div>
                                                <div className="flex items-center justify-between sm:justify-end gap-4 flex-1">
                                                    <div className="text-right min-w-[90px]">
                                                        <span className="text-sm font-bold block">Rp {Number(asset.amount).toLocaleString('id-ID')}</span>
                                                        {asset.paid && asset.paidAt && (
                                                            <div className="text-[9px] text-success flex items-center justify-end gap-1 mt-0.5">
                                                                <CalendarDays size={9} />
                                                                {formatDate(asset.paidAt)}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="flex flex-col items-center gap-1 min-w-[70px]">
                                                        <Toggle
                                                            checked={asset.paid}
                                                            onCheckedChange={() => requestToggle(asset.id, asset.paid, wp.citizen_id, asset.location, asset.amount, wp.name)}
                                                        />
                                                        <span className={`text-[9px] font-bold ${asset.paid ? 'text-success' : 'text-muted-foreground'}`}>
                                                            {asset.paid ? 'LUNAS' : 'BELUM'}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-2 text-muted-foreground text-xs">Belum ada aset.</div>
                                )}
                            </div>
                        ))}
                    </div>
                )
            }
        } else {
            const wp = item.wp as WPGroup;
            return {
                id: wp.citizen_id,
                title: (
                    <div className="flex items-center justify-between w-full pr-4">
                        <div className="text-left">
                            <div className="flex items-center gap-2">
                                <p className="font-semibold">{wp.name}</p>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                {wp.address}
                                {(wp.rt || wp.rw) && (
                                    <span className="ml-1 text-[10px] bg-muted px-1 rounded">
                                        {wp.rt && `RT ${wp.rt}`} {wp.rw && `/ RW ${wp.rw}`}
                                    </span>
                                )}
                            </p>
                        </div>
                        <div className="text-right flex flex-col items-end gap-1">
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Sisa Tagihan</p>
                            <span className={`font-bold text-sm block ${wp.total_unpaid > 0 ? 'text-destructive' : 'text-success'}`}>
                                Rp {wp.total_unpaid.toLocaleString('id-ID')}
                            </span>
                        </div>
                    </div>
                ),
                content: (
                    <div className="space-y-3 pt-2 border-t border-border mt-2">
                        {wp.tax_objects.length > 0 ? (
                            wp.tax_objects.map((asset) => (
                                <div key={asset.id} className={`flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg gap-3 border transition-colors ${asset.paid ? 'bg-success/10 border-success/20' : 'bg-muted/40'}`}>
                                    <div className="flex-1">
                                        <p className="text-xs font-medium">{asset.location} <span className="text-muted-foreground font-normal text-[10px]">• Thn {asset.year}</span></p>
                                        <p className="text-[10px] font-mono text-muted-foreground flex gap-1 mt-0.5 whitespace-nowrap overflow-x-auto">
                                            {asset.nop.startsWith('TANPA-NOP') ? (
                                                <span className="bg-orange-50 text-orange-600 border-orange-200 border px-1.5 py-0.5 rounded text-[9px] uppercase font-bold tracking-wider">
                                                    NOP BELUM ADA
                                                </span>
                                            ) : (
                                                <span>{asset.nop}</span>
                                            )}
                                        </p>
                                    </div>
                                    <div className="flex items-center justify-between sm:justify-end gap-4 flex-1">
                                        <div className="text-right min-w-[90px]">
                                            <span className="text-sm font-bold block">Rp {Number(asset.amount).toLocaleString('id-ID')}</span>
                                            {asset.paid && asset.paidAt && (
                                                <div className="text-[9px] text-success flex items-center justify-end gap-1 mt-0.5">
                                                    <CalendarDays size={9} />
                                                    {formatDate(asset.paidAt)}
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex flex-col items-center gap-1 min-w-[70px]">
                                            <Toggle
                                                checked={asset.paid}
                                                onCheckedChange={() => requestToggle(asset.id, asset.paid, wp.citizen_id, asset.location, asset.amount, wp.name)}
                                            />
                                            <span className={`text-[9px] font-bold ${asset.paid ? 'text-success' : 'text-muted-foreground'}`}>
                                                {asset.paid ? 'LUNAS' : 'BELUM'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="text-center py-2 text-muted-foreground text-xs">Belum ada aset.</div>
                        )}
                    </div>
                )
            }
        }
    })

    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-12">
            <div className="flex flex-col gap-2">
                <h2 className="text-2xl font-bold tracking-tight">Eksekusi Pembayaran</h2>
                <p className="text-muted-foreground">Cari WP dan geser toggle untuk mencatat pelunasan per Kikitir.</p>
            </div>

            <div className="sticky top-0 z-30 pt-2 pb-4 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 space-y-3">
                {/* Area Filters */}
                <div className="flex flex-col gap-2">
                    {uniqueKampungs.length > 0 && (
                        <div className="flex flex-wrap gap-2 items-center">
                            <span className="text-sm font-semibold mr-2 text-muted-foreground w-20">Kampung:</span>
                            <Button
                                variant={filterKampung === null ? "primary" : "outline"}
                                size="sm"
                                className="h-8 rounded-full"
                                onClick={() => setFilterKampung(null)}
                            >
                                <X size={14} className="mr-1" /> Semua
                            </Button>
                            {uniqueKampungs.map(k => (
                                <Button
                                    key={String(k)}
                                    variant={filterKampung === k ? "primary" : "outline"}
                                    size="sm"
                                    className="h-8 rounded-full"
                                    onClick={() => setFilterKampung(String(k))}
                                >
                                    {String(k)}
                                </Button>
                            ))}
                        </div>
                    )}
                    {uniqueRWs.length > 0 && (
                        <div className="flex flex-wrap gap-2 items-center">
                            <span className="text-sm font-semibold mr-2 text-muted-foreground w-20">RW:</span>
                            <Button
                                variant={filterRW === null ? "primary" : "outline"}
                                size="sm"
                                className="h-8 rounded-full"
                                onClick={() => setFilterRW(null)}
                            >
                                <X size={14} className="mr-1" /> Semua
                            </Button>
                            {uniqueRWs.map(rw => (
                                <Button
                                    key={String(rw)}
                                    variant={filterRW === rw ? "primary" : "outline"}
                                    size="sm"
                                    className="h-8 rounded-full"
                                    onClick={() => setFilterRW(String(rw))}
                                >
                                    {String(rw)}
                                </Button>
                            ))}
                        </div>
                    )}
                    {uniqueRTs.length > 0 && (
                        <div className="flex flex-wrap gap-2 items-center">
                            <span className="text-sm font-semibold mr-2 text-muted-foreground w-20">RT:</span>
                            <Button
                                variant={filterRT === null ? "primary" : "outline"}
                                size="sm"
                                className="h-8 rounded-full"
                                onClick={() => setFilterRT(null)}
                            >
                                <X size={14} className="mr-1" /> Semua
                            </Button>
                            {uniqueRTs.map(rt => (
                                <Button
                                    key={String(rt)}
                                    variant={filterRT === rt ? "primary" : "outline"}
                                    size="sm"
                                    className="h-8 rounded-full"
                                    onClick={() => setFilterRT(String(rt))}
                                >
                                    {String(rt)}
                                </Button>
                            ))}
                        </div>
                    )}
                </div>
                
                {/* Search Bar */}
                <Input
                    placeholder="Scan NOP atau Ketik Nama..."
                    icon={Search}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="shadow-md h-12 text-lg"
                />

                {/* Filter Tabs */}
                <div className="flex p-1 bg-muted/50 rounded-lg border w-full sm:w-fit">
                    <button
                        onClick={() => setFilterStatus('all')}
                        className={`flex-1 sm:flex-none px-4 py-1.5 text-sm font-medium rounded-md transition-all ${filterStatus === 'all'
                            ? 'bg-background text-foreground shadow-sm'
                            : 'text-muted-foreground hover:bg-background/50'
                            }`}
                    >
                        Semua
                    </button>
                    <button
                        onClick={() => setFilterStatus('unpaid')}
                        className={`flex-1 sm:flex-none px-4 py-1.5 text-sm font-medium rounded-md transition-all ${filterStatus === 'unpaid'
                            ? 'bg-red-100 text-red-700 shadow-sm border border-red-200'
                            : 'text-muted-foreground hover:bg-background/50'
                            }`}
                    >
                        Belum Lunas
                    </button>
                    <button
                        onClick={() => setFilterStatus('paid')}
                        className={`flex-1 sm:flex-none px-4 py-1.5 text-sm font-medium rounded-md transition-all ${filterStatus === 'paid'
                            ? 'bg-green-100 text-green-700 shadow-sm border border-green-200'
                            : 'text-muted-foreground hover:bg-background/50'
                            }`}
                    >
                        Lunas
                    </button>
                </div>
            </div>

            {isLoading ? (
                <div className="text-center py-12"><Loader2 className="animate-spin inline mr-2" /> Memuat Data Tagihan...</div>
            ) : items.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                    Data tidak ditemukan
                </div>
            ) : (
                <SimpleAccordion items={items} />
            )}

            {/* Pagination Controls */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between border-t border-dashed pt-6 mt-6">
                    <div className="text-sm text-muted-foreground">
                        Halaman {currentPage} dari {totalPages} ({filteredResults.length} WP)
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

            {/* Confirmation Modal */}
            <Modal
                isOpen={!!pendingToggle}
                onClose={() => setPendingToggle(null)}
                title={pendingToggle?.currentStatus ? 'Batalkan Pelunasan?' : 'Konfirmasi Pelunasan'}
                footer={
                    <>
                        <Button variant="outline" onClick={() => setPendingToggle(null)}>
                            Batal
                        </Button>
                        <Button
                            variant={pendingToggle?.currentStatus ? 'danger' : 'primary'}
                            onClick={executeToggle}
                        >
                            {pendingToggle?.currentStatus ? 'Ya, Batalkan' : 'Ya, Lunaskan'}
                        </Button>
                    </>
                }
            >
                {pendingToggle && (
                    <div className="space-y-4">
                        <div className={`flex items-start gap-3 p-4 rounded-xl border ${pendingToggle.currentStatus ? 'bg-destructive/5 border-destructive/20' : 'bg-success/5 border-success/20'}`}>
                            {pendingToggle.currentStatus ? (
                                <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                            ) : (
                                <CheckCircle className="w-5 h-5 text-success shrink-0 mt-0.5" />
                            )}
                            <div>
                                <p className="font-semibold text-foreground">
                                    {pendingToggle.currentStatus
                                        ? 'Ubah status kembali menjadi BELUM BAYAR?'
                                        : 'Tandai sebagai LUNAS?'}
                                </p>
                                <p className="text-sm text-muted-foreground mt-1">
                                    {pendingToggle.currentStatus
                                        ? 'Status pelunasan akan dibatalkan dan dicatat sebagai tunggakan kembali.'
                                        : 'Aset akan ditandai lunas dengan waktu pencatatan saat ini.'}
                                </p>
                            </div>
                        </div>

                        <div className="bg-muted/30 rounded-xl p-4 space-y-2">
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Nama WP</span>
                                <span className="font-semibold text-foreground">{pendingToggle.citizenName}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Lokasi Aset</span>
                                <span className="font-medium text-foreground">{pendingToggle.assetLocation}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Jumlah</span>
                                <span className="font-bold text-foreground">Rp {pendingToggle.assetAmount.toLocaleString('id-ID')}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Status Baru</span>
                                <span className={`font-bold ${pendingToggle.currentStatus ? 'text-destructive' : 'text-success'}`}>
                                    {pendingToggle.currentStatus ? 'BELUM BAYAR' : 'LUNAS'}
                                </span>
                            </div>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    )
}
