"use client"

import { useState, useEffect } from "react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { KeyRound, Loader2, LogOut, CalendarDays } from "lucide-react"

export default function PengaturanPage() {
    // State for Change Password
    const [passForm, setPassForm] = useState({ phone: "", oldPass: "", newPass: "" })
    const [loading, setLoading] = useState(false)
    const [msg, setMsg] = useState({ type: "", text: "" })

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setMsg({ type: "", text: "" })

        try {
            const res = await fetch('/api/change-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    phone: passForm.phone,
                    oldPassword: passForm.oldPass,
                    newPassword: passForm.newPass
                })
            })

            const data = await res.json()

            if (res.ok && data.success) {
                setMsg({ type: "success", text: "Password berhasil diubah!" })
                setPassForm({ phone: "", oldPass: "", newPass: "" })
            } else {
                setMsg({ type: "error", text: data.error || "Gagal mengubah password." })
            }
        } catch (err) {
            setMsg({ type: "error", text: "Terjadi kesalahan sistem." })
        } finally {
            setLoading(false)
        }
    }

    const [deadline, setDeadline] = useState("")
    const [deadlineMsg, setDeadlineMsg] = useState({ type: "", text: "" })
    const [deadlineLoading, setDeadlineLoading] = useState(false)

    useEffect(() => {
        // Load deadline from localStorage
        const stored = localStorage.getItem('pbb_deadline')
        if (stored) setDeadline(stored)
    }, [])

    const handleSaveDeadline = async (e: React.FormEvent) => {
        e.preventDefault()
        setDeadlineLoading(true)
        setDeadlineMsg({ type: "", text: "" })

        try {
            localStorage.setItem('pbb_deadline', deadline)
            setDeadlineMsg({ type: "success", text: "Jatuh tempo berhasil disimpan di perangkat ini!" })
        } catch (err) {
            setDeadlineMsg({ type: "error", text: "Terjadi kesalahan sistem saat menyimpan." })
        } finally {
            setDeadlineLoading(false)
        }
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-10">
            <h2 className="text-2xl font-bold tracking-tight">Pengaturan</h2>

            <div className="grid gap-6">

                {/* Set Deadline Card */}
                <Card className="border-blue-100 shadow-sm w-full max-w-2xl mx-auto md:mx-0">
                    <CardHeader>
                        <CalendarDays className="w-8 h-8 mb-2 text-blue-500" />
                        <CardTitle className="text-lg">Atur Jatuh Tempo PBB</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSaveDeadline} className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-muted-foreground">Tanggal Jatuh Tempo Tahun Ini</label>
                                <Input
                                    type="date"
                                    value={deadline}
                                    onChange={e => setDeadline(e.target.value)}
                                    required
                                    className="h-12"
                                />
                            </div>

                            {deadlineMsg.text && (
                                <div className={`p-3 rounded text-sm text-center font-medium ${deadlineMsg.type === 'success' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                                    {deadlineMsg.text}
                                </div>
                            )}

                            <Button className="w-full bg-blue-600 hover:bg-blue-700" disabled={deadlineLoading}>
                                {deadlineLoading && <Loader2 className="animate-spin mr-2" size={16} />}
                                Simpan Jatuh Tempo
                            </Button>
                        </form>
                    </CardContent>
                </Card>

                {/* Change Password Card - Centered/Full Width */}
                <Card className="border-orange-100 shadow-sm w-full max-w-2xl mx-auto md:mx-0">
                    <CardHeader>
                        <KeyRound className="w-8 h-8 mb-2 text-orange-500" />
                        <CardTitle className="text-lg">Ganti Password Admin</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleChangePassword} className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Nomor WhatsApp Admin</label>
                                <Input
                                    placeholder="08..."
                                    value={passForm.phone}
                                    onChange={e => setPassForm({ ...passForm, phone: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Password Lama</label>
                                <Input
                                    type="password"
                                    placeholder="********"
                                    value={passForm.oldPass}
                                    onChange={e => setPassForm({ ...passForm, oldPass: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Password Baru</label>
                                <Input
                                    type="password"
                                    placeholder="********"
                                    value={passForm.newPass}
                                    onChange={e => setPassForm({ ...passForm, newPass: e.target.value })}
                                    required
                                />
                            </div>

                            {msg.text && (
                                <div className={`p-3 rounded text-sm text-center font-medium ${msg.type === 'success' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                                    {msg.text}
                                </div>
                            )}

                            <Button className="w-full" disabled={loading}>
                                {loading && <Loader2 className="animate-spin mr-2" size={16} />}
                                Simpan Password Baru
                            </Button>
                        </form>
                    </CardContent>
                </Card>

                {/* Logout moved to Header */}

            </div>
        </div>
    )
}
