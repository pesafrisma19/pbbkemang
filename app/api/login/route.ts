import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'

// Use Service Role Key to bypass RLS for secure password fetching
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: Request) {
    try {
        const body = await request.json()
        const { phone, password } = body

        if (!phone || !password) {
            return NextResponse.json(
                { error: 'Nomor WhatsApp dan Password wajib diisi' },
                { status: 400 }
            )
        }

        // 1. Fetch user by phone
        // Note: We select 'password' explicitly although it might be hidden in normal view
        const { data: admin, error } = await supabase
            .from('admins')
            .select('*')
            .eq('phone', phone)
            .single()

        if (error || !admin) {
            return NextResponse.json(
                { error: 'Akun tidak ditemukan atau salah nomor' },
                { status: 401 }
            )
        }

        // 2. Compare Password (Hash vs Plain)
        const isValid = await bcrypt.compare(password, admin.password)

        if (!isValid) {
            return NextResponse.json(
                { error: 'Password salah!' },
                { status: 401 }
            )
        }

        // 3. Success
        return NextResponse.json({ success: true })

    } catch (err) {
        console.error('Login error:', err)
        return NextResponse.json(
            { error: 'Terjadi kesalahan server' },
            { status: 500 }
        )
    }
}
