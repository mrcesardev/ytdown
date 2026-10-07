'use client';

import React, { useState, useEffect, useRef } from 'react';
import { supabase, MediaDownload } from '@/lib/supabase';
import {
  isYouTubeUrl,
  isTikTokUrl,
  isTwitterUrl,
  isSupportedMediaUrl,
  isYouTubePlaylist,
  cleanMediaUrl,
  getMediaPlatform,
} from '@/lib/youtube';
import AuthModal from '@/components/AuthModal';
import RewardedDownloadModal from '@/components/RewardedDownloadModal';
import { MONETIZATION_CONFIG } from '@/config/monetization';
import {
  Music,
  Film,
  Download,
  Link2,
  Lock,
  Sparkles,
  AlertCircle,
  ListVideo,
  Clock,
  User,
  CheckSquare,
  Square,
  Loader2,
  Search,
  X,
  Archive,
  Info,
} from 'lucide-react';

interface PlaylistEntry {
  index: number;
  id: string;
  title: string;
  duration?: number | null;
  duration_formatted?: string | null;
  thumbnail?: string | null;
  url: string;
}

interface MediaInfo {
  url: string;
  title: string;
  thumbnail?: string | null;
  duration?: number | null;
  duration_formatted?: string | null;
  uploader?: string | null;
  is_playlist: boolean;
  entries?: PlaylistEntry[] | null;
  total_entries?: number | null;
}

interface DownloadFormProps {
  userId: string | null;
  onDownloadStarted?: (newDownload: MediaDownload) => void;
}

export default function DownloadForm({ userId, onDownloadStarted }: DownloadFormProps) {
  const [url, setUrl] = useState('');
  const [format, setFormat] = useState<'mp3' | 'mp4'>('mp3');
  const [quality, setQuality] = useState<'standard' | 'high'>('standard');
  const [loading, setLoading] = useState(false);
  const [loadingInfo, setLoadingInfo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Informações da mídia extraídas
  const [mediaInfo, setMediaInfo] = useState<MediaInfo | null>(null);
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
  const [selectionWarning, setSelectionWarning] = useState<string | null>(null);

  // Controle do modal de cadastro
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalReason, setAuthModalReason] = useState<'playlist' | 'high_quality'>('high_quality');

  // Controle do modal de download com recompensa (anúncio para não logados)
  const [rewardedModalOpen, setRewardedModalOpen] = useState(false);
  const [rewardedItem, setRewardedItem] = useState<MediaDownload | null>(null);

  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const isPlaylistUrl = (inputUrl: string) => isYouTubePlaylist(inputUrl);

  // Busca metadados da URL
  const fetchMediaDetails = async (targetUrl: string) => {
    const cleaned = cleanMediaUrl(targetUrl.trim());
    if (!cleaned || !isSupportedMediaUrl(cleaned)) {
      setMediaInfo(null);
      return;
    }

    setLoadingInfo(true);
    setError(null);
    setSelectionWarning(null);

    try {
      const res = await fetch('/api/info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: cleaned }),
      });

      const json = await res.json();
      if (!res.ok || !json.data) {
        throw new Error(json.detail || 'Não foi possível carregar as informações do vídeo.');
      }

      const info: MediaInfo = json.data;
      setMediaInfo(info);

      // Se for playlist, seleciona por padrão os primeiros 5 vídeos (ou menos, se houver menos)
      if (info.is_playlist && info.entries && info.entries.length > 0) {
        const defaultSelected = info.entries.slice(0, 5).map((e) => e.index);
        setSelectedIndices(defaultSelected);
      } else {
        setSelectedIndices([]);
      }
    } catch (err: any) {
      console.warn('Erro ao obter detalhes da mídia:', err);
      // Mantém fallback limpo para o usuário continuar caso queira
      setMediaInfo(null);
      setError(err.message || 'Erro ao carregar prévia do link.');
    } finally {
      setLoadingInfo(false);
    }
  };

  // Efeito com debounce para buscar informações automaticamente ao digitar/colar
  useEffect(() => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    const trimmed = url.trim();
    if (trimmed && isSupportedMediaUrl(trimmed)) {
      debounceTimeoutRef.current = setTimeout(() => {
        fetchMediaDetails(trimmed);
      }, 700);
    } else {
      setMediaInfo(null);
      setSelectedIndices([]);
      setError(null);
    }

    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, [url]);

  const handleQualitySelect = (selectedQuality: 'standard' | 'high') => {
    if (selectedQuality === 'high' && !userId) {
      setAuthModalReason('high_quality');
      setAuthModalOpen(true);
      return;
    }
    setQuality(selectedQuality);
  };

  // Alterna a seleção de um vídeo na playlist (mínimo 1, máximo 5)
  const toggleTrackSelection = (index: number) => {
    setSelectionWarning(null);

    if (selectedIndices.includes(index)) {
      // Desmarca
      setSelectedIndices((prev) => prev.filter((i) => i !== index));
    } else {
      // Tenta marcar
      if (selectedIndices.length >= 5) {
        setSelectionWarning('Limite máximo de 5 vídeos atingido para este download.');
        return;
      }
      setSelectedIndices((prev) => [...prev, index]);
    }
  };

  const selectFirstFive = () => {
    if (!mediaInfo?.entries) return;
    setSelectionWarning(null);
    setSelectedIndices(mediaInfo.entries.slice(0, 5).map((e) => e.index));
  };

  const clearSelection = () => {
    setSelectionWarning(null);
    setSelectedIndices([]);
  };

  const handleClearUrl = () => {
    setUrl('');
    setMediaInfo(null);
    setSelectedIndices([]);
    setError(null);
    setSelectionWarning(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUrl = cleanMediaUrl(url.trim());
    if (!cleanUrl) return;

    if (!isSupportedMediaUrl(cleanUrl)) {
      setError('Por favor, insira um link válido do YouTube, TikTok, Instagram ou X (Twitter).');
      return;
    }

    const platform = getMediaPlatform(cleanUrl);
    const isPlaylist = platform === 'youtube' && (mediaInfo ? mediaInfo.is_playlist : isPlaylistUrl(cleanUrl));

    // Validação de Playlist
    if (isPlaylist) {
      if (!userId) {
        setAuthModalReason('playlist');
        setAuthModalOpen(true);
        return;
      }

      if (mediaInfo?.entries && selectedIndices.length === 0) {
        setError('Por favor, selecione pelo menos 1 vídeo da playlist para baixar.');
        return;
      }

      if (selectedIndices.length > 5) {
        setError('O limite máximo é de 5 vídeos por download.');
        return;
      }
    }

    setLoading(true);
    setError(null);

    try {
      // Filtra as URLs selecionadas caso seja playlist com dados extraídos
      let selectedUrls: string[] | null = null;
      if (isPlaylist && mediaInfo?.entries) {
        selectedUrls = mediaInfo.entries
          .filter((entry) => selectedIndices.includes(entry.index))
          .map((entry) => entry.url);
      }

      const res = await fetch('/api/downloads', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: cleanUrl,
          format,
          quality,
          is_playlist: isPlaylist,
          selected_urls: selectedUrls,
          playlist_title: mediaInfo?.title || null,
          title: mediaInfo?.title || null,
          user_id: userId || null,
        }),
      });

      const resData = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(resData.detail || 'Falha ao iniciar o download.');
      }

      const createdRecord: MediaDownload = resData.record || {
        id: resData.id,
        user_id: userId || null,
        title: mediaInfo?.title || null,
        thumbnail: mediaInfo?.thumbnail || null,
        original_url: url.trim(),
        format,
        quality,
        is_playlist: isPlaylist,
        status: 'pending',
        progress: 0,
        created_at: new Date().toISOString(),
      };

      if (!userId && typeof window !== 'undefined' && createdRecord.id) {
        const existing: string[] = JSON.parse(localStorage.getItem('ytdown_anon_downloads') || '[]');
        localStorage.setItem(
          'ytdown_anon_downloads',
          JSON.stringify([createdRecord.id, ...existing.filter((item) => item !== createdRecord.id).slice(0, 9)])
        );
      }

      setUrl('');
      setMediaInfo(null);
      setSelectedIndices([]);
      if (onDownloadStarted) {
        onDownloadStarted(createdRecord);
      }

      // Se o usuário não estiver logado, exibe o modal com contador/anúncio de recompensa
      if (!userId && MONETIZATION_CONFIG.rewardedAds.enabled) {
        setRewardedItem(createdRecord);
        setRewardedModalOpen(true);
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao iniciar o download.');
    } finally {
      setLoading(false);
    }
  };

  const isSubmitDisabled =
    loading ||
    loadingInfo ||
    !url.trim() ||
    Boolean(mediaInfo?.is_playlist && selectedIndices.length === 0);

  return (
    <>
      <div className="w-full max-w-3xl mx-auto">
        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 sm:p-8 backdrop-blur-xl shadow-2xl relative overflow-hidden">
          {/* Subtle glow */}
          <div className="absolute -top-24 -right-24 w-48 h-48 bg-rose-500/10 rounded-full blur-2xl pointer-events-none" />

          <div className="text-center mb-6">
            <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Baixe Vídeos do YouTube, TikTok, Instagram e X (Twitter)
            </h1>
            <p className="text-slate-400 text-sm mt-2 max-w-lg mx-auto">
              {userId
                ? 'Sua conta está ativa com downloads em 320 kbps, playlists em ZIP, TikTok, Instagram e X sem marca d\'água.'
                : 'Gratuito, direto e sem anúncios. Baixe do YouTube, TikTok, Instagram ou X (Twitter) em MP4 ou MP3.'}
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
                {loadingInfo ? (
                  <Loader2 className="w-5 h-5 animate-spin text-rose-500" />
                ) : (
                  <Link2 className="w-5 h-5" />
                )}
              </div>

              <input
                type="url"
                required
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="Cole o link do YouTube, TikTok, Instagram ou X (Twitter)..."
                className="w-full pl-12 pr-12 py-4 bg-slate-950/90 border border-slate-700/80 rounded-2xl text-white placeholder-slate-500 text-base focus:outline-none focus:ring-2 focus:ring-rose-500/60 focus:border-rose-500 transition-all shadow-inner"
              />

              {url && (
                <button
                  type="button"
                  onClick={handleClearUrl}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white p-1 rounded-full hover:bg-slate-800 transition-colors"
                  title="Limpar"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Skeleton / Loading de busca */}
            {loadingInfo && (
              <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 flex items-center gap-3 text-slate-400 text-sm animate-pulse">
                <Loader2 className="w-5 h-5 animate-spin text-rose-500" />
                <span>Buscando capa, duração e informações da mídia...</span>
              </div>
            )}

            {/* PREVIEW DA MÍDIA: VÍDEO ÚNICO */}
            {mediaInfo && !mediaInfo.is_playlist && !loadingInfo && (
              <div className="p-4 sm:p-5 rounded-2xl bg-slate-950/70 border border-slate-800 flex flex-col sm:flex-row items-center gap-4 transition-all">
                {/* Capa */}
                <div className="relative w-full sm:w-44 h-28 rounded-xl bg-slate-800 overflow-hidden flex-shrink-0 border border-slate-700/50">
                  {mediaInfo.thumbnail ? (
                    <img
                      src={mediaInfo.thumbnail}
                      alt={mediaInfo.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-500">
                      <Film className="w-8 h-8" />
                    </div>
                  )}

                  {mediaInfo.duration_formatted && (
                    <span className="absolute bottom-2 right-2 bg-black/85 text-white text-[11px] font-mono font-semibold px-2 py-0.5 rounded-md flex items-center gap-1 shadow">
                      <Clock className="w-3 h-3" />
                      {mediaInfo.duration_formatted}
                    </span>
                  )}
                </div>

                {/* Detalhes */}
                <div className="min-w-0 flex-1 w-full text-left">
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    {getMediaPlatform(mediaInfo.url) === 'tiktok' ? (
                      <span className="text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-cyan-400" />
                        TikTok Sem Marca d'Água
                      </span>
                    ) : getMediaPlatform(mediaInfo.url) === 'instagram' ? (
                      <span className="text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full bg-gradient-to-r from-purple-500/20 via-pink-500/20 to-rose-500/20 text-pink-300 border border-pink-500/30 flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-pink-400" />
                        Instagram Sem Marca d'Água
                      </span>
                    ) : getMediaPlatform(mediaInfo.url) === 'twitter' ? (
                      <span className="text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/30 flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-sky-400" />
                        X (Twitter) Vídeo
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-rose-500/15 text-rose-400 border border-rose-500/20">
                        Vídeo do YouTube
                      </span>
                    )}
                    {mediaInfo.uploader && (
                      <span className="text-xs text-slate-400 flex items-center gap-1">
                        <User className="w-3 h-3" /> {mediaInfo.uploader}
                      </span>
                    )}
                  </div>

                  <h3 className="text-base font-bold text-white line-clamp-2 leading-snug">
                    {mediaInfo.title}
                  </h3>
                </div>
              </div>
            )}

            {/* PREVIEW DA MÍDIA: PLAYLIST COM SELEÇÃO LIMITADA A 5 VÍDEOS */}
            {mediaInfo && mediaInfo.is_playlist && !loadingInfo && (
              <div className="p-4 sm:p-5 rounded-2xl bg-slate-950/80 border border-indigo-500/30 space-y-4">
                {/* Cabeçalho da Playlist */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 flex-shrink-0">
                      <Archive className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                          Playlist
                        </span>
                        <span className="text-xs text-slate-400">
                          {mediaInfo.total_entries || mediaInfo.entries?.length || 0} vídeos no total
                        </span>
                      </div>
                      <h3 className="text-sm sm:text-base font-bold text-white line-clamp-1 mt-0.5">
                        {mediaInfo.title}
                      </h3>
                    </div>
                  </div>

                  {/* Contador de Seleção */}
                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    <span
                      className={`text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1.5 transition-colors ${
                        selectedIndices.length === 5
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                          : selectedIndices.length > 0
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      <span>
                        Selecionados: <strong>{selectedIndices.length}</strong> / 5
                      </span>
                    </span>
                  </div>
                </div>

                {/* Aviso / Ações de Seleção */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs">
                  <div className="text-slate-400 flex items-center gap-1.5">
                    <Info className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                    <span>
                      Selecione de <strong>1 a 5 vídeos</strong> para baixar em um arquivo <strong>.ZIP</strong>.
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={selectFirstFive}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors text-[11px]"
                    >
                      5 Primeiros
                    </button>
                    <button
                      type="button"
                      onClick={clearSelection}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors text-[11px]"
                    >
                      Limpar
                    </button>
                  </div>
                </div>

                {/* Banner de alerta de limite atingido */}
                {selectionWarning && (
                  <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{selectionWarning}</span>
                  </div>
                )}

                {/* Lista rolável de vídeos da playlist */}
                {mediaInfo.entries && mediaInfo.entries.length > 0 && (
                  <div className="max-h-72 overflow-y-auto space-y-1.5 pr-1 rounded-xl border border-slate-800/80 bg-slate-950/60 p-2">
                    {mediaInfo.entries.map((entry) => {
                      const isSelected = selectedIndices.includes(entry.index);
                      const isMaxReached = selectedIndices.length >= 5 && !isSelected;

                      return (
                        <div
                          key={entry.id || entry.index}
                          onClick={() => toggleTrackSelection(entry.index)}
                          className={`p-2.5 rounded-xl flex items-center justify-between gap-3 cursor-pointer transition-all border ${
                            isSelected
                              ? 'bg-rose-500/10 border-rose-500/40 text-white shadow-sm'
                              : isMaxReached
                              ? 'opacity-40 hover:opacity-50 border-transparent bg-slate-900/30 cursor-not-allowed'
                              : 'bg-slate-900/50 hover:bg-slate-900 border-slate-800/60 text-slate-300 hover:text-white'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            {/* Checkbox */}
                            <div className="flex-shrink-0 text-slate-400">
                              {isSelected ? (
                                <CheckSquare className="w-4 h-4 text-rose-400" />
                              ) : (
                                <Square className="w-4 h-4" />
                              )}
                            </div>

                            {/* Número da faixa */}
                            <span className="text-[11px] font-mono text-slate-500 w-5 text-right flex-shrink-0">
                              #{entry.index}
                            </span>

                            {/* Mini Thumbnail */}
                            <div className="w-10 h-8 rounded bg-slate-800 flex-shrink-0 overflow-hidden relative border border-slate-700/50">
                              {entry.thumbnail ? (
                                <img
                                  src={entry.thumbnail}
                                  alt={entry.title}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-slate-600">
                                  <Music className="w-3.5 h-3.5" />
                                </div>
                              )}
                            </div>

                            {/* Título */}
                            <span
                              className="text-xs font-medium truncate"
                              title={entry.title}
                            >
                              {entry.title}
                            </span>
                          </div>

                          {/* Duração */}
                          {entry.duration_formatted && (
                            <span className="text-[11px] font-mono text-slate-400 flex-shrink-0 ml-2">
                              {entry.duration_formatted}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {!userId && (
                  <div className="p-3 bg-indigo-500/10 border border-indigo-500/30 rounded-xl text-indigo-300 text-xs flex items-center justify-between gap-3">
                    <span>O download de playlists compactadas em ZIP requer login gratuito.</span>
                    <button
                      type="button"
                      onClick={() => {
                        setAuthModalReason('playlist');
                        setAuthModalOpen(true);
                      }}
                      className="font-bold underline text-indigo-200 hover:text-white"
                    >
                      Cadastrar-se
                    </button>
                  </div>
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
                    <div className="text-[11px] opacity-70">
                      {mediaInfo?.is_playlist
                        ? 'Faixas em MP3'
                        : getMediaPlatform(mediaInfo?.url || url) === 'tiktok' || getMediaPlatform(mediaInfo?.url || url) === 'instagram'
                        ? 'Música / Áudio original'
                        : getMediaPlatform(mediaInfo?.url || url) === 'twitter'
                        ? 'Trilha sonora / Áudio'
                        : 'Apenas o áudio'}
                    </div>
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
                    <div className="text-[11px] opacity-70">
                      {getMediaPlatform(mediaInfo?.url || url) === 'tiktok' || getMediaPlatform(mediaInfo?.url || url) === 'instagram'
                        ? 'Sem marca d\'água'
                        : getMediaPlatform(mediaInfo?.url || url) === 'twitter'
                        ? 'Vídeo em HD'
                        : 'Vídeo com som'}
                    </div>
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
              disabled={isSubmitDisabled}
              className="w-full py-4 px-6 bg-gradient-to-r from-rose-600 via-rose-500 to-rose-600 hover:from-rose-500 hover:to-rose-400 text-white font-bold rounded-2xl transition-all shadow-lg shadow-rose-600/25 flex items-center justify-center gap-2 group disabled:opacity-40 disabled:cursor-not-allowed text-base"
            >
              {loading ? (
                <>
                  <span className="inline-block animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
                  <span>Enviando para a VPS...</span>
                </>
              ) : mediaInfo?.is_playlist ? (
                <>
                  <Archive className="w-5 h-5 group-hover:-translate-y-0.5 transition-transform" />
                  <span>
                    Baixar Playlist ({selectedIndices.length} {selectedIndices.length === 1 ? 'vídeo' : 'vídeos'} em .ZIP)
                  </span>
                </>
              ) : (
                <>
                  <Download className="w-5 h-5 group-hover:-translate-y-0.5 transition-transform" />
                  <span>Baixar Agora ({format.toUpperCase()})</span>
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

      <RewardedDownloadModal
        isOpen={rewardedModalOpen}
        onClose={() => setRewardedModalOpen(false)}
        downloadItem={rewardedItem}
      />
    </>
  );
}
