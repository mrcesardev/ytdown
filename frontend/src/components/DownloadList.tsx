'use client';

import React, { useEffect, useState } from 'react';
import { supabase, MediaDownload } from '@/lib/supabase';
import {
  Music,
  Film,
  Download,
  Clock,
  Loader2,
  CheckCircle2,
  XCircle,
  Trash2,
  FileAudio,
  FileVideo,
  Archive,
} from 'lucide-react';

interface DownloadListProps {
  userId: string | null;
  activeDownloads: MediaDownload[];
}

export default function DownloadList({ userId, activeDownloads }: DownloadListProps) {
  const [downloads, setDownloads] = useState<MediaDownload[]>(activeDownloads);
  const [loading, setLoading] = useState(!!userId);

  // 1. Carrega downloads do Supabase se o usuário estiver logado
  useEffect(() => {
    if (!userId) {
      // Para usuários anônimos, recupera do localStorage se houver
      if (typeof window !== 'undefined') {
        const storedIds: string[] = JSON.parse(localStorage.getItem('ytdown_anon_downloads') || '[]');
        if (storedIds.length > 0) {
          supabase
            .from('media_downloads')
            .select('*')
            .in('id', storedIds)
            .order('created_at', { ascending: false })
            .then(({ data }) => {
              if (data) {
                setDownloads(data as MediaDownload[]);
              }
            });
        }
      }
      setLoading(false);
      return;
    }

    const fetchUserDownloads = async () => {
      try {
        const { data, error } = await supabase
          .from('media_downloads')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(30);

        if (!error && data) {
          setDownloads(data as MediaDownload[]);
        }
      } catch (e) {
        console.error('Erro ao buscar histórico:', e);
      } finally {
        setLoading(false);
      }
    };

    fetchUserDownloads();
  }, [userId]);

  // Sincroniza quando activeDownloads muda no componente pai
  useEffect(() => {
    if (activeDownloads.length > 0) {
      setDownloads((prev) => {
        const ids = new Set(prev.map((d) => d.id));
        const newOnes = activeDownloads.filter((d) => !ids.has(d.id));
        return [...newOnes, ...prev];
      });
    }
  }, [activeDownloads]);

  // 2. Realtime listener
  useEffect(() => {
    const channel = supabase
      .channel('media_downloads_realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'media_downloads',
        },
        (payload) => {
          const updated = payload.new as MediaDownload;
          if (!updated) return;

          setDownloads((prev) => {
            const exists = prev.some((d) => d.id === updated.id);
            if (exists) {
              return prev.map((item) => (item.id === updated.id ? updated : item));
            }
            // Se for do mesmo usuário ou for anônimo recente
            if (userId && updated.user_id === userId) {
              return [updated, ...prev];
            }
            return prev;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const handleDelete = async (id: string) => {
    try {
      if (userId) {
        await supabase.from('media_downloads').delete().eq('id', id);
      } else if (typeof window !== 'undefined') {
        const storedIds: string[] = JSON.parse(localStorage.getItem('ytdown_anon_downloads') || '[]');
        localStorage.setItem(
          'ytdown_anon_downloads',
          JSON.stringify(storedIds.filter((item) => item !== id))
        );
      }
      setDownloads((prev) => prev.filter((d) => d.id !== id));
    } catch (err) {
      console.error('Erro ao remover:', err);
    }
  };

  const formatFileSize = (bytes?: number | null) => {
    if (!bytes) return null;
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-slate-500">
        <Loader2 className="w-7 h-7 animate-spin text-rose-500 mb-2" />
        <p className="text-xs">Carregando...</p>
      </div>
    );
  }

  if (downloads.length === 0) {
    return null;
  }

  return (
    <div className="w-full max-w-3xl mx-auto space-y-4">
      <div className="flex items-center justify-between px-2">
        <h3 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
          <span>{userId ? 'Seus Downloads & Histórico' : 'Downloads em Andamento'}</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono">
            {downloads.length}
          </span>
        </h3>
      </div>

      <div className="space-y-3">
        {downloads.map((item) => (
          <div
            key={item.id}
            className={`p-4 sm:p-5 bg-slate-900/80 border rounded-2xl transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 backdrop-blur-sm shadow-lg ${
              item.status === 'completed'
                ? 'border-emerald-500/30 bg-slate-900/90'
                : 'border-slate-800'
            }`}
          >
            {/* Informações da mídia */}
            <div className="flex items-center gap-4 min-w-0 w-full sm:w-auto">
              <div className="w-14 h-14 rounded-xl bg-slate-800 flex items-center justify-center flex-shrink-0 text-slate-300 overflow-hidden relative border border-slate-700/50">
                {item.thumbnail ? (
                  <img
                    src={item.thumbnail}
                    alt={item.title || 'Thumbnail'}
                    className="w-full h-full object-cover"
                  />
                ) : item.is_playlist ? (
                  <Archive className="w-6 h-6 text-amber-400" />
                ) : item.format === 'mp3' ? (
                  <FileAudio className="w-6 h-6 text-rose-400" />
                ) : (
                  <FileVideo className="w-6 h-6 text-indigo-400" />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span
                    className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                      item.is_playlist
                        ? 'bg-amber-500/15 text-amber-400 border border-amber-500/20'
                        : item.format === 'mp3'
                        ? 'bg-rose-500/15 text-rose-400 border border-rose-500/20'
                        : 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/20'
                    }`}
                  >
                    {item.is_playlist ? 'PLAYLIST .ZIP' : item.format}
                  </span>

                  {item.quality === 'high' && (
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                      320k HQ
                    </span>
                  )}

                  {formatFileSize(item.file_size) && (
                    <span className="text-[11px] text-slate-500 font-mono">
                      {formatFileSize(item.file_size)}
                    </span>
                  )}
                </div>

                <h4
                  className="text-sm font-semibold text-white truncate max-w-xs sm:max-w-md"
                  title={item.title || item.original_url}
                >
                  {item.title || item.original_url}
                </h4>

                {/* Status indicator */}
                <div className="mt-1 flex items-center gap-2">
                  {item.status === 'pending' && (
                    <span className="inline-flex items-center gap-1.5 text-xs text-amber-400">
                      <Clock className="w-3.5 h-3.5" /> Na fila da VPS...
                    </span>
                  )}

                  {item.status === 'processing' && (
                    <div className="flex flex-col gap-1 w-full max-w-[220px]">
                      <span className="inline-flex items-center gap-1.5 text-xs text-indigo-400">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Baixando e Convertendo ({item.progress || 0}%)
                      </span>
                      <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-indigo-500 h-1.5 rounded-full transition-all duration-300"
                          style={{ width: `${Math.max(item.progress || 10, 5)}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {item.status === 'completed' && (
                    <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Conversão concluída!
                    </span>
                  )}

                  {item.status === 'failed' && (
                    <span
                      className="inline-flex items-center gap-1.5 text-xs text-rose-400 font-medium"
                      title={item.error_message || 'Falha no processamento'}
                    >
                      <XCircle className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="truncate max-w-xs">{item.error_message || 'Erro no download'}</span>
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Ações */}
            <div className="flex items-center gap-2 w-full sm:w-auto justify-end border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-800">
              {item.status === 'completed' && item.download_url && (
                <a
                  href={item.download_url.replace('http://localhost:8000', 'http://45.178.180.152:8000')}
                  download
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-bold text-xs rounded-xl flex items-center gap-2 shadow-lg shadow-emerald-600/25 transition-all transform hover:scale-[1.02]"
                >
                  <Download className="w-4 h-4" />
                  <span>Baixar Arquivo</span>
                </a>
              )}

              <button
                onClick={() => handleDelete(item.id)}
                title="Remover"
                className="p-2 text-slate-500 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
