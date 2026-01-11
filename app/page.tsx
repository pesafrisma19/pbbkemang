"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabaseClient"
import { Input } from "@/components/ui/Input"
import { Badge } from "@/components/ui/Badge"
import { Button } from "@/components/ui/Button"
import { Search, Loader2, MapPin, CheckCircle, TrendingUp, Building2, Globe, ExternalLink, Sun, Moon, Menu, X, Home as HomeIcon, MessageSquare, Users } from "lucide-react"
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
  // Results State
  // Structure: { type: 'group' | 'single', data: any, id: string | number }
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({})

  const toggleCard = (id: string) => {
    setExpandedCards(prev => ({ ...prev, [id]: !prev[id] }))
  }

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
        setSearchResults([]);
        return;
      }

      setIsSearching(true);
      setExpandedCards({}); // Reset expansion on new search
      try {
        // 1. Search Logic: Find citizen IDs that match name or assets
        const { data: nameHits } = await supabase
          .from('citizens')
          .select('id, group_id')
          .ilike('name', `%${query}%`)
          .limit(20)

        const { data: assetHits } = await supabase
          .from('tax_objects')
          .select('citizen_id')
          .or(`nop.ilike.%${query}%,original_name.ilike.%${query}%,blok.ilike.%${query}%,persil.ilike.%${query}%`)
          .limit(20)

        // Collect all directly matched Citizen IDs and Group IDs
        const matchedCitizenIds = new Set<string>()
        const matchedGroupIds = new Set<string>()

        nameHits?.forEach(x => {
          matchedCitizenIds.add(x.id)
          if (x.group_id) matchedGroupIds.add(x.group_id)
        })

        // For asset hits, we need to fetch their group_id first to be sure (optimization: fetch citizen details for these IDs)
        const assetCitizenIds = assetHits?.map(x => x.citizen_id) || []
        if (assetCitizenIds.length > 0) {
          const { data: assetOwners } = await supabase
            .from('citizens')
            .select('id, group_id')
            .in('id', assetCitizenIds)

          assetOwners?.forEach(x => {
            matchedCitizenIds.add(x.id)
            if (x.group_id) matchedGroupIds.add(x.group_id)
          })
        }

        if (matchedCitizenIds.size === 0 && matchedGroupIds.size === 0) {
          setSearchResults([])
          setIsSearching(false)
          return
        }

        // 2. Fetch Data
        // A. Fetch ALL members of matched groups
        let groupMembers: any[] = []
        if (matchedGroupIds.size > 0) {
          const { data } = await supabase
            .from('citizens')
            .select(`
                    id, name, address, rt, rw, group_id,
                    tax_objects (nop, location_name, amount_due, status, year, original_name, blok, persil)
                `)
            .in('group_id', Array.from(matchedGroupIds))
          groupMembers = data || []
        }

        // B. Fetch ungrouped matched citizens (orphans) 
        // We only want citizens who matched the query BUT are NOT in the groups we already fetched
        const fetchedCitizenIdsInGroups = new Set(groupMembers.map(m => m.id))
        const orphanIdsToFetch = Array.from(matchedCitizenIds).filter(id => !fetchedCitizenIdsInGroups.has(id))

        let orphanMembers: any[] = []
        if (orphanIdsToFetch.length > 0) {
          const { data } = await supabase
            .from('citizens')
            .select(`
                    id, name, address, rt, rw, group_id,
                    tax_objects (nop, location_name, amount_due, status, year, original_name, blok, persil)
                `)
            .in('id', orphanIdsToFetch)
          orphanMembers = data || []
        }

        // 3. Process & Merge Data
        const allRaw = [...groupMembers, ...orphanMembers]

        // Process Function (calculate totals, etc)
        const processCitizen = (c: any) => {
          const assets = c.tax_objects || []
          const totalTax = assets.reduce((sum: number, a: any) => sum + a.amount_due, 0)
          const unpaidCount = assets.filter((a: any) => a.status !== 'paid').length
          // Calculate if this specific person matches the search query directly (for highlighting)
          const nameMatch = c.name.toLowerCase().includes(query.toLowerCase())
          const assetMatch = assets.some((a: any) =>
            a.nop.includes(query) ||
            (a.original_name && a.original_name.toLowerCase().includes(query.toLowerCase())) ||
            (a.blok && a.blok.toLowerCase().includes(query.toLowerCase())) ||
            (a.persil && a.persil.toLowerCase().includes(query.toLowerCase()))
          )
          return { ...c, totalTax, unpaidCount, assets, isMatch: nameMatch || assetMatch }
        }

        const processedAll = allRaw.map(processCitizen)

        // 4. Grouping & Sorting logic
        // Structure: [ { type: 'group', id: '1', members: [...] }, { type: 'single', data: ... } ]

        const finalStructure: any[] = []

        // A. Handle Groups
        const groupsMap = new Map<string, any[]>()
        processedAll.forEach(p => {
          if (p.group_id) {
            if (!groupsMap.has(p.group_id)) groupsMap.set(p.group_id, [])
            groupsMap.get(p.group_id)?.push(p)
          }
        })

        // Sort Groups by ID (assuming numeric usually, but stored as string sometimes?)
        // Let's try to parse int for sorting
        const sortedGroupIds = Array.from(groupsMap.keys()).sort((a, b) => {
          const numA = parseInt(a) || 999999
          const numB = parseInt(b) || 999999
          return numA - numB
        })

        sortedGroupIds.forEach(gid => {
          const members = groupsMap.get(gid)
          // Sort members: check if match query -> top, else unpaid count
          members?.sort((a, b) => {
            if (a.isMatch && !b.isMatch) return -1
            if (!a.isMatch && b.isMatch) return 1
            return b.unpaidCount - a.unpaidCount
          })
          finalStructure.push({ type: 'group', id: gid, members })
        })

        // B. Handle Orphans (Singles)
        const orphans = processedAll.filter(p => !p.group_id)
        orphans.sort((a, b) => b.unpaidCount - a.unpaidCount)

        orphans.forEach(o => {
          finalStructure.push({ type: 'single', data: o, id: o.id })
        })

        setSearchResults(finalStructure)

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
        <div className="w-full max-w-2xl animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-100">
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

          {/* Search Results */}
          {query.length >= 3 && (
            <div className="mt-6 space-y-8">
              {searchResults.length > 0 ? (
                searchResults.map((item) => {
                  if (item.type === 'group') {
                    // Calculate Group Total
                    const groupTotal = item.members.reduce((sum: number, m: any) => sum + m.totalTax, 0)
                    const groupUnpaid = item.members.reduce((sum: number, m: any) => sum + m.unpaidCount, 0)

                    return (
                      <div key={`group-${item.id}`} className="space-y-3">
                        <div className="flex items-center justify-between bg-blue-50 dark:bg-blue-900/20 px-4 py-3 rounded-xl border border-blue-100 dark:border-blue-800">
                          <div className="flex items-center gap-2">
                            <Users size={18} className="text-blue-600 dark:text-blue-400" />
                            <span className="font-bold text-blue-800 dark:text-blue-300">Group {item.id}</span>
                            <Badge variant="outline" className="ml-2 bg-blue-100/50 text-blue-700 border-blue-200">
                              {item.members.length} Anggota
                            </Badge>
                          </div>
                          <div className="text-right">
                            <div className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Total Group</div>
                            <div className="font-bold text-blue-700 dark:text-blue-400">Rp {groupTotal.toLocaleString('id-ID')}</div>
                          </div>
                        </div>

                        <div className="space-y-4 pl-2 border-l-2 border-blue-100 dark:border-blue-900/30 ml-4">
                          {item.members.map((citizen: any) => (
                            <CitizenCard
                              key={citizen.id}
                              citizen={citizen}
                              isExpanded={expandedCards[citizen.id] || false}
                              onToggle={() => toggleCard(citizen.id)}
                              highlight={citizen.isMatch}
                            />
                          ))}
                        </div>
                      </div>
                    )
                  } else {
                    const citizen = item.data;
                    return (
                      <CitizenCard
                        key={citizen.id}
                        citizen={citizen}
                        isExpanded={expandedCards[citizen.id] || false}
                        onToggle={() => toggleCard(citizen.id)}
                        highlight={citizen.isMatch}
                      />
                    )
                  }
                })
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
            value={`Rp ${stats.paidAmount.toLocaleString('id-ID')}`}
            desc="Pendapatan Masuk"
            color="primary"
            icon={<CheckCircle className="text-primary w-5 h-5" />}
          />
          <StatsCard
            title="Potensi Pajak"
            value={`Rp ${stats.unpaidAmount.toLocaleString('id-ID')}`}
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
                <span className="font-bold text-foreground text-sm">Rp {stats.paidAmount.toLocaleString('id-ID')}</span>
              </div>
              <div className="text-center px-4 py-2 bg-muted/30 rounded-lg">
                <div className="flex items-center gap-1.5 justify-center mb-1">
                  <div className="w-2 h-2 rounded-full bg-warning"></div>
                  <span className="text-foreground/70">Belum Bayar</span>
                </div>
                <span className="font-bold text-foreground text-sm">Rp {stats.unpaidAmount.toLocaleString('id-ID')}</span>
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

// Citizen Card Component
function CitizenCard({ citizen, isExpanded, onToggle, highlight }: any) {
  const hasShared = citizen.assets?.some((a: any) => a.otherOwners && a.otherOwners.length > 0)
  const fullyPaid = citizen.unpaidCount === 0

  return (
    <div className={`bg-card rounded-xl border shadow-sm overflow-hidden transition-all hover:shadow-md ${highlight ? 'border-border' : 'border-blue-200 dark:border-blue-800 bg-blue-50/30 dark:bg-blue-900/10'}`}>
      {/* Citizen Header */}
      <div
        className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 cursor-pointer hover:bg-muted/30 transition-colors"
        onClick={onToggle}
      >
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-lg text-foreground">{citizen.name}</h3>
            {!highlight && (
              <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
                KELUARGA
              </span>
            )}
            {/* Status Badge */}
            <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${fullyPaid ? 'bg-success/15 text-success' : 'bg-destructive/10 text-destructive'}`}>
              {fullyPaid ? 'LUNAS' : `${citizen.unpaidCount} BELUM BAYAR`}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <MapPin size={12} />
              {citizen.address}
              {(citizen.rt || citizen.rw) && ` (RT ${citizen.rt || '-'} / RW ${citizen.rw || '-'})`}
            </span>
            {citizen.group_id && (
              <span className="flex items-center gap-1 text-blue-500 bg-blue-500/10 px-1.5 py-0.5 rounded text-xs">
                <Building2 size={10} /> Group {citizen.group_id}
              </span>
            )}
            {hasShared && (
              <span className="flex items-center gap-1 text-warning bg-warning/10 px-1.5 py-0.5 rounded text-xs" title="Ada aset milik bersama">
                <CheckCircle size={10} /> Shared Aset
              </span>
            )}
          </div>
        </div>

        <div className="text-right">
          <div className="text-sm text-muted-foreground">Total Tagihan</div>
          <div className="font-extrabold text-lg">Rp {citizen.totalTax.toLocaleString('id-ID')}</div>
          <div className="text-xs text-primary mt-1 flex items-center justify-end gap-1">
            {isExpanded ? 'Sembunyikan' : 'Lihat Rincian'}
            {isExpanded ? <TrendingUp className="rotate-180" size={12} /> : <TrendingUp size={12} />}
          </div>
        </div>
      </div>

      {/* Assets List (Collapsible) */}
      {isExpanded && citizen.assets && (
        <div className="border-t border-border bg-muted/20 p-2 sm:p-4 space-y-3 animate-in fade-in slide-in-from-top-2 max-h-[60vh] overflow-y-auto">
          {citizen.assets.map((asset: any, idx: number) => (
            <div key={idx} className="bg-background rounded-lg border border-border/60 p-3 sm:flex justify-between items-center gap-4 group hover:border-primary/30 transition-colors">
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded text-foreground">{asset.nop}</span>
                  {asset.otherOwners?.length > 0 && (
                    <Badge variant="outline" className="text-[10px] h-5 px-1 bg-yellow-100 text-yellow-800 border-yellow-200" title={`Dimiliki juga oleh: ${asset.otherOwners.map((o: any) => o.name).join(', ')}`}>
                      👥 BERSAMA ({asset.otherOwners.length + 1})
                    </Badge>
                  )}
                </div>
                <div className="font-medium text-sm flex flex-wrap gap-2">
                  {asset.location_name}
                  <span className="text-muted-foreground font-normal">• {asset.year}</span>
                </div>

                {/* Meta Badges */}
                <div className="flex flex-wrap gap-1">
                  {asset.blok && <span className="text-[10px] border border-border px-1 rounded bg-muted/50 text-muted-foreground">Blok {asset.blok}</span>}
                  {asset.persil && <span className="text-[10px] border border-border px-1 rounded bg-muted/50 text-muted-foreground">Persil {asset.persil}</span>}
                  {asset.original_name && <span className="text-[10px] border border-border px-1 rounded bg-muted/50 text-muted-foreground italic">Ex: {asset.original_name}</span>}
                </div>

                {/* Shared Warning */}
                {asset.otherOwners?.length > 0 && (
                  <div className="mt-2 bg-yellow-50/50 dark:bg-yellow-900/10 border border-yellow-100 dark:border-yellow-900/30 rounded px-2 py-1.5 inline-block">
                    <span className="text-[10px] font-bold text-yellow-700 dark:text-yellow-500 block mb-0.5">PEMILIK LAIN:</span>
                    <div className="flex flex-col gap-1">
                      {asset.otherOwners.map((o: any, ox: number) => (
                        <div key={ox} className="flex items-center gap-2 text-[10px] text-muted-foreground">
                          <span className="font-medium">• {o.name}</span>
                          <span className="opacity-70 font-mono">(Rp {o.amount.toLocaleString('id-ID')})</span>
                          <span className={`px-1 rounded text-[9px] font-bold ${o.status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {o.status === 'paid' ? 'LUNAS' : 'BELUM'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-3 sm:mt-0 text-right min-w-[100px]">
                <div className="font-bold text-foreground text-base">Rp {asset.amount_due.toLocaleString('id-ID')}</div>
                <Badge variant={asset.status === 'paid' ? 'success' : 'destructive'} className="mt-1 text-[10px] h-5">
                  {asset.status === 'paid' ? 'LUNAS' : 'BELUM'}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function StatsCard({ title, value, desc, color, icon }: any) {
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
