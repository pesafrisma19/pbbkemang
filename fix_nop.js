const supabaseUrl = 'https://ozvzyubnftcteqjjedlx.supabase.co';
const supabaseKey = 'sb_publishable_sMHpM-BIz-AT-zlpih8sQw_MMX8xoAx';

const fn = async () => {
  const res = await fetch(`${supabaseUrl}/rest/v1/tax_objects?select=nop,citizen_id`, {
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`
    }
  });
  
  const data = await res.json();
  const broken = data.filter(d => !d.nop.startsWith('3') && !isNaN(d.nop) && String(d.nop).length > 10 && String(d.nop).startsWith('17'));
  console.log('Found', broken.length, 'broken NOPs');
  
  for (const item of broken) {
    const newNop = 'TANPA-NOP-' + item.nop;
    const patchRes = await fetch(`${supabaseUrl}/rest/v1/tax_objects?nop=eq.${item.nop}&citizen_id=eq.${item.citizen_id}`, {
      method: 'PATCH',
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ nop: newNop })
    });
    console.log(`Updated ${item.nop} -> ${newNop}: ${patchRes.status}`);
  }
  console.log('Fixed');
};

fn();
