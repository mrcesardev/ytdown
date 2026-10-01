'use client';

import React from 'react';
import Link from 'next/link';
import { Sparkles, Lock, X, Check, ArrowRight } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  reason: 'playlist' | 'high_quality';
}

export default function AuthModal({ isOpen, onClose, reason }: AuthModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl overflow-hidden">
        {/* Decorative background glow */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />

        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-full bg-slate-800/50 hover:bg-slate-800 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex flex-col items-center text-center">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-500 to-rose-500 flex items-center justify-center shadow-lg shadow-rose-500/20 mb-4">
            <Lock className="w-7 h-7 text-white" />
          </div>

          <h3 className="text-xl font-bold text-white tracking-tight">
            {reason === 'playlist' ? 'Download de Playlists' : 'Áudio em Alta Qualidade (320 kbps)'}
          </h3>

          <p className="text-slate-400 text-sm mt-2">
            {reason === 'playlist'
              ? 'O download de listas completas em formato ZIP é um recurso exclusivo para usuários cadastrados.'
              : 'A conversão de áudio em 320 kbps de alta fidelidade é liberada gratuitamente para quem tem conta.'}
          </p>

          <div className="w-full bg-slate-950/60 border border-slate-800/80 rounded-2xl p-4 my-5 text-left space-y-2.5">
            <div className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
              Vantagens da sua conta gratuita:
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-300">
              <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <span>Download de playlists inteiras do YouTube compactadas em ZIP</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-300">
              <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <span>MP3 em 320 kbps com máxima nitidez sonora</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-300">
              <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <span>Histórico salvo na sua conta para baixar quando quiser</span>
            </div>
          </div>

          <div className="w-full space-y-2">
            <Link
              href="/login"
              className="w-full py-3.5 px-4 bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-400 text-white font-semibold rounded-xl transition-all shadow-lg shadow-rose-600/25 flex items-center justify-center gap-2 group text-sm"
            >
              <span>Criar Conta Gratuita em 10s</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>

            <button
              onClick={onClose}
              className="w-full py-2.5 text-xs text-slate-400 hover:text-slate-300 transition-colors"
            >
              Continuar com a versão padrão grátis
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
