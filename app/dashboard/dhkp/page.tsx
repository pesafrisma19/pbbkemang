"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { supabase } from "@/lib/supabaseClient"
import { Input } from "@/components/ui/Input"
import { Button } from "@/components/ui/Button"
import { Search, Upload, FileDown, Loader2, Database, AlertCircle, Edit, Trash } from "lucide-react"
import { Modal } from "@/components/ui/Modal"
import * as XLSX from 'xlsx'

type DhkpRecord = {
    id: string;
    nop: string;
    nama_wp: string;
    alamat_wp: string;
    alamat_op: string;
    rt_op: string | null;
    rw_op: string | null;
    luas_bumi: number;
    luas_bangunan: number;
    ketetapan: number;
    blok: string | null;
    persil: string | null;
    kadus: string | null;
    kelas: string | null;
    tahun_pajak: string | null;
}

export default function DhkpAdminPage() {
    const [dhkpQuery, setDhkpQuery] = useState("")
    const [isLoading, setIsLoading] = useState(false)
    const [dhkpResults, setDhkpResults] = useState<DhkpRecord[]>([])
    const [totalCount, setTotalCount] = useState(0)

    // Pagination
    const [currentPage, setCurrentPage] = useState(1)
    const itemsPerPage = 50

    // Import State
    const [isImporting, setIsImporting] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const [isResultModalOpen, setIsResultModalOpen] = useState(false)
    const [importResult, setImportResult] = useState<{
        success: boolean;
        updated: number;
        inserted: number;
        skipped: number;
        errors: string[];
    } | null>(null)

    // Delete Confirmation State
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
    const [deleteTarget, setDeleteTarget] = useState<{ id: string; nop: string; nama: string } | null>(null)

    // Fetch Data
    const fetchDhkpData = useCallback(async () => {
        setIsLoading(true)
        try {
            let query = supabase.from('dhkp_records').select('*', { count: 'exact' })

            if (dhkpQuery) {
                // Search by NOP or Nama WP
                query = query.or(`nop.ilike.%${dhkpQuery}%,nama_wp.ilike.%${dhkpQuery}%`)
            }

            // Pagination logic
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

    // Fetch on mount and when query/page changes
    useEffect(() => {
        const timeout = setTimeout(() => {
            fetchDhkpData()
        }, 500)
        return () => clearTimeout(timeout)
    }, [dhkpQuery, currentPage, fetchDhkpData])

    // Reset page on search
    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setDhkpQuery(e.target.value)
        setCurrentPage(1)
    }

    const renderJenisTanahBadge = (item: DhkpRecord) => {
        if (!item.luas_bumi || !item.ketetapan) return null;
        
        if (item.luas_bangunan > 0) {
            return <span className="bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400 px-1.5 py-0.5 rounded text-[10px] font-medium border border-amber-200 dark:border-amber-800 inline-block mt-1">Darat</span>;
        }

        const tarif = item.ketetapan / item.luas_bumi;
        
        if (tarif >= 13 && tarif <= 25) {
            return <span className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400 px-1.5 py-0.5 rounded text-[10px] font-medium border border-emerald-200 dark:border-emerald-800 inline-block mt-1">Sawah</span>;
        } else {
            return <span className="bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400 px-1.5 py-0.5 rounded text-[10px] font-medium border border-amber-200 dark:border-amber-800 inline-block mt-1">Darat</span>;
        }
    }

    // Delete handler
    const confirmDelete = (id: string, nop: string, nama: string) => {
        setDeleteTarget({ id, nop, nama })
        setIsDeleteModalOpen(true)
    }

    const executeDelete = async () => {
        if (!deleteTarget) return
        try {
            const { error } = await supabase
                .from('dhkp_records')
                .delete()
                .eq('id', deleteTarget.id)

            if (error) throw error
            fetchDhkpData()
        } catch (err) {
            console.error("Delete error:", err)
            alert("Gagal menghapus data: " + String(err))
        } finally {
            setIsDeleteModalOpen(false)
            setDeleteTarget(null)
        }
    }

    // Download all data
    const handleDownloadData = async () => {
        try {
            let hasMore = true;
            let from = 0;
            const pageSize = 1000;
            let allData: any[] = [];

            while (hasMore) {
                const { data, error } = await supabase
                    .from('dhkp_records')
                    .select('*')
                    .order('nama_wp', { ascending: true })
                    .range(from, from + pageSize - 1)

                if (error || !data) break;
                allData = allData.concat(data);
                if (data.length < pageSize) hasMore = false;
                else from += pageSize;
            }

            if (allData.length === 0) {
                alert("Tidak ada data untuk diunduh.")
                return
            }

            const headers = [
                "NOP", "NAMA_WP", "ALAMAT_WP", "ALAMAT_OP", "RT_OP", "RW_OP",
                "LUAS_BUMI", "LUAS_BANGUNAN", "KETETAPAN", "TAHUN_PAJAK",
                "BLOK", "PERSIL", "KADUS", "KELAS"
            ];

            const rows = allData.map(r => [
                r.nop, r.nama_wp, r.alamat_wp, r.alamat_op, r.rt_op, r.rw_op,
                r.luas_bumi, r.luas_bangunan, r.ketetapan, r.tahun_pajak,
                r.blok, r.persil, r.kadus, r.kelas
            ]);

            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
            const wscols = headers.map(() => ({ wch: 18 }));
            ws['!cols'] = wscols;

            XLSX.utils.book_append_sheet(wb, ws, "Data_DHKP");
            XLSX.writeFile(wb, `Data_DHKP_${new Date().toISOString().slice(0,10)}.xlsx`);
        } catch (err) {
            console.error("Download error:", err)
            alert("Gagal download data.")
        }
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

                let insertedCount = 0
                let updatedCount = 0
                let skippedCount = 0
                const errorLog: string[] = []

                // Process in batches of 500 to prevent timeout
                const BATCH_SIZE = 500;

                for (let i = 0; i < data.length; i += BATCH_SIZE) {
                    const batch = data.slice(i, i + BATCH_SIZE);
                    const upsertData = [];

                    for (const row of batch as any[]) {
                        const nopRaw = row['NOP'] ? String(row['NOP']).trim() : ""
                        
                        // Syarat wajib hanya NOP saja (agar bisa upload Excel yang isinya cuma NOP dan Kadus)
                        if (!nopRaw) {
                            skippedCount++;
                            continue;
                        }

                        // Clean NOP (remove non-digits if needed, but preserve format)
                        const nopClean = nopRaw.replace(/[^0-9.-]/g, '');

                        upsertData.push({
                            nop: nopClean,
                            raw_excel: row // Simpan raw data untuk di-merge nanti
                        });
                    }

                    // Hapus duplikat NOP di dalam batch yang sama sebelum dikirim ke database
                    const uniqueUpsertMap = new Map();
                    for (const item of upsertData) {
                        uniqueUpsertMap.set(item.nop, item);
                    }
                    const uniqueUpsertData = Array.from(uniqueUpsertMap.values());

                    if (uniqueUpsertData.length > 0) {
                        // Smart Upsert: Ambil SEMUA data lama dari database untuk mencegah penghapusan
                        const nops = uniqueUpsertData.map(d => d.nop);
                        const { data: existingRecords } = await supabase
                            .from('dhkp_records')
                            .select('*')
                            .in('nop', nops);

                        const existingMap = new Map();
                        existingRecords?.forEach(r => existingMap.set(r.nop, r));

                        const finalBatch = uniqueUpsertData.map(d => {
                            const existing = existingMap.get(d.nop) || {};
                            const row = d.raw_excel;

                            const nameRaw = row['NAMA WP'] || row['NAMA_WP'];
                            const taxRaw = row['POKOK KETETAPAN'] || row['TOTAL/ESTIMASI TOTAL'] || row['TOTAL'] || row['KETETAPAN'];
                            
                            let nominal = undefined;
                            if (taxRaw !== undefined && taxRaw !== '') {
                                if (typeof taxRaw === 'number') {
                                    nominal = taxRaw;
                                } else {
                                    const cleanTax = String(taxRaw).replace(/rp/gi, '').replace(/\./g, '').replace(/\s/g, '').replace(/,/g, '.');
                                    nominal = Number(cleanTax) || 0;
                                }
                            }

                            // Fungsi Helper: Cek apakah kolom benar-benar ada dan tidak kosong di Excel
                            const getVal = (key1: string, key2?: string, key3?: string) => {
                                if (row[key1] !== undefined && row[key1] !== '') return row[key1];
                                if (key2 && row[key2] !== undefined && row[key2] !== '') return row[key2];
                                if (key3 && row[key3] !== undefined && row[key3] !== '') return row[key3];
                                return undefined;
                            };

                            const alamatWp = getVal('ALAMAT WP', 'ALAMAT_WP');
                            const alamatOp = getVal('ALAMAT OP', 'ALAMAT_OP');
                            const rtOp = getVal('RT OP');
                            const rwOp = getVal('RW OP');
                            const luasBumi = getVal('LUAS BUMI', 'LUAS_BUMI', 'LUAS');
                            const luasBgn = getVal('LUAS BANGUNAN', 'LUAS_BANGUNAN', 'BGN');
                            const tahunPajak = getVal('TAHUN PAJAK');
                            const blok = getVal('BLOK');
                            const persil = getVal('PERSIL');
                            const kadus = getVal('KADUS');
                            const kelas = getVal('KELAS');

                            return {
                                nop: d.nop,
                                // Jika di Excel ada, pakai Excel. Jika kosong, pertahankan data lama (existing).
                                nama_wp: nameRaw ? String(nameRaw).trim() : (existing.nama_wp || "-"),
                                alamat_wp: alamatWp !== undefined ? String(alamatWp) : (existing.alamat_wp || ''),
                                alamat_op: alamatOp !== undefined ? String(alamatOp) : (existing.alamat_op || ''),
                                rt_op: rtOp !== undefined ? String(rtOp).trim() : (existing.rt_op || null),
                                rw_op: rwOp !== undefined ? String(rwOp).trim() : (existing.rw_op || null),
                                luas_bumi: luasBumi !== undefined ? Number(luasBumi) : (existing.luas_bumi || 0),
                                luas_bangunan: luasBgn !== undefined ? Number(luasBgn) : (existing.luas_bangunan || 0),
                                ketetapan: nominal !== undefined ? nominal : (existing.ketetapan || 0),
                                tahun_pajak: tahunPajak !== undefined ? String(tahunPajak) : (existing.tahun_pajak || new Date().getFullYear().toString()),
                                blok: blok !== undefined ? String(blok).trim() : (existing.blok || null),
                                persil: persil !== undefined ? String(persil).trim() : (existing.persil || null),
                                kadus: kadus !== undefined ? String(kadus).trim() : (existing.kadus || null),
                                kelas: kelas !== undefined ? String(kelas).trim() : (existing.kelas || null)
                            };
                        });

                        // Do upsert
                        const { error: upsertError } = await supabase
                            .from('dhkp_records')
                            .upsert(finalBatch, { onConflict: 'nop' });

                        if (upsertError) {
                            errorLog.push(`Batch error: ${upsertError.message}`);
                        }
                    }
                }

                setImportResult({
                    success: true,
                    inserted: insertedCount,
                    updated: updatedCount,
                    skipped: skippedCount,
                    errors: errorLog
                })
                setIsResultModalOpen(true)
                fetchDhkpData()

            } catch (err) {
                console.error("Import Error:", err)
                setImportResult({
                    success: false,
                    inserted: 0,
                    updated: 0,
                    skipped: 0,
                    errors: [String(err)]
                })
                setIsResultModalOpen(true)
            } finally {
                setIsImporting(false)
                if (fileInputRef.current) fileInputRef.current.value = ""
            }
        }
        reader.readAsBinaryString(file)
    }

    const handleDownloadTemplate = () => {
        const headers = [
            "NOP", "NAMA_WP", "ALAMAT_WP", "ALAMAT_OP", "RT_OP", "RW_OP", 
            "LUAS_BUMI", "LUAS_BANGUNAN", "KETETAPAN", "TAHUN_PAJAK", 
            "BLOK", "PERSIL", "KADUS", "KELAS"
        ];

        const sample = [
            ["320513000500010007", "Asep Saepudin", "Jl. Mawar No.1", "Sawah Lega", "001", "002", 100, 50, 50000, 2024, "A1", "10", "Dusun Manis", "S III"],
            ["320513000500020008", "Budi Santoso", "Jl. Melati No.2", "Rumah Tinggal", "003", "004", 150, 100, 125000, 2024, "B2", "12", "Dusun Pahing", "D II"]
        ];

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet([headers, ...sample]);

        const wscols = headers.map(() => ({ wch: 18 }));
        ws['!cols'] = wscols;

        XLSX.utils.book_append_sheet(wb, ws, "Template_DHKP");
        XLSX.writeFile(wb, "Template_Import_DHKP.xlsx");
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-12 w-full min-w-0">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                        <Database className="text-primary w-6 h-6" />
                        Master DHKP
                    </h2>
                    <p className="text-muted-foreground text-sm mt-1">
                        Buku pintar referensi data ketetapan pajak desa.
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                    <input
                        type="file"
                        accept=".xlsx, .xls"
                        className="hidden"
                        ref={fileInputRef}
                        onChange={processImport}
                    />
                    
                    <Button
                        variant="secondary"
                        onClick={handleDownloadTemplate}
                        title="Download Format Excel DHKP"
                        className="gap-2 flex-1 sm:flex-none"
                    >
                        <FileDown className="w-4 h-4" />
                        <span className="hidden sm:inline">Format</span>
                    </Button>

                    <Button
                        variant="secondary"
                        onClick={handleDownloadData}
                        title="Download Semua Data DHKP"
                        className="gap-2 flex-1 sm:flex-none"
                    >
                        <FileDown className="w-4 h-4" />
                        <span className="hidden sm:inline">Data</span>
                    </Button>

                    <Button
                        variant="primary"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isImporting}
                        className="gap-2 flex-1 sm:flex-none"
                    >
                        {isImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                        {isImporting ? "Memproses..." : "Upload DHKP"}
                    </Button>
                </div>
            </div>

            {/* Search and Filters */}
            <div className="bg-card p-4 rounded-xl border border-border flex items-center gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                        placeholder="Cari Nama Pemilik Lama atau NOP..."
                        value={dhkpQuery}
                        onChange={handleSearchChange}
                        className="pl-10 h-12 text-lg"
                    />
                </div>
                {isLoading && <Loader2 className="w-6 h-6 animate-spin text-primary" />}
            </div>

            {/* Data Table */}
            <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm w-full max-w-[calc(100vw-2rem)] md:max-w-full">
                <div className="overflow-x-auto w-full">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b border-border">
                            <tr>
                                <th className="px-4 py-3 font-semibold">NOP</th>
                                <th className="px-4 py-3 font-semibold">Nama WP (Lama)</th>
                                <th className="px-4 py-3 font-semibold">Alamat WP</th>
                                <th className="px-4 py-3 font-semibold">Lokasi OP</th>
                                <th className="px-4 py-3 font-semibold text-center">Luas Tanah / Bgn</th>
                                <th className="px-4 py-3 font-semibold">Blok / Persil</th>
                                <th className="px-4 py-3 font-semibold text-right">Ketetapan</th>
                                <th className="px-4 py-3 font-semibold text-center w-16"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {dhkpResults.map((record) => (
                                <tr key={record.id} className="hover:bg-muted/30 transition-colors">
                                    <td className="px-4 py-3 font-mono text-xs">{record.nop}</td>
                                    <td className="px-4 py-3">
                                        <div className="font-semibold">{record.nama_wp}</div>
                                        {renderJenisTanahBadge(record)}
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="truncate max-w-[200px]" title={record.alamat_wp}>
                                            {record.alamat_wp || '-'}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="truncate max-w-[200px]" title={record.alamat_op}>
                                            {record.alamat_op}
                                        </div>
                                        <div className="text-[10px] text-muted-foreground">RT/RW: {record.rt_op || '-'}/{record.rw_op || '-'}</div>
                                    </td>
                                    <td className="px-4 py-3 text-center text-xs whitespace-nowrap">
                                        <div className="font-medium text-foreground">{record.luas_bumi} m²</div>
                                        <div className="text-[10px] text-muted-foreground">{record.luas_bangunan} m²</div>
                                    </td>
                                    <td className="px-4 py-3">
                                        {record.blok || record.persil || record.kelas ? (
                                            <div className="flex flex-wrap gap-1">
                                                {record.blok && <span className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 px-2 py-0.5 rounded text-xs">B:{record.blok}</span>}
                                                {record.persil && <span className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 px-2 py-0.5 rounded text-xs">P:{record.persil}</span>}
                                                {record.kelas && <span className="bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300 px-2 py-0.5 rounded text-xs">K:{record.kelas}</span>}
                                            </div>
                                        ) : (
                                            <span className="text-muted-foreground/50 text-xs">-</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-right font-bold">
                                        Rp {record.ketetapan.toLocaleString('id-ID')}
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <button
                                            onClick={() => confirmDelete(record.id, record.nop, record.nama_wp)}
                                            className="text-muted-foreground hover:text-destructive transition-colors p-1 rounded-md hover:bg-destructive/10"
                                            title="Hapus data ini"
                                        >
                                            <Trash size={14} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {dhkpResults.length === 0 && !isLoading && (
                                <tr>
                                    <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                                        Tidak ada data DHKP yang ditemukan.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination Controls */}
                {totalCount > 0 && (
                    <div className="px-4 py-3 border-t border-border flex items-center justify-between bg-muted/10">
                        <span className="text-sm text-muted-foreground">
                            Menampilkan {(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, totalCount)} dari {totalCount} data
                        </span>
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                            >
                                Sebelumnya
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setCurrentPage(p => p + 1)}
                                disabled={currentPage * itemsPerPage >= totalCount}
                            >
                                Selanjutnya
                            </Button>
                        </div>
                    </div>
                )}
            </div>

            {/* Import Result Modal */}
            <Modal isOpen={isResultModalOpen} onClose={() => setIsResultModalOpen(false)} title="Hasil Import DHKP">
                <div className="space-y-4">
                    {importResult?.success ? (
                        <>
                            <div className="flex items-center gap-3 text-success p-3 bg-success/10 rounded-lg">
                                <Database className="w-6 h-6" />
                                <div>
                                    <p className="font-bold">Import Selesai</p>
                                    <p className="text-sm opacity-90">Data DHKP berhasil disinkronisasi.</p>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3 mt-4">
                                <div className="p-3 bg-muted rounded-lg text-center">
                                    <div className="text-2xl font-bold">{importResult.inserted}</div>
                                    <div className="text-xs text-muted-foreground">Data Baru</div>
                                </div>
                                <div className="p-3 bg-muted rounded-lg text-center">
                                    <div className="text-2xl font-bold">{importResult.updated}</div>
                                    <div className="text-xs text-muted-foreground">Data Diupdate</div>
                                </div>
                            </div>
                            {importResult.errors.length > 0 && (
                                <div className="mt-4 p-3 border border-warning/50 bg-warning/10 rounded-lg">
                                    <p className="font-semibold text-sm text-warning mb-2">Beberapa baris dilewati:</p>
                                    <ul className="text-xs text-muted-foreground max-h-32 overflow-y-auto space-y-1">
                                        {importResult.errors.map((err, i) => <li key={i}>• {err}</li>)}
                                    </ul>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="flex items-start gap-3 text-destructive p-4 bg-destructive/10 rounded-lg">
                            <AlertCircle className="w-6 h-6 mt-0.5 shrink-0" />
                            <div>
                                <p className="font-bold">Gagal Import</p>
                                <p className="text-sm mt-1">{importResult?.errors[0]}</p>
                            </div>
                        </div>
                    )}
                    <div className="flex justify-end pt-4">
                        <Button onClick={() => setIsResultModalOpen(false)}>Tutup</Button>
                    </div>
                </div>
            </Modal>

            {/* Delete Confirmation Modal */}
            <Modal isOpen={isDeleteModalOpen} onClose={() => { setIsDeleteModalOpen(false); setDeleteTarget(null); }} title="Hapus Data DHKP"
                footer={
                    <>
                        <Button variant="outline" onClick={() => { setIsDeleteModalOpen(false); setDeleteTarget(null); }}>Batal</Button>
                        <Button variant="danger" onClick={executeDelete}>Ya, Hapus</Button>
                    </>
                }
            >
                {deleteTarget && (
                    <div className="space-y-4">
                        <div className="flex items-start gap-3 p-4 rounded-xl border bg-destructive/5 border-destructive/20">
                            <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                            <div>
                                <p className="font-semibold text-foreground">Yakin ingin menghapus data ini?</p>
                                <p className="text-sm text-muted-foreground mt-1">Data yang dihapus tidak bisa dikembalikan.</p>
                            </div>
                        </div>
                        <div className="bg-muted/30 rounded-xl p-4 space-y-2">
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">NOP</span>
                                <span className="font-mono font-medium text-foreground">{deleteTarget.nop}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Nama WP</span>
                                <span className="font-semibold text-foreground">{deleteTarget.nama}</span>
                            </div>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    )
}
