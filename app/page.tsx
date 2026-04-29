'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion, AnimatePresence } from 'motion/react';
import {
  Calendar,
  MapPin,
  HeartPulse,
  Coffee,
  Users,
  Gift,
  BookOpen,
  UtensilsCrossed,
  CheckCircle2,
  Dices,
  ArrowLeft,
  Clock,
  AlertCircle,
  Menu,
  X
} from 'lucide-react';

export default function Home() {
  const [showTerms, setShowTerms] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  return (
    <div className="bg-background text-on-background font-sans overflow-x-hidden selection:bg-secondary-container selection:text-primary">
      {/* TopAppBar */}
      <header className="fixed top-0 left-0 w-full z-50 bg-rose-50/95 backdrop-blur-sm border-b border-rose-200/50 shadow-[0_4px_20px_rgba(140,28,63,0.05)]">
        <div className="max-w-[1200px] mx-auto w-full flex justify-between items-center px-4 sm:px-6 py-2">
          <div className="flex items-center gap-2 shrink-0">
            <Image
              src="https://lh3.googleusercontent.com/aida/ADBb0ugI_ktMZqEiaKdWAeMkUov7eIVNbjiUEycPETPVbafa1UORo14_3FTl2u8q_3RIDSUl-mZlNeRG9QXSw-cfy7X3YbcaIKnSfc4e9bR-Hjs9XbqZCz8Ln_4WDdDXgigu7l4z2v9uA19YbeWwZEfcVZDZGZi-3tw9kpPzGGpjXQoJFP6gNze818UwnLVb6X6Wth4r3hRPwbZTRITrtfx_P7fRBnTSAhMmcDTeGhJe2ZuCuRkYvOceWiEDouxkGf8CgQmKfoWWV8xskA"
              alt="Chá com Prosa"
              width={60}
              height={60}
              className="h-12 sm:h-16 w-auto"
              referrerPolicy="no-referrer"
            />
            <span className="font-serif text-lg sm:text-2xl font-bold italic text-stone-700 whitespace-nowrap">Chá com Prosa</span>
          </div>

          <nav className="hidden lg:flex gap-8 items-center">
            <a href="#evento" className="font-serif text-base tracking-wide text-primary border-b-2 border-primary pb-1 font-semibold whitespace-nowrap">O Evento</a>
            <a href="#palestrante" className="font-serif text-base tracking-wide text-stone-600 hover:text-primary transition-colors whitespace-nowrap">Palestrante</a>
            <a href="#investimento" className="font-serif text-base tracking-wide text-stone-600 hover:text-primary transition-colors whitespace-nowrap">Investimento</a>
            <a href="#localizacao" className="font-serif text-base tracking-wide text-stone-600 hover:text-primary transition-colors whitespace-nowrap">Localização</a>
          </nav>

          <div className="flex items-center gap-4">
            <Link
              href="/checkout"
              className="text-white px-4 sm:px-6 py-2 sm:py-2.5 rounded-lg font-serif font-semibold text-xs sm:text-sm transition-all hover:scale-[1.03] active:scale-95 duration-300 ease-in-out bg-gradient-to-br from-[#C87A9F] to-[#D98BB0] shadow-md hover:shadow-[0_8px_20px_rgba(217,139,176,0.3)] border border-white/20 whitespace-nowrap"
            >
              <span className="hidden sm:inline">Garantir minha vaga</span>
              <span className="sm:hidden">Reservar</span>
            </Link>

            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="lg:hidden text-primary p-1 hover:bg-rose-100/50 rounded-lg transition-colors"
            >
              {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        <AnimatePresence>
          {isMenuOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="lg:hidden bg-white border-b border-rose-100 overflow-hidden"
            >
              <div className="flex flex-col p-6 gap-4">
                <a
                  href="#evento"
                  onClick={() => setIsMenuOpen(false)}
                  className="font-serif text-lg text-stone-600 hover:text-primary py-2 px-4 rounded-xl hover:bg-rose-50 transition-all font-medium"
                >
                  O Evento
                </a>
                <a
                  href="#palestrante"
                  onClick={() => setIsMenuOpen(false)}
                  className="font-serif text-lg text-stone-600 hover:text-primary py-2 px-4 rounded-xl hover:bg-rose-50 transition-all font-medium"
                >
                  Palestrante
                </a>
                <a
                  href="#investimento"
                  onClick={() => setIsMenuOpen(false)}
                  className="font-serif text-lg text-stone-600 hover:text-primary py-2 px-4 rounded-xl hover:bg-rose-50 transition-all font-medium"
                >
                  Investimento
                </a>
                <a
                  href="#localizacao"
                  onClick={() => setIsMenuOpen(false)}
                  className="font-serif text-lg text-stone-600 hover:text-primary py-2 px-4 rounded-xl hover:bg-rose-50 transition-all font-medium"
                >
                  Localização
                </a>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* Hero Section */}
      <section className="relative flex items-center pt-24 overflow-hidden min-h-[800px]">
        <div className="absolute inset-0 z-0 hero-gradient"></div>
        <div className="max-w-[1200px] mx-auto w-full relative z-10 grid md:grid-cols-2 items-center gap-12 px-6 py-12">
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
            className="space-y-6"
          >
            <div className="inline-block bg-secondary-container text-on-secondary-fixed-variant px-4 py-1 rounded-full font-bold text-xs tracking-widest uppercase">
              ESPECIAL 2026
            </div>
            <h1 className="font-serif text-4xl sm:text-5xl md:text-6xl font-bold leading-tight text-stone-800">
              Chá com Prosa<br />
              <span className="italic font-normal whitespace-nowrap inline-block" style={{ color: '#2D1B1E', fontSize: 'clamp(1rem, 3.5vw, 2.8rem)' }}>Mulheres com Propósito</span>
            </h1>
            <p className="font-sans text-lg text-on-surface-variant max-w-lg leading-relaxed">
              Um encontro para mulheres que buscam conhecer mais de Deus e seu propósito. O Chá com Prosa é mais que um evento, é um momento de comunhão e ajuda mútua entre mulheres.
            </p>
            <div className="flex flex-wrap gap-4 items-center">
              <Link
                href="/checkout"
                className="text-white px-8 py-4 rounded-lg font-serif font-semibold text-lg shadow-lg transition-all duration-300 hover:scale-[1.03] bg-gradient-to-br from-[#C87A9F] to-[#D98BB0] hover:shadow-[0_8px_20px_rgba(217,139,176,0.3)] border border-white/20"
              >
                Garantir minha vaga
              </Link>
              <div className="flex items-center gap-2 text-primary font-semibold">
                <Calendar className="w-5 h-5" />
                <span className="font-serif italic">30 de Maio às 16h</span>
              </div>
            </div>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1 }}
            className="hidden md:flex justify-center"
          >
            <div className="relative w-full max-w-md">
              <Image
                src="https://lh3.googleusercontent.com/aida/ADBb0ugI_ktMZqEiaKdWAeMkUov7eIVNbjiUEycPETPVbafa1UORo14_3FTl2u8q_3RIDSUl-mZlNeRG9QXSw-cfy7X3YbcaIKnSfc4e9bR-Hjs9XbqZCz8Ln_4WDdDXgigu7l4z2v9uA19YbeWwZEfcVZDZGZi-3tw9kpPzGGpjXQoJFP6gNze818UwnLVb6X6Wth4r3hRPwbZTRITrtfx_P7fRBnTSAhMmcDTeGhJe2ZuCuRkYvOceWiEDouxkGf8CgQmKfoWWV8xskA"
                alt="Chá com Prosa Logo"
                width={500}
                height={500}
                className="w-full h-auto drop-shadow-2xl"
                referrerPolicy="no-referrer"
              />
            </div>
          </motion.div>
        </div>
      </section>

      {/* Info Bar */}
      <motion.section
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className="py-12 bg-white border-y border-rose-100"
      >
        <div className="max-w-[1200px] mx-auto w-full px-6">
          <div className="flex flex-col md:flex-row items-center justify-center gap-8 md:gap-16 text-center md:text-left">
            <div className="flex items-center gap-4">
              <div className="bg-primary/10 p-4 rounded-full">
                <Calendar className="w-10 h-10 text-primary" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-widest text-primary font-bold">Data do Encontro</p>
                <h3 className="font-serif text-3xl font-semibold text-on-surface">30 de Maio de 2026</h3>
              </div>
            </div>
            <div className="hidden md:block h-12 w-px bg-rose-200"></div>
            <div className="flex items-center gap-4">
              <div className="bg-primary/10 p-4 rounded-full">
                <Clock className="w-10 h-10 text-primary" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-widest text-primary font-bold">Horário de Início</p>
                <h3 className="font-serif text-3xl font-semibold text-on-surface">Às 16h</h3>
              </div>
            </div>
          </div>
        </div>
      </motion.section>

      {/* O que é o Chá com Prosa */}
      <motion.section
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className="py-24 bg-secondary-container/20 relative" id="evento"
      >
        <div className="absolute inset-0 floral-accent"></div>
        <div className="max-w-[1200px] mx-auto w-full px-6 text-center relative z-10 font-sans">
          <HeartPulse className="w-12 h-12 text-primary mx-auto mb-4" />
          <h2 className="font-serif text-4xl font-bold text-primary mb-8">O que é o Chá com Prosa?</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-surface p-8 border-l-4 border-[#D98BB0] rounded-[16px] shadow-sm transition-all duration-300 hover:translate-y-[-5px] hover:shadow-[0_12px_30px_rgba(0,0,0,0.08)]">
              <Coffee className="w-10 h-10 text-primary mx-auto mb-4" />
              <h3 className="font-serif text-xl font-bold text-primary mb-2">Diálogo & Prosa</h3>
              <p className="text-on-surface-variant text-sm">Um tempo de mesa especial entre mulheres que compartilham suas experiências.</p>
            </div>
            <div className="bg-surface p-8 border-l-4 border-[#D98BB0] rounded-[16px] shadow-sm transition-all duration-300 hover:translate-y-[-5px] hover:shadow-[0_12px_30px_rgba(0,0,0,0.08)]">
              <Users className="w-10 h-10 text-primary mx-auto mb-4" />
              <h3 className="font-serif text-xl font-bold text-primary mb-2">Irmandade</h3>
              <p className="text-on-surface-variant text-sm">Um espaço seguro para fortalecer laços entre mulheres de propósito.</p>
            </div>
            <div className="bg-surface p-8 border-l-4 border-[#D98BB0] rounded-[16px] shadow-sm transition-all duration-300 hover:translate-y-[-5px] hover:shadow-[0_12px_30px_rgba(0,0,0,0.08)]">
              <BookOpen className="w-10 h-10 text-primary mx-auto mb-4" />
              <h3 className="font-serif text-xl font-bold text-primary mb-2">Espiritualidade</h3>
              <p className="text-on-surface-variant text-sm">Um momento especial de busca pela presença de Deus entre mulheres.</p>
            </div>
          </div>
        </div>
      </motion.section>

      {/* Palestrante */}
      <motion.section
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className="py-24 bg-surface overflow-hidden" id="palestrante"
      >
        <div className="max-w-[1200px] mx-auto w-full px-6">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div className="relative group">
              <div className="absolute -inset-4 border border-primary/20 rounded-xl transition-all group-hover:inset-0"></div>
              <Image
                src="https://lh3.googleusercontent.com/aida/ADBb0uhcMKvexsnSmfXgWpCroWTo2FKpTJ_quo8aCReTGFBuC-YuEmgRJnBcO2UWW4qV7vzpwNnpZujvFoA1tpm4MvyhNIl4g7ZkYNVDTWAgDEPZo4UP2JvGGbKcaaF-PWCizXB_Hletw5yd3WYGgXCxQrwRty4IXtx79nHriIXJk9eKFksY56DiS_ksLMV1aqtbgsMBsknBVR3jPmqzY_rdxZu5KuWOwm2rzvYyrpl2rtB0ERmiJO0sg8HmVEP4JcN4GkLgoEWcEiRqig"
                alt="Erika Gomes"
                width={600}
                height={500}
                className="relative rounded-xl shadow-xl w-full h-[500px] object-cover"
                referrerPolicy="no-referrer"
              />
              <div className="absolute -bottom-6 -right-6 bg-primary p-6 rounded-lg text-white shadow-lg hidden md:block">
                <p className="font-serif italic text-lg text-on-primary text-white">&quot;O cuidado começa no olhar para si.&quot;</p>
              </div>
            </div>
            <div className="space-y-6">
              <span className="text-primary text-xs font-bold uppercase tracking-widest">Nossa Convidada</span>
              <h2 className="font-serif text-4xl font-bold text-primary">Erika Gomes<br /><span className="text-on-surface-variant font-normal italic">Terapeuta Familiar</span></h2>
              <p className="text-lg text-on-surface-variant leading-relaxed">
                Erika Gomes é terapeuta familiar, dedicada a guiar mulheres através das complexidades da jornada feminina e familiar. Com um olhar sensível e acolhedor, ela trará reflexões profundas sobre o propósito de Deus para a mulher.
              </p>
              <div className="pt-6 border-t border-rose-100 flex flex-col sm:flex-row gap-6">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-primary" />
                  <span className="font-sans font-medium">Reflexão Profunda</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-primary" />
                  <span className="font-sans font-medium">Acolhimento</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.section>

      {/* Mimos & Sorteios */}
      <motion.section
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className="py-24 bg-primary text-white relative overflow-hidden min-h-[800px]"
      >
        <div className="absolute top-0 right-0 w-1/3 h-full opacity-10 pointer-events-none">
          <Gift className="w-full text-white h-full rotate-12" />
        </div>
        <div className="max-w-[1200px] mx-auto w-full relative z-10 px-6">
          <div className="text-center mb-16">
            <h2 className="font-serif text-4xl font-bold mb-4 text-white">Mimos Preparados com Amor</h2>
            <p className="text-lg opacity-90 italic text-white">Cada detalhe pensado para tornar sua experiência inesquecível</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white/10 backdrop-blur-sm p-6 border-l-4 border-[#D98BB0] rounded-[16px] text-center transition-all duration-300 hover:translate-y-[-5px] hover:shadow-[0_12px_30px_rgba(0,0,0,0.20)]">
              <Gift className="w-10 h-10 mx-auto mb-4 text-white" />
              <h4 className="font-serif text-xl font-bold mb-2 text-white">Kit Boas-Vindas</h4>
              <p className="text-sm opacity-80 text-white">Entrega do kit especial logo na sua chegada ao evento.</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm p-6 border-l-4 border-[#D98BB0] rounded-[16px] text-center transition-all duration-300 hover:translate-y-[-5px] hover:shadow-[0_12px_30px_rgba(0,0,0,0.20)]">
              <Dices className="w-10 h-10 mx-auto mb-4 text-white" />
              <h4 className="font-serif text-xl font-bold mb-2 text-white">Sorteios Exclusivos</h4>
              <p className="text-sm opacity-80 text-white">Sorteio de brindes especiais para nossas participantes.</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm p-6 border-l-4 border-[#D98BB0] rounded-[16px] text-center transition-all duration-300 hover:translate-y-[-5px] hover:shadow-[0_12px_30px_rgba(0,0,0,0.20)]">
              <BookOpen className="w-10 h-10 mx-auto mb-4 text-white" />
              <h4 className="font-serif text-xl font-bold mb-2 text-white">Material de Apoio</h4>
              <p className="text-sm opacity-80 text-white">Para registrar todos os insights e reflexões do dia.</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm p-6 border-l-4 border-[#D98BB0] rounded-[16px] text-center transition-all duration-300 hover:translate-y-[-5px] hover:shadow-[0_12px_30px_rgba(0,0,0,0.20)]">
              <UtensilsCrossed className="w-10 h-10 mx-auto mb-4 text-white" />
              <h4 className="font-serif text-xl font-bold mb-2 text-white">Buffet de Chás</h4>
              <p className="text-sm opacity-80 text-white">Uma parada para um chá da tarde delicioso.</p>
            </div>
          </div>
        </div>
      </motion.section>

      {/* Investimento */}
      <motion.section
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className="py-24 bg-secondary-container/10" id="investimento"
      >
        <div className="max-w-[1200px] mx-auto w-full px-6 flex justify-center">
          <div className="bg-surface p-12 border-l-4 border-[#D98BB0] rounded-[16px] shadow-2xl relative overflow-hidden max-w-lg w-full text-center transition-all duration-300 hover:translate-y-[-5px]">
            <h2 className="font-serif text-3xl font-bold text-primary mb-2">Sua Participação</h2>
            <div className="flex items-baseline justify-center gap-2 mb-4">
              <span className="text-on-surface-variant font-sans text-lg">R$</span>
              <span className="text-6xl font-bold text-primary">57,00</span>
            </div>
            <div className="bg-rose-100 text-primary py-2 px-6 rounded-full inline-flex items-center gap-2 mb-8 font-bold text-sm">
              <AlertCircle className="w-4 h-4" />
              Vagas limitadas: apenas 50 vagas
            </div>
            <p className="text-on-surface-variant text-base mb-10 leading-relaxed">
              Incluso: Palestra, Coffee Break completo, Kit de Boas-Vindas e participação em todos os sorteios.
            </p>
            <Link
              href="/checkout"
              className="block w-full text-white py-5 rounded-lg font-serif font-bold text-lg shadow-lg transition-all duration-300 hover:scale-[1.03] bg-gradient-to-br from-[#C87A9F] to-[#D98BB0] hover:shadow-[0_8px_20px_rgba(217,139,176,0.3)] border border-white/20"
            >
              Garantir minha vaga agora
            </Link>
            <p className="mt-8 text-xs text-stone-400 italic">
              Pagamento via PIX ou Cartão de Crédito
            </p>
          </div>
        </div>
      </motion.section>

      {/* Localização */}
      <motion.section
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className="py-24 bg-surface" id="localizacao"
      >
        <div className="max-w-[1200px] mx-auto w-full px-6">
          <div className="grid md:grid-cols-2 gap-16">
            <div className="space-y-8">
              <div>
                <h2 className="font-serif text-4xl font-bold text-primary mb-8">Onde e Quando</h2>
                <div className="space-y-6">
                  <div className="flex items-start gap-4">
                    <div className="bg-rose-100 p-3 rounded-lg text-primary">
                      <MapPin className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="font-serif text-xl font-bold text-primary">Localização</h4>
                      <p className="text-on-surface-variant">Templo sede da IADE</p>
                      <p className="text-on-surface-variant">Rua Estevam Aragoni, 77 - Cipó</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="bg-rose-100 p-3 rounded-lg text-primary">
                      <Calendar className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="font-serif text-xl font-bold text-primary">Data e Horário</h4>
                      <p className="text-on-surface-variant">30 de maio de 2026</p>
                      <p className="text-on-surface-variant italic">Às 16 horas</p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="p-8 bg-secondary-container/20 rounded-xl italic text-on-surface-variant border-l-4 border-primary">
                &quot;Preparamos um ambiente de paz para que você possa se desligar do mundo e se reconectar com seu propósito.&quot;
              </div>
            </div>
            <div className="rounded-2xl overflow-hidden shadow-2xl h-[450px] border border-rose-100 relative group transition-all duration-300 hover:shadow-[0_20px_40px_rgba(0,0,0,0.12)] hover:-translate-y-1">
              <a
                href="https://www.google.com/maps/dir/?api=1&destination=Rua+Estevam+Aragoni,+77+-+Cipó+-+Embu-Guaçu"
                target="_blank"
                rel="noopener noreferrer"
                className="absolute inset-0 z-10 cursor-pointer"
                title="Clique para abrir rotas no Google Maps"
              >
                <span className="sr-only">Abrir rotas no Google Maps</span>
              </a>
              <iframe
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3648.8680196222855!2d-46.8407886246603!3d-23.858852378595874!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x94ce34005b8716cb%3A0xc316972e382d6880!2sR.%20Estevam%20Aragoni%2C%2077%20-%20Jardim%20Cip%C3%B3%20(Cip%C3%B3-Gua%C3%A7u)%2C%20Embu-Gua%C3%A7u%20-%20SP%2C%2006900-000!5e0!3m2!1sen!2sbr!4v1715600000000!5m2!1sen!2sbr"
                className="w-full h-full border-0 pointer-events-none"
                allowFullScreen={true}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              ></iframe>
            </div>
          </div>
        </div>
      </motion.section>

      {/* Footer */}
      <footer className="py-16 bg-stone-50 border-t border-rose-100">
        <div className="max-w-[1200px] mx-auto w-full px-6 text-center space-y-8">
          <div className="flex flex-col items-center gap-4">
            <Image
              src="https://lh3.googleusercontent.com/aida/ADBb0ugI_ktMZqEiaKdWAeMkUov7eIVNbjiUEycPETPVbafa1UORo14_3FTl2u8q_3RIDSUl-mZlNeRG9QXSw-cfy7X3YbcaIKnSfc4e9bR-Hjs9XbqZCz8Ln_4WDdDXgigu7l4z2v9uA19YbeWwZEfcVZDZGZi-3tw9kpPzGGpjXQoJFP6gNze818UwnLVb6X6Wth4r3hRPwbZTRITrtfx_P7fRBnTSAhMmcDTeGhJe2ZuCuRkYvOceWiEDouxkGf8CgQmKfoWWV8xskA"
              alt="Chá com Prosa"
              width={60}
              height={60}
              className="h-12 w-auto"
              referrerPolicy="no-referrer"
            />
            <div className="flex gap-8">
              <button
                onClick={() => setShowTerms(true)}
                className="text-stone-500 hover:text-primary transition-colors text-sm font-serif italic"
              >
                Termos de Uso
              </button>
              <a href="https://wa.me/5511968472113?text=A%20paz..quero%20saber%20mais%20sobre%20o%20cha%20com%20prosa%20especial%202026" target="_blank" rel="noopener noreferrer" className="text-stone-500 hover:text-primary transition-colors text-sm font-serif italic">Contato</a>
            </div>
          </div>
          <div className="pt-8 border-t border-rose-100/50">
            <p className="font-serif text-sm italic text-stone-500">© 2026 Chá com Prosa. Um encontro marcado com mulheres de propósito.</p>
            <p className="text-[10px] uppercase tracking-widest text-stone-400 mt-2 font-bold">Desenvolvido com amor para mulheres que inspiram.</p>
          </div>
        </div>
      </footer>

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

              <div className="space-y-6 text-stone-600 text-sm leading-relaxed pr-4">
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
                  onClick={() => setShowTerms(false)}
                  className="w-full bg-gradient-to-br from-[#C87A9F] to-[#D98BB0] text-white rounded-xl py-4 font-bold shadow-lg hover:shadow-[0_8px_20px_rgba(217,139,176,0.3)] transition-all"
                >
                  Fechar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
