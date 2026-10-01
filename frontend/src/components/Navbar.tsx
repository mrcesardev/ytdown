'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { PlaySquare, LogOut, User, Sparkles, LogIn } from 'lucide-react';

interface NavbarProps {
  userEmail?: string | null;
}

export default function Navbar({ userEmail }: NavbarProps) {
  const router = useRouter();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.reload();
  };

  return (
    <header className="border-b border-slate-800/80 bg-slate-950/70 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-rose-600 to-rose-400 flex items-center justify-center shadow-md shadow-rose-500/20 group-hover:scale-105 transition-transform">
            <PlaySquare className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-white text-lg tracking-tight">YtDown</span>
              <span className="px-1.5 py-0.5 text-[10px] uppercase font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded">
                Sem Anúncios
              </span>
            </div>
          </div>
        </Link>

        <div className="flex items-center gap-3">
          {userEmail ? (
            <>
              <div className="hidden sm:flex items-center gap-2 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-full font-medium">
                <Sparkles className="w-3.5 h-3.5" />
                <span>320k & Playlists Liberados</span>
              </div>

              <div className="hidden md:flex items-center gap-2 text-xs text-slate-400 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-full">
                <User className="w-3.5 h-3.5 text-slate-500" />
                <span className="max-w-[150px] truncate">{userEmail}</span>
              </div>

              <button
                onClick={handleSignOut}
                title="Encerrar sessão"
                className="p-2 text-slate-400 hover:text-rose-400 hover:bg-slate-900 rounded-lg transition-colors border border-transparent hover:border-slate-800"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </>
          ) : (
            <Link
              href="/login"
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 hover:border-slate-600 text-white text-xs font-semibold rounded-xl flex items-center gap-2 transition-all shadow-sm"
            >
              <LogIn className="w-3.5 h-3.5 text-rose-400" />
              <span>Entrar / Criar Conta</span>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
