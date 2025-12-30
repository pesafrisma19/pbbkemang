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
    const [showAssetForm, setShowAssetForm] = useState(false)

    // Delete Confirmation State
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
    const [deleteTarget, setDeleteTarget] = useState<{ id: string, name: string } | null>(null)

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1)
    const itemsPerPage = 10

    const [localData, setLocalData] = useState<WPData[]>([])

    const filteredData = localData.filter(wp =>
        wp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        wp.assets.some(a => a.nop.includes(searchTerm))
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
        const sample = [
            ["Asep Saepudin", "Dusun Manis RT 01", "3204...", "0812...", "32.04.123...", "Sawah Lega", 50000, 2024, "BELUM", "H. Dadang", "10a", "001"],
            ["Budi Santoso", "Dusun Pahing RT 02", "3204...", "0857...", "32.04.456...", "Rumah Tinggal", 125000, 2024, "LUNAS", "-", "12b", "005"]
        ]

        const wb = XLSX.utils.book_new()
        const ws = XLSX.utils.aoa_to_sheet([headers, ...sample])
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
                const data = XLSX.utils.sheet_to_json(ws)

                if (data.length === 0) {
                    alert("File Excel kosong!")
                    setIsImporting(false)
                    return
                }

                // Process Data Row by Row
                let successCount = 0
                let newCitizenCount = 0
                let matchedCitizenCount = 0 // New
                let newAssetCount = 0

                for (const row of data as any[]) {
                    const nameRaw = row['NAMA_WP']
                    const nopRaw = row['NOP']

                    if (!nameRaw || !nopRaw) continue;

                    const name = String(nameRaw).trim()
                    const address = row['ALAMAT'] ? String(row['ALAMAT']).trim() : '-'
                    const nop = String(nopRaw).replace(/['"]/g, '').trim()

                    // 1. Find or Create Citizen
                    let citizenId = null

                    // Cleanup phone
                    let phone = row['WHATSAPP'] ? String(row['WHATSAPP']).replace(/\D/g, '') : null
                    if (phone && phone.startsWith('0')) phone = '62' + phone.substring(1)

                    const citizenPayload = {
                        name: name,
                        address: address,
                        nik: row['NIK'] ? String(row['NIK']).trim() : null,
                        whatsapp: phone
                    }

                    // Try to find existing citizen first
                    const { data: existing, error: findError } = await supabase
                        .from('citizens')
                        .select('id')
                        .eq('name', name) // We use exact match
                        .eq('address', address)
                        .maybeSingle()

                    if (existing) {
                        citizenId = existing.id
                        matchedCitizenCount++
                    } else {
                        const { data: newCitizen, error: createError } = await supabase
                            .from('citizens')
                            .insert(citizenPayload)
                            .select('id')
                            .single()

                        if (!createError) {
                            citizenId = newCitizen.id
                            newCitizenCount++
                        }
                    }

                    // 2. Upsert Tax Object
                    if (citizenId) {
                        const statusRaw = String(row['STATUS_BAYAR'] || '').toUpperCase()
                        const status = statusRaw === 'LUNAS' ? 'paid' : 'unpaid'

                        // Parse nominal (handle formatted strings if any)
                        const nominal = Number(row['NOMINAL_PAJAK']) || 0

                        await supabase
                            .from('tax_objects')
                            .upsert({
                                nop: nop,
                                citizen_id: citizenId,
                                location_name: row['LOKASI_OBJEK'] || 'Tanah/Bangunan',
                                amount_due: nominal,
                                year: Number(row['TAHUN_PAJAK']) || new Date().getFullYear(),
                                status: status,
                                original_name: row['NAMA_ASAL'] || null,
                                persil: row['PERSIL'] ? String(row['PERSIL']) : null,
                                blok: row['BLOK'] ? String(row['BLOK']) : null
                            }, { onConflict: 'nop' })

                        newAssetCount++
                        successCount++
                    }
                }

                alert(`Import Selesai!\n- Warga Baru: ${newCitizenCount}\n- Warga Lama (Match): ${matchedCitizenCount}\n- Total Aset/Kikitir Diproses: ${newAssetCount}`)
                fetchData() // Refresh list

            } catch (err) {
                console.error("Import Error:", err)
                const msg = err instanceof Error ? err.message : String(err)
                alert("Gagal import file: " + msg)
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
                        nop: obj.nop,
                        loc: obj.location_name,
                        tax: obj.amount_due,
                        year: obj.year || new Date().getFullYear(),
                        status: obj.status,
                        original_name: obj.original_name,
                        persil: obj.persil,
                        blok: obj.blok
                    })) || []
                }))
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

    // --- Form Handlers ---

    const resetForm = () => {
        setFormData({ name: "", address: "", nik: "", whatsapp: "" })
        setFormAssets([])
        setNewAsset({ nop: "", loc: "", tax: 0, year: new Date().getFullYear(), status: 'unpaid', original_name: "", persil: "", blok: "" })
        setShowAssetForm(false)
        setEditingId(null)
    }

    const handleAddAsset = () => {
        if (!newAsset.nop || !newAsset.tax) return;
        setFormAssets([...formAssets, newAsset])
        setNewAsset({ nop: "", loc: "", tax: 0, year: new Date().getFullYear(), status: 'unpaid' })
        setShowAssetForm(false)
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
                    nop: a.nop,
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

        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err)
            alert("Terjadi kesalahan database: " + msg)
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
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err)
            alert("Gagal menghapus: " + msg)
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
                        {/* Optional Badge for WA presence */}
                    </div>
                    <p className="text-xs text-muted-foreground">{wp.address}</p>
                </div>
                <div className="text-right flex items-center gap-3">
                    <Badge variant="outline" className="hidden sm:inline-flex">{wp.total_asset} Kikitir</Badge>

                    {/* WhatsApp Button */}
                    {wp.whatsapp && (
                        <a
                            href={getWaLink(wp.whatsapp)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bg-green-100 text-green-600 p-1.5 rounded-full hover:bg-green-200 transition-colors"
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
            <div className="space-y-3 pt-2 border-t">
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
                                    {asset.blok && <span className="ml-2 font-sans bg-slate-100 px-1 rounded">Blok {asset.blok}</span>}
                                    {asset.persil && <span className="ml-1 font-sans bg-slate-100 px-1 rounded">Persil {asset.persil}</span>}
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
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                    Data Wajib Pajak
                    {isLoading && <Loader2 className="animate-spin h-5 w-5 text-muted-foreground" />}
                </h2>
                <div className="flex gap-2 w-full sm:w-auto">
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
                    placeholder="Cari Nama atau NOP..."
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
                <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
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
                                <div key={idx} className="flex items-center justify-between bg-muted/50 p-2 rounded-lg text-sm group hover:bg-muted transition-colors">
                                    <div className="flex-1">
                                        <div className="font-medium">
                                            {asset.loc} <span className="text-xs text-muted-foreground font-normal">({asset.year})</span>
                                        </div>
                                        <div className="text-xs text-muted-foreground font-mono">
                                            {asset.nop}
                                            {asset.blok && ` • Blok ${asset.blok}`}
                                            {asset.persil && ` • Persil ${asset.persil}`}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="font-bold">Rp {Number(asset.tax).toLocaleString('id-ID')}</span>
                                        <button
                                            onClick={() => removeAsset(idx)}
                                            className="text-destructive hover:bg-red-100 p-2 rounded-full transition-colors"
                                            title="Hapus Kikitir ini"
                                        >
                                            <Trash size={16} />
                                        </button>
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
                                    <label className="text-xs font-medium">Nomor Objek Pajak (NOP)</label>
                                    <Input
                                        placeholder="32.04.xxx..."
                                        className="h-9 text-sm"
                                        value={newAsset.nop}
                                        onChange={(e) => setNewAsset({ ...newAsset, nop: e.target.value })}
                                    />
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
                                    <Button size="sm" className="w-full" onClick={handleAddAsset}>Simpan ke List</Button>
                                    <Button size="sm" variant="ghost" onClick={() => setShowAssetForm(false)}>Batal</Button>
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
        </div>
    )
}
