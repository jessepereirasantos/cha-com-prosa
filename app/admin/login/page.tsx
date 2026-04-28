'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Coffee, Lock, Loader2, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import Link from 'next/link';
import { motion } from 'motion/react';

export default function AdminLoginPage() {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(false);
    
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      if (res.ok) {
        router.push('/admin/dashboard');
        setTimeout(() => {
          if (window.location.pathname !== '/admin/dashboard') {
            window.location.href = '/admin/dashboard';
          }
        }, 1000);
      } else {
        setError(true);
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center p-4">
      <Link href="/" className="absolute top-8 left-8 flex items-center gap-2 text-stone-500 hover:text-stone-900 transition-colors font-bold text-sm">
        <ArrowLeft className="w-4 h-4" />
        Voltar ao site
      </Link>

      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md bg-white border-l-4 border-[#D98BB0] rounded-[16px] shadow-xl p-8 md:p-12 transition-all duration-300 hover:shadow-[0_12px_30px_rgba(0,0,0,0.08)]"
      >
        <div className="flex flex-col items-center text-center mb-10">
          <div className="w-16 h-16 bg-burgundy-600 rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-burgundy-900/20">
            <Coffee className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-serif font-bold text-stone-900">Acesso Restrito</h1>
          <p className="text-stone-500 text-sm mt-2">Painel de Gestão Chá com Prosa</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div className="space-y-2">
            <label className="text-xs font-bold text-stone-400 uppercase tracking-widest pl-1">Senha de Acesso</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError(false);
                }}
                className={`w-full bg-stone-50 border ${error ? 'border-red-500' : 'border-stone-200'} rounded-2xl px-5 py-4 pl-12 pr-12 focus:ring-2 focus:ring-[#D98BB0]/20 focus:border-[#D98BB0] outline-none transition-all`}
                placeholder="••••••••"
              />
              <Lock className="w-5 h-5 text-stone-400 absolute left-4 top-1/2 -translate-y-1/2" />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-stone-400 hover:text-primary transition-colors p-1"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            {error && <p className="text-red-500 text-xs font-bold pl-1 pt-1 italic">Senha incorreta. Tente novamente.</p>}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-br from-[#C87A9F] to-[#D98BB0] text-white rounded-xl py-4 font-bold text-lg hover:scale-[1.03] transition-all duration-300 shadow-lg hover:shadow-[0_8px_20px_rgba(217,139,176,0.3)] flex items-center justify-center gap-3 disabled:opacity-70 border border-white/20"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              'Entrar no Painel'
            )}
          </button>
        </form>

        <p className="text-center mt-8 text-xs text-stone-400">
          Acesso restrito a organizadores. <br />
          Dificuldades com a senha? Entre em contato com o suporte.
        </p>
      </motion.div>
    </div>
  );
}
