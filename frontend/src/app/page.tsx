'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase, MediaDownload } from '@/lib/supabase';
import Navbar from '@/components/Navbar';
import DownloadForm from '@/components/DownloadForm';
import DownloadList from '@/components/DownloadList';
import DonationModal from '@/components/DonationModal';
import AdBanner from '@/components/AdBanner';
import SeoContent from '@/components/SeoContent';
import { Sparkles, Shield, Zap, Heart } from 'lucide-react';

export default function HomePage() {
  const [user, setUser] = useState<any>(null);
  const [activeDownloads, setActiveDownloads] = useState<MediaDownload[]>([]);
  const [isDonationOpen, setIsDonationOpen] = useState(false);

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
      <Navbar
        userEmail={user?.email || null}
        onOpenDonation={() => setIsDonationOpen(true)}
      />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-8 sm:py-12 space-y-12">
        {/* Formulário Principal de Download com H1 Semântico */}
        <DownloadForm
          userId={user?.id || null}
          onDownloadStarted={handleDownloadStarted}
        />

        {/* Slot de Anúncio Nativo / Apoio ao Projeto */}
        <AdBanner onOpenDonation={() => setIsDonationOpen(true)} />

        {/* Lista de Downloads em Andamento e Histórico */}
        <DownloadList
          userId={user?.id || null}
          activeDownloads={activeDownloads}
        />

        {/* Seção Informativa de Recursos Rápidos */}
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

        {/* Seção Completa de SEO: Como Baixar, Formatos, Diferenciais e FAQ Accordion */}
        <SeoContent />
      </main>

      <footer className="border-t border-slate-900 py-8 px-4 text-center text-xs text-slate-500 space-y-4">
        {/* Links de Rodapé para Rastreamento e SEO */}
        <nav aria-label="Links úteis" className="flex flex-wrap items-center justify-center gap-4 text-slate-400 text-xs">
          <Link href="#faq" className="hover:text-rose-400 transition-colors">
            Perguntas Frequentes
          </Link>
          <span>&bull;</span>
          <Link href="/login" className="hover:text-rose-400 transition-colors">
            Cadastrar Grátis (320k & Playlists)
          </Link>
          <span>&bull;</span>
          <button
            type="button"
            onClick={() => setIsDonationOpen(true)}
            className="hover:text-rose-400 transition-colors"
          >
            Apoiar Servidores com PIX
          </button>
        </nav>

        <div className="flex items-center justify-center gap-2">
          <span>
            YtDown &copy; {new Date().getFullYear()} &bull; Conversor e Baixador de Mídia Online de Alta Performance
          </span>
        </div>

        <div>
          <button
            type="button"
            onClick={() => setIsDonationOpen(true)}
            className="inline-flex items-center gap-1.5 text-slate-400 hover:text-rose-400 transition-colors font-medium hover:underline"
          >
            <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500/20" />
            <span>Gosta do projeto? Ajude a manter os servidores com uma doação via PIX</span>
          </button>
        </div>
      </footer>

      {/* Modal de Doação / Chave PIX */}
      <DonationModal
        isOpen={isDonationOpen}
        onClose={() => setIsDonationOpen(false)}
      />
    </div>
  );
}
