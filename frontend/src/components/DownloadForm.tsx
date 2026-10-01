'use client';

import React, { useState } from 'react';
import { supabase, MediaDownload } from '@/lib/supabase';
import AuthModal from '@/components/AuthModal';
import {
  Music,
  Film,
  Download,
  Link2,
  Lock,
  Sparkles,
  AlertCircle,
  ListVideo,
} from 'lucide-react';

interface DownloadFormProps {
  userId: string | null;
  onDownloadStarted?: (newDownload: MediaDownload) => void;
}

export default function DownloadForm({ userId, onDownloadStarted }: DownloadFormProps) {
  const [url, setUrl] = useState('');
  const [format, setFormat] = useState<'mp3' | 'mp4'>('mp3');
  const [quality, setQuality] = useState<'standard' | 'high'>('standard');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Controle do modal de cadastro
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalReason, setAuthModalReason] = useState<'playlist' | 'high_quality'>('high_quality');

  const isPlaylistUrl = (inputUrl: string) => inputUrl.includes('list=');

  const handleQualitySelect = (selectedQuality: 'standard' | 'high') => {
    if (selectedQuality === 'high' && !userId) {
      setAuthModalReason('high_quality');
      setAuthModalOpen(true);
      return;
    }
    setQuality(selectedQuality);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    // Validação de URL
    if (!url.includes('youtube.com/') && !url.includes('youtu.be/')) {
      setError('Por favor, insira um link válido do YouTube.');
      return;
    }

    const isPlaylist = isPlaylistUrl(url);

    // Se for playlist e usuário for anônimo, exige cadastro
    if (isPlaylist && !userId) {
      setAuthModalReason('playlist');
      setAuthModalOpen(true);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 1. Cria o registro inicial no Supabase (user_id é nulo se anônimo)
      const { data: record, error: dbError } = await supabase
        .from('media_downloads')
        .insert({
          user_id: userId || null,
          original_url: url.trim(),
          format: format,
          quality: quality,
          is_playlist: isPlaylist,
          status: 'pending',
          progress: 0,
        })
        .select()
        .single();

      if (dbError) throw dbError;

      // 2. Notifica a API da VPS para enfileirar o processamento
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const apiSecret = process.env.NEXT_PUBLIC_API_SECRET_KEY || '';

      const res = await fetch(`${apiUrl}/api/downloads`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(apiSecret ? { 'X-API-KEY': apiSecret } : {}),
        },
        body: JSON.stringify({
          id: record.id,
          url: url.trim(),
          format: format,
          quality: quality,
          is_playlist: isPlaylist,
          user_id: userId || null,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Falha ao comunicar com o servidor de conversão.');
      }

      // Se for anônimo, salva o id no localStorage para recuperar o progresso se recarregar
      if (!userId && typeof window !== 'undefined') {
        const existing = JSON.parse(localStorage.getItem('ytdown_anon_downloads') || '[]');
        localStorage.setItem('ytdown_anon_downloads', JSON.stringify([record.id, ...existing.slice(0, 9)]));
      }

      setUrl('');
      if (onDownloadStarted) {
        onDownloadStarted(record as MediaDownload);
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao iniciar o download.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="w-full max-w-3xl mx-auto">
        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 sm:p-8 backdrop-blur-xl shadow-2xl relative overflow-hidden">
          {/* Subtle glow */}
          <div className="absolute -top-24 -right-24 w-48 h-48 bg-rose-500/10 rounded-full blur-2xl pointer-events-none" />

          <div className="text-center mb-6">
            <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Baixe Vídeos e Músicas do YouTube
            </h1>
            <p className="text-slate-400 text-sm mt-2 max-w-lg mx-auto">
              {userId
                ? 'Sua conta está ativa com downloads ilimitados, 320 kbps e suporte a playlists.'
                : 'Gratuito, direto e sem propagandas. Cole o link e baixe instantaneamente.'}
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-center gap-3">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Input da URL */}
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
                <Link2 className="w-5 h-5" />
              </div>
              <input
                type="url"
                required
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="Cole o link do YouTube (ex: https://www.youtube.com/watch?v=...)"
                className="w-full pl-12 pr-4 py-4 bg-slate-950/90 border border-slate-700/80 rounded-2xl text-white placeholder-slate-500 text-base focus:outline-none focus:ring-2 focus:ring-rose-500/60 focus:border-rose-500 transition-all shadow-inner"
              />
            </div>

            {/* Aviso inteligente se colar link de playlist */}
            {isPlaylistUrl(url) && (
              <div className="p-3.5 bg-indigo-500/10 border border-indigo-500/30 rounded-xl text-indigo-300 text-xs flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <ListVideo className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                  <span>
                    Playlist detectada!{' '}
                    {userId
                      ? 'Todos os itens serão compactados em um arquivo ZIP único.'
                      : 'O download de listas completas requer login gratuito.'}
                  </span>
                </div>
                {!userId && (
                  <button
                    type="button"
                    onClick={() => {
                      setAuthModalReason('playlist');
                      setAuthModalOpen(true);
                    }}
                    className="font-bold underline text-indigo-200 hover:text-white"
                  >
                    Ver detalhes
                  </button>
                )}
              </div>
            )}

            {/* Seletores de formato */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                1. Escolha o Formato
              </label>
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <button
                  type="button"
                  onClick={() => setFormat('mp3')}
                  className={`p-3.5 sm:p-4 rounded-2xl border flex items-center justify-center gap-3 transition-all ${
                    format === 'mp3'
                      ? 'bg-rose-500/15 border-rose-500 text-rose-400 shadow-md shadow-rose-500/10'
                      : 'bg-slate-950/50 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                  }`}
                >
                  <Music className="w-5 h-5 flex-shrink-0" />
                  <div className="text-left">
                    <div className="font-semibold text-sm">Áudio MP3</div>
                    <div className="text-[11px] opacity-70">Apenas o áudio</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setFormat('mp4')}
                  className={`p-3.5 sm:p-4 rounded-2xl border flex items-center justify-center gap-3 transition-all ${
                    format === 'mp4'
                      ? 'bg-rose-500/15 border-rose-500 text-rose-400 shadow-md shadow-rose-500/10'
                      : 'bg-slate-950/50 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                  }`}
                >
                  <Film className="w-5 h-5 flex-shrink-0" />
                  <div className="text-left">
                    <div className="font-semibold text-sm">Vídeo MP4</div>
                    <div className="text-[11px] opacity-70">Vídeo com som</div>
                  </div>
                </button>
              </div>
            </div>

            {/* Seletores de qualidade */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  2. Escolha a Qualidade
                </label>
                {!userId && (
                  <span className="text-[11px] text-amber-400/90 flex items-center gap-1">
                    <Sparkles className="w-3 h-3" /> 320k e 1080p grátis com cadastro
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <button
                  type="button"
                  onClick={() => handleQualitySelect('standard')}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    quality === 'standard'
                      ? 'bg-slate-800 border-slate-600 text-white'
                      : 'bg-slate-950/40 border-slate-800/80 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs">
                      {format === 'mp3' ? 'Padrão (128 kbps)' : 'Padrão (720p HD)'}
                    </span>
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded font-bold">
                      GRÁTIS
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">Download rápido e leve</div>
                </button>

                <button
                  type="button"
                  onClick={() => handleQualitySelect('high')}
                  className={`p-3 rounded-xl border text-left transition-all relative ${
                    quality === 'high'
                      ? 'bg-rose-500/10 border-rose-500 text-rose-300'
                      : 'bg-slate-950/40 border-slate-800/80 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs flex items-center gap-1.5">
                      {format === 'mp3' ? 'Alta Fidelidade (320 kbps)' : 'Máxima Resolução (1080p+)'}
                    </span>
                    {!userId ? (
                      <Lock className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                    ) : (
                      <span className="text-[10px] bg-rose-500/20 text-rose-400 px-1.5 py-0.5 rounded font-bold">
                        PRO
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {!userId ? 'Clique para desbloquear' : 'Máxima qualidade disponível'}
                  </div>
                </button>
              </div>
            </div>

            {/* Botão de Envio */}
            <button
              type="submit"
              disabled={loading || !url.trim()}
              className="w-full py-4 px-6 bg-gradient-to-r from-rose-600 via-rose-500 to-rose-600 hover:from-rose-500 hover:to-rose-400 text-white font-bold rounded-2xl transition-all shadow-lg shadow-rose-600/25 flex items-center justify-center gap-2 group disabled:opacity-40 disabled:cursor-not-allowed text-base"
            >
              {loading ? (
                <>
                  <span className="inline-block animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
                  <span>Enviando para a VPS...</span>
                </>
              ) : (
                <>
                  <Download className="w-5 h-5 group-hover:-translate-y-0.5 transition-transform" />
                  <span>Baixar Agora</span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>

      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        reason={authModalReason}
      />
    </>
  );
}
