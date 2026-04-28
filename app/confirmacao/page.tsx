'use client';

import { motion } from 'motion/react';
import { CheckCircle2, Ticket, Calendar, MapPin, Download, Loader2, QrCode, Clock } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { useRef, useState, useEffect } from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

export default function ConfirmationPage() {
  const ticketRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);
  const [participantData, setParticipantData] = useState({
    name: 'PARTICIPANTE',
    id: '#000000'
  });
  const [pixData, setPixData] = useState<{
    qrCode: string | null;
    qrCodeBase64: string | null;
    expiresAt: string | null;
    copied: boolean;
  } | null>(null);

  useEffect(() => {
    const savedName = localStorage.getItem('last_ticket_name');
    const savedId   = localStorage.getItem('last_ticket_id');
    const qrCode    = localStorage.getItem('pix_qr_code');
    const qrBase64  = localStorage.getItem('pix_qr_base64');
    const expiresAt = localStorage.getItem('pix_expires_at');

    requestAnimationFrame(() => {
      setParticipantData({
        name: savedName || 'PARTICIPANTE',
        id: savedId ? `#${savedId.slice(-6).toUpperCase()}` : '#000000'
      });

      if (qrCode) {
        setPixData({ qrCode, qrCodeBase64: qrBase64, expiresAt, copied: false });
      }
    });
  }, []);

  const copyPixCode = async () => {
    if (!pixData?.qrCode) return;
    await navigator.clipboard.writeText(pixData.qrCode);
    setPixData(prev => prev ? { ...prev, copied: true } : null);
    setTimeout(() => setPixData(prev => prev ? { ...prev, copied: false } : null), 3000);
  };

  const downloadTicket = async () => {
    if (!ticketRef.current) return;
    setDownloading(true);

    try {
      // Pequena pausa para garantir que o DOM está pronto
      await new Promise(resolve => setTimeout(resolve, 500));

      const canvas = await html2canvas(ticketRef.current, {
        scale: 3, // Aumentando a qualidade para impressão
        backgroundColor: '#FFF9FA',
        logging: false,
        useCORS: true, // Crucial para imagens externas
        allowTaint: false,
        proxy: undefined,
        scrollX: 0,
        scrollY: -window.scrollY, // Resolve problemas de deslocamento se a página estiver com scroll
        onclone: (clonedDoc) => {
          // Garante que o elemento clonado seja visível para a captura
          const el = clonedDoc.querySelector('[ref="ticketRef"]') as HTMLElement;
          if (el) el.style.display = 'flex';
        }
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'px',
        format: [canvas.width / 3, canvas.height / 3]
      });

      pdf.addImage(imgData, 'PNG', 0, 0, canvas.width / 3, canvas.height / 3);
      
      const fileName = `ingresso-cha-com-prosa-${participantData.name.split(' ')[0].toLowerCase()}.pdf`;
      pdf.save(fileName);
      
      console.log('Ticket gerado com sucesso!');
    } catch (error: any) {
      console.error('Erro detalhado PDF:', error);
      alert('Ops! Ocorreu um erro técnico ao gerar o PDF. Tente novamente ou tire um print da tela.');
    } finally {
      setDownloading(false);
    }
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
              className="h-8 w-8 object-contain transition-transform group-hover:rotate-12"
            />
            <span className="text-xl sm:text-2xl font-serif text-primary font-bold italic">Chá com Prosa</span>
          </Link>
        </div>
      </nav>

      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-rose-100/40 via-transparent to-transparent font-sans">
        <div className="max-w-2xl w-full">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-8"
          >
            <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4 text-emerald-600 shadow-sm border border-emerald-100">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h1 className="text-3xl font-serif text-primary font-bold mb-2">Sua vaga está garantida!</h1>
            <p className="text-stone-500 italic">Preparamos um lugar especial para você.</p>
          </motion.div>

          {/* New Professional Ticket Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="relative"
          >
            <div 
              ref={ticketRef}
              className="bg-white rounded-[32px] overflow-hidden shadow-2xl shadow-rose-200/40 border border-rose-100 flex flex-col"
              style={{ minHeight: '520px', width: '100%', maxWidth: '500px', margin: '0 auto' }}
            >
              {/* Header */}
              <div className="bg-gradient-to-r from-[#C87A9F] to-[#D98BB0] p-8 text-white relative">
                 <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl" />
                 <div className="flex justify-between items-start relative z-10">
                    <div className="flex flex-col gap-1">
                       <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-80">Ingresso Especial</p>
                       <h2 className="text-2xl font-serif font-bold italic">Chá com Prosa</h2>
                    </div>
                    <img 
                      src="https://lh3.googleusercontent.com/aida/ADBb0ugI_ktMZqEiaKdWAeMkUov7eIVNbjiUEycPETPVbafa1UORo14_3FTl2u8q_3RIDSUl-mZlNeRG9QXSw-cfy7X3YbcaIKnSfc4e9bR-Hjs9XbqZCz8Ln_4WDdDXgigu7l4z2v9uA19YbeWwZEfcVZDZGZi-3tw9kpPzGGpjXQoJFP6gNze818UwnLVb6X6Wth4r3hRPwbZTRITrtfx_P7fRBnTSAhMmcDTeGhJe2ZuCuRkYvOceWiEDouxkGf8CgQmKfoWWV8xskA" 
                      alt="Logo" 
                      crossOrigin="anonymous"
                      style={{ height: '40px', width: '40px', objectFit: 'contain' }}
                      className="brightness-0 invert opacity-90"
                    />
                 </div>
                 <div className="mt-8 relative z-10">
                    <p className="text-[11px] font-bold uppercase tracking-widest text-[#FFF0F5] mb-1 text-white">Edição 2026</p>
                    <h3 className="text-3xl font-serif font-bold leading-tight">Mulheres com Propósito</h3>
                 </div>
              </div>

              {/* Main Body */}
              <div className="flex-1 p-8 space-y-8 relative">
                 {/* Decorative background shapes */}
                 <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] pointer-events-none overflow-hidden">
                    <img 
                      src="https://lh3.googleusercontent.com/aida/ADBb0ugI_ktMZqEiaKdWAeMkUov7eIVNbjiUEycPETPVbafa1UORo14_3FTl2u8q_3RIDSUl-mZlNeRG9QXSw-cfy7X3YbcaIKnSfc4e9bR-Hjs9XbqZCz8Ln_4WDdDXgigu7l4z2v9uA19YbeWwZEfcVZDZGZi-3tw9kpPzGGpjXQoJFP6gNze818UwnLVb6X6Wth4r3hRPwbZTRITrtfx_P7fRBnTSAhMmcDTeGhJe2ZuCuRkYvOceWiEDouxkGf8CgQmKfoWWV8xskA" 
                      alt="BG Pattern" 
                      crossOrigin="anonymous"
                      style={{ height: '300px', width: 'auto' }}
                      className="animate-pulse"
                    />
                 </div>

                 <div className="text-center relative z-10">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-2">Participante Confirmada</p>
                    <h4 className="text-3xl font-serif text-primary font-bold uppercase tracking-tight break-words px-4">
                      {participantData.name}
                    </h4>
                 </div>

                 <div className="grid grid-cols-2 gap-x-8 gap-y-6 pt-6 border-t border-rose-100 flex-wrap relative z-10">
                    <div className="space-y-1">
                       <div className="flex items-center gap-2 text-primary">
                          <Calendar className="w-4 h-4" />
                          <p className="text-[10px] font-bold uppercase tracking-wider">Data</p>
                       </div>
                       <p className="text-stone-700 font-medium pl-6">30 de Maio, 2026</p>
                    </div>
                    <div className="space-y-1">
                       <div className="flex items-center gap-2 text-primary">
                          <MapPin className="w-4 h-4" />
                          <p className="text-[10px] font-bold uppercase tracking-wider">Local</p>
                       </div>
                       <p className="text-stone-700 font-medium pl-6 text-sm">Templo Sede - Rua Estevam Aragoni, 77</p>
                    </div>
                    <div className="space-y-1">
                       <div className="flex items-center gap-2 text-primary">
                          <Clock className="w-4 h-4" />
                          <p className="text-[10px] font-bold uppercase tracking-wider">Início</p>
                       </div>
                       <p className="text-stone-700 font-medium pl-6">18h00</p>
                    </div>
                    <div className="space-y-1">
                       <div className="flex items-center gap-2 text-primary">
                          <Ticket className="w-4 h-4" />
                          <p className="text-[10px] font-bold uppercase tracking-wider">Acesso</p>
                       </div>
                       <p className="text-stone-700 font-medium pl-6">Individual</p>
                    </div>
                 </div>
              </div>

              {/* Footer / Stub Section */}
              <div className="relative border-t-2 border-dashed border-rose-100 bg-rose-50/30 p-8 pt-10">
                 {/* Ticket notches */}
                 <div className="absolute top-0 -left-4 w-8 h-8 bg-[#FFF9FA] rounded-full border border-rose-100 -translate-y-1/2" />
                 <div className="absolute top-0 -right-4 w-8 h-8 bg-[#FFF9FA] rounded-full border border-rose-100 -translate-y-1/2" />
                 
                 <div className="flex justify-between items-center gap-8 relative z-10 text-stone-800">
                    <div className="space-y-3">
                       <div className="p-2 bg-white border border-rose-100 rounded-xl inline-block shadow-sm">
                          <QrCode className="w-16 h-16 text-stone-800" />
                       </div>
                       <p className="text-[10px] uppercase font-bold tracking-widest text-primary/40 italic">
                         Apresente na entrada
                       </p>
                    </div>
                    <div className="text-right flex-col flex items-end">
                       <div className="bg-rose-100 text-primary px-3 py-1 rounded-full text-[10px] font-bold tracking-widest mb-4 inline-block">
                          CONFIRMADO
                       </div>
                       <p className="text-[10px] font-bold text-stone-400 tracking-widest uppercase">Código do Ticket</p>
                       <p className="text-xl font-mono text-stone-700 font-bold tracking-normal">{participantData.id}</p>
                    </div>
                 </div>
              </div>
            </div>

            {/* Mensagem de Instrução Final */}
            <div className="mt-8 bg-white border border-rose-100 rounded-[24px] shadow-sm p-8 text-center space-y-2">
               <p className="text-xs font-bold text-emerald-600 uppercase tracking-widest">Pagamento Confirmado</p>
               <p className="text-stone-500 text-sm italic">
                 Sua inscrição foi processada com sucesso. Você já pode baixar seu ingresso ou apresentá-lo através do e-mail/WhatsApp que enviamos.
               </p>
            </div>

            <div className="mt-8 space-y-4">
              <button
                onClick={downloadTicket}
                disabled={downloading}
                className="group flex items-center justify-center gap-3 w-full bg-gradient-to-br from-[#C87A9F] to-[#D98BB0] hover:shadow-[0_8px_25px_rgba(217,139,176,0.4)] text-white rounded-2xl py-5 font-serif font-bold text-lg shadow-xl transition-all transform hover:-translate-y-1 active:scale-[0.98] disabled:opacity-70 border border-white/20"
              >
                {downloading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Download className="w-6 h-6 group-hover:translate-y-0.5 transition-transform" />}
                Baixar Ticket para Celular
              </button>
              
              <Link 
                href="/"
                className="block w-full bg-white text-stone-500 border border-stone-200 rounded-2xl py-4 font-serif font-bold text-lg hover:bg-stone-50 transition-all text-center"
              >
                Voltar à Página Inicial
              </Link>
            </div>
            
            <p className="text-center mt-8 text-[11px] uppercase font-bold tracking-[0.3em] text-primary/30 max-w-[300px] mx-auto leading-relaxed">
              ENVIAMOS UMA CÓPIA DESTE INGRESSO PARA O SEU WHATSAPP E E-MAIL CADASTRADOS.
            </p>
          </motion.div>
        </div>
      </main>
            
      <footer className="py-8 text-center border-t border-rose-100">
        <p className="text-stone-400 text-xs italic">
          Chá com Prosa &copy; 2026 - Momentos que Transformam
        </p>
      </footer>
    </div>
  );
}
