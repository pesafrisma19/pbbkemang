"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { LayoutDashboard, Users, Wallet, Settings, LogOut } from "lucide-react"

const menuItems = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/dashboard/data-wp", label: "Data WP", icon: Users },
    { href: "/dashboard/pembayaran", label: "Pembayaran", icon: Wallet },
    { href: "/dashboard/pengaturan", label: "Pengaturan", icon: Settings },
]

export function Sidebar() {
    const pathname = usePathname()

    return (
        <aside className="hidden lg:flex w-64 flex-col border-r bg-background/80 backdrop-blur-xl h-screen sticky top-0">
            <div className="p-6 border-b flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600"></div>
                <span className="font-bold text-lg">Admin PBB</span>
            </div>

            <nav className="flex-1 p-4 space-y-1">
                {menuItems.map((item) => {
                    const Icon = item.icon
                    const isActive = pathname === item.href

                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={cn(
                                "flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl transition-colors",
                                isActive
                                    ? "bg-primary/10 text-primary"
                                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                            )}
                        >
                            <Icon size={20} />
                            {item.label}
                        </Link>
                    )
                })}
            </nav>

            <div className="p-4 border-t">
                <button
                    onClick={() => {
                        document.cookie = "admin_session=; path=/; max-age=0";
                        window.location.href = "/login";
                    }}
                    className="flex w-full items-center gap-3 px-4 py-3 text-sm font-medium text-destructive hover:bg-destructive/10 rounded-xl transition-colors"
                >
                    <LogOut size={20} />
                    Keluar
                </button>
            </div>
        </aside>
    )
}
