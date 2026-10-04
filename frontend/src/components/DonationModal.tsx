'use client';

import React, { useState } from 'react';
import { MONETIZATION_CONFIG } from '@/config/monetization';
import { Heart, Copy, Check, X, Coffee, ShieldCheck, Sparkles } from 'lucide-react';

interface DonationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function DonationModal({ isOpen, onClose }: DonationModalProps) {
  const [copied, setCopied] = useState(false);
  const { key, receiverName } = MONETIZATION_CONFIG.pix;

  if (!isOpen) return null;

  const handleCopy = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(key);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(
    key
  )}&margin=10`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-7 shadow-2xl text-center space-y-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Botão Fechar */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white bg-slate-800/60 hover:bg-slate-800 rounded-full transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Ícone e Cabeçalho */}
        <div className="space-y-2">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-tr from-rose-500 to-amber-400 p-0.5 shadow-lg shadow-rose-500/20">
            <div className="w-full h-full bg-slate-900 rounded-[14px] flex items-center justify-center">
              <Heart className="w-7 h-7 text-rose-500 fill-rose-500/20 animate-pulse" />
            </div>
          </div>
          <h3 className="text-xl font-extrabold text-white tracking-tight">
            Apoie o YtDown
          </h3>
          <p className="text-xs text-slate-400 leading-relaxed max-w-xs mx-auto">
            O YtDown opera sem anúncios abusivos, oferecendo downloads em alta velocidade. Sua contribuição de qualquer valor mantém os servidores online!
          </p>
        </div>

        {/* Área do PIX */}
        <div className="bg-slate-950/80 border border-slate-800/90 rounded-2xl p-5 space-y-4 shadow-inner">
          <div className="flex items-center justify-center gap-2 text-xs font-semibold text-emerald-400">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Doação Instantânea via PIX</span>
          </div>

          {/* QR Code */}
          <div className="flex justify-center">
            <div className="p-2 bg-white rounded-xl shadow-md border border-slate-700/50">
              <img
                src={qrCodeUrl}
                alt="QR Code PIX"
                width={150}
                height={150}
                className="rounded-lg"
              />
            </div>
          </div>

          {/* Chave PIX e Botão Copiar */}
          <div className="space-y-2">
            <div className="text-[11px] text-slate-500">
              Destinatário: <span className="text-slate-300 font-medium">{receiverName}</span>
            </div>
            <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-xl p-2.5">
              <input
                type="text"
                readOnly
                value={key}
                className="bg-transparent text-xs text-slate-200 w-full focus:outline-none font-mono select-all truncate px-1"
              />
              <button
                type="button"
                onClick={handleCopy}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all flex-shrink-0 ${
                  copied
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : 'bg-rose-600 hover:bg-rose-500 text-white shadow-sm'
                }`}
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Copiado!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copiar</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Rodapé do Modal */}
        <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-500">
          <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
          <span>Contribuição voluntária &bull; Muito obrigado pelo apoio!</span>
        </div>
      </div>
    </div>
  );
}
