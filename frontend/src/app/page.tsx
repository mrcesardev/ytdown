'use client';

import React, { useEffect, useState } from 'react';
import { supabase, MediaDownload } from '@/lib/supabase';
import Navbar from '@/components/Navbar';
import DownloadForm from '@/components/DownloadForm';
import DownloadList from '@/components/DownloadList';
import { Sparkles, Shield, Zap } from 'lucide-react';

export default function HomePage() {
  const [user, setUser] = useState<any>(null);
  const [activeDownloads, setActiveDownloads] = useState<MediaDownload[]>([]);

  useEffect(() => {
    // 1. Verifica se há usuário logado (sem bloquear quem não estiver)
    const checkUser = async () => {
      try {
        const {
          data: { user: currentUser },
        } = await supabase.auth.getUser();
        setUser(currentUser || null);
      } catch (e) {
        setUser(null);
      }
    };

    checkUser();

    // 2. Escuta mudanças na autenticação
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleDownloadStarted = (newRecord: MediaDownload) => {
    setActiveDownloads((prev) => [newRecord, ...prev]);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 flex flex-col selection:bg-rose-500 selection:text-white">
      <Navbar userEmail={user?.email || null} />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-8 sm:py-12 space-y-10">
        {/* Formulário Principal de Download */}
        <DownloadForm
          userId={user?.id || null}
          onDownloadStarted={handleDownloadStarted}
        />

        {/* Lista de Downloads em Andamento e Histórico */}
        <DownloadList
          userId={user?.id || null}
          activeDownloads={activeDownloads}
        />

        {/* Seção Informativa de Recursos */}
        <div className="max-w-3xl mx-auto pt-6 border-t border-slate-900 grid grid-cols-1 sm:grid-cols-3 gap-6 text-center">
          <div className="p-4 rounded-2xl bg-slate-900/40 border border-slate-800/60">
            <Zap className="w-5 h-5 text-rose-400 mx-auto mb-2" />
            <h4 className="text-sm font-semibold text-white">Download Direto</h4>
            <p className="text-xs text-slate-400 mt-1">
              Cole o link e baixe na hora sem pop-ups, redirecionamentos ou encurtadores.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/40 border border-slate-800/60">
            <Sparkles className="w-5 h-5 text-amber-400 mx-auto mb-2" />
            <h4 className="text-sm font-semibold text-white">MP3 320 kbps & Playlists</h4>
            <p className="text-xs text-slate-400 mt-1">
              Cadastre-se gratuitamente para baixar playlists inteiras em .ZIP e áudios em 320k.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/40 border border-slate-800/60">
            <Shield className="w-5 h-5 text-emerald-400 mx-auto mb-2" />
            <h4 className="text-sm font-semibold text-white">Privado & Seguro</h4>
            <p className="text-xs text-slate-400 mt-1">
              Processamento executado em servidor próprio na VPS Brasil com limpeza periódica.
            </p>
          </div>
        </div>
      </main>

      <footer className="border-t border-slate-900 py-6 text-center text-xs text-slate-500">
        YtDown &copy; {new Date().getFullYear()} &bull; Conversor de Mídia Pessoal &bull; VPS Absam.io
      </footer>
    </div>
  );
}
