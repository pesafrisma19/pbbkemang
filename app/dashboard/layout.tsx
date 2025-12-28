"use client"

import { Sidebar } from "@/components/layout/Sidebar"
import { BottomNav } from "@/components/layout/BottomNav"
import { ThemeToggle } from "@/components/features/ThemeToggle"
import { LogOut } from "lucide-react"
import { Button } from "@/components/ui/Button"

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const handleLogout = () => {
        document.cookie = "admin_session=; path=/; max-age=0";
        window.location.href = "/login";
    }

    return (
        <div className="min-h-screen bg-background flex">
            <Sidebar />
            <div className="flex-1 flex flex-col pb-20 lg:pb-0">
                <header className="h-16 border-b flex items-center justify-between px-6 bg-background/50 backdrop-blur-sm sticky top-0 z-40">
                    <h1 className="font-semibold text-lg">Dashboard</h1>
                    <div className="flex items-center gap-2">
                        <ThemeToggle />
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={handleLogout}
                            className="text-red-500 hover:text-red-600 hover:bg-red-50"
                            title="Keluar Aplikasi"
                        >
                            <LogOut size={20} />
                        </Button>
                    </div>
                </header>
                <main className="flex-1 p-4 md:p-6 overflow-y-auto">
                    {children}
                </main>
            </div>
            <BottomNav />
        </div>
    )
}
