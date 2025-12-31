"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabaseClient"
import { Card, CardContent } from "@/components/ui/Card"
import { Input } from "@/components/ui/Input"
import { Badge } from "@/components/ui/Badge"
import { Button } from "@/components/ui/Button"
import { Search, Loader2, MapPin, CheckCircle, TrendingUp, Building2, Globe, ExternalLink, Sun, Moon, Menu, X, Home as HomeIcon, MessageSquare } from "lucide-react"
import Link from "next/link"
import dynamic from 'next/dynamic'
const PieChart = dynamic(() => import('recharts').then(mod => mod.PieChart), { ssr: false, loading: () => <div className="h-[220px] w-full bg-muted/20 animate-pulse rounded-full"></div> })
const Pie = dynamic(() => import('recharts').then(mod => mod.Pie), { ssr: false })
const Cell = dynamic(() => import('recharts').then(mod => mod.Cell), { ssr: false })
const ResponsiveContainer = dynamic(() => import('recharts').then(mod => mod.ResponsiveContainer), { ssr: false })
const Tooltip = dynamic(() => import('recharts').then(mod => mod.Tooltip), { ssr: false })
import { useTheme } from "next-themes"

export default function Home() {
  const [activeTab, setActiveTab] = useState<'stats' | 'search'>('search')

  // Theme State
  const { theme, setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  // Mobile Menu State
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

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

  // Initialize Theme (Wait for mount to avoid hydration mismatch)
  useEffect(() => {
    setMounted(true)
  }, [])

  const toggleTheme = () => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')
  }

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
              const matchesName = c.name.toLowerCase().includes(query.toLowerCase())
              const searchClean = query.replace(/[.]/g, '');
              const matchesAsset =
                t.nop.includes(searchClean) ||
                t.original_name?.toLowerCase().includes(query.toLowerCase()) ||
                t.blok?.toLowerCase().includes(query.toLowerCase()) ||
                t.persil?.toLowerCase().includes(query.toLowerCase());

              if (matchesName || matchesAsset) {
                flats.push({
                  id: c.id,
                  name: c.name,
                  address: c.address,
                  nop: t.nop.replace(/[.]/g, ''),
                  raw_nop: t.nop, // Keep raw for querying
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

        // 5. Fetch Shared NOP Info
        const resultNops = flats.map(f => f.raw_nop);
        if (resultNops.length > 0) {
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
            const nopMap: Record<string, any[]> = {};

            sharedObjects.forEach((obj: any) => {
              if (obj.citizens) {
                // Normalize key to dot-less to match flat.nop
                const key = obj.nop.replace(/[.]/g, '');
                if (!nopMap[key]) nopMap[key] = [];

                nopMap[key].push({
                  id: obj.citizens.id,
                  name: obj.citizens.name,
                  address: obj.citizens.address || '-',
                  amount: obj.amount_due
                });
              }
            });

            flats.forEach(f => {
              if (nopMap[f.nop]) {
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
    <div className={`min-h-screen bg-background flex flex-col font-sans transition-colors duration-300 text-foreground pb-20 md:pb-0`}>

      {/* Mobile Sidebar / Drawer */}
      <div className={`fixed inset-0 z-[60] transform ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} transition-transform duration-300 ease-in-out md:hidden`}>
        {/* Overlay */}
        <div className={`absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-300 ${mobileMenuOpen ? 'opacity-100' : 'opacity-0'}`} onClick={() => setMobileMenuOpen(false)}></div>

        {/* Drawer Content */}
        <div className="relative w-3/4 max-w-sm h-full bg-background border-r border-border shadow-2xl p-6 flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <span className="font-bold text-xl flex items-center gap-2">
              <Building2 className="text-primary" />
              Menu Desa
            </span>
            <Button variant="ghost" size="icon" onClick={() => setMobileMenuOpen(false)}>
              <X size={24} />
            </Button>
          </div>

          <nav className="flex flex-col gap-2">
            <Link href="/" className="flex items-center gap-3 px-4 py-3 rounded-xl bg-primary/10 text-primary font-medium">
              <HomeIcon size={20} />
              Beranda
            </Link>
            <Link href="#" className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground font-medium transition-colors">
              <MessageSquare size={20} />
              Pengaduan
            </Link>
            <Link href="/login" className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground font-medium transition-colors">
              <ExternalLink size={20} />
              Login Admin
            </Link>
          </nav>

          <div className="mt-auto pt-6 border-t border-border">
            <p className="text-xs text-muted-foreground text-center">
              &copy; 2025 Pemerintah Desa Kemang
            </p>
          </div>
        </div>
      </div>


      {/* Header */}
      <header className="fixed top-0 w-full z-50 bg-background/80 backdrop-blur-md border-b border-border transition-colors duration-300">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* Mobile Menu Button */}
            <button className="md:hidden p-2 -ml-2 text-muted-foreground hover:text-foreground" onClick={() => setMobileMenuOpen(true)}>
              <Menu size={24} />
            </button>
            <div className="bg-primary/10 p-1.5 rounded-lg text-primary">
              <Building2 size={20} />
            </div>
            <span className="font-bold text-lg tracking-tight text-foreground hidden md:block">PBB Desa Kemang</span>
            <span className="font-bold text-lg tracking-tight text-foreground md:hidden">PBB Kemang</span>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-6 absolute left-1/2 transform -translate-x-1/2">
            <Link href="/" className="text-sm font-medium text-foreground hover:text-primary transition-colors">
              Beranda
            </Link>
            <Link href="#" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
              Pengaduan
            </Link>
          </nav>

          <div className="flex items-center gap-3">
            {/* Theme Toggle */}
            <Button variant="ghost" size="icon" onClick={toggleTheme} className="rounded-full text-muted-foreground hover:text-foreground hover:bg-muted">
              {mounted && (resolvedTheme === 'dark' ? <Sun size={20} /> : <Moon size={20} />)}
            </Button>

            <div className="hidden md:block">
              <Link href="/login">
                <Button variant="outline" size="sm" className="rounded-full px-4 bg-background text-foreground border-border hover:bg-muted font-medium">Login Admin</Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 pt-24 pb-12 px-4 container mx-auto flex flex-col items-center gap-12">

        {/* Hero Section */}
        <div className="text-center space-y-4 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary/10 text-primary rounded-full text-xs font-semibold uppercase tracking-wide mb-2 border border-primary/20">
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
                className="flex-1 bg-transparent border-none outline-none text-lg text-foreground placeholder:text-muted-foreground/50 h-10 md:h-12 w-full"
                placeholder="Cari Nama / NOP / Blok..."
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
                  <div key={i} className="bg-card p-4 rounded-xl border border-border shadow-sm hover:shadow-md transition-all flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 group cursor-default">
                    <div className="flex flex-col w-full">
                      <div className="flex justify-between items-start w-full">
                        <span className="font-bold text-foreground group-hover:text-primary transition-colors text-base">{r.name}</span>
                        <div className={`sm:hidden text-xs font-bold uppercase tracking-wider px-2 py-1 rounded-full ${r.status === 'paid' ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}`}>
                          {r.status === 'paid' ? 'LUNAS' : 'BELUM'}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mt-1">
                        <span className="bg-muted px-1.5 py-0.5 rounded font-mono text-foreground">{r.nop}</span>
                        <span className="flex items-center gap-1"><MapPin size={10} /> {r.loc} • {r.year}</span>
                      </div>

                      {/* Search Matches & Details */}
                      <div className="flex flex-wrap gap-1 mt-2">
                        {r.blok && (
                          <Badge variant="outline" className={`text-[10px] h-5 px-1.5 ${r.blok.toLowerCase().includes(query.toLowerCase()) ? 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800' : 'bg-muted text-muted-foreground border-border'}`}>
                            Blok {r.blok}
                          </Badge>
                        )}
                        {r.persil && (
                          <Badge variant="outline" className={`text-[10px] h-5 px-1.5 ${r.persil.toLowerCase().includes(query.toLowerCase()) ? 'bg-warning/10 text-warning border-warning/20' : 'bg-muted text-muted-foreground border-border'}`}>
                            Persil {r.persil}
                          </Badge>
                        )}
                        {r.original_name && (
                          <Badge variant="outline" className={`text-[10px] h-5 px-1.5 ${r.original_name.toLowerCase().includes(query.toLowerCase()) ? 'bg-warning/10 text-warning border-warning/20' : 'bg-muted text-muted-foreground border-border'}`}>
                            Ex: {r.original_name}
                          </Badge>
                        )}
                      </div>

                      {/* Expanded NOP Info */}
                      {r.other_owners && r.other_owners.length > 0 && (
                        <div className="mt-3 bg-muted/30 border border-muted rounded-lg overflow-hidden animate-in fade-in">
                          <div className="px-3 py-1.5 bg-muted/50 border-b border-muted flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-warning"></div>
                            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Gabungan NOP:</span>
                          </div>
                          <div className="flex flex-col divide-y divide-border/50">
                            {r.other_owners.map((owner: any, idx: number) => (
                              <div key={idx} className="flex justify-between items-center px-3 py-2 hover:bg-muted/30">
                                <div>
                                  <div className="text-[11px] font-bold text-foreground">{owner.name}</div>
                                  <div className="text-[10px] text-muted-foreground">{owner.address}</div>
                                </div>
                                <span className="text-[10px] font-mono text-muted-foreground">Rp {owner.amount.toLocaleString('id-ID')}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                    </div>

                    <div className="hidden sm:block text-right min-w-max">
                      <div className="font-bold text-foreground text-lg">Rp {r.amount.toLocaleString('id-ID')}</div>
                      <div className={`text-[10px] font-bold uppercase tracking-wider mt-1 ${r.status === 'paid' ? 'text-success' : 'text-destructive'}`}>
                        {r.status === 'paid' ? 'LUNAS' : 'BELUM BAYAR'}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                !isSearching && (
                  <div className="text-center p-8 bg-card border border-dashed border-border rounded-xl text-muted-foreground">
                    <p>Data tidak ditemukan.</p>
                    <p className="text-sm mt-1 opacity-70">Pastikan ejaan nama atau NOP benar.</p>
                  </div>
                )
              )}
            </div>
          )}
        </div>

        {/* Public Stats Grid */}
        <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 animate-in fade-in slide-in-from-bottom-10 duration-1000 delay-200">
          <StatsCard
            title="Pajak Terkumpul"
            value={`Rp ${(stats.paidAmount / 1000000).toFixed(1)} Jt`}
            desc="Pendapatan Masuk"
            color="primary"
            icon={<CheckCircle className="text-primary w-5 h-5" />}
          />
          <StatsCard
            title="Potensi Pajak"
            value={`Rp ${(stats.unpaidAmount / 1000000).toFixed(1)} Jt`}
            desc="Belum Terbayar"
            color="warning"
            icon={<TrendingUp className="text-warning w-5 h-5" />}
          />
          <StatsCard
            title="Partisipasi"
            value={`${stats.paidCount} Transaksi`}
            desc="Warga Taat Pajak"
            color="success"
            icon={<Building2 className="text-success w-5 h-5" />}
          />
        </div>

        {/* Pie Chart Section */}
        <div className="w-full max-w-md animate-in fade-in slide-in-from-bottom-12 duration-1000 delay-300">
          <div className="bg-card p-6 rounded-2xl border border-border shadow-sm flex flex-col items-center hover:shadow-md transition-shadow">
            <h3 className="text-center font-bold text-foreground mb-1 flex items-center gap-2">
              <TrendingUp size={18} className="text-primary" />
              Rasio Kepatuhan
            </h3>
            <p className="text-xs text-muted-foreground mb-6">Update Data Realtime</p>

            <div className="w-full relative min-w-0">
              {/* Center Text */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none h-[220px]">
                <span className="text-3xl font-extrabold text-foreground">{stats.percentage}%</span>
                <span className="text-[10px] text-muted-foreground uppercase tracking-widest">Realisasi</span>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={65}
                    outerRadius={85}
                    cornerRadius={5}
                    paddingAngle={4}
                    dataKey="value"
                    stroke="none"
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: any) => `Rp ${Number(value).toLocaleString('id-ID')}`}
                    contentStyle={{ borderRadius: '12px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-card)', color: 'var(--color-foreground)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                    itemStyle={{ color: 'var(--color-foreground)' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="flex justify-center gap-8 mt-4 text-xs font-medium w-full">
              <div className="text-center px-4 py-2 bg-muted/30 rounded-lg">
                <div className="flex items-center gap-1.5 justify-center mb-1">
                  <div className="w-2 h-2 rounded-full bg-success"></div>
                  <span className="text-muted-foreground">Sudah Masuk</span>
                </div>
                <span className="font-bold text-foreground text-sm">Rp {(stats.paidAmount / 1000000).toFixed(1)} Jt</span>
              </div>
              <div className="text-center px-4 py-2 bg-muted/30 rounded-lg">
                <div className="flex items-center gap-1.5 justify-center mb-1">
                  <div className="w-2 h-2 rounded-full bg-warning"></div>
                  <span className="text-muted-foreground">Belum Bayar</span>
                </div>
                <span className="font-bold text-foreground text-sm">Rp {(stats.unpaidAmount / 1000000).toFixed(1)} Jt</span>
              </div>
            </div>
          </div>
        </div>

      </main>

      {/* Footer */}
      <footer className="bg-card border-t border-border py-12 pb-24 md:pb-12">
        <div className="container mx-auto px-4 text-center space-y-8">
          <div className="flex flex-col items-center gap-3">
            <div className="flex items-center gap-2 font-bold text-foreground text-xl">
              <Building2 className="text-primary" />
              Desa Kemang
            </div>
            <p className="text-muted-foreground text-sm max-w-md mx-auto leading-normal">
              Sistem Informasi Digital Pengelolaan Pajak Bumi dan Bangunan (PBB-P2). <br className="hidden md:block" />
              Mewujudkan tata kelola desa yang transparan dan akuntabel.
            </p>
          </div>

          {/* External Links */}
          <div className="flex flex-col md:flex-row justify-center gap-3 md:gap-4 text-sm font-medium">
            <a
              href="https://desakemang.my.id"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 text-muted-foreground hover:text-primary transition-colors bg-muted/50 px-5 py-2.5 rounded-full border border-border hover:border-primary/30"
            >
              <Globe size={16} />
              Website Desa Kemang
              <ExternalLink size={12} className="opacity-50" />
            </a>
            <a
              href="https://pbbdesakemang.vercel.app"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 text-muted-foreground hover:text-primary transition-colors bg-muted/50 px-5 py-2.5 rounded-full border border-border hover:border-primary/30"
            >
              <CheckCircle size={16} />
              Bayar Pajak Online
              <ExternalLink size={12} className="opacity-50" />
            </a>
          </div>

          <div className="pt-6 border-t border-border w-24 mx-auto"></div>
          <div className="text-xs text-muted-foreground">
            &copy; 2025 Pemerintah Desa Kemang &bull; All rights reserved
          </div>
        </div>
      </footer>
    </div>
  )
}

function StatsCard({ title, value, desc, color, icon }: any) {
  // Mapping simplified for Tailwind safe-listing if needed, but here we use simple dynamic classes or inline styles if complex
  const borderColor = {
    primary: "hover:border-primary/50",
    warning: "hover:border-warning/50",
    success: "hover:border-success/50"
  }[color as string] || "hover:border-primary/50";

  return (
    <div className={`group p-5 rounded-2xl border border-border bg-card shadow-sm hover:shadow-md transition-all duration-300 flex flex-col items-start space-y-3 ${borderColor}`}>
      <div className={`p-2.5 rounded-lg bg-muted text-foreground group-hover:bg-${color}/10 group-hover:text-${color} transition-colors`}>
        {icon}
      </div>
      <div>
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-1">{title}</span>
        <span className="text-2xl md:text-3xl font-extrabold text-foreground tracking-tight">{value}</span>
      </div>
      <span className="text-xs text-muted-foreground/80 flex items-center gap-1">
        {desc}
      </span>
    </div>
  )
}
