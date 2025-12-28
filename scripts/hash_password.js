const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Error: Missing environment variables.');
    console.log('URL:', supabaseUrl);
    console.log('KEY:', supabaseServiceKey ? 'Found' : 'Missing');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function migrate() {
    console.log('Starting password migration...');

    // 1. Get all admins
    const { data: admins, error } = await supabase.from('admins').select('*');
    if (error) {
        console.error('Error fetching admins:', error);
        return;
    }

    console.log(`Found ${admins.length} admins.`);

    for (const admin of admins) {
        // Check if password looks like a bcrypt hash ($2a$...)
        if (admin.password.startsWith('$2a$') || admin.password.startsWith('$2b$')) {
            console.log(`User ${admin.phone} already has a hashed password. Skipping.`);
            continue;
        }

        console.log(`Hashing password for ${admin.phone}...`);
        const hashedPassword = await bcrypt.hash(admin.password, 10);

        const { error: updateError } = await supabase
            .from('admins')
            .update({ password: hashedPassword })
            .eq('id', admin.id);

        if (updateError) {
            console.error(`Failed to update ${admin.phone}:`, updateError);
        } else {
            console.log(`Success! Password for ${admin.phone} secured.`);
        }
    }
}

migrate();
