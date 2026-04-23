"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { supabase } from "@/lib/supabaseClient"
import { Input } from "@/components/ui/Input"
import { Button } from "@/components/ui/Button"
import { Search, Upload, FileDown, Loader2, Database, AlertCircle, Edit } from "lucide-react"
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
                        const nameRaw = row['NAMA WP'] || row['NAMA_WP']

                        if (!nopRaw || !nameRaw) {
                            skippedCount++;
                            continue;
                        }

                        // Clean NOP (remove non-digits if needed, but preserve format)
                        const nopClean = nopRaw.replace(/[^0-9.-]/g, '');

                        // Clean Tax amount
                        const taxRaw = row['POKOK KETETAPAN'] || row['TOTAL/ESTIMASI TOTAL'] || row['TOTAL'] || row['KETETAPAN'];
                        let nominal = 0;
                        if (typeof taxRaw === 'number') {
                            nominal = taxRaw;
                        } else if (typeof taxRaw === 'string') {
                            const cleanTax = taxRaw.replace(/rp/gi, '').replace(/\./g, '').replace(/\s/g, '').replace(/,/g, '.');
                            nominal = Number(cleanTax) || 0;
                        }

                        upsertData.push({
                            nop: nopClean,
                            nama_wp: String(nameRaw).trim(),
                            alamat_wp: row['ALAMAT WP'] || row['ALAMAT_WP'] || '',
                            alamat_op: row['ALAMAT OP'] || row['ALAMAT_OP'] || '',
                            rt_op: row['RT OP'] ? String(row['RT OP']).trim() : null,
                            rw_op: row['RW OP'] ? String(row['RW OP']).trim() : null,
                            luas_bumi: Number(row['LUAS BUMI']) || 0,
                            luas_bangunan: Number(row['LUAS BANGUNAN']) || 0,
                            ketetapan: nominal,
                            tahun_pajak: row['TAHUN PAJAK'] ? String(row['TAHUN PAJAK']) : new Date().getFullYear().toString(),

                            // Ambil data manual dari Excel jika ada
                            blok_excel: row['BLOK'] ? String(row['BLOK']).trim() : null,
                            persil_excel: row['PERSIL'] ? String(row['PERSIL']).trim() : null,
                            kadus_excel: row['KADUS'] ? String(row['KADUS']).trim() : null,
                            kelas_excel: row['KELAS'] ? String(row['KELAS']).trim() : null,
                        });
                    }

                    if (upsertData.length > 0) {
                        // Smart Upsert: Fetch existing records for this batch
                        const nops = upsertData.map(d => d.nop);
                        const { data: existingRecords } = await supabase
                            .from('dhkp_records')
                            .select('nop, blok, persil, kadus, kelas')
                            .in('nop', nops);

                        const existingMap = new Map();
                        existingRecords?.forEach(r => existingMap.set(r.nop, r));

                        // Merge manual data so it's not overwritten by Excel
                        const finalBatch = upsertData.map(d => {
                            const existing = existingMap.get(d.nop);

                            // Ekstrak data excel, lalu buang field temporary
                            const { blok_excel, persil_excel, kadus_excel, kelas_excel, ...rest } = d;

                            if (existing) {
                                updatedCount++;
                                return {
                                    ...rest,
                                    // Jika di database sudah ada isinya, dan di excel kosong, pakai yang di database.
                                    // Jika di excel ada isinya, pakai yang di excel (berguna untuk import pertama kali).
                                    blok: existing.blok && !blok_excel ? existing.blok : blok_excel,
                                    persil: existing.persil && !persil_excel ? existing.persil : persil_excel,
                                    kadus: existing.kadus && !kadus_excel ? existing.kadus : kadus_excel,
                                    kelas: existing.kelas && !kelas_excel ? existing.kelas : kelas_excel
                                };
                            } else {
                                insertedCount++;
                                return {
                                    ...rest,
                                    blok: blok_excel,
                                    persil: persil_excel,
                                    kadus: kadus_excel,
                                    kelas: kelas_excel
                                };
                            }
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
                                <th className="px-4 py-3 font-semibold">Lokasi OP</th>
                                <th className="px-4 py-3 font-semibold">Blok / Persil</th>
                                <th className="px-4 py-3 font-semibold text-right">Ketetapan</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {dhkpResults.map((record) => (
                                <tr key={record.id} className="hover:bg-muted/30 transition-colors">
                                    <td className="px-4 py-3 font-mono text-xs">{record.nop}</td>
                                    <td className="px-4 py-3 font-semibold">{record.nama_wp}</td>
                                    <td className="px-4 py-3">
                                        <div className="truncate max-w-[200px]" title={record.alamat_op}>
                                            {record.alamat_op}
                                        </div>
                                        <div className="text-[10px] text-muted-foreground">RT/RW: {record.rt_op || '-'}/{record.rw_op || '-'}</div>
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
                                </tr>
                            ))}
                            {dhkpResults.length === 0 && !isLoading && (
                                <tr>
                                    <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
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
        </div>
    )
}
