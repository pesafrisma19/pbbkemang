"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { supabase } from "@/lib/supabaseClient"
import { Input } from "@/components/ui/Input"
import { Button } from "@/components/ui/Button"
import { SimpleAccordion } from "@/components/ui/Accordion"
import { Badge } from "@/components/ui/Badge"
import { Search, Upload, Plus, Pencil, Trash, Loader2, Phone, MessageCircle, FileDown, AlertCircle } from "lucide-react"
import { Modal } from "@/components/ui/Modal"
import * as XLSX from 'xlsx'

// Types
// Types
type Asset = {
    nop: string;
    loc: string;
    tax: number;
    year: number; // New
    status: 'paid' | 'unpaid';
    original_name?: string; // New: Nama Asal
    persil?: string; // New: Persil
    blok?: string; // New: Blok
}

type WPData = {
    id: string; // uuid
    name: string;
    address: string;
    nik?: string;
    whatsapp?: string; // New: WhatsApp
    total_asset: number;
    total_tax: number;
    assets: Asset[];
}

export default function DataWPPage() {
    const [searchTerm, setSearchTerm] = useState("")
    const [isLoading, setIsLoading] = useState(true)

    // Import State
    const [isImporting, setIsImporting] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

    // Modal & Form State
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [modalMode, setModalMode] = useState<'add' | 'edit'>('add')
    const [editingId, setEditingId] = useState<string | null>(null)

    // Updated Form Data to include WA
    const [formData, setFormData] = useState({
        name: "",
        address: "",
        nik: "",
        whatsapp: ""
    })

    const [formAssets, setFormAssets] = useState<Asset[]>([])
    const [newAsset, setNewAsset] = useState<Asset>({
        nop: "", loc: "", tax: 0, year: new Date().getFullYear(), status: 'unpaid',
        original_name: "", persil: "", blok: ""
    })
    const [nopOwnersMap, setNopOwnersMap] = useState<Record<string, { name: string, address: string, tax: number }[]>>({})
    const [detailNop, setDetailNop] = useState<string | null>(null) // For viewing shared details
    const [showAssetForm, setShowAssetForm] = useState(false)
    const [useFastNop, setUseFastNop] = useState(true)

    // Import Result State
    const [isResultModalOpen, setIsResultModalOpen] = useState(false)
    const [importResult, setImportResult] = useState<{
        success: boolean;
        newCitizens: number;
        matchedCitizens: number;
        newAssets: number;
        skipped: number;
        errors: string[];
        message?: string;
    } | null>(null)

    // General Alert State
    const [alertState, setAlertState] = useState<{
        isOpen: boolean;
        title: string;
        message: React.ReactNode;
        type: 'success' | 'error' | 'info';
    }>({ isOpen: false, title: "", message: "", type: 'info' })

    // Delete Confirmation State
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
    const [deleteTarget, setDeleteTarget] = useState<{ id: string, name: string } | null>(null)

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1)
    const itemsPerPage = 10

    const [localData, setLocalData] = useState<WPData[]>([])

    const filteredData = localData.filter(wp =>
        wp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        wp.assets.some(a =>
            a.nop.includes(searchTerm) ||
            (a.original_name && a.original_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (a.persil && a.persil.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (a.blok && a.blok.toLowerCase().includes(searchTerm.toLowerCase()))
        )
    )

    const totalPages = Math.ceil(filteredData.length / itemsPerPage)
    const paginatedData = filteredData.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    )

    // Reset page when search changes
    useEffect(() => {
        setCurrentPage(1)
    }, [searchTerm])

    // --- Excel Handling ---

    const handleDownloadTemplate = () => {
        const headers = [
            "NAMA_WP", "ALAMAT", "NIK", "WHATSAPP", "NOP", "LOKASI_OBJEK", "NOMINAL_PAJAK", "TAHUN_PAJAK", "STATUS_BAYAR",
            "NAMA_ASAL", "PERSIL", "BLOK"
        ]

        // Sample Data:
        // 1. Asep - Full NOP (18 digit numbers only)
        // 2. Budi - Short NOP (4 digit shorthand) -> automatically expands to 3205130005000xxxx7
        const sample = [
            // WP 1: Asep - 1 Kikitir (Full NOP 18 digit)
            ["Asep Saepudin", "Dusun Manis RT 01", "3204123456780001", "081234567890", "320513000500010007", "Sawah Lega", 50000, 2024, "BELUM", "H. Dadang", "10a", "001"],

            // WP 2: Budi - Kikitir 1 (Short NOP 4 digit: 2001 -> 320513000500020017)
            ["Budi Santoso", "Dusun Pahing RT 02", "3204876543210002", "085798765432", "2001", "Rumah Tinggal", 125000, 2024, "LUNAS", "-", "12b", "005"],

            // WP 2: Budi - Kikitir 2 (Short NOP 4 digit: 2002)
            ["Budi Santoso", "Dusun Pahing RT 02", "3204876543210002", "085798765432", "2002", "Kebun Jati", 75000, 2024, "BELUM", "-", "12c", "005"]
        ]

        const wb = XLSX.utils.book_new()
        const ws = XLSX.utils.aoa_to_sheet([headers, ...sample])

        // Auto-width for better visibility
        const wscols = headers.map(() => ({ wch: 20 }))
        ws['!cols'] = wscols

        XLSX.utils.book_append_sheet(wb, ws, "Template_PBB")
        XLSX.writeFile(wb, "Template_Import_PBB.xlsx")
    }

    const processImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return;

        setIsImporting(true)
        const reader = new FileReader()

        reader.onload = async (evt) => {
            try {
                const bstr = evt.target?.result
                const wb = XLSX.read(bstr, { type: 'binary' })
                const wsname = wb.SheetNames[0]
                const ws = wb.Sheets[wsname]
                // Parse with header: 1 to get raw arrays or default to get objects. Using default but ensuring keys match.
                const data = XLSX.utils.sheet_to_json(ws)

                if (data.length === 0) {
                    alert("File Excel kosong!")
                    setIsImporting(false)
                    return
                }

                // Stats
                let newCitizenCount = 0
                let matchedCitizenCount = 0
                let newAssetCount = 0
                let skippedCount = 0
                const errorLog: string[] = []

                // Cache created citizens in this session to minimize API calls for consecutive rows
                // Key: "name|address" -> ID
                const sessionCitizens: Record<string, string> = {}

                for (let i = 0; i < data.length; i++) {
                    const row = data[i] as any
                    const rowNum = i + 2 // Excellence uses 1-based, +1 for header

                    // 1. Parse Fields
                    const nameRaw = row['NAMA_WP']
                    const addressRaw = row['ALAMAT']
                    let nopRaw = row['NOP']
                    const taxRaw = row['NOMINAL_PAJAK']

                    // Validation Message Helpers
                    const missingFields = []
                    if (!nameRaw) missingFields.push("NAMA_WP")
                    if (!addressRaw) missingFields.push("ALAMAT")
                    if (!nopRaw) missingFields.push("NOP")
                    if (!taxRaw) missingFields.push("NOMINAL_PAJAK")

                    if (missingFields.length > 0) {
                        errorLog.push(`Baris ${rowNum}: Data tidak lengkap (${missingFields.join(", ")})`)
                        skippedCount++
                        continue
                    }

                    const name = String(nameRaw).trim()
                    const address = String(addressRaw).trim()
                    const nominal = Number(taxRaw) || 0

                    // NOP Handling: 
                    // 1. Convert to string and strip non-digits (remove dots, etc)
                    let nopClean = String(nopRaw).trim().replace(/\D/g, '')

                    // 2. Expand Short Code logic (if length <= 4)
                    if (nopClean.length <= 4 && nopClean.length > 0) {
                        // Pad with leading zeros if less than 4 digits?? No, usually simple concat. 
                        // User said "1466" -> "320513000500014667"
                        // Pattern: PREFIX (13) + INPUT (4) + SUFFIX (1) = 18 digits.
                        // Only if input is exactly 4 digits or less? Let's assume input matches the "Fast Mode" hole.
                        nopClean = `3205130005000${nopClean}7`
                    }

                    if (nominal <= 0) {
                        errorLog.push(`Baris ${rowNum}: Nominal Pajak 0 atau invalid`)
                        skippedCount++
                        continue
                    }

                    // 2. Find or Create Citizen
                    const citizenKey = `${name.toLowerCase()}|${address.toLowerCase()}`
                    let citizenId = sessionCitizens[citizenKey]

                    // Prepare metadata
                    let phone = row['WHATSAPP'] ? String(row['WHATSAPP']).replace(/\D/g, '') : null
                    // REMOVED: Auto-convert '0' to '62'. Now keeps '0' like manual input.
                    // if (phone && phone.startsWith('0')) phone = '62' + phone.substring(1)

                    if (!citizenId) {
                        // Check Database
                        const { data: existing } = await supabase
                            .from('citizens')
                            .select('id')
                            .eq('name', name)
                            .eq('address', address)
                            .maybeSingle()

                        if (existing) {
                            citizenId = existing.id
                            matchedCitizenCount++
                        } else {
                            // Create New
                            const { data: newCitizen, error: createError } = await supabase
                                .from('citizens')
                                .insert({
                                    name: name,
                                    address: address,
                                    nik: row['NIK'] ? String(row['NIK']).trim() : null,
                                    whatsapp: phone
                                })
                                .select('id')
                                .single()

                            if (createError) {
                                errorLog.push(`Baris ${rowNum}: Gagal buat WP (${createError.message})`)
                                skippedCount++
                                continue
                            }
                            citizenId = newCitizen.id
                            newCitizenCount++
                        }
                        // Save to session cache
                        sessionCitizens[citizenKey] = citizenId
                    } else {
                        // Already processed in this batch (e.g. Row 2 was Budi, Row 3 is Budi again)
                        matchedCitizenCount++
                    }

                    // 3. Upsert Tax Object (Kikitir)
                    if (citizenId) {
                        const statusRaw = String(row['STATUS_BAYAR'] || '').toUpperCase()
                        const status = statusRaw === 'LUNAS' ? 'paid' : 'unpaid'

                        const { error: upsertError } = await supabase
                            .from('tax_objects')
                            .upsert({
                                nop: nopClean,
                                citizen_id: citizenId,
                                location_name: row['LOKASI_OBJEK'] || 'Tanah/Bangunan',
                                amount_due: nominal,
                                year: Number(row['TAHUN_PAJAK']) || new Date().getFullYear(),
                                status: status,
                                original_name: row['NAMA_ASAL'] || null,
                                persil: row['PERSIL'] ? String(row['PERSIL']) : null,
                                blok: row['BLOK'] ? String(row['BLOK']) : null
                            }, { onConflict: 'nop, citizen_id' })

                        if (upsertError) {
                            errorLog.push(`Baris ${rowNum}: Gagal simpan Kikitir/NOP ${nopClean} (${upsertError.message})`)
                            // Don't increment newAssetCount
                        } else {
                            newAssetCount++
                        }
                    }
                }

                // Show Result Modal
                setImportResult({
                    success: true,
                    newCitizens: newCitizenCount,
                    matchedCitizens: matchedCitizenCount,
                    newAssets: newAssetCount,
                    skipped: skippedCount,
                    errors: errorLog
                })
                setIsResultModalOpen(true)

                fetchData()

            } catch (err) {
                console.error("Import Error:", err)
                const msg = err instanceof Error ? err.message : String(err)
                setImportResult({
                    success: false,
                    newCitizens: 0,
                    matchedCitizens: 0,
                    newAssets: 0,
                    skipped: 0,
                    errors: [msg],
                    message: "Gagal memproses file Excel."
                })
                setIsResultModalOpen(true)
            } finally {
                setIsImporting(false)
                if (fileInputRef.current) fileInputRef.current.value = "" // Reset input
            }
        }

        reader.readAsBinaryString(file)
    }

    // 1. Fetch Data from Supabase
    const fetchData = useCallback(async () => {
        setIsLoading(true)
        try {
            const { data, error } = await supabase
                .from('citizens')
                .select(`
                    id, 
                    name, 
                    nik, 
                    address,
                    whatsapp,
                    tax_objects (
                        nop,
                        location_name,
                        amount_due,
                        year,
                        status,
                        original_name,
                        persil,
                        blok
                    )
                `)
                .order('created_at', { ascending: false });

            if (error) throw error;

            if (data) {
                const mapped: WPData[] = data.map((item: any) => ({
                    id: item.id,
                    name: item.name,
                    address: item.address,
                    nik: item.nik,
                    whatsapp: item.whatsapp, // New
                    total_asset: item.tax_objects?.length || 0,
                    total_tax: item.tax_objects?.reduce((sum: number, obj: any) => sum + obj.amount_due, 0) || 0,
                    assets: item.tax_objects?.map((obj: any) => ({
                        nop: String(obj.nop).replace(/\D/g, ''), // CLEAN DISPLAY DOTS
                        loc: obj.location_name,
                        tax: obj.amount_due,
                        year: obj.year || new Date().getFullYear(),
                        status: obj.status,
                        original_name: obj.original_name,
                        persil: obj.persil,
                        blok: obj.blok
                    })) || []
                }))
                // Compute NOP Owners Map
                const ownersMap: Record<string, { name: string, address: string, tax: number }[]> = {}
                mapped.forEach(wp => {
                    wp.assets.forEach(asset => {
                        if (!ownersMap[asset.nop]) ownersMap[asset.nop] = []
                        ownersMap[asset.nop].push({
                            name: wp.name,
                            address: wp.address,
                            tax: asset.tax // Keep track of indiv tax if needed
                        })
                    })
                })
                setNopOwnersMap(ownersMap)
                setLocalData(mapped)
            }
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err)
            console.error("Error fetching data:", msg)
        } finally {
            setIsLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchData()
    }, [fetchData])

    const [editingAssetIndex, setEditingAssetIndex] = useState<number | null>(null)

    // --- Form Handlers ---

    const resetForm = () => {
        setFormData({ name: "", address: "", nik: "", whatsapp: "" })
        setFormAssets([])
        setNewAsset({ nop: "", loc: "", tax: 0, year: new Date().getFullYear(), status: 'unpaid', original_name: "", persil: "", blok: "" })
        setShowAssetForm(false)
        setEditingId(null)
        setEditingAssetIndex(null)
    }

    const handleAddAsset = () => {
        if (!newAsset.nop || !newAsset.tax) return;

        if (editingAssetIndex !== null) {
            // Update Existing
            const updated = [...formAssets]
            updated[editingAssetIndex] = newAsset
            setFormAssets(updated)
            setEditingAssetIndex(null)
        } else {
            // Add New
            setFormAssets([...formAssets, newAsset])
        }

        setNewAsset({ nop: "", loc: "", tax: 0, year: new Date().getFullYear(), status: 'unpaid', original_name: "", persil: "", blok: "" })
        setShowAssetForm(false)
    }

    const handleEditAsset = (idx: number) => {
        setEditingAssetIndex(idx)
        setNewAsset(formAssets[idx])
        setShowAssetForm(true)
    }

    const removeAsset = (idx: number) => {
        const newAssets = [...formAssets]
        newAssets.splice(idx, 1)
        setFormAssets(newAssets)
    }

    const handleSubmit = async () => {
        if (!formData.name || !formData.address) return;
        setIsLoading(true)

        try {
            let citizenId = editingId;

            const payload = {
                name: formData.name,
                nik: formData.nik,
                address: formData.address,
                whatsapp: formData.whatsapp // New
            }

            if (modalMode === 'add') {
                // 1. Insert Citizen
                const { data, error } = await supabase
                    .from('citizens')
                    .insert([payload])
                    .select()
                    .single();

                if (error) throw error;
                citizenId = data.id;

            } else if (modalMode === 'edit' && editingId) {
                // 1. Update Citizen Info
                const { error } = await supabase
                    .from('citizens')
                    .update(payload)
                    .eq('id', editingId)

                if (error) throw error;

                // 2. Sync Assets: Delete Old, Insert New
                const { error: deleteError } = await supabase
                    .from('tax_objects')
                    .delete()
                    .eq('citizen_id', editingId)

                if (deleteError) throw deleteError;
            }

            // 3. Insert All Assets
            if (formAssets.length > 0 && citizenId) {
                const assetsToInsert = formAssets.map(a => ({
                    citizen_id: citizenId,
                    nop: String(a.nop).replace(/\D/g, ''), // Ensure clean save
                    location_name: a.loc,
                    amount_due: a.tax,
                    status: a.status || 'unpaid',
                    year: new Date().getFullYear(),
                    original_name: a.original_name,
                    persil: a.persil,
                    blok: a.blok
                }))

                const { error: assetError } = await supabase
                    .from('tax_objects')
                    .insert(assetsToInsert)

                if (assetError) throw assetError;
            }

            await fetchData()
            setIsModalOpen(false)
            resetForm()

        } catch (err: any) {
            console.error("Submit Error:", err)
            const msg = err?.message || String(err)

            let title = "Gagal Menyimpan"
            let userMsg = msg

            // Custom Error Parsing
            if (msg.includes("duplicate key value") && msg.includes("nik")) {
                title = "NIK Sudah Terdaftar"
                userMsg = "NIK yang Anda masukkan sudah digunakan oleh warga lain. Mohon periksa kembali data Anda atau gunakan pencarian untuk menemukan warga tersebut."
            } else if (msg.includes("violates unique constraint")) {
                title = "Data Duplikat"
                userMsg = "Data dengan informasi unik ini (NIK atau NOP) sudah ada di sistem."
            }

            setAlertState({
                isOpen: true,
                title: title,
                message: userMsg,
                type: 'error'
            })
        } finally {
            setIsLoading(false)
        }
    }

    const confirmDelete = (id: string, name: string) => {
        setDeleteTarget({ id, name })
        setIsDeleteModalOpen(true)
    }

    const executeDelete = async () => {
        if (!deleteTarget) return;
        setIsLoading(true)
        try {
            const { error } = await supabase
                .from('citizens')
                .delete()
                .eq('id', deleteTarget.id)

            if (error) throw error;
            await fetchData()
            setIsDeleteModalOpen(false)
            setDeleteTarget(null)
        } catch (err: any) {
            const msg = err?.message || String(err)
            setAlertState({
                isOpen: true,
                title: "Gagal Menghapus",
                message: "Tidak dapat menghapus data ini. Kemungkinan data sedang digunakan atau ada masalah koneksi.",
                type: 'error'
            })
        } finally {
            setIsLoading(false)
        }
    }

    const handleEditClick = (wp: WPData) => {
        setModalMode('edit')
        setEditingId(wp.id)
        setFormData({
            name: wp.name,
            address: wp.address,
            nik: wp.nik || "",
            whatsapp: wp.whatsapp || "" // New
        })
        setFormAssets(wp.assets)
        setIsModalOpen(true)
    }

    // --- Render ---

    // Helper: Format to Indonesian Country Code
    const getWaLink = (phone: string) => {
        let p = phone.trim().replace(/\D/g, ''); // Digits only
        if (p.startsWith('0')) {
            p = '62' + p.substring(1);
        }
        return `https://wa.me/${p}`;
    }

    const items = paginatedData.map(wp => ({
        id: wp.id,
        title: (
            <div className="flex items-center justify-between w-full pr-4">
                <div className="text-left">
                    <div className="flex items-center gap-2">
                        <p className="font-semibold">{wp.name}</p>
                    </div>
                    <p className="text-xs text-muted-foreground">{wp.address}</p>

                    {/* Search Match Highlight */}
                    {searchTerm && (
                        <div className="mt-1">
                            {wp.assets.map(a => {
                                const matchParts = []
                                const lowerTerm = searchTerm.toLowerCase()
                                // Search against dot-less state
                                if (a.nop.includes(searchTerm)) matchParts.push(`NOP: ${a.nop}`)
                                if (a.original_name?.toLowerCase().includes(lowerTerm)) matchParts.push(`Ex: ${a.original_name}`)
                                if (a.blok?.toLowerCase().includes(lowerTerm)) matchParts.push(`Blok ${a.blok}`)
                                if (a.persil?.toLowerCase().includes(lowerTerm)) matchParts.push(`Persil ${a.persil}`)

                                if (matchParts.length > 0) {
                                    return (
                                        <Badge key={a.nop} variant="outline" className="mr-1 text-[10px] h-4 px-1 font-normal bg-warning/10 text-warning border-warning/20">
                                            {matchParts.join(", ")}
                                        </Badge>
                                    )
                                }
                                return null
                            })}
                        </div>
                    )}
                </div>
                <div className="text-right flex items-center gap-3">
                    <Badge variant="outline" className="hidden sm:inline-flex">{wp.total_asset} Kikitir</Badge>

                    {/* WhatsApp Button */}
                    {wp.whatsapp && (
                        <a
                            href={getWaLink(wp.whatsapp)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bg-success/10 text-success p-1.5 rounded-full hover:bg-success/20 transition-colors"
                            onClick={(e) => e.stopPropagation()}
                            title="Chat WhatsApp"
                        >
                            <MessageCircle size={16} />
                        </a>
                    )}

                    <div>
                        <span className="font-bold text-sm block">Rp {wp.total_tax.toLocaleString('id-ID')}</span>
                    </div>
                </div>
            </div>
        ),
        content: (
            <div className="space-y-3 pt-2 border-t border-border">
                {/* Meta Info */}
                <div className="flex gap-4 text-xs text-muted-foreground pb-2">
                    <div className="flex items-center gap-1">
                        <Phone size={12} /> {wp.whatsapp || "-"}
                    </div>
                    <div>NIK: {wp.nik || "-"}</div>
                </div>

                {wp.assets.length > 0 ? (
                    wp.assets.map((asset, idx) => (
                        <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between bg-muted/30 p-3 rounded-lg gap-2">
                            <div>
                                <p className="text-sm font-medium">
                                    {asset.loc} <span className="text-muted-foreground font-normal text-xs">• Thn {asset.year}</span>
                                </p>
                                <p className="text-xs font-mono text-muted-foreground">
                                    {asset.nop}
                                    {asset.blok && <span className="ml-2 font-sans bg-muted text-foreground px-1 rounded">Blok {asset.blok}</span>}
                                    {asset.persil && <span className="ml-1 font-sans bg-muted text-foreground px-1 rounded">Persil {asset.persil}</span>}

                                    {/* Global Shared Indicator */}
                                    {nopOwnersMap[asset.nop] && nopOwnersMap[asset.nop].length > 1 && (
                                        <button
                                            onClick={(e) => {
                                                e.preventDefault();
                                                setDetailNop(asset.nop)
                                            }}
                                            className="ml-2 inline-flex items-center gap-1 bg-warning/10 text-warning px-1.5 py-0.5 rounded text-[10px] font-sans hover:bg-warning/20 transition-colors"
                                            title="Klik untuk lihat detail pemilik"
                                        >
                                            <div className="w-1.5 h-1.5 rounded-full bg-warning animate-pulse"></div>
                                            {nopOwnersMap[asset.nop].length} Pemilik
                                        </button>
                                    )}
                                </p>
                                {asset.original_name && <p className="text-[10px] text-muted-foreground italic">Ex: {asset.original_name}</p>}
                            </div>
                            <div className="flex items-center justify-between sm:justify-end gap-3 flex-1">
                                <span className="text-sm font-semibold">Rp {asset.tax.toLocaleString('id-ID')}</span>
                                <Badge variant={asset.status === 'paid' ? 'success' : 'destructive'}>
                                    {asset.status === 'paid' ? 'LUNAS' : 'BELUM'}
                                </Badge>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="text-center py-4 text-muted-foreground text-sm">
                        Belum ada data kikitir/tanah.
                    </div>
                )}

                <div className="flex justify-end gap-2 mt-4 pt-2 border-t border-dashed">
                    <Button
                        size="sm"
                        variant="outline"
                        className="h-8 gap-1"
                        onClick={() => handleEditClick(wp)}
                    >
                        <Pencil size={14} /> Edit
                    </Button>
                    <Button
                        size="sm"
                        variant="danger"
                        className="h-8 gap-1"
                        onClick={() => confirmDelete(wp.id, wp.name)}
                    >
                        <Trash size={14} /> Hapus
                    </Button>
                </div>
            </div>
        )
    }))

    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-12">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                    Data Wajib Pajak
                    {isLoading && <Loader2 className="animate-spin h-5 w-5 text-muted-foreground" />}
                </h2>
                <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                    <input
                        type="file"
                        accept=".xlsx, .xls"
                        ref={fileInputRef}
                        className="hidden"
                        onChange={processImport}
                    />

                    <Button
                        variant="secondary"
                        className="gap-2 flex-1 sm:flex-none"
                        onClick={handleDownloadTemplate}
                        title="Download Format Excel"
                    >
                        <FileDown size={16} /> <span className="hidden sm:inline">Format</span>
                    </Button>

                    <Button
                        variant="outline"
                        className="gap-2 flex-1 sm:flex-none"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isImporting}
                    >
                        {isImporting ? <Loader2 className="animate-spin" size={16} /> : <Upload size={16} />}
                        {isImporting ? "Proses..." : "Import Excel"}
                    </Button>
                    <Button
                        className="gap-2 flex-1 sm:flex-none"
                        onClick={() => {
                            setModalMode('add')
                            resetForm()
                            setIsModalOpen(true)
                        }}
                    >
                        <Plus size={16} /> Tambah
                    </Button>
                </div>
            </div>

            <div className="glass-card p-4 rounded-xl flex items-center gap-4">
                <Input
                    placeholder="Cari Nama, NOP, Blok, Persil, atau Nama Asal..."
                    icon={Search}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="bg-background/50 border-none shadow-inner"
                />
            </div>



            {items.length === 0 && !isLoading ? (
                <div className="text-center py-12 text-muted-foreground">
                    Belum ada data. Silakan tambah data baru.
                </div>
            ) : (
                <SimpleAccordion items={items} />
            )}

            {/* Pagination Controls */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between border-t pt-4">
                    <div className="text-sm text-muted-foreground">
                        Halaman {currentPage} dari {totalPages} ({filteredData.length} data)
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

            {/* Main Modal (Add/Edit) */}
            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={modalMode === 'add' ? "Tambah Wajib Pajak Baru" : "Edit Data Wajib Pajak"}
                footer={
                    <>
                        <Button variant="ghost" onClick={() => setIsModalOpen(false)} disabled={isLoading}>Batal</Button>
                        <Button onClick={handleSubmit} disabled={isLoading}>
                            {isLoading ? 'Menyimpan...' : 'Simpan Data'}
                        </Button>
                    </>
                }
            >
                <div className="space-y-4">
                    <div className="space-y-4 border-b pb-4">
                        <h3 className="font-semibold text-sm text-accent-blue">I. Data Diri Warga</h3>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Nama Lengkap</label>
                            <Input
                                placeholder="Contoh: Asep Saepudin"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">NIK (KTP)</label>
                                <Input
                                    placeholder="16 Digit NIK"
                                    value={formData.nik}
                                    onChange={(e) => setFormData({ ...formData, nik: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">No. WhatsApp</label>
                                <Input
                                    placeholder="08xxxxxxxx"
                                    value={formData.whatsapp}
                                    onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
                                    icon={Phone}
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Alamat</label>
                            <Input
                                placeholder="Dusun / Blok"
                                value={formData.address}
                                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="font-semibold text-sm text-accent-orange">II. Data Kikitir/Aset</h3>
                            {!showAssetForm && (
                                <Button size="sm" variant="outline" onClick={() => setShowAssetForm(true)} className="h-7 text-xs">
                                    + Tambah Kikitir
                                </Button>
                            )}
                        </div>

                        {/* List Kikitir in Form */}
                        <div className="space-y-2">
                            {formAssets.map((asset, idx) => (
                                <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between bg-muted/50 p-3 rounded-lg text-sm group hover:bg-muted transition-colors gap-3 sm:gap-2">
                                    <div className="flex-1 w-full sm:w-auto">
                                        <div className="font-medium flex justify-between sm:block">
                                            <span>{asset.loc}</span>
                                            <span className="text-xs text-muted-foreground font-normal sm:ml-1">Thn {asset.year}</span>
                                        </div>
                                        <div className="text-xs text-muted-foreground font-mono flex flex-wrap items-center gap-1 mt-1">
                                            {asset.nop}
                                            {/* Shared Indicator */}
                                            {formAssets.filter(a => a.nop === asset.nop).length > 1 && (
                                                <Badge variant="outline" className="h-4 px-1 text-[10px] bg-blue-100 text-blue-700 hover:bg-blue-100 border-none">
                                                    Shared
                                                </Badge>
                                            )}
                                            {asset.blok && <span className="hidden sm:inline">•</span>}
                                            {asset.blok && <span className="bg-background px-1 rounded border">Blok {asset.blok}</span>}

                                            {asset.persil && <span className="hidden sm:inline">•</span>}
                                            {asset.persil && <span className="bg-background px-1 rounded border">Persil {asset.persil}</span>}
                                        </div>
                                        {asset.original_name && (
                                            <div className="text-[10px] text-muted-foreground italic mt-0.5">
                                                Ex: {asset.original_name}
                                            </div>
                                        )}
                                    </div>

                                    {/* Actions & Price */}
                                    <div className="flex items-center justify-between w-full sm:w-auto sm:justify-end gap-3 border-t sm:border-t-0 pt-2 sm:pt-0 border-border/40">
                                        <span className="font-bold text-foreground">Rp {Number(asset.tax).toLocaleString('id-ID')}</span>
                                        <div className="flex items-center gap-1">
                                            <button
                                                onClick={() => handleEditAsset(idx)}
                                                className="text-blue-600 bg-blue-50 sm:bg-transparent hover:bg-blue-100 p-2 rounded-full transition-colors"
                                                title="Edit Kikitir ini"
                                            >
                                                <Pencil size={16} />
                                            </button>
                                            <button
                                                onClick={() => removeAsset(idx)}
                                                className="text-destructive bg-red-50 sm:bg-transparent hover:bg-red-100 p-2 rounded-full transition-colors"
                                                title="Hapus Kikitir ini"
                                            >
                                                <Trash size={16} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {formAssets.length === 0 && !showAssetForm && (
                                <div className="text-center text-xs text-muted-foreground py-2 border border-dashed rounded-lg">
                                    Belum ada data kikitir
                                </div>
                            )}
                        </div>

                        {/* Form Tambah Kikitir */}
                        {showAssetForm && (
                            <div className="bg-muted/30 p-4 rounded-xl space-y-3 border border-accent-blue/30 animate-in fade-in zoom-in-95">
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <label className="text-xs font-medium">Nomor Objek Pajak (NOP)</label>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-5 text-[10px] px-2"
                                            onClick={() => setUseFastNop(!useFastNop)}
                                        >
                                            {useFastNop ? "Mode Cepat" : "Mode Manual"}
                                        </Button>
                                    </div>
                                    <div className="relative">
                                        {useFastNop ? (
                                            <div className="flex items-center gap-2">
                                                <div className="bg-muted px-2 py-1.5 rounded border text-sm text-muted-foreground font-mono select-none">
                                                    3205130005000
                                                </div>
                                                <Input
                                                    placeholder="1466"
                                                    className="h-9 text-sm font-mono flex-1"
                                                    value={newAsset.nop.replace('3205130005000', '').slice(0, -1)}
                                                    onChange={(e) => {
                                                        const val = e.target.value.replace(/\D/g, '').substring(0, 4)
                                                        // Logic: Prefix + Input + Suffix (7)
                                                        setNewAsset({ ...newAsset, nop: `3205130005000${val}7` })
                                                    }}
                                                />
                                                <div className="bg-muted px-2 py-1.5 rounded border text-sm text-muted-foreground font-mono select-none">
                                                    7
                                                </div>
                                            </div>
                                        ) : (
                                            <Input
                                                placeholder="3205xxxxxxxxxxxxxx"
                                                className="h-9 text-sm"
                                                value={newAsset.nop}
                                                onChange={(e) => setNewAsset({ ...newAsset, nop: e.target.value })}
                                            />
                                        )}
                                    </div>
                                    {useFastNop && (
                                        <p className="text-[10px] text-muted-foreground">
                                            *Otomatis prefix: 3205130005000 & suffix: 7
                                        </p>
                                    )}
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-2">
                                        <label className="text-xs font-medium">Lokasi Tanah</label>
                                        <Input
                                            placeholder="Blok Sawah..."
                                            className="h-9 text-sm"
                                            value={newAsset.loc}
                                            onChange={(e) => setNewAsset({ ...newAsset, loc: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-medium">Nominal Pajak</label>
                                        <Input
                                            type="number"
                                            className="h-9 text-sm"
                                            value={newAsset.tax}
                                            onChange={(e) => setNewAsset({ ...newAsset, tax: Number(e.target.value) })}
                                        />
                                    </div>
                                    <div className="space-y-2 col-span-2">
                                        <label className="text-xs font-medium">Tahun Pajak</label>
                                        <Input
                                            type="number"
                                            className="h-9 text-sm w-full"
                                            value={newAsset.year}
                                            onChange={(e) => setNewAsset({ ...newAsset, year: Number(e.target.value) })}
                                        />
                                    </div>

                                    {/* New Fields */}
                                    <div className="space-y-2 col-span-2 border-t pt-2 mt-1">
                                        <p className="text-xs font-semibold text-muted-foreground">Detail Tambahan (Opsional)</p>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-xs font-medium">Nama Asal/Sebelumnya</label>
                                        <Input
                                            placeholder="Nama pemilik lama..."
                                            className="h-9 text-sm"
                                            value={newAsset.original_name || ""}
                                            onChange={(e) => setNewAsset({ ...newAsset, original_name: e.target.value })}
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-3 col-span-1">
                                        <div className="space-y-2">
                                            <label className="text-xs font-medium">Blok</label>
                                            <Input
                                                placeholder="001"
                                                className="h-9 text-sm"
                                                value={newAsset.blok || ""}
                                                onChange={(e) => setNewAsset({ ...newAsset, blok: e.target.value })}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-xs font-medium">Persil</label>
                                            <Input
                                                placeholder="12a"
                                                className="h-9 text-sm"
                                                value={newAsset.persil || ""}
                                                onChange={(e) => setNewAsset({ ...newAsset, persil: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                </div>
                                <div className="flex gap-2 pt-1">
                                    <Button size="sm" className="w-full" onClick={handleAddAsset}>
                                        {editingAssetIndex !== null ? 'Update List' : 'Simpan ke List'}
                                    </Button>
                                    <Button size="sm" variant="ghost" onClick={() => {
                                        setShowAssetForm(false)
                                        setEditingAssetIndex(null)
                                    }}>Batal</Button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </Modal>

            {/* Delete Confirmation Modal */}
            <Modal
                isOpen={isDeleteModalOpen}
                onClose={() => setIsDeleteModalOpen(false)}
                title="Konfirmasi Hapus"
                footer={
                    <>
                        <Button variant="ghost" onClick={() => setIsDeleteModalOpen(false)} disabled={isLoading}>Batal</Button>
                        <Button variant="danger" onClick={executeDelete} disabled={isLoading}>
                            {isLoading ? 'Menghapus...' : 'Ya, Hapus Data'}
                        </Button>
                    </>
                }
            >
                <div>
                    <div className="flex items-center justify-center p-4">
                        <div className="bg-red-100 p-3 rounded-full animate-in zoom-in">
                            <Trash className="w-8 h-8 text-red-600" />
                        </div>
                    </div>
                    <p className="text-center text-muted-foreground">
                        Apakah Anda yakin ingin menghapus data <strong>{deleteTarget?.name}</strong>?
                    </p>
                    <p className="text-center text-xs text-red-500 mt-2 font-medium">
                        PERINGATAN: Tindakan ini tidak bisa dibatalkan dan semua kikitir milik warga ini akan ikut terhapus.
                    </p>
                </div>
            </Modal>

            {/* Shared NOP Details Modal */}
            <Modal
                isOpen={!!detailNop}
                onClose={() => setDetailNop(null)}
                title="Detail Pemilik Bersama (Shared NOP)"
                footer={
                    <Button onClick={() => setDetailNop(null)}>Tutup</Button>
                }
            >
                {detailNop && nopOwnersMap[detailNop] ? (
                    <div className="space-y-4">
                        <div className="bg-muted p-2 rounded text-xs font-mono text-muted-foreground text-center">
                            NOP: {detailNop}
                        </div>
                        <div className="space-y-2">
                            <p className="text-sm font-medium">Daftar Pemilik:</p>
                            <div className="border rounded-lg divide-y">
                                {nopOwnersMap[detailNop].map((owner, idx) => (
                                    <div key={idx} className="p-3 flex items-center justify-between hover:bg-muted/50">
                                        <div>
                                            <p className="font-semibold text-sm">{owner.name}</p>
                                            <p className="text-xs text-muted-foreground">{owner.address}</p>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-xs font-mono block">Rp {owner.tax.toLocaleString('id-ID')}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Total Summary */}
                            <div className="bg-muted/50 p-3 rounded-lg flex items-center justify-between border">
                                <span className="font-medium text-sm">Total Pajak (Gapok)</span>
                                <span className="font-bold font-mono text-sm">
                                    Rp {nopOwnersMap[detailNop].reduce((sum, owner) => sum + owner.tax, 0).toLocaleString('id-ID')}
                                </span>
                            </div>
                        </div>
                    </div>
                ) : (
                    <p className="text-center text-muted-foreground">Data tidak ditemukan.</p>
                )}
            </Modal>

            {/* Modal: Result Import */}
            <Modal
                isOpen={isResultModalOpen}
                onClose={() => setIsResultModalOpen(false)}
                title="Hasil Import Data"
                footer={
                    <Button onClick={() => setIsResultModalOpen(false)} className="w-full sm:w-auto">
                        Tutup
                    </Button>
                }
            >
                {importResult && (
                    <div className="space-y-6">
                        {/* Summary Cards */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="col-span-2 sm:col-span-1 bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/20 p-3 rounded-xl flex flex-col items-center justify-center text-center">
                                <span className="text-xs font-medium text-green-700 dark:text-green-300 mb-1">Berhasil</span>
                                <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                                    {importResult.newAssets}
                                </div>
                                <span className="text-[10px] text-green-600/80 dark:text-green-400/80">Kikitir Tersimpan</span>
                            </div>
                            <div className="col-span-2 sm:col-span-1 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 p-3 rounded-xl flex flex-col items-center justify-center text-center">
                                <span className="text-xs font-medium text-red-700 dark:text-red-300 mb-1">Gagal/Dilewati</span>
                                <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                                    {importResult.skipped}
                                </div>
                                <span className="text-[10px] text-red-600/80 dark:text-red-400/80">Baris Bermasalah</span>
                            </div>
                        </div>

                        {/* Detailed Stats */}
                        <div className="grid grid-cols-2 gap-4 text-xs">
                            <div className="flex justify-between p-2 rounded bg-muted/50">
                                <span>Warga Baru</span>
                                <span className="font-semibold">{importResult.newCitizens}</span>
                            </div>
                            <div className="flex justify-between p-2 rounded bg-muted/50">
                                <span>Warga Lama (Match)</span>
                                <span className="font-semibold">{importResult.matchedCitizens}</span>
                            </div>
                        </div>

                        {/* Error Log */}
                        {importResult.errors.length > 0 ? (
                            <div className="space-y-2">
                                <div className="flex items-center gap-2 text-sm font-medium text-destructive">
                                    <AlertCircle size={16} />
                                    <span>Rincian Error ({importResult.errors.length})</span>
                                </div>
                                <div className="bg-destructive/5 rounded-lg border border-destructive/20 p-3 text-xs font-mono text-destructive max-h-[150px] overflow-y-auto space-y-1">
                                    {importResult.errors.map((err, i) => (
                                        <div key={i} className="border-b border-destructive/10 last:border-0 pb-1 last:pb-0">
                                            {err}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-4 bg-green-50 dark:bg-green-500/10 rounded-lg border border-green-200 dark:border-green-500/20 text-green-700 dark:text-green-300 text-sm font-medium">
                                ✅ Semua data berhasil diimport tanpa error!
                            </div>
                        )}
                    </div>
                )}
            </Modal>


            {/* Modal: General Alert */}
            <Modal
                isOpen={alertState.isOpen}
                onClose={() => setAlertState({ ...alertState, isOpen: false })}
                title={alertState.title}
                footer={
                    <Button
                        onClick={() => setAlertState({ ...alertState, isOpen: false })}
                        className={`w-full sm:w-auto ${alertState.type === 'error' ? "bg-destructive hover:bg-destructive/90 text-destructive-foreground" : ""}`}
                    >
                        Mengerti
                    </Button>
                }
            >
                <div className="flex flex-col items-center justify-center space-y-4 py-4 text-center">
                    {alertState.type === 'error' && (
                        <div className="bg-red-100 dark:bg-red-900/30 p-4 rounded-full text-red-600 dark:text-red-400 mb-2 ring-8 ring-red-50 dark:ring-red-900/10">
                            <AlertCircle size={48} strokeWidth={1.5} />
                        </div>
                    )}

                    <div className="space-y-2">
                        <p className="text-sm text-foreground/80 leading-relaxed max-w-[90%] mx-auto">
                            {alertState.message}
                        </p>
                    </div>
                </div>
            </Modal>
        </div >
    )
}
