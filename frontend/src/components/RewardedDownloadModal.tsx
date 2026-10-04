'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { MONETIZATION_CONFIG } from '@/config/monetization';
import { MediaDownload } from '@/lib/supabase';
import {
  Sparkles,
  Download,
  Loader2,
  CheckCircle2,
  Clock,
  Zap,
  UserPlus,
  ShieldCheck,
  X,
} from 'lucide-react';

interface RewardedDownloadModalProps {
  isOpen: boolean;
  onClose: () => void;
  downloadItem: MediaDownload | null;
}

export default function RewardedDownloadModal({
  isOpen,
  onClose,
  downloadItem,
}: RewardedDownloadModalProps) {
  const { countdownSeconds, adScriptUrl } = MONETIZATION_CONFIG.rewardedAds;
  const [secondsLeft, setSecondsLeft] = useState(countdownSeconds);
  const [isUnlocked, setIsUnlocked] = useState(false);

  // Inicia ou reinicia o contador quando o modal abrir
  useEffect(() => {
    if (!isOpen) {
      setSecondsLeft(countdownSeconds);
      setIsUnlocked(false);
      return;
    }

    setSecondsLeft(countdownSeconds);
    setIsUnlocked(false);

    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setIsUnlocked(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isOpen, countdownSeconds]);

  // Se o script de anúncio rewarded estiver configurado
  useEffect(() => {
    if (isOpen && adScriptUrl) {
      try {
        const script = document.createElement('script');
        script.src = adScriptUrl;
        script.async = true;
        document.body.appendChild(script);
        return () => {
          document.body.removeChild(script);
        };
      } catch (e) {
        console.error('Erro ao inicializar script de rewarded ad:', e);
      }
    }
  }, [isOpen, adScriptUrl]);

  if (!isOpen) return null;

  const progressPercent = Math.min(
    100,
    Math.round(((countdownSeconds - secondsLeft) / countdownSeconds) * 100)
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-7 shadow-2xl text-center space-y-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Botão Fechar só ativo após desbloqueio ou se o usuário quiser fechar */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white bg-slate-800/60 hover:bg-slate-800 rounded-full transition-colors"
          title="Fechar"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Cabeçalho */}
        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5 text-rose-400" />
            <span>Desbloqueio de Download Grátis</span>
          </div>
          <h3 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
            {isUnlocked ? 'Download Liberado!' : 'Preparando seu Arquivo...'}
          </h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
            {isUnlocked
              ? 'Obrigado por apoiar a ferramenta gratuita! Seu arquivo de alta velocidade está pronto.'
              : 'Estamos processando a melhor qualidade na VPS enquanto você desbloqueia o download.'}
          </p>
        </div>

        {/* Prévia da Mídia & Contador */}
        <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4 shadow-inner">
          {downloadItem && (
            <div className="flex items-center gap-3 text-left bg-slate-900/80 border border-slate-800/70 p-3 rounded-xl">
              {downloadItem.thumbnail ? (
                <img
                  src={downloadItem.thumbnail}
                  alt={downloadItem.title || 'Mídia'}
                  className="w-12 h-12 object-cover rounded-lg flex-shrink-0 border border-slate-700/50"
                />
              ) : (
                <div className="w-12 h-12 rounded-lg bg-slate-800 flex items-center justify-center flex-shrink-0 text-slate-400">
                  <Download className="w-5 h-5" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <span className="text-[10px] uppercase font-bold text-rose-400">
                  {downloadItem.format.toUpperCase()} &bull;{' '}
                  {downloadItem.quality === 'high' ? '320 kbps' : 'Padrão'}
                </span>
                <p className="text-xs font-semibold text-white truncate">
                  {downloadItem.title || downloadItem.original_url}
                </p>
              </div>
            </div>
          )}

          {/* Barra de Progresso e Timer */}
          {!isUnlocked ? (
            <div className="space-y-2 py-2">
              <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
                <span className="flex items-center gap-1.5">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-500" />
                  Liberando em instantes...
                </span>
                <span className="text-white font-mono font-bold text-sm">
                  {secondsLeft}s
                </span>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden border border-slate-700/50">
                <div
                  className="bg-gradient-to-r from-rose-600 via-rose-500 to-amber-400 h-full transition-all duration-1000 ease-linear rounded-full shadow-sm shadow-rose-500/50"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          ) : (
            <div className="py-2 flex items-center justify-center gap-2 text-emerald-400 text-sm font-semibold">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              <span>Pronto para Download!</span>
            </div>
          )}

          {/* Slot de Anúncio / Patrocinador Nativo */}
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800/80 text-center space-y-2">
            <div className="text-[9px] uppercase tracking-wider text-slate-500 font-mono">
              Patrocinador &bull; Apoie o YtDown
            </div>
            <div className="text-xs font-bold text-white flex items-center justify-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Downloads Ilimitados e 100% Livres de Anúncios?</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Crie uma conta gratuita em menos de 10 segundos para baixar playlists completas e nunca mais ver este contador!
            </p>
            <Link
              href="/login"
              onClick={onClose}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-750 text-white text-[11px] font-semibold border border-slate-700 transition-colors"
            >
              <UserPlus className="w-3.5 h-3.5 text-rose-400" />
              <span>Criar Conta Gratuita</span>
            </Link>
          </div>
        </div>

        {/* Botão de Ação Final */}
        <div>
          {isUnlocked ? (
            <button
              type="button"
              onClick={onClose}
              className="w-full py-3.5 px-5 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-bold rounded-2xl transition-all shadow-lg shadow-emerald-600/25 flex items-center justify-center gap-2 text-sm animate-bounce"
            >
              <Download className="w-4 h-4" />
              <span>Acompanhar Download Liberado</span>
            </button>
          ) : (
            <div className="text-[11px] text-slate-500 flex items-center justify-center gap-1">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>Aguarde {secondsLeft} segundos para desbloquear seu link...</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
