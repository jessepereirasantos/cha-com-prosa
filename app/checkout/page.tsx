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

  // POLLING: Verifica status do pagamento a cada 3 segundos (PIX e Cartão)
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
            setStep(3); // Mostra sucesso
            setTimeout(() => {
              router.push('/confirmacao');
            }, 2000);
          }
        } catch (err) {
          console.error('Polling error:', err);
        }
      }, 3000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [pixData, cardPaymentId, step, router]);

  const handlePhoneChange = (e: ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, '');
    if (val.length > 11) val = val.slice(0, 11);

    if (val.length > 2) {
      val = `(${val.slice(0, 2)}) ${val.slice(2)}`;
    }
    if (val.length > 9) {
      val = `${val.slice(0, 10)}-${val.slice(10)}`;
    }

    setValue('phone', val);
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
        couponCode
      };

      if (paymentMethod === 'card') {
        // 1. Inicializa Mercado Pago
        if (!(window as any).MercadoPago) {
          throw new Error('Mercado Pago SDK não carregado');
        }

        const publicKey = process.env.NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY;

        if (!publicKey) {
          console.error("ERRO CRÍTICO: Public key do Mercado Pago não definida (NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY)");
          throw new Error('Erro de configuração do sistema de pagamentos. Informe o administrador.');
        }

        const mp = new (window as any).MercadoPago(publicKey);

        // 2. Tenta identificar o método de pagamento e emissor
        const bin = cardData.number.replace(/\s/g, '').slice(0, 6);
        if (bin.length >= 6) {
          try {
            const pmResponse = await mp.getPaymentMethods({ bin });
            if (pmResponse.results && pmResponse.results.length > 0) {
              payload.paymentMethodId = pmResponse.results[0].id;
              payload.issuerId = pmResponse.results[0].issuer?.id?.toString();
            }
          } catch (binError) {
            console.warn('Erro ao identificar bandeira:', binError);
          }
        }

        // 3. Cria o Token do Cartão
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
          // Se não detectou acima, tenta usar o que veio no token
          if (!payload.paymentMethodId) payload.paymentMethodId = 'master';
        } else {
          console.error('MP Card Token Error:', cardTokenResponse);
          throw new Error('Dados do cartão inválidos. Verifique os números.');
        }
      }

      const response = await fetch('/api/create-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Erro ao processar pagamento');
      }

      if (paymentMethod === 'pix') {
        localStorage.setItem('last_ticket_id', result.id);
        localStorage.setItem('last_ticket_name', data.name);
        setPixData({
          paymentId: result.payment_id,
          qrCode: result.qr_code,
          qrCodeBase64: result.qr_code_base64
        });
        setStep(2);
      } else {
        // Pagamento via cartão
        localStorage.setItem('last_ticket_id', result.id);
        localStorage.setItem('last_ticket_name', data.name);
        if (result.status === 'approved') {
          // Aprovado imediatamente → vai para sucesso
          setStep(3);
          setTimeout(() => router.push('/confirmacao'), 1500);
        } else {
          // Em processamento (in_process) → faz polling igual ao PIX
          setCardPaymentId(result.payment_id);
          setStep(2);
        }
      }

    } catch (error: any) {
      console.error('Payment error:', error);
      alert(error.message || 'Erro ao processar pagamento. Por favor, tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-rose-50/10 text-on-surface flex flex-col font-sans">
      <nav className="bg-white/80 backdrop-blur-md border-b border-rose-100 sticky top-0 z-50">
        <div className="max-w-[1200px] mx-auto w-full px-6 py-6 flex justify-between items-center">
          <Link href="/" className="flex items-center gap-3">
            <Image
              src="https://lh3.googleusercontent.com/aida/ADBb0ugI_ktMZqEiaKdWAeMkUov7eIVNbjiUEycPETPVbafa1UORo14_3FTl2u8q_3RIDSUl-mZlNeRG9QXSw-cfy7X3YbcaIKnSfc4e9bR-Hjs9XbqZCz8Ln_4WDdDXgigu7l4z2v9uA19YbeWwZEfcVZDZGZi-3tw9kpPzGGpjXQoJFP6gNze818UwnLVb6X6Wth4r3hRPwbZTRITrtfx_P7fRBnTSAhMmcDTeGhJe2ZuCuRkYvOceWiEDouxkGf8CgQmKfoWWV8xskA"
              alt="Logo"
              width={32}
              height={32}
              className="h-8 w-8 object-contain"
            />
            <span className="text-2xl font-serif text-primary font-bold italic">Chá com Prosa</span>
          </Link>
          <div className="text-[10px] uppercase font-bold tracking-widest text-primary/60">
            Checkout Seguro
          </div>
        </div>
      </nav>

      <div className="flex-1 max-w-[1200px] mx-auto w-full py-12 px-6 grid md:grid-cols-12 gap-12">
        {/* Form Column */}
        <div className="md:col-span-12 lg:col-span-7 space-y-10">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            className="flex items-center gap-6 mb-12"
          >
            <Link href="/" className="w-10 h-10 rounded-full border border-rose-200 flex items-center justify-center hover:bg-rose-50 transition-colors text-primary">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1 className="text-4xl font-serif text-primary font-bold">Seus Dados</h1>
          </motion.div>

          <form id="checkout-form" onSubmit={handleSubmit(handleFormSubmit)} className="space-y-8 bg-white p-8 md:p-10 border-l-4 border-[#D98BB0] rounded-[16px] shadow-sm transition-all duration-300 hover:shadow-[0_12px_30px_rgba(0,0,0,0.08)]">
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-primary/60">Nome Completo</label>
                <input
                  {...register('name')}
                  className="w-full bg-rose-50/30 border border-rose-100 rounded-xl px-4 py-3 outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all"
                  placeholder="Seu nome"
                />
                {errors.name && <p className="text-error text-[10px] uppercase font-bold tracking-widest">{errors.name.message}</p>}
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-primary/60">CPF</label>
                <input
                  {...register('document')}
                  className="w-full bg-rose-50/30 border border-rose-100 rounded-xl px-4 py-3 outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all"
                  placeholder="000.000.000-00"
                />
                {errors.document && <p className="text-error text-[10px] uppercase font-bold tracking-widest">{errors.document.message}</p>}
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-primary/60">Whatsapp</label>
                <input
                  {...register('phone', {
                    onChange: (e) => handlePhoneChange(e)
                  })}
                  className="w-full bg-rose-50/30 border border-rose-100 rounded-xl px-4 py-3 outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all"
                  placeholder="(11) 90000-0000"
                />
                {errors.phone && <p className="text-error text-[10px] uppercase font-bold tracking-widest">{errors.phone.message}</p>}
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-primary/60">Email</label>
                <input
                  {...register('email')}
                  className="w-full bg-rose-50/30 border border-rose-100 rounded-xl px-4 py-3 outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all"
                  placeholder="email@exemplo.com"
                />
                {errors.email && <p className="text-error text-[10px] uppercase font-bold tracking-widest">{errors.email.message}</p>}
              </div>
            </div>

            <div className="pt-10 border-t border-rose-50">
              <h3 className="text-2xl font-serif text-primary font-bold mb-8">Forma de Pagamento</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('pix')}
                  className={`flex items-center gap-4 p-6 rounded-2xl border-2 transition-all ${paymentMethod === 'pix' ? 'border-primary bg-rose-50' : 'border-rose-50 bg-white hover:border-rose-100'}`}
                >
                  <QrCode className={`w-8 h-8 ${paymentMethod === 'pix' ? 'text-primary' : 'text-stone-300'}`} />
                  <div className="text-left">
                    <p className="text-sm font-bold uppercase tracking-widest text-primary">Pix</p>
                    <p className="text-[10px] text-stone-400 font-medium italic">Aprovação imediata</p>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('card')}
                  className={`flex items-center gap-4 p-6 rounded-2xl border-2 transition-all ${paymentMethod === 'card' ? 'border-primary bg-rose-50' : 'border-rose-50 bg-white hover:border-rose-100'}`}
                >
                  <CreditCard className={`w-8 h-8 ${paymentMethod === 'card' ? 'text-primary' : 'text-stone-300'}`} />
                  <div className="text-left">
                    <p className="text-sm font-bold uppercase tracking-widest text-primary">Cartão</p>
                    <p className="text-[10px] text-stone-400 font-medium italic">Até 3x sem juros</p>
                  </div>
                </button>
              </div>

              <AnimatePresence mode="wait">
                {paymentMethod === 'card' && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="mt-6 space-y-4 bg-rose-50/50 p-6 rounded-2xl border border-rose-100"
                  >
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-primary/60">Número do Cartão</label>
                      <input
                        type="text"
                        required
                        placeholder="0000 0000 0000 0000"
                        className="w-full bg-white border border-rose-200 rounded-xl px-4 py-3 outline-none focus:border-primary/50 transition-all text-sm"
                        value={cardData.number}
                        onChange={(e) => {
                          let val = e.target.value.replace(/\D/g, '');
                          val = val.match(/.{1,4}/g)?.join(' ') || val;
                          setCardData({ ...cardData, number: val.slice(0, 19) });
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-primary/60">Nome no Cartão</label>
                      <input
                        type="text"
                        required
                        placeholder="NOME COMO NO CARTÃO"
                        className="w-full bg-white border border-rose-200 rounded-xl px-4 py-3 outline-none focus:border-primary/50 transition-all text-sm uppercase"
                        value={cardData.name}
                        onChange={(e) => setCardData({ ...cardData, name: e.target.value })}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-primary/60">Validade</label>
                        <input
                          type="text"
                          required
                          placeholder="MM/AA"
                          className="w-full bg-white border border-rose-200 rounded-xl px-4 py-3 outline-none focus:border-primary/50 transition-all text-sm"
                          value={cardData.expiry}
                          onChange={(e) => {
                            let val = e.target.value.replace(/\D/g, '');
                            if (val.length > 2) val = val.slice(0, 2) + '/' + val.slice(2, 4);
                            setCardData({ ...cardData, expiry: val.slice(0, 5) });
                          }}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-primary/60">CVV</label>
                        <input
                          type="text"
                          required
                          placeholder="000"
                          className="w-full bg-white border border-rose-200 rounded-xl px-4 py-3 outline-none focus:border-primary/50 transition-all text-sm"
                          value={cardData.cvv}
                          onChange={(e) => setCardData({ ...cardData, cvv: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                        />
                      </div>
                    </div>
                  </motion.div>
                )}
                {paymentMethod === 'pix' && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="mt-6 p-6 bg-rose-50/50 rounded-2xl border border-rose-100 flex items-center gap-4"
                  >
                    <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-primary shrink-0 border border-rose-100">
                      <QrCode className="w-6 h-6" />
                    </div>
                    <p className="text-xs text-stone-500 italic font-medium">
                      O código PIX será gerado após você clicar em &quot;Garantir minha vaga&quot;.
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </form>
        </div>

        {/* Summary Column */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="md:col-span-12 lg:col-span-5"
        >
          <div className="bg-white border-l-4 border-[#D98BB0] rounded-[16px] p-8 sticky top-32 shadow-sm transition-all duration-300 hover:translate-y-[-5px] hover:shadow-[0_12px_30px_rgba(0,0,0,0.08)]">
            <h3 className="text-xl font-serif text-primary font-bold mb-8 border-b border-rose-50 pb-4">Resumo da Compra</h3>

            <div className="space-y-6 mb-8">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-rose-50 rounded-xl flex items-center justify-center text-primary">
                    <Ticket className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-sm font-bold uppercase tracking-tight text-primary">Ingresso Individual</p>
                    <p className="text-[10px] text-primary/60 uppercase font-black tracking-widest">30 de Maio de 2026</p>
                  </div>
                </div>
                <p className="text-lg font-serif font-bold text-primary">R$ 57,00</p>
              </div>
            </div>

            {/* Coupon Section */}
            <div className="mb-8 p-4 bg-stone-50 rounded-2xl border border-stone-100">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Tag className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                  <input
                    type="text"
                    placeholder="Cupom de desconto"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                    className="w-full bg-white border border-stone-200 rounded-xl py-2 pl-10 pr-4 text-xs font-bold outline-none focus:ring-2 focus:ring-primary/10"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleApplyCoupon}
                  disabled={isValidatingCoupon || !couponCode}
                  className="bg-primary text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-primary/90 transition-all disabled:opacity-50"
                >
                  {isValidatingCoupon ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Aplicar'}
                </button>
              </div>
              {couponError && <p className="text-[10px] text-red-500 mt-2 ml-1 font-bold">{couponError}</p>}
              {discount > 0 && <p className="text-[10px] text-green-600 mt-2 ml-1 font-bold">Cupom aplicado: - R$ {discount.toFixed(2)}</p>}
            </div>

            <div className="space-y-4 border-t border-rose-50 pt-6">
              <div className="flex justify-between text-stone-500 text-sm italic">
                <span>Subtotal</span>
                <span>R$ 57,00</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-green-600 text-sm italic font-bold">
                  <span>Desconto</span>
                  <span>- R$ {discount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-stone-500 text-sm italic">
                <span>Taxa de Serviço</span>
                <span>R$ 0,00</span>
              </div>
              <div className="flex justify-between items-center pt-4 border-t border-rose-100">
                <span className="text-lg font-serif font-bold">Total</span>
                <span className="text-3xl font-serif text-primary font-bold">R$ {(57 - discount).toFixed(2)}</span>
              </div>
            </div>

            <div className="mt-8 p-4 bg-rose-50 rounded-2xl flex flex-col gap-4 border border-rose-100/50">
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-primary shrink-0 shadow-sm border border-rose-100">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <p className="text-[10px] text-primary leading-relaxed font-medium uppercase tracking-widest italic">
                  Seu ingresso será enviado imediatamente após a confirmação do pagamento.
                </p>
              </div>

              <div className="flex items-center gap-3 pt-4 border-t border-rose-200/30">
                <input
                  type="checkbox"
                  id="agree-terms"
                  checked={agreed}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setAgreed(e.target.checked)}
                  className="w-4 h-4 rounded text-primary focus:ring-primary border-rose-200"
                />
                <div className="text-[10px] uppercase font-bold tracking-widest text-primary/60">
                  Li e concordo com as
                  <span
                    onClick={(e) => {
                      e.preventDefault();
                      setShowTerms(true);
                    }}
                    className="text-primary hover:underline underline-offset-2 cursor-pointer ml-1"
                  >
                    Regras e Termos de Uso
                  </span>
                </div>
              </div>
            </div>

            <button
              type="submit"
              form="checkout-form"
              disabled={loading || !agreed}
              className="w-full mt-8 bg-gradient-to-br from-[#C87A9F] to-[#D98BB0] hover:scale-[1.03] text-white rounded-xl py-5 text-base font-serif font-bold shadow-lg hover:shadow-[0_8px_20px_rgba(217,139,176,0.3)] transition-all duration-300 disabled:opacity-50 border border-white/20"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Confirmar vaga'}
            </button>
          </div>
        </motion.div>
      </div>

      <AnimatePresence>
        {showTerms && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-stone-900/60 backdrop-blur-md z-[110] flex items-center justify-center p-6"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white border-l-8 border-[#D98BB0] rounded-[24px] p-8 md:p-12 max-w-2xl w-full max-h-[80vh] overflow-y-auto shadow-2xl relative"
            >
              <button
                onClick={() => setShowTerms(false)}
                className="absolute top-6 right-6 text-stone-400 hover:text-primary transition-colors"
                title="Fechar"
              >
                <ArrowLeft className="w-6 h-6 rotate-90" />
              </button>

              <h2 className="text-3xl font-serif text-primary font-bold mb-8 italic">Termos de Uso e Regras do Evento</h2>

              <div className="space-y-6 text-stone-600 text-sm leading-relaxed overflow-y-auto pr-4 custom-scrollbar">
                <section>
                  <h4 className="font-bold text-primary uppercase text-xs tracking-widest mb-2 font-sans">1. Política de Ingressos e Cancelamento</h4>
                  <p>As vagas para o Chá com Prosa Especial 2026 são estritamente limitadas e reservadas nominalmente. Devido aos custos de organização, mimos e buffet já previstos por participante, <strong>não realizamos devolução de valores</strong> em caso de desistência, falta ou atrasos.</p>
                </section>

                <section>
                  <h4 className="font-bold text-primary uppercase text-xs tracking-widest mb-2 font-sans">2. Horário e Local</h4>
                  <p>O evento terá início pontualmente às 16h00 no dia 30 de maio de 2026, no Templo Sede da IADE. Recomendamos a chegada com 15 minutos de antecedência para credenciamento e entrega do Kit de Boas-Vindas.</p>
                </section>

                <section>
                  <h4 className="font-bold text-primary uppercase text-xs tracking-widest mb-2 font-sans">3. Sorteios e Brindes</h4>
                  <p>Para participar dos sorteios exclusivos e receber brindes especiais, a participante <strong>deve estar presente no local</strong> no momento da premiação. Caso a sorteada não esteja presente, um novo sorteio será realizado imediatamente.</p>
                </section>

                <section>
                  <h4 className="font-bold text-primary uppercase text-xs tracking-widest mb-2 font-sans">4. Comportamento e Convivência</h4>
                  <p>O Chá com Prosa é um ambiente de paz, respeito e apoio mútuo. Espera-se que todas as participantes mantenham uma conduta cordial e respeitosa com as demais convidadas e equipe de organização.</p>
                </section>

                <section>
                  <h4 className="font-bold text-primary uppercase text-xs tracking-widest mb-2 font-sans">5. Uso de Imagem</h4>
                  <p>Ao participar do evento, você autoriza o uso de sua imagem em fotos e vídeos registrados durante o evento para fins de divulgação em redes sociais e materiais institucionais do Chá com Prosa.</p>
                </section>
              </div>

              <div className="mt-10">
                <button
                  onClick={() => {
                    setAgreed(true);
                    setShowTerms(false);
                  }}
                  className="w-full bg-gradient-to-br from-[#C87A9F] to-[#D98BB0] text-white rounded-xl py-4 font-bold shadow-lg hover:shadow-[0_8px_20px_rgba(217,139,176,0.3)] transition-all"
                >
                  Entendi e Concordo com as Regras
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
        {step > 1 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-stone-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-6"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white rounded-3xl p-12 max-w-md w-full text-center shadow-2xl border border-rose-100"
            >
              {step === 2 && (
                <div className="space-y-6">
                  <div className="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center mx-auto text-primary mb-4">
                    <QrCode className="w-8 h-8" />
                  </div>
                  <h2 className="text-2xl font-serif text-primary font-bold">Escaneie o QR Code</h2>
                  <p className="text-stone-500 text-xs italic">Acesse o app do seu banco e pague via PIX para confirmar sua vaga agora mesmo.</p>

                  {pixData?.qrCodeBase64 && (
                    <div className="bg-white p-4 rounded-2xl border-2 border-rose-100 inline-block mx-auto shadow-sm">
                      <img
                        src={`data:image/png;base64,${pixData.qrCodeBase64}`}
                        alt="QR Code Pix"
                        className="w-48 h-48 mx-auto"
                      />
                    </div>
                  )}

                  <div className="space-y-3 pt-4">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Pix Copia e Cola</p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        readOnly
                        value={pixData?.qrCode || ''}
                        className="flex-1 bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 text-[10px] font-mono text-stone-500 truncate"
                      />
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(pixData?.qrCode || '');
                          alert('Código PIX copiado!');
                        }}
                        className="bg-primary text-white px-4 py-2 rounded-lg text-[10px] font-bold uppercase"
                      >
                        Copiar
                      </button>
                    </div>
                  </div>

                  <div className="pt-6 border-t border-rose-50 flex items-center justify-center gap-3">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Aguardando confirmação do banco...</p>
                  </div>
                </div>
              )}
              {step === 3 && (
                <div className="space-y-8">
                  <div className="w-20 h-20 bg-rose-50 rounded-full flex items-center justify-center mx-auto text-primary">
                    <CheckCircle2 className="w-10 h-10" />
                  </div>
                  <div>
                    <h2 className="text-3xl font-serif text-primary font-bold mb-2">Tudo Pronto!</h2>
                    <p className="text-stone-500 text-sm italic">Sua vaga está garantida. Redirecionando para seu ingresso...</p>
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <Script
        src="https://sdk.mercadopago.com/js/v2"
        strategy="afterInteractive"
      />
    </div>
  );
}
