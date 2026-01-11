"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { supabase } from "@/lib/supabaseClient"
import { Input } from "@/components/ui/Input"
import { Card, CardContent } from "@/components/ui/Card"
import { Toggle } from "@/components/ui/Toggle"
import { Button } from "@/components/ui/Button"
import { Search, MapPin, Loader2, User, CalendarDays, ChevronDown, ChevronUp, Filter, Users } from "lucide-react"

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
                .order('name', { ascending: true })

            if (error) throw error

            if (data) {
                const groups: WPGroup[] = data.map((citizen: any) => {
                    const objects: TaxObject[] = (citizen.tax_objects || []).map((obj: any) => ({
                        id: obj.id,
                        nop: obj.nop.replace(/[.]/g, ''),
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

    // Handle Toggle Payment
    const handleToggle = async (objectId: string, currentStatus: boolean, citizenId: string) => {
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

    // Filter and Group Logic with Group Member Search
    const filteredResults = useMemo(() => {
        const lowerSearch = searchTerm.toLowerCase().trim()
        const cleanSearch = searchTerm.replace(/[.]/g, '')

        // Helper to check status filter
        const checkStatus = (g: WPGroup) => {
            if (filterStatus === 'unpaid' && g.total_unpaid === 0) return false;
            if (filterStatus === 'paid' && g.total_unpaid > 0) return false;
            return true;
        }

        // If no search term, return simple list (but maybe we should group them too? User asked for search specific behavior)
        // Let's stick to simple list for no search to keep it clean, or applies grouping if desired.
        // For now, if no search, just return all flat (or existing behavior). 
        // ACTUALLY, usually admin wants to see list. Let's keep flat if no search.
        if (!lowerSearch) {
            // For default view, we might not want complex grouping unless requested. 
            // But to be consistent, maybe just stick to flat list or Grouped? 
            // The user request was specific to "saat pencarian".
            // So if no search, return flat list as "singles".
            const filtered = allData.filter(checkStatus)
            return filtered.map(d => ({ type: 'single', data: d, id: d.citizen_id }))
        }

        // 1. Find matched citizens
        const matchedCitizens = allData.filter(g => {
            if (!checkStatus(g)) return false;

            // Name/Address Match
            if (g.name.toLowerCase().includes(lowerSearch)) return true
            if (g.address?.toLowerCase().includes(lowerSearch)) return true

            // NOP Match
            const hasMatchingObject = g.tax_objects.some(obj => obj.nop.includes(cleanSearch))
            return hasMatchingObject
        })

        if (matchedCitizens.length === 0) return []

        // 2. Identify Groups and Orphans
        const matchedGroupIds = new Set<string>()
        const matchedCitizenIds = new Set<string>()

        matchedCitizens.forEach(c => {
            matchedCitizenIds.add(c.citizen_id)
            if (c.group_id) matchedGroupIds.add(c.group_id)
        })

        const finalStructure: any[] = []

        // 3. Handle Groups
        if (matchedGroupIds.size > 0) {
            const groupsMap = new Map<string, WPGroup[]>()
            const groupIdsArr = Array.from(matchedGroupIds)

            // We need to fetch ALL members of these groups from allData, even if they didn't match the search
            // But we must respect the status filter? 
            // Usually "Group View" shows everyone to see the context. 
            // If I filter by "Unpaid", I probably still want to see the "Paid" members of that group?
            // The user said "tampil idah dan keluarganya". Implies context.
            // Let's include all members, but maybe visually dim those who don't match status?
            // Or just filter them out if strict?
            // Let's assume strict filter for now, OR show all but highlight matches.
            // Given the previous code filtered related members by status, I will stick to filtering by status.

            allData.forEach(g => {
                if (g.group_id && matchedGroupIds.has(g.group_id)) {
                    if (checkStatus(g)) { // Only include if matches status filter
                        if (!groupsMap.has(g.group_id)) groupsMap.set(g.group_id, [])
                        groupsMap.get(g.group_id)?.push({
                            ...g,
                            isGroupMember: !matchedCitizenIds.has(g.citizen_id) // Mark as just a member if not a direct match
                        })
                    }
                }
            })

            // Sort Groups
            const sortedGroupIds = Array.from(groupsMap.keys()).sort((a, b) => {
                const numA = parseInt(a) || 999999
                const numB = parseInt(b) || 999999
                return numA - numB
            })

            sortedGroupIds.forEach(gid => {
                const members = groupsMap.get(gid)
                if (members && members.length > 0) {
                    // Sort members: direct matches first
                    members.sort((a, b) => {
                        const aMatch = matchedCitizenIds.has(a.citizen_id)
                        const bMatch = matchedCitizenIds.has(b.citizen_id)
                        if (aMatch && !bMatch) return -1
                        if (!aMatch && bMatch) return 1
                        return 0
                    })
                    finalStructure.push({ type: 'group', id: gid, members })
                }
            })
        }

        // 4. Handle Orphans
        // Citizens who matched search but have no group_id (or their group was filtered out completely?)
        // Basically matchedCitizens who don't have a group_id
        const orphans = matchedCitizens.filter(c => !c.group_id)
        orphans.forEach(c => {
            finalStructure.push({ type: 'single', data: c, id: c.citizen_id })
        })

        return finalStructure
    }, [allData, searchTerm, filterStatus])

    // Pagination Logic
    const totalPages = Math.ceil(filteredResults.length / itemsPerPage)
    const paginatedItems = filteredResults.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    )
    // Find the split point in paginated results
    // Removed old pagination logic to support grouped items
    // const paginatedRelated = ...

    // Reset page on search or filter change
    useEffect(() => {
        setCurrentPage(1)
    }, [searchTerm, filterStatus])

    // Helper to format date
    const formatDate = (dateString: string | null) => {
        if (!dateString) return ""
        const d = new Date(dateString)
        return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    }

    // Render WP Card
    const renderWPCard = (group: WPGroup) => (
        <div key={group.citizen_id} className={`border rounded-xl overflow-hidden shadow-sm transition-all hover:shadow-md ${group.isGroupMember ? 'border-blue-200 dark:border-blue-800 bg-blue-50/30 dark:bg-blue-900/10' : 'bg-card text-card-foreground'}`}>
            {/* WP Header */}
            <div className={`p-4 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${group.isGroupMember ? 'bg-blue-50/50 dark:bg-blue-900/20' : 'bg-muted/30'}`}>
                <div>
                    <div className="flex items-center gap-2 flex-wrap">
                        <div className="flex items-center gap-2">
                            <User size={18} className={group.isGroupMember ? "text-blue-500" : "text-blue-600"} />
                            <span className="font-bold text-lg">{group.name}</span>
                        </div>
                        {group.isGroupMember && (
                            <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
                                KELUARGA
                            </span>
                        )}
                        {group.group_id && (
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600 font-medium whitespace-nowrap">
                                    Group {group.group_id}
                                </span>
                                {groupStats[group.group_id] > 0 && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-destructive/10 text-destructive font-bold whitespace-nowrap" title="Total tunggakan seluruh anggota Group ini">
                                        Total Group: Rp {groupStats[group.group_id].toLocaleString('id-ID')}
                                    </span>
                                )}
                            </div>
                        )}
                    </div>
                    <p className="text-sm text-muted-foreground ml-6 mt-1">
                        {group.address}
                        {(group.rt || group.rw) && (
                            <span className="ml-1 text-[10px] bg-muted px-1 rounded">
                                RT {group.rt ? group.rt.padStart(3, '0') : '-'} / RW {group.rw ? group.rw.padStart(3, '0') : '-'}
                            </span>
                        )}
                    </p>
                </div>
                <div className="text-right">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Sisa Tagihan</p>
                    <p className={`text-xl font-bold font-mono ${group.total_unpaid > 0 ? 'text-destructive' : 'text-success'}`}>
                        Rp {group.total_unpaid.toLocaleString('id-ID')}
                    </p>
                </div>
            </div>

            {/* List of Tax Objects */}
            <div className="divide-y">
                {group.tax_objects.map((item) => (
                    <div key={item.id} className={`p-4 transition-colors ${item.paid ? 'bg-success/10' : 'hover:bg-muted/20'}`}>
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            {/* Item Details */}
                            <div className="flex-1 space-y-1">
                                <div className="flex items-center gap-2 text-sm font-medium">
                                    {item.nop.startsWith('TANPA-NOP') ? (
                                        <span className="bg-orange-50 text-orange-600 border-orange-200 border px-1.5 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider">
                                            NOP BELUM ADA
                                        </span>
                                    ) : (
                                        <span className="bg-muted text-foreground px-2 py-0.5 rounded text-xs font-mono">{item.nop}</span>
                                    )}
                                    <span>{item.location}</span>
                                    <span className="text-muted-foreground">• Thn {item.year}</span>
                                </div>

                                {/* Extra Details: Original Name, Persil, Blok */}
                                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground ml-1">
                                    {item.original_name && (
                                        <span className="flex items-center gap-1">
                                            Ex: <span className="text-foreground/80 font-medium">{item.original_name}</span>
                                        </span>
                                    )}
                                    {item.blok && (
                                        <span className="bg-muted/50 px-1.5 rounded border border-border">
                                            Blok: {item.blok}
                                        </span>
                                    )}
                                    {item.persil && (
                                        <span className="bg-muted/50 px-1.5 rounded border border-border">
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
                                        <div className="text-[10px] text-success flex items-center justify-end gap-1">
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
                                    <span className={`text-[10px] font-bold ${item.paid ? 'text-success' : 'text-muted-foreground'}`}>
                                        {item.paid ? 'LUNAS' : 'BELUM'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )

    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-12">
            <div className="flex flex-col gap-2">
                <h2 className="text-2xl font-bold tracking-tight">Eksekusi Pembayaran</h2>
                <p className="text-muted-foreground">Cari WP dan geser toggle untuk mencatat pelunasan per Kikitir.</p>
            </div>

            <div className="sticky top-0 z-30 pt-2 pb-4 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 space-y-3">
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
            ) : (
                <div className="space-y-6">
                    {/* Grouped Matches */}
                    {paginatedItems.map((item: any) => {
                        if (item.type === 'group') {
                            const groupUnpaid = item.members.reduce((sum: number, m: any) => sum + m.total_unpaid, 0)
                            return (
                                <div key={`group-${item.id}`} className="space-y-3">
                                    <div className="flex items-center justify-between bg-blue-50 dark:bg-blue-900/20 px-4 py-3 rounded-xl border border-blue-100 dark:border-blue-800">
                                        <div className="flex items-center gap-2">
                                            <Users size={18} className="text-blue-600 dark:text-blue-400" />
                                            <span className="font-bold text-blue-800 dark:text-blue-300">Group {item.id}</span>
                                            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100/50 text-blue-700 border border-blue-200">
                                                {item.members.length} Anggota
                                            </span>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Total Group</div>
                                            <div className="font-bold text-blue-700 dark:text-blue-400">Rp {groupUnpaid.toLocaleString('id-ID')}</div>
                                        </div>
                                    </div>

                                    <div className="grid gap-6 pl-2 border-l-2 border-blue-100 dark:border-blue-900/30 ml-4">
                                        {item.members.map((member: WPGroup) => renderWPCard(member))}
                                    </div>
                                </div>
                            )
                        } else {
                            return renderWPCard(item.data)
                        }
                    })}

                    {filteredResults.length === 0 && (
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
        </div>
    )
}
