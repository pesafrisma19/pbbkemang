"use client"

import { Search } from "lucide-react"
import { Button } from "@/components/ui/Button"

export function SearchBar() {
    return (
        <div className="relative w-full max-w-lg mx-auto">
            <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground h-5 w-5" />
                <input
                    type="text"
                    placeholder="Cari NOP atau Nama Wajib Pajak..."
                    className="flex h-12 w-full rounded-full border border-input bg-background/80 px-12 py-3 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 shadow-sm transition-all hover:bg-background"
                />
                <Button
                    size="sm"
                    className="absolute right-1.5 top-1.5 rounded-full h-9 px-4"
                >
                    Cari
                </Button>
            </div>
        </div>
    )
}
