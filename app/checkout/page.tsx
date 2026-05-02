'use client';

import React, { useState, useEffect, ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Loader2, CheckCircle2, Ticket, CreditCard, QrCode, Tag } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import Script from 'next/script';

const formSchema = z.object({
  name: z.string().min(3, 'Nome é obrigatório'),
  email: z.string().email('E-mail inválido'),
  phone: z.string().min(10, 'Telefone inválido'),
  document: z.string().min(11, 'CPF inválido'),
});

type FormData = z.infer<typeof formSchema>;

export default function CheckoutPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'pix' | 'card'>('pix');
  const [cardData, setCardData] = useState({
    number: '',
    name: '',
    expiry: '',
    cvv: ''
  });

  const [agreed, setAgreed] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [pixData, setPixData] = useState<{ qrCode: string; qrCodeBase64: string; paymentId: string } | null>(null);
  const [cardPaymentId, setCardPaymentId] = useState<string | null>(null);

  // Coupon States
  const [couponCode, setCouponCode] = useState('');
  const [discount, setDiscount] = useState(0);
  const [isValidatingCoupon, setIsValidatingCoupon] = useState(false);
  const [couponError, setCouponError] = useState('');

  const { register, handleSubmit, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(formSchema),
  });

  // 1. RECUPERAÇÃO DE ESTADO (DETERMINÍSTICO)
  useEffect(() => {
    const savedPaymentId = localStorage.getItem('active_payment_id');
    const savedMethod = localStorage.getItem('active_payment_method');
    
    if (savedPaymentId && step === 1) {
      console.log('[DETERMINÍSTICO] Recuperando estado pendente...');
      if (savedMethod === 'pix') {
        const savedPixData = localStorage.getItem('active_pix_data');
        if (savedPixData) {
          setPixData(JSON.parse(savedPixData));
          setStep(2);
        }
      } else {
        setCardPaymentId(savedPaymentId);
        setStep(2);
      }
    }
  }, [step]);

  // 2. POLLING REATIVO: Fonte Única de Verdade (API Direta do MP)
  useEffect(() => {
    let interval: any;
    const paymentId = pixData?.paymentId || cardPaymentId || localStorage.getItem('active_payment_id');

    if (paymentId && step === 2) {
      console.log(`[POLLING] Monitorando ID: ${paymentId}`);
      interval = setInterval(async () => {
        try {
          const res = await fetch(`/api/payment-status?id=${paymentId}`);
          const data = await res.json();

          if (data.status === 'approved') {
            console.log('[POLLING] Pagamento aprovado! Redirecionando...');
            clearInterval(interval);
            
            localStorage.removeItem('active_payment_id');
            localStorage.removeItem('active_payment_method');
            localStorage.removeItem('active_pix_data');
            
            window.location.href = '/confirmacao';
          }
        } catch (err) {
          console.error('Polling error:', err);
        }
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [pixData, cardPaymentId, step]);

  const handlePhoneChange = (e: ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, '');
    if (val.length > 11) val = val.slice(0, 11);
    if (val.length > 2) val = `(${val.slice(0, 2)}) ${val.slice(2)}`;
    if (val.length > 9) val = `${val.slice(0, 9)}-${val.slice(9)}`;
    e.target.value = val;
    setValue('phone', val);
  };

  const handleDocumentChange = (e: ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, '');
    if (val.length > 11) val = val.slice(0, 11);
    if (val.length > 9) val = `${val.slice(0, 3)}.${val.slice(3, 6)}.${val.slice(6, 9)}-${val.slice(9)}`;
    else if (val.length > 6) val = `${val.slice(0, 3)}.${val.slice(3, 6)}.${val.slice(6)}`;
    else if (val.length > 3) val = `${val.slice(0, 3)}.${val.slice(3)}`;
    e.target.value = val;
    setValue('document', val);
  };

  const validateCoupon = async () => {
    if (!couponCode) return;
    setIsValidatingCoupon(true);
    setCouponError('');
    try {
      const res = await fetch('/api/validate-coupon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: couponCode })
      });
      const data = await res.json();
      if (data.valid) setDiscount(data.discount);
      else { setCouponError('Cupom inválido'); setDiscount(0); }
    } catch (err) { setCouponError('Erro ao validar'); }
    finally { setIsValidatingCoupon(false); }
  };

  const handleFormSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      const res = await fetch('/api/create-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          paymentMethod,
          couponCode: discount > 0 ? couponCode : null,
          ...(paymentMethod === 'card' ? {
            cardToken: (window as any).cardToken,
            paymentMethodId: (window as any).paymentMethodId,
            issuerId: (window as any).issuerId,
            installments: (window as any).installments
          } : {})
        })
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Erro no pagamento');

      if (paymentMethod === 'pix') {
        localStorage.setItem('active_payment_id', result.paymentId);
        localStorage.setItem('active_payment_method', 'pix');
        const pixInfo = { paymentId: result.paymentId, qrCode: result.qr_code, qrCodeBase64: result.qr_code_base64 };
        localStorage.setItem('active_pix_data', JSON.stringify(pixInfo));
        setPixData(pixInfo);
        setStep(2);
      } else {
        if (result.status === 'approved') {
          localStorage.removeItem('active_payment_id');
          localStorage.removeItem('active_payment_method');
          window.location.href = '/confirmacao';
        } else {
          localStorage.setItem('active_payment_id', result.paymentId);
          localStorage.setItem('active_payment_method', 'card');
          setCardPaymentId(result.paymentId);
          setStep(2);
        }
      }
    } catch (err: any) { alert(err.message); }
    finally { setLoading(false); }
  };

  const finalPrice = Math.max(0, 57 - discount);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white selection:bg-[#ff8c00]/30">
      <Script src="https://sdk.mercadopago.com/js/v2" strategy="beforeInteractive" />
      
      {/* Background Decorativo */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[#ff8c00]/5 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-[#ff8c00]/5 blur-[120px] rounded-full" />
      </div>

      <div className="relative max-w-4xl mx-auto px-4 py-8">
        <header className="flex items-center justify-between mb-12">
          <Link href="/" className="group flex items-center gap-2 text-zinc-400 hover:text-white transition-colors">
            <div className="w-8 h-8 rounded-full bg-zinc-900 flex items-center justify-center border border-zinc-800 group-hover:border-[#ff8c00]/50 transition-all">
              <ArrowLeft size={18} />
            </div>
            <span className="text-sm font-medium">Voltar ao início</span>
          </Link>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[#ff8c00] animate-pulse" />
            <span className="text-xs font-bold tracking-widest text-zinc-500 uppercase">Checkout Seguro</span>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-7 space-y-6">
            <AnimatePresence mode="wait">
              {step === 1 ? (
                <motion.div
                  key="step1"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="bg-zinc-900/50 backdrop-blur-xl border border-zinc-800/50 rounded-3xl p-8"
                >
                  <div className="flex items-center gap-4 mb-8">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#ff8c00] to-[#e67e00] flex items-center justify-center shadow-lg shadow-[#ff8c00]/20">
                      <Ticket className="text-white" size={24} />
                    </div>
                    <div>
                      <h1 className="text-2xl font-bold">Seu Ingresso</h1>
                      <p className="text-zinc-500 text-sm">Preencha seus dados para continuar</p>
                    </div>
                  </div>

                  <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Nome Completo</label>
                        <input
                          {...register('name')}
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-4 py-4 focus:border-[#ff8c00] focus:ring-1 focus:ring-[#ff8c00] transition-all outline-none"
                          placeholder="Como no RG"
                        />
                        {errors.name && <p className="text-red-500 text-xs ml-1">{errors.name.message}</p>}
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-zinc-500 uppercase ml-1">WhatsApp</label>
                        <input
                          {...register('phone')}
                          onChange={handlePhoneChange}
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-4 py-4 focus:border-[#ff8c00] focus:ring-1 focus:ring-[#ff8c00] transition-all outline-none"
                          placeholder="(00) 00000-0000"
                        />
                        {errors.phone && <p className="text-red-500 text-xs ml-1">{errors.phone.message}</p>}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-zinc-500 uppercase ml-1">E-mail</label>
                        <input
                          {...register('email')}
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-4 py-4 focus:border-[#ff8c00] focus:ring-1 focus:ring-[#ff8c00] transition-all outline-none"
                          placeholder="seu@email.com"
                        />
                        {errors.email && <p className="text-red-500 text-xs ml-1">{errors.email.message}</p>}
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-zinc-500 uppercase ml-1">CPF</label>
                        <input
                          {...register('document')}
                          onChange={handleDocumentChange}
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-4 py-4 focus:border-[#ff8c00] focus:ring-1 focus:ring-[#ff8c00] transition-all outline-none"
                          placeholder="000.000.000-00"
                        />
                        {errors.document && <p className="text-red-500 text-xs ml-1">{errors.document.message}</p>}
                      </div>
                    </div>

                    <div className="pt-4">
                      <label className="text-xs font-bold text-zinc-500 uppercase mb-4 block">Forma de Pagamento</label>
                      <div className="grid grid-cols-2 gap-4">
                        <button
                          type="button"
                          onClick={() => setPaymentMethod('pix')}
                          className={`flex flex-col items-center gap-3 p-6 rounded-2xl border transition-all ${
                            paymentMethod === 'pix' 
                            ? 'bg-[#ff8c00]/10 border-[#ff8c00] text-white shadow-lg shadow-[#ff8c00]/5' 
                            : 'bg-zinc-950 border-zinc-800 text-zinc-500 hover:border-zinc-700'
                          }`}
                        >
                          <QrCode size={24} />
                          <span className="text-sm font-bold">PIX Instantâneo</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setPaymentMethod('card')}
                          className={`flex flex-col items-center gap-3 p-6 rounded-2xl border transition-all ${
                            paymentMethod === 'card' 
                            ? 'bg-[#ff8c00]/10 border-[#ff8c00] text-white shadow-lg shadow-[#ff8c00]/5' 
                            : 'bg-zinc-950 border-zinc-800 text-zinc-500 hover:border-zinc-700'
                          }`}
                        >
                          <CreditCard size={24} />
                          <span className="text-sm font-bold">Cartão de Crédito</span>
                        </button>
                      </div>
                    </div>

                    {paymentMethod === 'card' && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="pt-4 space-y-4">
                        <div id="payment-card-container" className="bg-zinc-950 p-4 rounded-2xl border border-zinc-800" />
                        <p className="text-[10px] text-zinc-500 text-center">Processamento seguro via Mercado Pago</p>
                      </motion.div>
                    )}

                    <div className="pt-6">
                      <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-[#ff8c00] hover:bg-[#e67e00] disabled:opacity-50 text-white font-bold py-5 rounded-2xl flex items-center justify-center gap-3 shadow-xl shadow-[#ff8c00]/20 transition-all active:scale-[0.98]"
                      >
                        {loading ? <Loader2 className="animate-spin" /> : <><CheckCircle2 size={20} /> Finalizar Inscrição</>}
                      </button>
                    </div>
                  </form>
                </motion.div>
              ) : (
                <motion.div
                  key="step2"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-zinc-900/50 backdrop-blur-xl border border-zinc-800/50 rounded-3xl p-8 text-center"
                >
                  {paymentMethod === 'pix' && pixData ? (
                    <div className="space-y-8">
                      <div className="flex flex-col items-center gap-4">
                        <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center border border-green-500/20">
                          <QrCode className="text-green-500" size={32} />
                        </div>
                        <div>
                          <h2 className="text-2xl font-bold">Quase lá!</h2>
                          <p className="text-zinc-400">Pague o PIX para confirmar sua presença</p>
                        </div>
                      </div>

                      <div className="bg-white p-4 rounded-3xl inline-block shadow-2xl shadow-[#ff8c00]/10">
                        <Image src={`data:image/png;base64,${pixData.qrCodeBase64}`} alt="QR Code PIX" width={240} height={240} className="rounded-xl" />
                      </div>

                      <div className="space-y-4 max-w-sm mx-auto">
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(pixData.qrCode);
                            alert('Código copiado!');
                          }}
                          className="w-full bg-zinc-950 border border-zinc-800 hover:border-[#ff8c00]/50 py-4 rounded-2xl font-bold text-sm transition-all flex items-center justify-center gap-2"
                        >
                          Copia e Cola
                        </button>
                        <div className="flex items-center justify-center gap-2 text-zinc-500">
                          <Loader2 className="animate-spin" size={14} />
                          <span className="text-xs">Aguardando confirmação...</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="py-20 space-y-6">
                      <Loader2 className="animate-spin mx-auto text-[#ff8c00]" size={48} />
                      <h2 className="text-xl font-bold">Processando seu pagamento...</h2>
                      <p className="text-zinc-500">Não feche esta página.</p>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="lg:col-span-5 space-y-6">
            <div className="bg-zinc-900/50 backdrop-blur-xl border border-zinc-800/50 rounded-3xl p-8 sticky top-8">
              <h3 className="text-lg font-bold mb-6">Resumo do Pedido</h3>
              <div className="space-y-4 mb-8">
                <div className="flex items-center justify-between py-4 border-b border-zinc-800">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-zinc-950 flex items-center justify-center border border-zinc-800">
                      <Ticket size={20} className="text-[#ff8c00]" />
                    </div>
                    <div>
                      <p className="text-sm font-bold">Ingresso Individual</p>
                      <p className="text-xs text-zinc-500">Acesso completo ao evento</p>
                    </div>
                  </div>
                  <span className="font-bold">R$ 57,00</span>
                </div>
                
                {discount > 0 && (
                  <div className="flex items-center justify-between text-green-500 text-sm">
                    <span className="flex items-center gap-2"><Tag size={14} /> Cupom aplicado</span>
                    <span>- R$ {discount.toFixed(2)}</span>
                  </div>
                )}

                <div className="flex items-center justify-between pt-2">
                  <span className="text-zinc-400 font-medium">Total</span>
                  <span className="text-3xl font-black text-[#ff8c00]">R$ {finalPrice.toFixed(2)}</span>
                </div>
              </div>

              {step === 1 && (
                <div className="space-y-4">
                  <div className="relative">
                    <input
                      type="text"
                      value={couponCode}
                      onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                      placeholder="Cupom de desconto"
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-4 py-4 text-sm focus:border-[#ff8c00] outline-none"
                    />
                    <button
                      onClick={validateCoupon}
                      disabled={isValidatingCoupon || !couponCode}
                      className="absolute right-2 top-2 bottom-2 px-4 bg-zinc-900 hover:bg-zinc-800 rounded-xl text-xs font-bold transition-all disabled:opacity-50"
                    >
                      {isValidatingCoupon ? <Loader2 className="animate-spin" size={14} /> : 'Aplicar'}
                    </button>
                  </div>
                  {couponError && <p className="text-red-500 text-[10px] ml-2 font-bold">{couponError}</p>}
                </div>
              )}

              <div className="mt-8 pt-8 border-t border-zinc-800 space-y-4">
                <div className="flex items-center gap-3 text-zinc-500">
                  <CheckCircle2 size={16} className="text-zinc-700" />
                  <span className="text-[10px] font-medium leading-tight">Ao comprar, você concorda com os termos de participação do evento.</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <footer className="mt-20 text-center pb-12">
          <p className="text-zinc-600 text-[10px] uppercase tracking-[0.2em]">© 2026 Chá com Prosa • Mulheres com Propósito</p>
        </footer>
      </div>
    </div>
  );
}
