"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { LayoutDashboard, Users, Wallet, Settings } from "lucide-react"

const menuItems = [
    { href: "/dashboard", label: "Home", icon: LayoutDashboard },
    { href: "/dashboard/data-wp", label: "Data", icon: Users },
    { href: "/dashboard/pembayaran", label: "Bayar", icon: Wallet },
    { href: "/dashboard/pengaturan", label: "Set", icon: Settings },
]

export function BottomNav() {
    const pathname = usePathname()

    return (
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 border-t bg-background/80 backdrop-blur-xl z-50 pb-safe">
            <div className="flex justify-around items-center h-16">
                {menuItems.map((item) => {
                    const Icon = item.icon
                    const isActive = pathname === item.href

                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={cn(
                                "flex flex-col items-center justify-center w-full h-full space-y-1",
                                isActive ? "text-primary" : "text-muted-foreground"
                            )}
                        >
                            <Icon size={24} strokeWidth={isActive ? 2.5 : 2} />
                            <span className="text-[10px] font-medium">{item.label}</span>
                        </Link>
                    )
                })}
            </div>
        </nav>
    )
}
