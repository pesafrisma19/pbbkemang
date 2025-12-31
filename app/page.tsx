"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabaseClient"
import { Card, CardContent } from "@/components/ui/Card"
import { Input } from "@/components/ui/Input"
import { Badge } from "@/components/ui/Badge"
import { Button } from "@/components/ui/Button"
import { Search, Loader2, MapPin, CheckCircle, TrendingUp, Building2, Globe, ExternalLink } from "lucide-react"
import Link from "next/link"
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'

export default function Home() {
  const [activeTab, setActiveTab] = useState<'stats' | 'search'>('search')

  // Stats State
  const [stats, setStats] = useState({
    paidAmount: 0,
    unpaidAmount: 0,
    paidCount: 0,
    percentage: 0
  })

  // Chart Data
  const chartData = [
    { name: 'Sudah Masuk (Lunas)', value: stats.paidAmount },
    { name: 'Belum Bayar (Potensi)', value: stats.unpaidAmount },
  ];
  const COLORS = ['#16a34a', '#f97316']; // Green, Orange

  // Search State
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<any[]>([])
  const [isSearching, setIsSearching] = useState(false)

  // Fetch Stats on Load
  useEffect(() => {
    const fetchStats = async () => {
      const { data, error } = await supabase
        .from('tax_objects')
        .select('amount_due, status')

      if (data) {
        let paid = 0, unpaid = 0, count = 0;
        data.forEach(t => {
          if (t.status === 'paid') {
            paid += t.amount_due;
            count++;
          } else {
            unpaid += t.amount_due;
          }
        })
        // Mock Target: 250jt
        const pct = Math.round((paid / (paid + unpaid || 1)) * 100);
        setStats({ paidAmount: paid, unpaidAmount: unpaid, paidCount: count, percentage: pct })
      }
    }
    fetchStats()
  }, [])

  // Auto Search Effect
  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (query.length < 3) {
        setResults([]);
        return;
      }

      setIsSearching(true);
      try {
        // 1. Search by Citizen Name
        const { data: nameHits } = await supabase
          .from('citizens')
          .select('id')
          .ilike('name', `%${query}%`)
          .limit(20)

        // 2. Search by Asset Fields (NOP, Original Name, Blok, Persil)
        const { data: assetHits } = await supabase
          .from('tax_objects')
          .select('citizen_id')
          .or(`nop.ilike.%${query}%,original_name.ilike.%${query}%,blok.ilike.%${query}%,persil.ilike.%${query}%`)
          .limit(20)

        // 3. Combine IDs
        const ids = new Set<string>()
        nameHits?.forEach(x => ids.add(x.id))
        assetHits?.forEach(x => ids.add(x.citizen_id))
        const uniqueIds = Array.from(ids)

        if (uniqueIds.length === 0) {
          setResults([])
          setIsSearching(false)
          return
        }

        // 4. Fetch Full Data for these IDs (QUERY BERSIH - TANPA KOMENTAR DI DALAM STRING)
        const { data } = await supabase
          .from('citizens')
          .select(`
            id,
            name,
            address,
            tax_objects (
              nop,
              location_name,
              amount_due,
              status,
              year,
              original_name,
              blok,
              persil
            )
          `)
          .in('id', uniqueIds)
          .limit(20);

        const flats: any[] = [];
        data?.forEach((c: any) => {
          if (c.tax_objects?.length > 0) {
            c.tax_objects.forEach((t: any) => {
              // Client-side Filter
              const matchesName = c.name.toLowerCase().includes(query.toLowerCase())
              const matchesAsset =
                t.nop.includes(query) ||
                t.original_name?.toLowerCase().includes(query.toLowerCase()) ||
                t.blok?.toLowerCase().includes(query.toLowerCase()) ||
                t.persil?.toLowerCase().includes(query.toLowerCase());

              if (matchesName || matchesAsset) {
                flats.push({
                  id: c.id, // ID sekarang sudah tersedia karena ada di select atas
                  name: c.name,
                  address: c.address,
                  nop: t.nop,
                  loc: t.location_name,
                  year: t.year || '-',
                  amount: t.amount_due,
                  status: t.status,
                  original_name: t.original_name,
                  blok: t.blok,
                  persil: t.persil,
                  other_owners: []
                })
              }
            })
          }
        });

        // 5. Fetch Shared NOP Info (FIXED LOGIC)
        const resultNops = flats.map(f => f.nop);
        if (resultNops.length > 0) {
          // A. Ambil detail NOP dan pemiliknya
          const { data: sharedObjects } = await supabase
            .from('tax_objects')
            .select(`
              nop,
              amount_due,
              citizens (
                id,
                name,
                address
              )
            `)
            .in('nop', resultNops);

          if (sharedObjects && sharedObjects.length > 0) {
            // B. Grouping by NOP
            const nopMap: Record<string, any[]> = {};

            sharedObjects.forEach((obj: any) => {
              if (obj.citizens) {
                if (!nopMap[obj.nop]) nopMap[obj.nop] = [];

                nopMap[obj.nop].push({
                  id: obj.citizens.id,
                  name: obj.citizens.name,
                  address: obj.citizens.address || '-',
                  amount: obj.amount_due
                });
              }
            });

            // C. Attach to flats & Filter user sendiri
            flats.forEach(f => {
              if (nopMap[f.nop]) {
                // Filter: Buang data jika ID-nya sama dengan ID orang yang sedang ditampilkan
                const others = nopMap[f.nop].filter((o: any) => String(o.id) !== String(f.id));

                if (others.length > 0) {
                  f.other_owners = others;
                }
              }
            });
          }
        }

        setResults(flats);
      } catch (err) {
        console.error(err)
      } finally {
        setIsSearching(false)
      }
    }, 500) // 500ms delay

    return () => clearTimeout(delayDebounceFn)
  }, [query])


  return (
    <div className="min-h-screen bg-background flex flex-col font-sans text-foreground">

      {/* Header */}
      <header className="fixed top-0 w-full z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-primary p-1.5 rounded-lg text-primary-foreground">
              <Building2 size={20} />
            </div>
            <span className="font-bold text-lg tracking-tight text-foreground">PBB Desa Kemang</span>
          </div>
          <Link href="/login">
            <Button variant="outline" size="sm" className="rounded-full px-4 bg-card text-foreground border-border hover:bg-muted font-medium">Login Admin</Button>
          </Link>
        </div>
      </header>

      <main className="flex-1 pt-24 pb-12 px-4 container mx-auto flex flex-col items-center gap-12">

        {/* Hero Section */}
        <div className="text-center space-y-4 max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary/10 text-primary rounded-full text-xs font-semibold uppercase tracking-wide mb-2">
            <CheckCircle size={12} /> Portal Resmi 2025
          </div>
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-foreground">
            Transparansi Pajak <br />
            <span className="bg-gradient-to-r from-primary to-cyan-500 bg-clip-text text-transparent">Membangun Desa</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-lg mx-auto leading-relaxed">
            Pantau realisasi pendapatan pajak bumi dan bangunan serta cek status tagihan Anda secara real-time.
          </p>
        </div>

        {/* Search Widget */}
        <div className="w-full max-w-xl animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-100">
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-primary to-cyan-500 rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-1000"></div>
            <div className="relative bg-card rounded-xl shadow-xl p-2 flex items-center gap-2 border border-border">
              <Search className="text-muted-foreground ml-3" />
              <input
                className="flex-1 bg-transparent border-none outline-none text-lg text-foreground placeholder:text-muted-foreground/50 h-12"
                placeholder="Ketik Nama, NOP, Blok, Persil, atau Nama Asal..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              {isSearching && <Loader2 className="animate-spin text-primary mr-3" />}
            </div>
          </div>

          {/* Live Search Results */}
          {query.length >= 3 && (
            <div className="mt-4 space-y-3">
              {results.length > 0 ? (
                results.map((r, i) => (
                  <div key={i} className="bg-card p-4 rounded-xl border border-border shadow-sm hover:shadow-md transition-all flex justify-between items-center group cursor-default">
                    <div className="flex flex-col">
                      <span className="font-bold text-foreground group-hover:text-primary transition-colors">{r.name}</span>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mt-1">
                        <span className="bg-muted px-1.5 py-0.5 rounded font-mono text-foreground">{r.nop}</span>
                        <span className="flex items-center gap-1"><MapPin size={10} /> {r.loc} • {r.year}</span>
                      </div>

                      {/* Search Matches & Details */}
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {r.blok && (
                          <Badge variant="outline" className={`text-[10px] h-4 px-1 ${r.blok.toLowerCase().includes(query.toLowerCase()) ? 'bg-yellow-100 text-yellow-800 border-yellow-200' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>
                            Blok {r.blok}
                          </Badge>
                        )}
                        {r.persil && (
                          <Badge variant="outline" className={`text-[10px] h-4 px-1 ${r.persil.toLowerCase().includes(query.toLowerCase()) ? 'bg-warning/10 text-warning border-warning/20' : 'bg-muted text-muted-foreground border-border'}`}>
                            Persil {r.persil}
                          </Badge>
                        )}
                        {r.original_name && (
                          <Badge variant="outline" className={`text-[10px] h-4 px-1 ${r.original_name.toLowerCase().includes(query.toLowerCase()) ? 'bg-warning/10 text-warning border-warning/20' : 'bg-muted text-muted-foreground border-border'}`}>
                            Ex: {r.original_name}
                          </Badge>
                        )}
                        {r.nop.includes(query) && (
                          <Badge variant="outline" className="text-[10px] h-4 px-1 bg-warning/10 text-warning border-warning/20">NOP</Badge>
                        )}
                      </div>
                      {/* Tampilan Info NOP Ganda Minimalis */}
                      {r.other_owners && r.other_owners.length > 0 && (
                        <div className="mt-3 bg-warning/5 border border-warning/20 rounded-lg overflow-hidden animate-in fade-in">
                          {/* Header Kecil */}
                          <div className="px-3 py-1.5 bg-warning/10 border-b border-warning/10 flex items-center gap-1.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-warning animate-pulse"></div>
                            <span className="text-[10px] font-semibold text-warning uppercase tracking-wide">
                              Data Lain pada NOP ini:
                            </span>
                          </div>

                          {/* List Minimalis */}
                          <div className="flex flex-col divide-y divide-warning/10">
                            {r.other_owners.map((owner: any, idx: number) => (
                              <div key={idx} className="flex justify-between items-center px-3 py-2 hover:bg-warning/5 transition-colors">
                                <div className="flex flex-col gap-0.5">
                                  <span className="text-[11px] font-bold text-foreground leading-none">
                                    {owner.name}
                                  </span>
                                  <span className="text-[10px] text-muted-foreground flex items-center gap-1 leading-none">
                                    <MapPin size={8} /> {owner.address}
                                  </span>
                                </div>
                                <div className="text-right">
                                  <span className="text-[11px] font-mono font-medium text-muted-foreground bg-background/50 px-1.5 py-0.5 rounded border border-border">
                                    Rp {owner.amount.toLocaleString('id-ID')}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {/* ================================== */}
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-foreground">Rp {r.amount.toLocaleString('id-ID')}</div>
                      <div className={`text-[10px] font-bold uppercase tracking-wider mt-1 ${r.status === 'paid' ? 'text-success' : 'text-destructive'}`}>
                        {r.status === 'paid' ? 'LUNAS' : 'BELUM BAYAR'}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                !isSearching && (
                  <div className="text-center p-6 bg-card/50 border border-dashed border-border rounded-xl text-muted-foreground">
                    Data tidak ditemukan. Pastikan ejaan nama benar.
                  </div>
                )
              )}
            </div>
          )}
        </div>

        {/* Public Stats Grid */}
        <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-10 duration-1000 delay-200">
          <StatsCard
            title="Pajak Terkumpul"
            value={`Rp ${(stats.paidAmount / 1000000).toFixed(1)} Jt`}
            desc="Uang masuk ke Kas Desa"
            color="primary"
          />
          <StatsCard
            title="Potensi Pajak"
            value={`Rp ${(stats.unpaidAmount / 1000000).toFixed(1)} Jt`}
            desc="Belum terbayarkan"
            color="warning"
          />
          <StatsCard
            title="Partisipasi Warga"
            value={`${stats.paidCount} Transaksi`}
            desc="Lunas tahun ini"
            color="success"
          />
        </div>

        {/* Pie Chart Section */}
        <div className="w-full max-w-md animate-in fade-in slide-in-from-bottom-12 duration-1000 delay-300">
          <div className="bg-card p-6 rounded-2xl border border-border shadow-sm flex flex-col items-center">
            <h3 className="text-center font-bold text-foreground mb-4 flex items-center gap-2">
              <TrendingUp size={18} className="text-primary" />
              Rasio Kepatuhan Pajak
            </h3>

            {/* Total Target Summary */}
            <div className="text-center mb-4">
              <p className="text-xs text-muted-foreground uppercase tracking-widest font-semibold">Total Target Realisasi</p>
              <p className="text-2xl font-extrabold text-foreground">
                Rp {(stats.paidAmount + stats.unpaidAmount).toLocaleString('id-ID')}
              </p>
            </div>

            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    fill="#8884d8"
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: any) => `Rp ${Number(value).toLocaleString('id-ID')}`}
                    contentStyle={{ borderRadius: '12px', borderColor: 'var(--color-border)', backgroundColor: 'var(--color-card)', color: 'var(--color-foreground)' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="flex justify-center gap-6 mt-2 text-xs font-medium border-t border-border pt-4 w-full">
              <div className="text-center">
                <div className="flex items-center gap-2 justify-center mb-1">
                  <div className="w-3 h-3 rounded-full bg-success"></div>
                  <span className="text-muted-foreground">Sudah Masuk</span>
                </div>
                <span className="font-bold text-success text-sm">{(stats.percentage)}%</span>
              </div>
              <div className="text-center">
                <div className="flex items-center gap-2 justify-center mb-1">
                  <div className="w-3 h-3 rounded-full bg-warning"></div>
                  <span className="text-muted-foreground">Belum Bayar</span>
                </div>
                <span className="font-bold text-warning text-sm">{(100 - stats.percentage)}%</span>
              </div>
            </div>
          </div>
        </div>

      </main>

      {/* Footer */}
      <footer className="bg-card border-t border-border py-12">
        <div className="container mx-auto px-4 text-center space-y-8">
          <div className="flex flex-col items-center gap-2">
            <div className="flex items-center gap-2 font-bold text-foreground text-xl">
              <Building2 className="text-primary" />
              Desa Kemang
            </div>
            <p className="text-muted-foreground text-sm max-w-md mx-auto">
              Sistem Informasi Digital Pengelolaan Pajak Bumi dan Bangunan (PBB-P2). <br />
              Mewujudkan tata kelola desa yang transparan dan akuntabel.
            </p>
          </div>

          {/* External Links */}
          <div className="flex flex-wrap justify-center gap-4 text-sm font-medium">
            <a
              href="https://desakemang.my.id"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors bg-muted/50 px-4 py-2 rounded-full border border-border hover:border-primary/30"
            >
              <Globe size={16} />
              Website Desa Kemang
              <ExternalLink size={12} className="opacity-50" />
            </a>
            <a
              href="https://pbbdesakemang.vercel.app"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors bg-muted/50 px-4 py-2 rounded-full border border-border hover:border-primary/30"
            >
              <CheckCircle size={16} />
              Bayar Pajak Online
              <ExternalLink size={12} className="opacity-50" />
            </a>
          </div>

          <div className="pt-4 border-t border-border w-24 mx-auto"></div>
          <div className="text-xs text-muted-foreground">
            &copy; 2025 Pemerintah Desa Kemang &bull; All rights reserved
          </div>
        </div>
      </footer>
    </div>
  )
}

function StatsCard({ title, value, desc, color }: any) {
  const colors: any = {
    primary: "bg-primary/5 text-primary border-primary/20",
    warning: "bg-warning/5 text-warning border-warning/20",
    success: "bg-success/5 text-success border-success/20",
  }
  return (
    <div className={`p-6 rounded-2xl border ${colors[color].replace('text-', 'border-')} bg-card shadow-sm flex flex-col items-center text-center space-y-2 hover:-translate-y-1 transition-transform duration-300`}>
      <span className="text-sm font-medium text-muted-foreground uppercase tracking-widest">{title}</span>
      <span className={`text-3xl font-extrabold ${colors[color].split(" ")[1]}`}>{value}</span>
      <span className="text-xs text-muted-foreground/80">{desc}</span>
    </div>
  )
}
