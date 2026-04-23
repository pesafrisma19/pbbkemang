-- Tabel untuk DHKP (Buku Pintar)
CREATE TABLE public.dhkp_records (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    nop VARCHAR(50) UNIQUE NOT NULL,
    nama_wp VARCHAR(255) NOT NULL,
    alamat_wp TEXT,
    alamat_op TEXT,
    rt_op VARCHAR(20),
    rw_op VARCHAR(20),
    luas_bumi NUMERIC DEFAULT 0,
    luas_bangunan NUMERIC DEFAULT 0,
    ketetapan NUMERIC DEFAULT 0,
    blok VARCHAR(100),
    persil VARCHAR(100),
    kadus VARCHAR(100),
    kelas VARCHAR(50),
    tahun_pajak VARCHAR(4),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Indexing agar pencarian sangat cepat walaupun ada jutaan data
CREATE INDEX idx_dhkp_nop ON public.dhkp_records (nop);
CREATE INDEX idx_dhkp_nama_wp ON public.dhkp_records (nama_wp);
CREATE INDEX idx_dhkp_kadus ON public.dhkp_records (kadus);

-- Enable RLS (Row Level Security) tapi izinkan baca untuk publik
ALTER TABLE public.dhkp_records ENABLE ROW LEVEL SECURITY;

-- Kebijakan (Policy) agar publik (anon) bisa MENCARI/MEMBACA data DHKP
CREATE POLICY "Public can view dhkp"
ON public.dhkp_records
FOR SELECT
TO public
USING (true);

-- Kebijakan agar Admin (authenticated) bisa INSERT/UPDATE/DELETE data DHKP
CREATE POLICY "Admin can modify dhkp"
ON public.dhkp_records
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);
