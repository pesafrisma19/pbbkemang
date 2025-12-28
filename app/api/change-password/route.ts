import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'

// Secure Backend Client
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: Request) {
    try {
        const { phone, oldPassword, newPassword } = await request.json()

        if (!phone || !oldPassword || !newPassword) {
            return NextResponse.json({ error: 'Data tidak lengkap' }, { status: 400 })
        }

        // 1. Fetch Admin
        const { data: admin, error } = await supabase
            .from('admins')
            .select('*')
            .eq('phone', phone)
            .single()

        if (error || !admin) {
            return NextResponse.json({ error: 'User tidak ditemukan' }, { status: 404 })
        }

        // 2. Verify Old Password
        const isValid = await bcrypt.compare(oldPassword, admin.password)
        if (!isValid) {
            return NextResponse.json({ error: 'Password Lama Salah!' }, { status: 401 })
        }

        // 3. Hash New Password
        const hashedPassword = await bcrypt.hash(newPassword, 10)

        // 4. Update Database
        const { error: updateError } = await supabase
            .from('admins')
            .update({ password: hashedPassword })
            .eq('id', admin.id)

        if (updateError) {
            throw updateError
        }

        return NextResponse.json({ success: true })
    } catch (err) {
        console.error('Change password error:', err)
        return NextResponse.json({ error: 'Gagal mengubah password' }, { status: 500 })
    }
}
