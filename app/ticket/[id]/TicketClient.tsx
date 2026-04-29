'use client';

import { useMemo } from 'react';
import { motion } from 'motion/react';
import { Calendar, MapPin, Download, Share2, ArrowLeft, Coffee, Map } from 'lucide-react';
import { Ticket } from '@/lib/types';
import Link from 'next/link';

export default function TicketClient({ ticket }: { ticket: Ticket }) {
  const qrGrid = useMemo(() => {
    const seed = ticket.code.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return Array.from({ length: 144 }).map((_, i) => {
      const val = (seed * (i + 1)) % 100;
      return val > 35;
    });
  }, [ticket.code]);

  return (
    <div className="min-h-screen bg-rose-50/10 text-on-surface p-6 md:p-12 flex flex-col items-center font-sans selection:bg-secondary-container selection:text-primary">
      <div className="w-full max-w-[1200px]">
        <Link href="/" className="inline-flex items-center gap-4 text-stone-400 hover:text-primary transition-all mb-12 group">
          <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
          <span className="text-[10px] uppercase font-bold tracking-[0.4em]">Voltar ao Início</span>
        </Link>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white border-l-4 border-[#D98BB0] rounded-[16px] shadow-2xl shadow-primary/10 overflow-hidden relative transition-all duration-300 hover:shadow-[0_12px_30px_rgba(0,0,0,0.08)]"
        >
          {/* Header */}
          <div className="p-10 md:p-14 border-b border-rose-50 bg-gradient-to-br from-primary to-primary-container text-white flex flex-col md:flex-row justify-between items-start md:items-center gap-8 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-10 opacity-10">
               <Coffee className="w-32 h-32 rotate-12 text-white" />
            </div>
            <div className="space-y-2 relative z-10">
              <span className="text-[10px] uppercase font-bold tracking-[0.4em] opacity-70 italic text-white">Vaga Confirmada</span>
              <div className="flex items-center gap-3 text-white">
                <h1 className="text-4xl font-serif font-bold italic">Chá com Prosa</h1>
              </div>
            </div>
            <div className="text-right flex flex-col items-end relative z-10">
              <span className="text-[10px] uppercase font-bold tracking-[0.3em] opacity-60 mb-2 text-white">Ingresso Digital</span>
              <div className="bg-white/10 border border-white/20 px-6 py-3 rounded-full text-[10px] uppercase font-bold tracking-[0.3em] flex items-center gap-3 text-white">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                Ativo
              </div>
            </div>
          </div>

          {/* Main Body */}
          <div className="p-10 md:p-14 grid md:grid-cols-12 gap-16">
            {/* Info Grid */}
            <div className="md:col-span-12 lg:col-span-8 space-y-12">
              <div className="grid grid-cols-2 gap-10">
                <div>
                  <p className="text-[10px] uppercase font-bold tracking-[0.3em] text-stone-400 mb-4">Participante</p>
                  <p className="text-3xl font-serif text-stone-800 font-bold leading-tight">{ticket.name.split(' ')[0]} {ticket.name.split(' ').slice(1).join(' ')}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold tracking-[0.3em] text-stone-400 mb-4">Código</p>
                  <p className="text-3xl font-serif text-primary italic font-bold tracking-tighter">#{ticket.code}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-10 border-t border-rose-50 pt-12">
                <div className="flex gap-4">
                   <Calendar className="w-6 h-6 text-primary/60" />
                   <div>
                     <p className="text-[10px] uppercase font-bold tracking-[0.3em] text-stone-400 mb-2">Dia do Encontro</p>
                     <p className="text-sm font-bold uppercase tracking-widest text-stone-700">30 de Maio de 2026 <br/>Às 16:00h</p>
                   </div>
                </div>
                <div className="flex gap-4">
                   <MapPin className="w-6 h-6 text-primary/60" />
                   <div>
                     <p className="text-[10px] uppercase font-bold tracking-[0.3em] text-stone-400 mb-2">Localização</p>
                     <p className="text-sm font-bold uppercase tracking-widest text-stone-700">Auditório IADE <br/>Embu-Guaçu / SP</p>
                   </div>
                </div>
              </div>
            </div>

            {/* QR Area */}
            <div className="md:col-span-12 lg:col-span-4 flex flex-col items-center justify-center lg:border-l border-rose-50 lg:pl-16">
              <div className="relative group p-4 border border-rose-50 rounded-3xl bg-rose-50/30">
                <div className="w-44 h-44 bg-white p-4 border-2 border-rose-100 relative z-10 transition-transform group-hover:scale-105 duration-500 rounded-2xl">
                  <div className="grid grid-cols-12 gap-1 w-full h-full">
                    {qrGrid.map((isActive, i) => (
                      <div key={i} className={`rounded-[1px] ${isActive ? 'bg-primary' : 'bg-transparent'}`} />
                    ))}
                  </div>
                </div>
              </div>
              <p className="mt-8 text-[9px] uppercase font-bold tracking-[0.6em] text-stone-400 animate-pulse">Sincronizado</p>
            </div>
          </div>

          {/* Action Bar */}
          <div className="bg-rose-50/30 p-10 grid sm:grid-cols-2 gap-6 pb-12">
             <button className="flex items-center justify-center gap-4 bg-white border border-[#D98BB0] rounded-2xl p-5 text-[10px] uppercase font-bold tracking-[0.4em] hover:bg-rose-50 transition-all duration-300 group text-primary font-bold hover:scale-[1.03]">
                <Share2 className="w-4 h-4 group-hover:scale-110 transition-transform text-[#D98BB0]" />
                Compartilhar
             </button>
             <button className="flex items-center justify-center gap-4 bg-gradient-to-br from-[#C87A9F] to-[#D98BB0] text-white rounded-2xl p-5 text-[10px] uppercase font-bold tracking-[0.4em] hover:scale-[1.03] transition-all duration-300 shadow-lg hover:shadow-[0_8px_20px_rgba(217,139,176,0.3)] group font-bold border border-white/20">
                <Download className="w-4 h-4 group-hover:translate-y-1 transition-transform" />
                Baixar PDF
             </button>
          </div>
        </motion.div>

        <div className="mt-16 text-center space-y-8">
          <p className="text-[10px] uppercase font-bold tracking-[0.4em] text-stone-400 leading-relaxed max-w-sm mx-auto italic">
            Participar de um propósito é o primeiro passo para encontrar o seu. Esperamos por você.
          </p>
          <div className="flex justify-center gap-12 items-center opacity-30 grayscale">
            <Coffee className="w-8 h-8" />
            <MapPin className="w-8 h-8" />
          </div>
        </div>
      </div>
    </div>
  );
}
