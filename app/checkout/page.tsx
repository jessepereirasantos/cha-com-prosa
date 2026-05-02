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
  const [ticketId, setTicketId] = useState<string | null>(null);

  // Coupon States
  const [couponCode, setCouponCode] = useState('');
  const [discount, setDiscount] = useState(0);
  const [isValidatingCoupon, setIsValidatingCoupon] = useState(false);
  const [couponError, setCouponError] = useState('');

  const { register, handleSubmit, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(formSchema),
  });

  // POLLING: Verifica status do pagamento a cada 1 segundo (Fonte de Verdade)
  useEffect(() => {
    let interval: any;
    const paymentId = pixData?.paymentId || cardPaymentId;

    if (paymentId && step === 2) {
      interval = setInterval(async () => {
        try {
          const res = await fetch(`/api/payment-status?id=${paymentId}`);
          const data = await res.json();

          if (data.status === 'approved') {
            clearInterval(interval);
            // Salva o ticketId para a página de confirmação buscar os dados reais
            if (ticketId) localStorage.setItem('last_ticket_id', ticketId);
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
    // Formato correto: (11) 94672-1741
    let formatted = val;
    if (val.length > 2) formatted = `(${val.slice(0, 2)}) ${val.slice(2)}`;
    if (val.length > 7) formatted = `(${val.slice(0, 2)}) ${val.slice(2, 7)}-${val.slice(7)}`;
    e.target.value = formatted;
    setValue('phone', formatted);
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

  const handleApplyCoupon = async () => {
    if (!couponCode) return;
    setIsValidatingCoupon(true);
    setCouponError('');
    try {
      const res = await fetch(`/api/coupons/validate?code=${couponCode}`);
      const data = await res.json();
      if (data.valid) {
        setDiscount(data.discount);
        setCouponError('');
      } else {
        setDiscount(0);
        setCouponError(data.error || 'Cupom inválido');
      }
    } catch (err) {
      setCouponError('Erro ao validar');
    } finally {
      setIsValidatingCoupon(false);
    }
  };

  const handleFormSubmit = async (data: FormData) => {
    if (!agreed) {
      alert("Por favor, aceite os Termos de Uso e Regras do Evento.");
      return;
    }

    setLoading(true);
    try {
      let payload: any = {
        ...data,
        paymentMethod,
        couponCode: discount > 0 ? couponCode : null
      };

      if (paymentMethod === 'card') {
        if (!(window as any).MercadoPago) throw new Error('Mercado Pago SDK não carregado');
        const publicKey = process.env.NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY;
        const mp = new (window as any).MercadoPago(publicKey);

        const bin = cardData.number.replace(/\s/g, '').slice(0, 6);
        const [month, year] = cardData.expiry.split('/');
        
        const cardTokenResponse = await mp.createCardToken({
          cardNumber: cardData.number.replace(/\s/g, ''),
          cardholderName: cardData.name,
          cardExpirationMonth: month,
          cardExpirationYear: '20' + year,
          securityCode: cardData.cvv,
          identificationType: 'CPF',
          identificationNumber: data.document.replace(/\D/g, ''),
        });

        if (cardTokenResponse.id) {
          payload.cardToken = cardTokenResponse.id;
          payload.paymentMethodId = 'master'; // Fallback ou identificação via SDK se necessário
        } else {
          throw new Error('Dados do cartão inválidos.');
        }
      }

      const response = await fetch('/api/create-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Erro ao processar pagamento');

      // Persiste o ticketId para uso no redirect
      if (result.ticketId) setTicketId(result.ticketId);

      if (paymentMethod === 'pix') {
        setPixData({
          paymentId: result.paymentId,
          qrCode: result.qr_code,
          qrCodeBase64: result.qr_code_base64
        });
        setStep(2);
      } else {
        if (result.status === 'approved') {
          // Cartão aprovado na hora: salva e redireciona
          if (result.ticketId) localStorage.setItem('last_ticket_id', result.ticketId);
          window.location.href = '/confirmacao';
        } else {
          setCardPaymentId(result.paymentId);
          setStep(2);
        }
      }

    } catch (error: any) {
      alert(error.message || 'Erro ao processar pagamento.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-rose-50/10 text-on-surface flex flex-col font-sans">
      <nav className="bg-white/80 backdrop-blur-md border-b border-rose-100 sticky top-0 z-50">
        <div className="max-w-[1200px] mx-auto w-full px-6 py-6 flex justify-between items-center">
          <Link href="/" className="flex items-center gap-3">
            <span className="text-2xl font-serif text-primary font-bold italic">Chá com Prosa</span>
          </Link>
          <div className="text-[10px] uppercase font-bold tracking-widest text-primary/60">
            Checkout Seguro
          </div>
        </div>
      </nav>

      <div className="flex-1 max-w-[1200px] mx-auto w-full py-12 px-6 grid md:grid-cols-12 gap-12">
        <div className="md:col-span-12 lg:col-span-7 space-y-10">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-6 mb-12">
            <Link href="/" className="w-10 h-10 rounded-full border border-rose-200 flex items-center justify-center hover:bg-rose-50 transition-colors text-primary">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1 className="text-4xl font-serif text-primary font-bold">Seus Dados</h1>
          </motion.div>

          <form id="checkout-form" onSubmit={handleSubmit(handleFormSubmit)} className="space-y-8 bg-white p-8 md:p-10 border-l-4 border-[#D98BB0] rounded-[16px] shadow-sm transition-all duration-300 hover:shadow-[0_12px_30px_rgba(0,0,0,0.08)]">
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-primary/60">Nome Completo</label>
                <input {...register('name')} className="w-full bg-rose-50/30 border border-rose-100 rounded-xl px-4 py-3 outline-none focus:border-primary/50 transition-all" placeholder="Seu nome" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-primary/60">CPF</label>
                <input {...register('document')} onChange={handleDocumentChange} className="w-full bg-rose-50/30 border border-rose-100 rounded-xl px-4 py-3 outline-none focus:border-primary/50 transition-all" placeholder="000.000.000-00" />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-primary/60">Whatsapp</label>
                <input {...register('phone')} onChange={handlePhoneChange} className="w-full bg-rose-50/30 border border-rose-100 rounded-xl px-4 py-3 outline-none focus:border-primary/50 transition-all" placeholder="(11) 90000-0000" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-primary/60">Email</label>
                <input {...register('email')} className="w-full bg-rose-50/30 border border-rose-100 rounded-xl px-4 py-3 outline-none focus:border-primary/50 transition-all" placeholder="email@exemplo.com" />
              </div>
            </div>

            <div className="pt-10 border-t border-rose-50">
              <h3 className="text-2xl font-serif text-primary font-bold mb-8">Forma de Pagamento</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button type="button" onClick={() => setPaymentMethod('pix')} className={`flex items-center gap-4 p-6 rounded-2xl border-2 transition-all ${paymentMethod === 'pix' ? 'border-primary bg-rose-50' : 'border-rose-50 bg-white'}`}>
                  <QrCode className={`w-8 h-8 ${paymentMethod === 'pix' ? 'text-primary' : 'text-stone-300'}`} />
                  <div className="text-left">
                    <p className="text-sm font-bold uppercase tracking-widest text-primary">Pix</p>
                    <p className="text-[10px] text-stone-400 font-medium italic">Aprovação imediata</p>
                  </div>
                </button>
                <button type="button" onClick={() => setPaymentMethod('card')} className={`flex items-center gap-4 p-6 rounded-2xl border-2 transition-all ${paymentMethod === 'card' ? 'border-primary bg-rose-50' : 'border-rose-50 bg-white'}`}>
                  <CreditCard className={`w-8 h-8 ${paymentMethod === 'card' ? 'text-primary' : 'text-stone-300'}`} />
                  <div className="text-left">
                    <p className="text-sm font-bold uppercase tracking-widest text-primary">Cartão</p>
                    <p className="text-[10px] text-stone-400 font-medium italic">Até 3x sem juros</p>
                  </div>
                </button>
              </div>

              <AnimatePresence>
                {paymentMethod === 'card' && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="mt-6 space-y-4 bg-rose-50/50 p-6 rounded-2xl border border-rose-100">
                    <input type="text" placeholder="0000 0000 0000 0000" className="w-full bg-white border border-rose-200 rounded-xl px-4 py-3 outline-none focus:border-primary/50 text-sm" value={cardData.number} onChange={(e) => setCardData({ ...cardData, number: e.target.value.replace(/\D/g, '').match(/.{1,4}/g)?.join(' ')?.slice(0, 19) || '' })} />
                    <input type="text" placeholder="NOME COMO NO CARTÃO" className="w-full bg-white border border-rose-200 rounded-xl px-4 py-3 outline-none focus:border-primary/50 text-sm uppercase" value={cardData.name} onChange={(e) => setCardData({ ...cardData, name: e.target.value })} />
                    <div className="grid grid-cols-2 gap-4">
                      <input type="text" placeholder="MM/AA" className="w-full bg-white border border-rose-200 rounded-xl px-4 py-3 outline-none focus:border-primary/50 text-sm" value={cardData.expiry} onChange={(e) => { let v = e.target.value.replace(/\D/g, ''); if (v.length > 2) v = v.slice(0, 2) + '/' + v.slice(2, 4); setCardData({ ...cardData, expiry: v }); }} />
                      <input type="text" placeholder="CVV" className="w-full bg-white border border-rose-200 rounded-xl px-4 py-3 outline-none focus:border-primary/50 text-sm" value={cardData.cvv} onChange={(e) => setCardData({ ...cardData, cvv: e.target.value.replace(/\D/g, '').slice(0, 4) })} />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </form>
        </div>

        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="md:col-span-12 lg:col-span-5">
          <div className="bg-white border-l-4 border-[#D98BB0] rounded-[16px] p-8 sticky top-32 shadow-sm transition-all duration-300 hover:translate-y-[-5px] hover:shadow-[0_12px_30px_rgba(0,0,0,0.08)]">
            <h3 className="text-xl font-serif text-primary font-bold mb-8 border-b border-rose-50 pb-4">Resumo da Compra</h3>
            <div className="space-y-6 mb-8">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-rose-50 rounded-xl flex items-center justify-center text-primary"><Ticket size={24} /></div>
                  <div>
                    <p className="text-sm font-bold uppercase tracking-tight text-primary">Ingresso Individual</p>
                    <p className="text-[10px] text-primary/60 uppercase font-black tracking-widest">30 de Maio de 2026</p>
                  </div>
                </div>
                <p className="text-lg font-serif font-bold text-primary">R$ 57,00</p>
              </div>
            </div>

            <div className="mb-8 p-4 bg-stone-50 rounded-2xl border border-stone-100">
              <div className="flex gap-2">
                <input type="text" placeholder="Cupom de desconto" value={couponCode} onChange={(e) => setCouponCode(e.target.value.toUpperCase())} className="w-full bg-white border border-stone-200 rounded-xl py-2 px-4 text-xs font-bold outline-none" />
                <button type="button" onClick={handleApplyCoupon} className="bg-primary text-white px-4 py-2 rounded-xl text-xs font-bold">{isValidatingCoupon ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Aplicar'}</button>
              </div>
              {couponError && <p className="text-[10px] text-red-500 mt-2 ml-1 font-bold">{couponError}</p>}
              {discount > 0 && <p className="text-[10px] text-green-600 mt-2 ml-1 font-bold">Cupom aplicado: - R$ {discount.toFixed(2)}</p>}
            </div>

            <div className="space-y-4 border-t border-rose-50 pt-6">
              <div className="flex justify-between text-stone-500 text-sm italic"><span>Subtotal</span><span>R$ 57,00</span></div>
              {discount > 0 && <div className="flex justify-between text-green-600 text-sm italic font-bold"><span>Desconto</span><span>- R$ {discount.toFixed(2)}</span></div>}
              <div className="flex justify-between items-center pt-4 border-t border-rose-100">
                <span className="text-lg font-serif font-bold">Total</span>
                <span className="text-3xl font-serif text-primary font-bold">R$ {(57 - discount).toFixed(2)}</span>
              </div>
            </div>

            <div className="mt-8 p-4 bg-rose-50 rounded-2xl flex flex-col gap-4 border border-rose-100/50">
              <div className="flex items-center gap-3">
                <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="w-4 h-4 rounded text-primary focus:ring-primary border-rose-200" />
                <span className="text-[10px] uppercase font-bold tracking-widest text-primary/60 cursor-pointer" onClick={() => setShowTerms(true)}>Li e concordo com os Termos de Uso</span>
              </div>
            </div>

            <button type="submit" form="checkout-form" disabled={loading || !agreed} className="w-full mt-8 bg-gradient-to-br from-[#C87A9F] to-[#D98BB0] text-white rounded-xl py-5 text-base font-serif font-bold shadow-lg disabled:opacity-50 transition-all">{loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Confirmar vaga'}</button>
          </div>
        </motion.div>
      </div>

      <AnimatePresence>
        {showTerms && (
          <motion.div className="fixed inset-0 bg-stone-900/60 backdrop-blur-md z-[110] flex items-center justify-center p-6">
            <div className="bg-white rounded-[24px] p-8 md:p-12 max-w-2xl w-full max-h-[80vh] overflow-y-auto relative">
              <button onClick={() => setShowTerms(false)} className="absolute top-6 right-6 text-stone-400 hover:text-primary"><ArrowLeft className="w-6 h-6 rotate-90" /></button>
              <h2 className="text-3xl font-serif text-primary font-bold mb-8">Termos de Uso</h2>
              <div className="space-y-4 text-stone-600 text-sm">
                <p>O evento Chá com Prosa ocorrerá no dia 30 de Maio de 2026. Ingressos são nominais e não reembolsáveis.</p>
              </div>
            </div>
          </motion.div>
        )}
        {step > 1 && (
          <motion.div className="fixed inset-0 bg-stone-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-6">
            <div className="bg-white rounded-3xl p-12 max-w-md w-full text-center shadow-2xl border border-rose-100">
              {step === 2 && (
                <div className="space-y-6">
                  <div className="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center mx-auto text-primary mb-4"><QrCode size={32} /></div>
                  <h2 className="text-2xl font-serif text-primary font-bold">Escaneie o QR Code</h2>
                  {pixData?.qrCodeBase64 && <img src={`data:image/png;base64,${pixData.qrCodeBase64}`} alt="QR Code Pix" className="w-48 h-48 mx-auto" />}
                  <div className="flex gap-2">
                    <input type="text" readOnly value={pixData?.qrCode || ''} className="flex-1 bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 text-[10px] truncate" />
                    <button onClick={() => { navigator.clipboard.writeText(pixData?.qrCode || ''); alert('Código copiado!'); }} className="bg-primary text-white px-4 py-2 rounded-lg text-[10px] font-bold">Copiar</button>
                  </div>
                  <p className="text-[10px] font-bold text-stone-400 uppercase animate-pulse">Aguardando confirmação do banco...</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <Script src="https://sdk.mercadopago.com/js/v2" strategy="afterInteractive" />
    </div>
  );
}
