'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import { 
  Users, Ticket, Search, CheckCircle, Clock, 
  LogOut, TrendingUp, Activity, Terminal, Shield, Coffee, Filter,
  Tag, Plus, Trash2, Edit3, Printer, Mail, Phone, Eye, RefreshCw,
  X
} from 'lucide-react';
import { Ticket as TicketType, TicketStatus, Coupon } from '../../../lib/types';
import Link from 'next/link';
import Image from 'next/image';

type Tab = 'overview' | 'coupons' | 'subscribers' | 'tickets';

export default function DashboardClient() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [tickets, setTickets] = useState<TicketType[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<TicketStatus | 'all'>('all');
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Modal States
  const [showCouponModal, setShowCouponModal] = useState(false);
  const [newCoupon, setNewCoupon] = useState({ code: '', discount: '' });

  const fetchData = useCallback(async () => {
    try {
      const [ticketsRes, couponsRes] = await Promise.all([
        fetch('/api/admin/tickets'),
        fetch('/api/admin/coupons')
      ]);
      
      if (ticketsRes.ok) {
        const ticketsData = await ticketsRes.json();
        setTickets(ticketsData);
      }
      
      if (couponsRes.ok) {
        const couponsData = await couponsRes.json();
        setCoupons(couponsData);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const isAuth = document.cookie.split(';').some(c => c.trim().startsWith('admin_auth=true'));
    if (!isAuth) {
      router.replace('/admin/login');
      return;
    }
    
    requestAnimationFrame(() => {
      fetchData();
    });
  }, [refreshTrigger, router, fetchData]);

  // Auto-sync de pagamentos a cada 60 segundos para garantir robustez
  useEffect(() => {
    if (activeTab !== 'tickets' && activeTab !== 'overview') return;
    
    const interval = setInterval(() => {
      console.log('[AUTO-SYNC] Iniciando sincronização automática...');
      handleSync(true); // true para modo silencioso
    }, 20000); // 20 segundos
    
    return () => clearInterval(interval);
  }, [activeTab]);

  const [isSyncing, setIsSyncing] = useState(false);

  const handleSync = async (silent = false) => {
    setIsSyncing(true);
    try {
      const res = await fetch('/api/admin/sync-payments', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        if (!silent) {
          alert(`${data.updatedCount} pagamentos foram sincronizados e atualizados!`);
        }
        if (data.updatedCount > 0) {
          setRefreshTrigger(p => p + 1);
        }
      }
    } catch (error) {
      console.error('Sync error:', error);
      if (!silent) alert('Erro ao sincronizar pagamentos.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleCheckIn = async (id: string) => {
    if (!confirm('DESEJA REALIZAR O CHECK-IN DESTE INGRESSO?')) return;
    try {
      const res = await fetch('/api/admin/tickets/check-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (res.ok) setRefreshTrigger(p => p + 1);
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/coupons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCoupon),
      });
      if (res.ok) {
        setRefreshTrigger(p => p + 1);
        setShowCouponModal(false);
        setNewCoupon({ code: '', discount: '' });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteCoupon = async (id: string) => {
    if (!confirm('Excluir este cupom?')) return;
    try {
      const res = await fetch(`/api/admin/coupons?id=${id}`, { method: 'DELETE' });
      if (res.ok) setRefreshTrigger(p => p + 1);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteTicket = async (id: string) => {
    if (!confirm('Deseja realmente excluir este cadastro? Esta ação é irreversível.')) return;
    try {
      const res = await fetch(`/api/admin/tickets?id=${id}`, { method: 'DELETE' });
      if (res.ok) setRefreshTrigger(p => p + 1);
    } catch (err) {
      console.error(err);
    }
  };

  const handleChangeStatus = async (id: string, newStatus: TicketStatus) => {
    try {
      const res = await fetch('/api/admin/tickets', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: newStatus }),
      });
      if (res.ok) setRefreshTrigger(p => p + 1);
    } catch (err) {
      console.error(err);
    }
  };

  const [isResending, setIsResending] = useState<string | null>(null);

  const handleResendWhatsApp = async (id: string) => {
    setIsResending(id);
    try {
      const res = await fetch('/api/admin/tickets/resend-whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        alert('Solicitação de reenvio enviada ao bot!');
        setRefreshTrigger(p => p + 1);
      } else {
        alert('Erro ao reenviar. Verifique se o bot está online.');
      }
    } catch (err) {
      console.error(err);
      alert('Erro de conexão ao tentar reenviar.');
    } finally {
      setIsResending(null);
    }
  };

  const printParticipantsList = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const html = `
      <html>
        <head>
          <title>Lista de Participantes - Chá com Prosa</title>
          <style>
            body { font-family: sans-serif; padding: 40px; }
            h1 { color: #880022; border-bottom: 2px solid #880022; padding-bottom: 10px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
            th { bg-color: #f9f9f9; font-size: 12px; text-transform: uppercase; }
            tr:nth-child(even) { background-color: #fff9fa; }
            .status { font-weight: bold; font-size: 10px; }
          </style>
        </head>
        <body>
          <h1>Lista de Participantes - Chá com Prosa 2026</h1>
          <p>Total de inscritas: ${tickets.length} | Data da extração: ${new Date().toLocaleDateString('pt-BR')}</p>
          <table>
            <thead>
              <tr>
                <th>Nome</th>
                <th>E-mail</th>
                <th>Telefone</th>
                <th>Status</th>
                <th>Assinatura/Check-in</th>
              </tr>
            </thead>
            <tbody>
              ${tickets.map(t => `
                <tr>
                  <td>${t.name}</td>
                  <td>${t.email}</td>
                  <td>${t.phone}</td>
                  <td class="status">${t.status.toUpperCase()}</td>
                  <td>_______________________</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <script>window.print();</script>
        </body>
      </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
  };

  const filteredTickets = tickets.filter(t => {
    const term = searchTerm.toLowerCase();
    const matchesSearch = t.name.toLowerCase().includes(term) || 
                          t.email.toLowerCase().includes(term) ||
                          t.phone.toLowerCase().includes(term) ||
                          t.code.toLowerCase().includes(term);
    const matchesFilter = filter === 'all' || t.status === filter;
    return matchesSearch && matchesFilter;
  });

  const stats = {
    total: tickets.length,
    paid: tickets.filter(t => t.status === TicketStatus.PAID).length,
    checkedIn: tickets.filter(t => t.status === TicketStatus.USED).length,
    revenue: tickets.filter(t => t.status !== TicketStatus.PENDING).length * 57
  };

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const sidebarItems = [
    { id: 'overview', label: 'Visão Geral', icon: Activity },
    { id: 'coupons', label: 'Cupons', icon: Tag },
    { id: 'subscribers', label: 'Participantes', icon: Users },
    { id: 'tickets', label: 'Ingressos', icon: Ticket },
  ];

  return (
    <div className="min-h-screen bg-rose-50/10 text-on-surface flex flex-col lg:flex-row font-sans selection:bg-secondary-container selection:text-primary relative">
      {/* Mobile Header */}
      <div className="lg:hidden bg-primary p-4 flex items-center justify-between sticky top-0 z-[100] shadow-lg">
        <div className="flex items-center gap-3">
          <Coffee className="w-5 h-5 text-white" />
          <span className="font-serif italic text-lg text-white">Chá com Prosa</span>
        </div>
        <button 
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="p-2 text-white bg-white/10 rounded-lg"
        >
          {isSidebarOpen ? <X /> : <Activity />}
        </button>
      </div>

      {/* Sidebar overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[90] lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-[100] w-72 bg-gradient-to-b from-primary to-primary-container text-white 
        transform transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        flex flex-col border-r border-rose-100/10 shadow-2xl lg:shadow-none
      `}>
        <div className="p-10 border-b border-white/5">
          <div className="flex items-center gap-4">
             <div className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center">
                <Coffee className="w-5 h-5 text-white" />
             </div>
             <div>
                <span className="font-serif italic text-xl block leading-none text-white">Chá com Prosa</span>
                <span className="text-[9px] uppercase font-bold tracking-[0.2em] text-white/40">Portal de Gestão</span>
             </div>
          </div>
        </div>

        <nav className="flex-1 p-6 space-y-2">
          {sidebarItems.map((item) => {
            const Icon = item.icon;
            return (
              <button 
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id as Tab);
                  setIsSidebarOpen(false);
                }}
                className={`w-full flex items-center gap-4 px-6 py-4 rounded-2xl font-bold transition-all text-sm ${activeTab === item.id ? 'bg-white/10 text-white shadow-lg' : 'text-white/50 hover:bg-white/5 hover:text-white'}`}
              >
                <Icon className="w-5 h-5" />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="p-6">
          <button 
            onClick={() => {
              document.cookie = "admin_auth=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
              window.location.href = '/admin/login';
            }}
            className="w-full flex items-center justify-center gap-3 bg-white/10 text-white p-4 rounded-2xl hover:bg-white/20 transition-all font-bold text-xs uppercase tracking-widest"
          >
            Sair do Sistema
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 h-screen overflow-y-auto">
        <header className="bg-white/80 backdrop-blur-md border-b border-rose-100 flex items-center justify-between sticky top-0 z-50">
           <div className="max-w-[1200px] mx-auto w-full px-8 py-6 flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-serif text-primary font-bold">
                  {sidebarItems.find(i => i.id === activeTab)?.label}
                </h1>
                <p className="text-[10px] text-stone-400 uppercase font-bold tracking-widest">Controle Administrativo</p>
              </div>
              
              {activeTab === 'subscribers' && (
                <button 
                  onClick={printParticipantsList}
                  className="flex items-center gap-2 bg-stone-100 hover:bg-stone-200 text-stone-700 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm"
                >
                  <Printer className="w-4 h-4" />
                  Imprimir Lista
                </button>
              )}

              {activeTab === 'coupons' && (
                <button 
                  onClick={() => setShowCouponModal(true)}
                  className="flex items-center gap-2 bg-gradient-to-br from-[#C87A9F] to-[#D98BB0] text-white px-4 py-2 rounded-xl text-xs font-bold hover:shadow-lg transition-all shadow-md transform active:scale-95"
                >
                  <Plus className="w-4 h-4" />
                  Criar Cupom
                </button>
              )}

              {activeTab === 'overview' && (
                <div className="flex items-center gap-6">
                   <div className="text-right">
                      <p className="text-xs font-bold uppercase tracking-widest text-primary">Admin</p>
                      <p className="text-[10px] text-stone-400 uppercase font-black">Conectado</p>
                   </div>
                   <div className="w-12 h-12 rounded-full overflow-hidden bg-rose-50 border border-rose-100 shadow-sm">
                      <Image src="https://picsum.photos/seed/admin/100/100" alt="Avatar" width={48} height={48} className="w-full h-full object-cover" />
                   </div>
                </div>
              )}
           </div>
        </header>

        <div className="max-w-[1200px] mx-auto w-full px-8 py-8 space-y-8">
          {activeTab === 'overview' && (
            <div className="space-y-8">
               <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  {[
                    { label: 'Total Inscritas', value: stats.total, color: 'text-stone-900', icon: Users },
                    { label: 'Confirmados', value: stats.paid, color: 'text-green-600', icon: CheckCircle },
                    { label: 'Check-ins', value: stats.checkedIn, color: 'text-blue-600', icon: Activity },
                    { label: 'Receita Est.', value: `R$ ${stats.revenue}`, color: 'text-primary', icon: TrendingUp },
                  ].map((stat, i) => (
                    <div key={i} className="bg-white p-6 border border-rose-100 rounded-2xl shadow-sm relative overflow-hidden group transition-all duration-300 hover:translate-y-[-5px] hover:shadow-[0_12px_30px_rgba(0,0,0,0.08)]">
                       <p className="text-[9px] font-bold uppercase tracking-widest text-stone-400 mb-1">{stat.label}</p>
                       <p className={`text-2xl font-serif font-bold ${stat.color}`}>{stat.value}</p>
                       <stat.icon className="w-12 h-12 absolute -right-4 -bottom-4 text-rose-50 opacity-20 transform -rotate-12 group-hover:scale-125 transition-transform" />
                    </div>
                  ))}
               </div>

               <div className="bg-white rounded-2xl border border-rose-100 p-8 shadow-sm">
                  <div className="flex items-center justify-between mb-8">
                    <h3 className="font-serif text-xl font-bold text-primary">Inscrições Recentes</h3>
                    <button onClick={() => setActiveTab('tickets')} className="text-xs font-bold text-primary hover:underline">Ver todas</button>
                  </div>
                  <div className="space-y-4">
                    {tickets.length === 0 ? (
                      <div className="p-12 text-center text-stone-300 italic text-sm">Nenhuma inscrição encontrada</div>
                    ) : tickets.slice(0, 5).map(t => (
                      <div key={t.id} className="flex items-center justify-between p-4 bg-rose-50/30 rounded-xl border border-rose-100">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center border border-rose-100 text-primary">
                            <Users className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="font-bold text-stone-700 text-sm">{t.name}</p>
                            <p className="text-[10px] text-stone-400 capitalize">{t.status} • {new Date(t.createdAt).toLocaleDateString()}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                           <span className="text-xs font-mono font-bold text-stone-400">{t.id}</span>
                        </div>
                      </div>
                    ))}
                  </div>
               </div>
            </div>
          )}

          {activeTab === 'coupons' && (
            <div className="space-y-6">
               <div className="bg-white rounded-2xl border border-rose-100 overflow-hidden shadow-sm">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-rose-50/50 text-[10px] font-bold uppercase tracking-widest text-stone-400 border-b border-rose-100">
                        <th className="p-6">Código</th>
                        <th className="p-6">Desconto</th>
                        <th className="p-6">Criado em</th>
                        <th className="p-6 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-rose-50">
                      {coupons.length === 0 ? (
                        <tr><td colSpan={4} className="p-12 text-center text-stone-400 italic text-sm">Nenhum cupom cadastrado</td></tr>
                      ) : coupons.map(c => (
                        <tr key={c.id}>
                          <td className="p-6 font-mono font-bold text-primary">{c.code}</td>
                          <td className="p-6 font-bold text-stone-700">R$ {parseFloat(c.discount.toString()).toFixed(2)}</td>
                          <td className="p-6 text-xs text-stone-400">{new Date(c.createdAt).toLocaleDateString()}</td>
                          <td className="p-6 text-right">
                            <button onClick={() => handleDeleteCoupon(c.id)} className="p-2 text-stone-300 hover:text-red-500 transition-colors">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
               </div>
            </div>
          )}

          {(activeTab === 'subscribers' || activeTab === 'tickets') && (
            <div className="space-y-6">
              <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                 <div className="flex flex-1 gap-4 items-center w-full">
                    <div className="relative w-full max-w-sm">
                        <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" />
                        <input 
                          type="text"
                          placeholder={`Buscar em ${activeTab === 'subscribers' ? 'participantes' : 'ingressos'}...`}
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="w-full bg-white border border-rose-100 rounded-xl py-3 pl-12 pr-4 outline-none focus:ring-2 focus:ring-primary/10 transition-all text-sm shadow-sm"
                        />
                    </div>
                    <button 
                      onClick={handleSync}
                      disabled={isSyncing}
                      title="Sincronizar pagamentos pendentes com Mercado Pago"
                      className={`p-3 bg-white border border-rose-100 rounded-xl text-stone-400 hover:text-primary hover:border-primary/20 transition-all shadow-sm ${isSyncing ? 'animate-spin cursor-not-allowed' : ''}`}
                    >
                      <RefreshCw className="w-5 h-5" />
                    </button>
                 </div>
                 <div className="flex gap-2 p-1 bg-white border border-rose-100 rounded-xl shadow-sm">
                    {['all', TicketStatus.PAID, TicketStatus.PENDING, TicketStatus.USED, TicketStatus.CANCELLED].map((f) => (
                      <button 
                        key={f}
                        onClick={() => setFilter(f as any)}
                        className={`px-4 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${filter === f ? 'bg-primary text-white shadow-sm' : 'text-stone-400 hover:text-primary'}`}
                      >
                        {f === 'all' ? 'Ver Todos' : f}
                      </button>
                    ))}
                 </div>
              </div>

              <div className="bg-white rounded-2xl border border-rose-100 overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-rose-50/50 text-[10px] font-bold uppercase tracking-widest text-stone-400 border-b border-rose-100">
                        {activeTab === 'subscribers' ? (
                          <>
                            <th className="p-6">Participante</th>
                            <th className="p-6">Contato</th>
                            <th className="p-6">Data Insc.</th>
                            <th className="p-6 text-right">Ações</th>
                          </>
                        ) : (
                          <>
                            <th className="p-6">Ingresso</th>
                            <th className="p-6">Status</th>
                            <th className="p-6">Pagamento</th>
                            <th className="p-6 text-right">Controle</th>
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-rose-50 text-sm">
                      {filteredTickets.map((t) => (
                        <tr key={t.id} className="hover:bg-rose-50/20 transition-colors">
                          {activeTab === 'subscribers' ? (
                            <>
                              <td className="p-6">
                                <p className="font-serif font-bold text-primary">{t.name}</p>
                                <p className="text-[9px] text-stone-400 font-mono tracking-tight uppercase">{t.document || 'Sem Documento'}</p>
                              </td>
                              <td className="p-6">
                                <div className="space-y-1">
                                  <p className="text-xs text-stone-600 flex items-center gap-2"><Mail className="w-3 h-3 text-primary/40" /> {t.email}</p>
                                  <p className="text-xs text-stone-600 flex items-center gap-2"><Phone className="w-3 h-3 text-primary/40" /> {t.phone}</p>
                                </div>
                              </td>
                              <td className="p-6 text-xs text-stone-400">{new Date(t.createdAt).toLocaleDateString()}</td>
                              <td className="p-6 text-right">
                                <div className="flex justify-end gap-2">
                                  <button className="p-2 text-stone-300 hover:text-primary transition-colors"><Edit3 className="w-4 h-4" /></button>
                                  <button onClick={() => handleDeleteTicket(t.id)} className="p-2 text-stone-300 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                                </div>
                              </td>
                            </>
                          ) : (
                            <>
                              <td className="p-6">
                                <p className="font-serif font-bold text-primary uppercase text-xs tracking-widest">{t.id}</p>
                                <p className="text-[10px] text-stone-400 font-medium text-wrap max-w-[150px]">{t.name}</p>
                              </td>
                              <td className="p-6">
                                <select 
                                  value={t.status}
                                  onChange={(e) => handleChangeStatus(t.id, e.target.value as TicketStatus)}
                                  className={`text-[9px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-full border border-rose-100 outline-none appearance-none cursor-pointer text-center min-w-[100px] ${
                                    t.status === TicketStatus.PAID ? 'bg-green-50 text-green-700 border-green-100' : 
                                    t.status === TicketStatus.USED ? 'bg-blue-50 text-blue-700 border-blue-100' : 
                                    t.status === TicketStatus.CANCELLED ? 'bg-rose-50 text-rose-700 border-rose-100' :
                                    'bg-orange-50 text-orange-700 border-orange-100'
                                  }`}
                                >
                                  <option value={TicketStatus.PENDING}>Pendente</option>
                                  <option value={TicketStatus.PAID}>Pago</option>
                                  <option value={TicketStatus.USED}>Utilizado</option>
                                  <option value={TicketStatus.CANCELLED}>Cancelado</option>
                                </select>
                              </td>
                              <td className="p-6">
                                <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">{t.paymentMethod || 'PIX'}</p>
                              </td>
                              <td className="p-6 text-right">
                                <div className="flex justify-end gap-3">
                                  {t.status === TicketStatus.PAID && (
                                    <button 
                                      onClick={() => handleResendWhatsApp(t.id)} 
                                      disabled={isResending === t.id}
                                      className={`p-2 transition-all hover:scale-110 ${t.whatsapp_sent ? 'text-green-500 hover:text-green-600' : 'text-stone-300 hover:text-primary'} ${isResending === t.id ? 'animate-spin' : ''}`}
                                      title={t.whatsapp_sent ? "WhatsApp já enviado. Clique para reenviar." : "Enviar WhatsApp agora"}
                                    >
                                      <Phone className="w-4 h-4" />
                                    </button>
                                  )}
                                  <Link href={`/ticket/${t.id}`} target="_blank" className="p-2 text-stone-300 hover:text-primary transition-all hover:scale-110"><Eye className="w-4 h-4" /></Link>
                                  <button onClick={() => fetchData()} className="p-2 text-stone-300 hover:text-primary transition-all hover:scale-110"><RefreshCw className="w-4 h-4" /></button>
                                </div>
                              </td>
                            </>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Coupon Modal */}
      {showCouponModal && (
        <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-white rounded-[32px] w-full max-w-md p-10 shadow-2xl relative border border-rose-100"
          >
            <button onClick={() => setShowCouponModal(false)} className="absolute top-8 right-8 text-stone-300 hover:text-stone-600 transition-colors"><X /></button>
            <div className="mb-8">
              <div className="w-12 h-12 bg-rose-50 rounded-2xl flex items-center justify-center text-primary mb-4">
                <Tag className="w-6 h-6" />
              </div>
              <h3 className="font-serif text-2xl font-bold text-primary">Novo Cupom</h3>
              <p className="text-xs text-stone-400 font-medium">Crie descontos para suas convidadas.</p>
            </div>

            <form onSubmit={handleAddCoupon} className="space-y-6">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-2 block pl-1">Código do Cupom</label>
                <input 
                  type="text" 
                  value={newCoupon.code}
                  onChange={e => setNewCoupon(p => ({ ...p, code: e.target.value.toUpperCase() }))}
                  placeholder="EX: PROSA10"
                  className="w-full bg-stone-50 border border-stone-100 rounded-2xl px-6 py-4 outline-none focus:ring-2 focus:ring-primary/10 transition-all font-mono font-bold text-primary"
                  required
                />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-2 block pl-1">Valor do Desconto (R$)</label>
                <input 
                  type="number" 
                  value={newCoupon.discount}
                  onChange={e => setNewCoupon(p => ({ ...p, discount: e.target.value }))}
                  placeholder="0.00"
                  className="w-full bg-stone-50 border border-stone-100 rounded-2xl px-6 py-4 outline-none focus:ring-2 focus:ring-primary/10 transition-all font-bold text-stone-700"
                  required
                />
              </div>
              <button type="submit" className="w-full bg-gradient-to-br from-[#880022] to-[#550011] text-white p-5 rounded-2xl font-bold shadow-xl hover:shadow-[#880022]/20 transition-all transform active:scale-95 mt-4">
                Criar Cupom Agora
              </button>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
