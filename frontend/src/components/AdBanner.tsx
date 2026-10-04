'use client';

import React, { useEffect, useRef } from 'react';
import { MONETIZATION_CONFIG } from '@/config/monetization';
import { Shield, Sparkles, Heart } from 'lucide-react';

interface AdBannerProps {
  slot?: 'top' | 'middle' | 'bottom';
  onOpenDonation?: () => void;
}

export default function AdBanner({ slot = 'middle', onOpenDonation }: AdBannerProps) {
  const adContainerRef = useRef<HTMLDivElement>(null);
  const { enabled, adsterraBannerKey } = MONETIZATION_CONFIG.ads;

  useEffect(() => {
    // Injeta scripts de anúncio caso a rede esteja habilitada
    if (enabled && adsterraBannerKey && adContainerRef.current) {
      try {
        const script = document.createElement('script');
        script.type = 'text/javascript';
        script.src = `//www.profitablecreativeformat.com/${adsterraBannerKey}/invoke.js`;
        script.async = true;
        adContainerRef.current.appendChild(script);
      } catch (e) {
        console.error('Erro ao carregar banner de anúncio:', e);
      }
    }
  }, [enabled, adsterraBannerKey]);

  // Se anúncios da rede estiverem ativos e configurados
  if (enabled && adsterraBannerKey) {
    return (
      <div className="w-full max-w-3xl mx-auto my-6 text-center">
        <div className="text-[10px] text-slate-600 uppercase font-mono tracking-wider mb-1">
          Publicidade
        </div>
        <div
          ref={adContainerRef}
          className="min-h-[90px] w-full bg-slate-900/30 border border-slate-800/40 rounded-2xl flex items-center justify-center overflow-hidden"
        />
      </div>
    );
  }

  // Fallback Premium: Card nativo de apoio e utilidade
  return (
    <div className="w-full max-w-3xl mx-auto my-6 p-4 sm:p-5 bg-gradient-to-r from-slate-900/90 via-slate-900/70 to-slate-900/90 border border-slate-800/80 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 backdrop-blur-sm shadow-md">
      <div className="flex items-center gap-3 text-center sm:text-left">
        <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center flex-shrink-0 text-rose-400">
          <Heart className="w-5 h-5 fill-rose-500/20" />
        </div>
        <div>
          <div className="flex items-center justify-center sm:justify-start gap-2">
            <span className="text-xs font-bold text-white tracking-tight">
              Gosta do YtDown sem anúncios e na velocidade máxima?
            </span>
            <span className="text-[9px] uppercase px-1.5 py-0.5 rounded font-bold bg-amber-500/15 text-amber-400 border border-amber-500/20 hidden sm:inline-block">
              Apoie
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Ajude a manter os servidores ativos com qualquer valor via PIX.
          </p>
        </div>
      </div>

      {onOpenDonation && (
        <button
          type="button"
          onClick={onOpenDonation}
          className="px-4 py-2 bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-400 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-rose-600/20 flex items-center gap-1.5 flex-shrink-0"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Fazer um PIX</span>
        </button>
      )}
    </div>
  );
}
