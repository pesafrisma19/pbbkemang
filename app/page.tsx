"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabaseClient"
import { Card, CardContent } from "@/components/ui/Card"
import { Input } from "@/components/ui/Input"
import { Badge } from "@/components/ui/Badge"
import { Button } from "@/components/ui/Button"
import { Search, Loader2, MapPin, CheckCircle, TrendingUp, Building2, Globe, ExternalLink, Sun, Moon, Menu, X, Home as HomeIcon, MessageSquare, Users, ChevronDown, ChevronUp } from "lucide-react"
import Link from "next/link"
import dynamic from 'next/dynamic'
const LandingPieChart = dynamic(() => import('@/components/features/LandingPieChart'), {
  ssr: false,
  loading: () => <div className="h-[220px] w-full bg-muted/20 animate-pulse rounded-full"></div>
})

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
          .select('id, group_id')
          .ilike('name', `%${query}%`)
          .limit(20)

        // 2. Search by Group Name
        const { data: groupHits } = await supabase
          .from('citizen_groups')
          .select('id')
          .ilike('name', `%${query}%`)
          .limit(10)

        // 3. Search by Asset Fields (NOP, Original Name, Blok, Persil)
        const { data: assetHits } = await supabase
          .from('tax_objects')
          .select('citizen_id')
          .or(`nop.ilike.%${query}%,original_name.ilike.%${query}%,blok.ilike.%${query}%,persil.ilike.%${query}%`)
          .limit(20)

        // 4. Collect IDs
        const explicitCitizenIds = new Set<string>()
        const targetGroupIds = new Set<string>()

        nameHits?.forEach(x => {
          explicitCitizenIds.add(x.id)
          if (x.group_id) targetGroupIds.add(x.group_id)
        })

        groupHits?.forEach(x => targetGroupIds.add(x.id))

        assetHits?.forEach(x => explicitCitizenIds.add(x.citizen_id))

        // If we have asset hits, we need to check if those citizens belong to a group
        // But doing a separate query usually is fine or we just let "fetch full" handle it.
        // Optimization: Just query all explicit citizens first to get their group_ids, then expand?
        // Let's iterate: We have explicitCitizenIds. We want to fetch them. 
        // If they have a group_id, we want to fetch their siblings too.

        // 5. Construct Filter
        // We want: WHERE (id IN explicitCitizenIds) OR (group_id IN targetGroupIds)
        // But supabase "or" syntax with "in" is tricky.
        // Easier: Fetch citizens where ID in explicitCitizenIds. Collect their group_ids.
        // Then merge with targetGroupIds. Then fetch ALL by group_id.
        // Finally merge results.

        let allGroupIds = Array.from(targetGroupIds);
        let allCitizenIds = Array.from(explicitCitizenIds);

        if (allCitizenIds.length === 0 && allGroupIds.length === 0) {
          setResults([])
          setIsSearching(false)
          return
        }

        // Fetch Initial Citizens to discover more groups
        if (allCitizenIds.length > 0) {
          const { data: initialCitizens } = await supabase
            .from('citizens')
            .select('group_id')
            .in('id', allCitizenIds)

          initialCitizens?.forEach(c => {
            if (c.group_id) allGroupIds.push(c.group_id)
          })
        }

        // Deduplicate
        allGroupIds = Array.from(new Set(allGroupIds));

        // 6. FINAL DATA FETCH
        // Condition: group_id IN allGroupIds OR id IN allCitizenIds
        // Note: If a citizen is in a group in allGroupIds, they will be fetched by the first condition.
        // So we just need to be careful not to fetch duplicates? Supabase returns rows.

        let queryBuilder = supabase.from('citizens').select(`
            id,
            name,
            address,
            group_id,
            citizen_groups ( id, name ),
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

        if (allGroupIds.length > 0 && allCitizenIds.length > 0) {
          queryBuilder = queryBuilder.or(`group_id.in.(${allGroupIds.join(',')}),id.in.(${allCitizenIds.join(',')})`)
        } else if (allGroupIds.length > 0) {
          queryBuilder = queryBuilder.in('group_id', allGroupIds)
        } else {
          queryBuilder = queryBuilder.in('id', allCitizenIds)
        }

        const { data: rawData } = await queryBuilder.limit(50); // increased limit for groups

        // 7. Process & Group Results
        // We want to structure: 
        // [ { type: 'group', group: {...}, members: [...] }, { type: 'individual', ... } ]

        const processedGroups: Record<string, { group: any, members: any[] }> = {}
        const processedIndividuals: any[] = []

        rawData?.forEach((c: any) => {
          // Flatten Assets
          const assets = c.tax_objects?.map((t: any) => ({
            nop: t.nop.replace(/[.]/g, ''),
            raw_nop: t.nop,
            loc: t.location_name,
            year: t.year || '-',
            amount: t.amount_due,
            status: t.status,
            original_name: t.original_name,
            blok: t.blok,
            persil: t.persil
          })) || []

          const citizenData = {
            id: c.id,
            name: c.name,
            address: c.address,
            assets: assets,
            group_id: c.group_id,
            group_name: c.citizen_groups?.name
          }

          if (c.group_id && c.citizen_groups) {
            if (!processedGroups[c.group_id]) {
              processedGroups[c.group_id] = {
                group: { id: c.citizen_groups.id, name: c.citizen_groups.name },
                members: []
              }
            }
            processedGroups[c.group_id].members.push(citizenData)
          } else {
            // Individual
            // Only add if it matches the search criteria directly? 
            // (It must, since we fetched by IDs).
            // But wait, if we fetched by Group, we get all members. 
            // If we fetched by Name, we got the specific person.

            // For individual, display flat list of assets? 
            // Existing UI expects a flattened object per asset? 
            // The OLD UI mapped results = flats (1 row per asset).
            // BUT we want to show Group Cards.
            // Hybrid Approach:
            // - If Group: Show Group Card.
            // - If Individual: Show Individual Card (aggregating assets) OR 1 row per asset?
            // The User asked: "bisa jadi 1 gth di daftar listya" (One item in the list).
            // So Individual should also be aggregated per Person? 
            // Existing code: `flats.push({ ... })` per Asset.
            // Let's stick to Aggregated Person Card for Individuals to be consistent with Group Card.
            // OR KEEP Old Logic for non-groups? 
            // "1 orang bisa lebih dari 1 sppt" -> Old logic handled this by showing multiple cards or 1 card?
            // Old logic: `flats.push` inside `c.tax_objects.forEach`. It showed 1 card PER ASSET.
            // User Request: "1 orang bisa lebih dari 1 sppt... aku ingin buat 1 group... nama beda nik beda tapi bisa jadi 1 gth".
            // This implies they want Aggregation.
            // So I should probably switch to "1 Card per Person" (or Group) instead of "1 Card per Asset".

            processedIndividuals.push(citizenData)
          }
        })

        // Convert to Array
        const finalResults = [
          ...Object.values(processedGroups).map(g => ({ type: 'group', ...g })),
          ...processedIndividuals.map(i => ({ type: 'individual', ...i }))
        ]

        // Calculate Totals for sorting/display
        finalResults.forEach((r: any) => {
          if (r.type === 'group') {
            r.totalAmount = r.members.reduce((sum: number, m: any) => sum + m.assets.reduce((a: number, s: any) => a + s.amount, 0), 0)
            r.totalAssets = r.members.reduce((sum: number, m: any) => sum + m.assets.length, 0)
            r.unpaidCount = r.members.reduce((sum: number, m: any) => sum + m.assets.filter((a: any) => a.status !== 'paid').length, 0)
          } else {
            r.totalAmount = r.assets.reduce((sum: number, a: any) => sum + a.amount, 0)
            r.totalAssets = r.assets.length
            r.unpaidCount = r.assets.filter((a: any) => a.status !== 'paid').length
            r.status = r.unpaidCount === 0 && r.totalAssets > 0 ? 'paid' : 'unpaid' // Derived status
          }
        })

        setResults(finalResults)
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
            <Button variant="ghost" size="icon" onClick={() => setMobileMenuOpen(false)} aria-label="Tutup Menu">
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
            <button className="md:hidden p-2 -ml-2 text-muted-foreground hover:text-foreground" onClick={() => setMobileMenuOpen(true)} aria-label="Buka Menu">
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
            <Button variant="ghost" size="icon" onClick={toggleTheme} className="rounded-full text-muted-foreground hover:text-foreground hover:bg-muted" aria-label="Ganti Tema">
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
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary/10 text-primary-700 dark:text-primary rounded-full text-xs font-bold uppercase tracking-wide mb-2 border border-primary/20">
            <CheckCircle size={12} /> Portal Resmi 2025
          </div>
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-foreground">
            Transparansi Pajak <br />
            <span className="bg-gradient-to-r from-primary to-cyan-500 bg-clip-text text-transparent">Membangun Desa</span>
          </h1>
          <p className="text-lg text-foreground/80 max-w-lg mx-auto leading-relaxed">
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
                  <div key={i} className="bg-card w-full rounded-xl border border-border shadow-sm hover:shadow-md transition-all overflow-hidden group">

                    {/* Header: Name or Group Name */}
                    <div className="p-4 border-b border-border/50 bg-muted/20 flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-full ${r.type === 'group' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                          {r.type === 'group' ? <Users size={18} /> : <Building2 size={18} />}
                        </div>
                        <div>
                          <h3 className="font-bold text-foreground text-base">
                            {r.type === 'group' ? `Kelompok: ${r.group.name}` : r.name}
                          </h3>
                          <div className="text-xs text-muted-foreground flex items-center gap-2">
                            {r.type === 'group' ? (
                              <span>{r.members.length} Anggota</span>
                            ) : (
                              <span>{r.address}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-lg text-foreground">Rp {r.totalAmount.toLocaleString('id-ID')}</div>
                        <div className={`text-[10px] font-bold uppercase tracking-wider ${r.unpaidCount === 0 ? 'text-success' : 'text-warning'}`}>
                          {r.unpaidCount === 0 && r.totalAssets > 0 ? 'LUNAS' : `BELUM LUNAS (${r.unpaidCount})`}
                        </div>
                      </div>
                    </div>

                    {/* Content: List of Taxes */}
                    <div className="p-0">
                      {r.type === 'group' ? (
                        <div className="divide-y divide-border/50">
                          {r.members.map((m: any, idx: number) => (
                            <div key={idx} className="p-3 pl-4 sm:pl-8 bg-card/30">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="font-semibold text-sm">{m.name}</span>
                                <span className="text-xs text-muted-foreground">({m.address})</span>
                              </div>
                              <div className="space-y-2">
                                {m.assets.map((asset: any, aidx: number) => (
                                  <AssetRow key={aidx} asset={asset} query={query} />
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="p-4 space-y-3">
                          {r.assets.length > 0 ? (
                            r.assets.map((asset: any, aidx: number) => (
                              <AssetRow key={aidx} asset={asset} query={query} />
                            ))
                          ) : (
                            <p className="text-sm text-muted-foreground italic">Tidak ada data aset.</p>
                          )}
                        </div>
                      )}
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
            <h2 className="text-center font-bold text-foreground mb-1 flex items-center gap-2">
              <TrendingUp size={18} className="text-primary" />
              Rasio Kepatuhan
            </h2>
            <p className="text-xs text-foreground/70 mb-6">Update Data Realtime</p>

            <div className="w-full relative min-w-0">
              {/* Center Text */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none h-[220px]">
                <span className="text-3xl font-extrabold text-foreground">{stats.percentage}%</span>
                <span className="text-[10px] text-foreground/60 uppercase tracking-widest">Realisasi</span>
              </div>
              <LandingPieChart data={chartData} />
            </div>

            <div className="flex justify-center gap-8 mt-4 text-xs font-medium w-full">
              <div className="text-center px-4 py-2 bg-muted/30 rounded-lg">
                <div className="flex items-center gap-1.5 justify-center mb-1">
                  <div className="w-2 h-2 rounded-full bg-success"></div>
                  <span className="text-foreground/70">Sudah Masuk</span>
                </div>
                <span className="font-bold text-foreground text-sm">Rp {(stats.paidAmount / 1000000).toFixed(1)} Jt</span>
              </div>
              <div className="text-center px-4 py-2 bg-muted/30 rounded-lg">
                <div className="flex items-center gap-1.5 justify-center mb-1">
                  <div className="w-2 h-2 rounded-full bg-warning"></div>
                  <span className="text-foreground/70">Belum Bayar</span>
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
            <p className="text-foreground/70 text-sm max-w-md mx-auto leading-normal">
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
              className="flex items-center justify-center gap-2 text-foreground/70 hover:text-primary transition-colors bg-muted/50 px-5 py-2.5 rounded-full border border-border hover:border-primary/30"
            >
              <Globe size={16} />
              Website Desa Kemang
              <ExternalLink size={12} className="opacity-50" />
            </a>
            <a
              href="https://pbbdesakemang.vercel.app"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 text-foreground/70 hover:text-primary transition-colors bg-muted/50 px-5 py-2.5 rounded-full border border-border hover:border-primary/30"
            >
              <CheckCircle size={16} />
              Bayar Pajak Online
              <ExternalLink size={12} className="opacity-50" />
            </a>
          </div>

          <div className="pt-6 border-t border-border w-24 mx-auto"></div>
          <div className="text-xs text-foreground/60">
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
        <span className="text-xs font-bold text-foreground/70 uppercase tracking-wider block mb-1">{title}</span>
        <span className="text-2xl md:text-3xl font-extrabold text-foreground tracking-tight">{value}</span>
      </div>
      <span className="text-xs text-foreground/60 flex items-center gap-1">
        {desc}
      </span>
    </div>
  )
}

function AssetRow({ asset, query }: { asset: any, query: string }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2 rounded hover:bg-muted/50 transition-colors">
      <div className="flex-1">
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
          <span className="font-mono bg-muted px-1 rounded">{asset.nop}</span>
          <span>{asset.loc}</span>
          <span>• {asset.year}</span>
        </div>
        {/* Search Matches */}
        <div className="flex flex-wrap gap-1">
          {asset.blok && (
            <Badge variant="outline" className={`text-[10px] h-4 px-1 ${asset.blok.toLowerCase().includes(query.toLowerCase()) ? 'bg-yellow-100 text-yellow-800' : ''}`}>
              Blok {asset.blok}
            </Badge>
          )}
          {asset.original_name && (
            <Badge variant="outline" className={`text-[10px] h-4 px-1 ${asset.original_name.toLowerCase().includes(query.toLowerCase()) ? 'bg-orange-100 text-orange-800' : ''}`}>
              Ex: {asset.original_name}
            </Badge>
          )}
        </div>
      </div>
      <div className="text-right flex items-center gap-3 justify-end">
        <span className="font-medium text-sm">Rp {asset.amount.toLocaleString('id-ID')}</span>
        <Badge variant={asset.status === 'paid' ? 'default' : 'destructive'} className={`${asset.status === 'paid' ? 'bg-success hover:bg-success/90' : 'bg-destructive/90'} text-[10px] h-5`}>
          {asset.status === 'paid' ? 'Lunas' : 'Belum'}
        </Badge>
      </div>
    </div>
  )
}
