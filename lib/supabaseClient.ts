import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://ozvzyubnftcteqjjedlx.supabase.co";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_sMHpM-BIz-AT-zlpih8sQw_MMX8xoAx";

export const supabase = createClient(supabaseUrl, supabaseKey);
