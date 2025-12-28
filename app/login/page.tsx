"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabaseClient"
import { Input } from "@/components/ui/Input"
import { Button } from "@/components/ui/Button"
import { Lock, Phone, ArrowRight, Loader2 } from "lucide-react"

export default function LoginPage() {
    const router = useRouter()
    const [formData, setFormData] = useState({ phone: "", password: "" })
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState("")

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setError("")
        setIsLoading(true)

        try {
            // Call Secure API
            const res = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            })

            const data = await res.json()

            if (res.ok && data.success) {
                // Success - Set Cookie (Plain JS)
                // Expires in 1 day
                document.cookie = "admin_session=true; path=/; max-age=86400; SameSite=Lax";
                router.push("/dashboard")
            } else {
                setError(data.error || "Login gagal.")
                setIsLoading(false)
            }
        } catch (err) {
            setError("Gagal menghubungi server.")
            setIsLoading(false)
        }
    }

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-muted/20 p-4 relative">
            <Button
                variant="ghost"
                size="sm"
                className="absolute top-4 left-4 md:top-8 md:left-8 gap-2 text-muted-foreground hover:text-foreground"
                onClick={() => router.push('/')}
            >
                <ArrowRight className="rotate-180" size={16} />
                Kembali
            </Button>
            <div className="w-full max-w-sm space-y-6">
                <div className="flex flex-col items-center text-center space-y-2">
                    <div className="h-12 w-12 bg-accent-blue/10 text-accent-blue rounded-xl flex items-center justify-center mb-2">
                        <Lock size={24} />
                    </div>
                    <h1 className="text-2xl font-bold tracking-tight">Login Admin</h1>
                    <p className="text-sm text-muted-foreground">
                        Masuk untuk mengelola Data PBB Desa Kemang
                    </p>
                </div>

                <div className="glass-card p-6 rounded-xl border shadow-sm bg-background">
                    <form onSubmit={handleLogin} className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Nomor WhatsApp</label>
                            <Input
                                placeholder="Contoh: 0852xxx"
                                icon={Phone}
                                value={formData.phone}
                                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                type="tel"
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Password</label>
                            <Input
                                placeholder="********"
                                icon={Lock}
                                type="password"
                                value={formData.password}
                                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                required
                            />
                        </div>

                        {error && (
                            <div className="text-xs text-red-500 bg-red-50 p-2 rounded text-center font-medium animate-in fade-in">
                                {error}
                            </div>
                        )}

                        <Button className="w-full gap-2" size="lg" disabled={isLoading}>
                            {isLoading ? <Loader2 className="animate-spin w-4 h-4" /> : null}
                            {isLoading ? 'Memproses...' : 'Masuk Dashboard'}
                            {!isLoading && <ArrowRight size={16} />}
                        </Button>
                    </form>
                </div>

                <div className="text-center text-xs text-muted-foreground">
                    &copy; 2025 Pemerintah Desa Kemang
                </div>
            </div>
        </div>
    )
}
