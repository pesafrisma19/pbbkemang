import Link from "next/link"
import { ThemeToggle } from "@/components/features/ThemeToggle"
import { Button } from "@/components/ui/Button"

export function Header() {
    return (
        <header className="sticky top-0 z-50 w-full border-b bg-background/70 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
            <div className="container flex h-16 items-center justify-between">
                <div className="flex items-center gap-2">
                    {/* Logo Placeholder - You can replace with Image later */}
                    <div className="h-8 w-8 rounded-lg bg-accent-blue bg-gradient-to-br from-blue-500 to-indigo-600 shadow-md"></div>
                    <span className="text-lg font-bold tracking-tight">PBB Kemang</span>
                </div>

                <div className="flex items-center gap-4">
                    <ThemeToggle />
                    <Link href="/login">
                        <Button variant="ghost" size="sm" className="hidden sm:inline-flex">
                            Login Admin
                        </Button>
                    </Link>
                </div>
            </div>
        </header>
    )
}
