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
        const { data } = await supabase
          .from('citizens')
          .select(`
            name,
            address,
            tax_objects (
              nop,
              location_name,
              amount_due,
              status,
              year
            )
          `)
          .ilike('name', `%${query}%`)
          .limit(10);

        const flats: any[] = [];
        data?.forEach((c: any) => {
          if (c.tax_objects?.length > 0) {
            c.tax_objects.forEach((t: any) => {
              flats.push({
                name: c.name,
                address: c.address,
                nop: t.nop,
                loc: t.location_name,
                year: t.year || '-',
                amount: t.amount_due,
                status: t.status
              })
            })
          }
        });
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
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900">

      {/* Header */}
      <header className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-blue-600 p-1.5 rounded-lg text-white">
              <Building2 size={20} />
            </div>
            <span className="font-bold text-lg tracking-tight text-slate-800">PBB Desa Kemang</span>
          </div>
          <Link href="/login">
            <Button variant="outline" size="sm" className="rounded-full px-4">Login Admin</Button>
          </Link>
        </div>
      </header>

      <main className="flex-1 pt-24 pb-12 px-4 container mx-auto flex flex-col items-center gap-12">

        {/* Hero Section */}
        <div className="text-center space-y-4 max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-semibold uppercase tracking-wide mb-2">
            <CheckCircle size={12} /> Portal Resmi 2025
          </div>
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-slate-900">
            Transparansi Pajak <br />
            <span className="bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent">Membangun Desa</span>
          </h1>
          <p className="text-lg text-slate-500 max-w-lg mx-auto leading-relaxed">
            Pantau realisasi pendapatan pajak bumi dan bangunan serta cek status tagihan Anda secara real-time.
          </p>
        </div>

        {/* Search Widget */}
        <div className="w-full max-w-xl animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-100">
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-cyan-500 rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-1000"></div>
            <div className="relative bg-white rounded-xl shadow-xl p-2 flex items-center gap-2 border border-slate-100">
              <Search className="text-slate-400 ml-3" />
              <input
                className="flex-1 bg-transparent border-none outline-none text-lg placeholder:text-slate-400 h-12"
                placeholder="Ketik Nama Wajib Pajak..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              {isSearching && <Loader2 className="animate-spin text-blue-500 mr-3" />}
            </div>
          </div>

          {/* Live Search Results */}
          {query.length >= 3 && (
            <div className="mt-4 space-y-3">
              {results.length > 0 ? (
                results.map((r, i) => (
                  <div key={i} className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-all flex justify-between items-center group cursor-default">
                    <div className="flex flex-col">
                      <span className="font-bold text-slate-800 group-hover:text-blue-600 transition-colors">{r.name}</span>
                      <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                        <span className="bg-slate-100 px-1.5 py-0.5 rounded font-mono text-slate-600">{r.nop}</span>
                        <span className="flex items-center gap-1"><MapPin size={10} /> {r.loc} • {r.year}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-slate-900">Rp {r.amount.toLocaleString('id-ID')}</div>
                      <div className={`text-[10px] font-bold uppercase tracking-wider mt-1 ${r.status === 'paid' ? 'text-green-600' : 'text-red-500'}`}>
                        {r.status === 'paid' ? 'LUNAS' : 'BELUM BAYAR'}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                !isSearching && (
                  <div className="text-center p-6 bg-white/50 border border-dashed rounded-xl text-slate-400">
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
            color="blue"
          />
          <StatsCard
            title="Potensi Pajak"
            value={`Rp ${(stats.unpaidAmount / 1000000).toFixed(1)} Jt`}
            desc="Belum terbayarkan"
            color="orange"
          />
          <StatsCard
            title="Partisipasi Warga"
            value={`${stats.paidCount} Transaksi`}
            desc="Lunas tahun ini"
            color="green"
          />
        </div>

        {/* Pie Chart Section */}
        <div className="w-full max-w-md animate-in fade-in slide-in-from-bottom-12 duration-1000 delay-300">
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center">
            <h3 className="text-center font-bold text-slate-800 mb-4 flex items-center gap-2">
              <TrendingUp size={18} className="text-blue-600" />
              Rasio Kepatuhan Pajak
            </h3>

            {/* Total Target Summary */}
            <div className="text-center mb-4">
              <p className="text-xs text-slate-500 uppercase tracking-widest font-semibold">Total Target Realisasi</p>
              <p className="text-2xl font-extrabold text-slate-900">
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
                    contentStyle={{ borderRadius: '12px', borderColor: '#f1f5f9' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="flex justify-center gap-6 mt-2 text-xs font-medium border-t pt-4 w-full">
              <div className="text-center">
                <div className="flex items-center gap-2 justify-center mb-1">
                  <div className="w-3 h-3 rounded-full bg-green-600"></div>
                  <span className="text-slate-600">Sudah Masuk</span>
                </div>
                <span className="font-bold text-green-600 text-sm">{(stats.percentage)}%</span>
              </div>
              <div className="text-center">
                <div className="flex items-center gap-2 justify-center mb-1">
                  <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                  <span className="text-slate-600">Belum Bayar</span>
                </div>
                <span className="font-bold text-orange-500 text-sm">{(100 - stats.percentage)}%</span>
              </div>
            </div>
          </div>
        </div>

      </main>

      {/* Footer */}
      <footer className="bg-white border-t py-12">
        <div className="container mx-auto px-4 text-center space-y-8">
          <div className="flex flex-col items-center gap-2">
            <div className="flex items-center gap-2 font-bold text-slate-800 text-xl">
              <Building2 className="text-blue-600" />
              Desa Kemang
            </div>
            <p className="text-slate-500 text-sm max-w-md mx-auto">
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
              className="flex items-center gap-2 text-slate-600 hover:text-blue-600 transition-colors bg-slate-50 px-4 py-2 rounded-full border border-slate-100 hover:border-blue-200"
            >
              <Globe size={16} />
              Website Desa Kemang
              <ExternalLink size={12} className="opacity-50" />
            </a>
            <a
              href="https://pbbdesakemang.vercel.app"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-slate-600 hover:text-blue-600 transition-colors bg-slate-50 px-4 py-2 rounded-full border border-slate-100 hover:border-blue-200"
            >
              <CheckCircle size={16} />
              Bayar Pajak Online
              <ExternalLink size={12} className="opacity-50" />
            </a>
          </div>

          <div className="pt-4 border-t border-slate-100 w-24 mx-auto"></div>
          <div className="text-xs text-slate-400">
            &copy; 2025 Pemerintah Desa Kemang &bull; All rights reserved
          </div>
        </div>
      </footer>
    </div>
  )
}

function StatsCard({ title, value, desc, color }: any) {
  const colors: any = {
    blue: "bg-blue-50 text-blue-600 border-blue-100",
    orange: "bg-orange-50 text-orange-600 border-orange-100",
    green: "bg-green-50 text-green-600 border-green-100",
  }
  return (
    <div className={`p-6 rounded-2xl border ${colors[color].replace('text-', 'border-')} bg-white shadow-sm flex flex-col items-center text-center space-y-2 hover:-translate-y-1 transition-transform duration-300`}>
      <span className="text-sm font-medium text-slate-500 uppercase tracking-widest">{title}</span>
      <span className={`text-3xl font-extrabold ${colors[color].split(" ")[1]}`}>{value}</span>
      <span className="text-xs text-slate-400">{desc}</span>
    </div>
  )
}
