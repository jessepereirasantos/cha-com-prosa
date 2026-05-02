'use client';

import { motion } from 'motion/react';
import { CheckCircle2, Ticket, Calendar, MapPin, Download, QrCode, Clock, Loader2 } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { useState, useEffect } from 'react';

export default function ConfirmationPage() {
  const [participantData, setParticipantData] = useState({
    name: 'CARREGANDO...',
    code: '......',
    id: ''
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchRealData() {
      const savedId = localStorage.getItem('last_ticket_id');
      
      if (!savedId) {
        setLoading(false);
        return;
      }

      try {
        const res = await fetch(`/api/tickets/${savedId}`);
        const data = await res.json();
        
        if (data && !data.error) {
          setParticipantData({
            name: data.name,
            code: data.code,
            id: savedId
          });
        }
      } catch (err) {
        console.error('Erro ao buscar dados reais:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchRealData();
  }, []);

  const handleDownloadTicket = () => {
    if (!participantData.id) return;
    window.location.href = `/api/generate-ticket?id=${participantData.id}`;
  };

  return (
    <div className="min-h-screen bg-[#FFF9FA] flex flex-col font-sans selection:bg-rose-200">
      <nav className="bg-white/80 backdrop-blur-md border-b border-rose-100 sticky top-0 z-50">
        <div className="max-w-[1200px] mx-auto w-full px-4 sm:px-6 py-4 flex justify-between items-center">
          <Link href="/" className="flex items-center gap-3 group">
             <Image 
              src="https://lh3.googleusercontent.com/aida/ADBb0ugI_ktMZqEiaKdWAeMkUov7eIVNbjiUEycPETPVbafa1UORo14_3FTl2u8q_3RIDSUl-mZlNeRG9QXSw-cfy7X3YbcaIKnSfc4e9bR-Hjs9XbqZCz8Ln_4WDdDXgigu7l4z2v9uA19YbeWwZEfcVZDZGZi-3tw9kpPzGGpjXQoJFP6gNze818UwnLVb6X6Wth4r3hRPwbZTRITrtfx_P7fRBnTSAhMmcDTeGhJe2ZuCuRkYvOceWiEDouxkGf8CgQmKfoWWV8xskA" 
              alt="Logo" 
              width={32} 
              height={32} 
              className="h-8 w-8 object-contain"
            />
            <span className="text-xl sm:text-2xl font-serif text-primary font-bold italic">Chá com Prosa</span>
          </Link>
        </div>
      </nav>

      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-rose-100/40 via-transparent to-transparent">
        <div className="max-w-2xl w-full">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-8">
            <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4 text-emerald-600 shadow-sm border border-emerald-100">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h1 className="text-3xl font-serif text-primary font-bold mb-2">Sua vaga está garantida!</h1>
            <p className="text-stone-500 italic">Preparamos um lugar especial para você.</p>
          </motion.div>

          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 }} className="relative">
            <div className="bg-white rounded-[32px] overflow-hidden flex flex-col shadow-2xl border border-rose-100" style={{ minHeight: '520px', maxWidth: '500px', margin: '0 auto' }}>
              <div className="p-8 text-white relative" style={{ background: 'linear-gradient(to right, #C87A9F, #D98BB0)' }}>
                 <div className="absolute top-0 right-0 w-32 h-32 rounded-full -mr-16 -mt-16 bg-white/10" />
                 <div className="flex justify-between items-start relative z-10">
                    <div className="flex flex-col gap-1">
                       <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-80">Ingresso Especial</p>
                       <h2 className="text-2xl font-serif font-bold italic">Chá com Prosa</h2>
                    </div>
                 </div>
                 <div className="mt-8 relative z-10">
                    <p className="text-[11px] font-bold uppercase tracking-widest text-[#FFF0F5] mb-1">Edição 2026</p>
                    <h3 className="text-3xl font-serif font-bold leading-tight">Mulheres com Propósito</h3>
                 </div>
              </div>

              <div className="flex-1 p-8 space-y-8 relative">
                  <div className="text-center relative z-10">
                    <p className="text-[10px] font-bold uppercase tracking-widest mb-2 text-stone-400">Participante Confirmada</p>
                    {loading ? (
                      <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
                    ) : (
                      <h4 className="text-3xl font-serif text-primary font-bold uppercase tracking-tight break-words px-4">
                        {participantData.name}
                      </h4>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-x-8 gap-y-6 pt-6 border-t border-rose-50 relative z-10">
                    <div className="space-y-1">
                       <div className="flex items-center gap-2 text-rose-900">
                          <Calendar className="w-4 h-4" />
                          <p className="text-[10px] font-bold uppercase tracking-wider">Data</p>
                       </div>
                       <p className="font-medium pl-6 text-stone-600">30 de Maio, 2026</p>
                    </div>
                    <div className="space-y-1">
                       <div className="flex items-center gap-2 text-rose-900">
                          <MapPin className="w-4 h-4" />
                          <p className="text-[10px] font-bold uppercase tracking-wider">Local</p>
                       </div>
                       <p className="font-medium pl-6 text-sm text-stone-600">Templo Sede - IADE</p>
                    </div>
                  </div>
              </div>

              <div className="relative border-t-2 border-dashed border-rose-100 p-8 pt-10 bg-rose-50/50">
                 <div className="absolute top-0 -left-4 w-8 h-8 bg-[#FFF9FA] rounded-full border border-rose-100 -translate-y-1/2" />
                 <div className="absolute top-0 -right-4 w-8 h-8 bg-[#FFF9FA] rounded-full border border-rose-100 -translate-y-1/2" />
                 
                 <div className="flex justify-between items-center gap-8 relative z-10">
                    <div className="p-2 border border-rose-100 rounded-xl bg-white">
                       <QrCode className="w-16 h-16 text-stone-800" />
                    </div>
                    <div className="text-right flex-col flex items-end">
                       <div className="px-3 py-1 rounded-full text-[10px] font-bold tracking-widest mb-4 bg-rose-100 text-rose-900">
                          CONFIRMADO
                       </div>
                       <p className="text-[10px] font-bold tracking-widest uppercase text-stone-400">Código do Ticket</p>
                       <p className="text-xl font-mono font-bold text-stone-700">
                         #{participantData.code.toUpperCase()}
                       </p>
                    </div>
                 </div>
              </div>
            </div>

            <div className="mt-8 space-y-4">
              <button
                onClick={handleDownloadTicket}
                className="group flex items-center justify-center gap-3 w-full bg-gradient-to-br from-[#C87A9F] to-[#D98BB0] text-white rounded-2xl py-5 font-serif font-bold text-lg shadow-xl transition-all"
              >
                <Download className="w-6 h-6" />
                Baixar Ingresso (PDF Real)
              </button>
            </div>
          </motion.div>
        </div>
      </main>
    </div>
  );
}
