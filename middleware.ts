import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
    const hasSession = request.cookies.get('admin_session')
    const { pathname } = request.nextUrl

    // Hanya jalankan logic ini di halaman dashboard
    if (pathname.startsWith('/dashboard')) {
        if (!hasSession) {
            // Jika tidak ada session, lempar balik ke login
            const loginUrl = new URL('/login', request.url)
            return NextResponse.redirect(loginUrl)
        }
    }

    // Jika sudah login tapi akses halaman login, langsung redirect ke dashboard
    if (pathname === '/login') {
        if (hasSession) {
            const dashboardUrl = new URL('/dashboard', request.url)
            return NextResponse.redirect(dashboardUrl)
        }
    }

    return NextResponse.next()
}

// Tentukan path mana saja yang kena middleware ini
export const config = {
    matcher: ['/dashboard/:path*', '/login'],
}
