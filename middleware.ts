import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
    // Hanya jalankan logic ini di halaman dashboard
    if (request.nextUrl.pathname.startsWith('/dashboard')) {

        // Cek apakah cookie 'admin_session' ada
        const hasSession = request.cookies.get('admin_session')

        if (!hasSession) {
            // Jika tidak ada session, lempar balik ke login
            const loginUrl = new URL('/login', request.url)
            return NextResponse.redirect(loginUrl)
        }
    }

    return NextResponse.next()
}

// Tentukan path mana saja yang kena middleware ini
export const config = {
    matcher: '/dashboard/:path*',
}
