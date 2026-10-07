import React from 'react';
import {
  Youtube,
  Music,
  Video,
  Download,
  ShieldCheck,
  CheckCircle2,
  ChevronDown,
  HelpCircle,
  Zap,
  FolderArchive,
  Layers,
  Sparkles,
  Smartphone,
  Laptop,
  Twitter,
} from 'lucide-react';

export default function SeoContent() {
  const faqs = [
    {
      question: 'O YtDown é realmente gratuito?',
      answer:
        'Sim! O YtDown é uma ferramenta gratuita de conversão e extração de mídias. Você pode baixar vídeos do YouTube, TikTok sem marca d\'água, Instagram e X (Twitter) em qualidade padrão sem pagar nada e sem necessidade de cartão de crédito.',
    },
    {
      question: 'Como baixar vídeos do X (Twitter)?',
      answer:
        'Abra o tweet que contém o vídeo ou GIF no X (Twitter), copie o link compartilhável e cole na barra de busca do YtDown. O sistema detecta a mídia e permite baixar o MP4 em alta resolução ou extrair a faixa em MP3.',
    },
    {
      question: 'Como baixar vídeos do TikTok sem a marca d\'água?',
      answer:
        'Basta copiar o link do vídeo no aplicativo ou site do TikTok, colar no campo de busca do YtDown e escolher o formato MP4. Nosso servidor remove a marca d\'água automaticamente, entregando o arquivo original com máxima nitidez.',
    },
    {
      question: 'Como converter vídeos do YouTube em MP3 de 320 kbps?',
      answer:
        'Selecione a aba Áudio (MP3) e a opção Alta Fidelidade (320 kbps). O recurso de 320k requer apenas um cadastro gratuito rápido na plataforma para que o servidor processe a conversão com taxa de bits acústica máxima.',
    },
    {
      question: 'É possível baixar uma playlist inteira do YouTube de uma só vez?',
      answer:
        'Sim! Ao colar o link de uma playlist do YouTube, o YtDown carrega a lista das faixas e permite que você selecione os vídeos desejados. O sistema empacota as faixas em um arquivo comprimido .ZIP para download direto.',
    },
    {
      question: 'Funciona no celular Android e no iPhone (iOS)?',
      answer:
        'Perfeitamente! O YtDown é uma aplicação web progressiva responsiva que roda diretamente no Safari, Chrome, Edge, Firefox ou qualquer navegador moderno de smartphone, tablet ou computador, sem precisar instalar nada.',
    },
    {
      question: 'É seguro usar o YtDown?',
      answer:
        'Totalmente seguro. Não exigimos instalação de extensões suspeitas nem executáveis no seu computador. As conversões são executadas em nossa infraestrutura dedicada em nuvem e os arquivos são apagados periodicamente para proteger sua privacidade.',
    },
  ];

  return (
    <section
      aria-label="Informações e Guia do YtDown"
      className="max-w-4xl mx-auto mt-16 space-y-16 text-slate-300"
    >
      {/* SEÇÃO 1: COMO FUNCIONA (PASSO A PASSO) */}
      <div className="space-y-6">
        <div className="text-center space-y-2">
          <span className="text-xs uppercase font-bold tracking-wider text-rose-400 bg-rose-500/10 px-3 py-1 rounded-full border border-rose-500/20">
            Passo a Passo Simples
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Como Baixar Vídeos e Músicas no YtDown
          </h2>
          <p className="text-sm text-slate-400 max-w-xl mx-auto">
            Processo rápido, direto e sem anúncios invasivos em apenas 3 etapas:
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800/80 relative group hover:border-rose-500/40 transition-all">
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 font-bold mb-4">
              1
            </div>
            <h3 className="text-base font-semibold text-white mb-2">Copie o Link</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              No YouTube, TikTok, Instagram ou X (Twitter), abra a mídia que deseja baixar e copie o link de compartilhamento da barra de endereços ou botão compartilhar.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800/80 relative group hover:border-rose-500/40 transition-all">
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 font-bold mb-4">
              2
            </div>
            <h3 className="text-base font-semibold text-white mb-2">Cole e Escolha o Formato</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Cole a URL no campo de busca do YtDown. Escolha se quer baixar o vídeo em <strong>MP4</strong> ou converter para áudio em <strong>MP3 (128k ou 320k)</strong>.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800/80 relative group hover:border-rose-500/40 transition-all">
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 font-bold mb-4">
              3
            </div>
            <h3 className="text-base font-semibold text-white mb-2">Baixe Instantaneamente</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Clique no botão de download. Nossa infraestrutura dedicada processa a conversão em nuvem e disponibiliza o download direto para o seu dispositivo.
            </p>
          </div>
        </div>
      </div>

      {/* SEÇÃO 2: PLATAFORMAS SUPORTADAS E RECURSOS */}
      <div className="space-y-6 pt-6 border-t border-slate-900">
        <div className="text-center space-y-2">
          <span className="text-xs uppercase font-bold tracking-wider text-cyan-400 bg-cyan-500/10 px-3 py-1 rounded-full border border-cyan-500/20">
            Compatibilidade Total
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Tudo o Que Você Pode Baixar com o YtDown
          </h2>
          <p className="text-sm text-slate-400 max-w-xl mx-auto">
            Uma plataforma unificada para extrair o melhor de cada rede social com qualidade original.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <article className="p-5 rounded-2xl bg-slate-900/50 border border-slate-800/70 hover:border-slate-700 transition-all">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-lg bg-red-500/15 border border-red-500/25 flex items-center justify-center text-red-400">
                <Youtube className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Baixar Vídeos e Músicas do YouTube</h3>
                <span className="text-[11px] text-slate-400">MP4 HD & MP3 até 320 kbps</span>
              </div>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Extraia áudio e vídeo de clipes, podcasts, aulas e shows com rapidez. Suporte a taxas de amostragem de alta fidelidade e download de faixas individuais ou playlists em arquivo .ZIP.
            </p>
          </article>

          <article className="p-5 rounded-2xl bg-slate-900/50 border border-slate-800/70 hover:border-slate-700 transition-all">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-lg bg-cyan-500/15 border border-cyan-500/25 flex items-center justify-center text-cyan-400">
                <Zap className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Baixar TikTok Sem Marca d'Água</h3>
                <span className="text-[11px] text-slate-400">MP4 Limpo em Alta Resolução</span>
              </div>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Salve seus vídeos favoritos do TikTok sem aquele logotipo flutuante incômodo. Ideal para criadores de conteúdo que precisam repostar mídias ou salvar lembranças em alta resolução.
            </p>
          </article>

          <article className="p-5 rounded-2xl bg-slate-900/50 border border-slate-800/70 hover:border-slate-700 transition-all">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-purple-500/20 to-pink-500/20 border border-pink-500/25 flex items-center justify-center text-pink-400">
                <Video className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Baixar Reels e Vídeos do Instagram</h3>
                <span className="text-[11px] text-slate-400">Reels, Vídeos de Feed e Áudios</span>
              </div>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Extraia vídeos rápidos do Instagram Reels com total fidelidade visual e sonora. Compatível também com publicações convencionais de vídeo e extração da trilha sonora em MP3.
            </p>
          </article>

          <article className="p-5 rounded-2xl bg-slate-900/50 border border-slate-800/70 hover:border-slate-700 transition-all">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-lg bg-sky-500/15 border border-sky-500/25 flex items-center justify-center text-sky-400">
                <Twitter className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Baixar Vídeos do X (Twitter)</h3>
                <span className="text-[11px] text-slate-400">Vídeos, Clipes e GIFs em MP4</span>
              </div>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Salve vídeos, clipes e GIFs do X (antigo Twitter) com alta fidelidade em MP4 ou converta em áudio MP3 de forma simples, rápida e sem anúncios.
            </p>
          </article>

          <article className="p-5 rounded-2xl bg-slate-900/50 border border-slate-800/70 hover:border-slate-700 transition-all sm:col-span-2">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-lg bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center text-indigo-400">
                <FolderArchive className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Download de Playlists Completas em .ZIP</h3>
                <span className="text-[11px] text-slate-400">Coleção de Músicas e Vídeos</span>
              </div>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Evite o trabalho repetitivo de baixar uma música por vez. Com uma conta gratuita no YtDown, cole o link da playlist, selecione as faixas e baixe um único arquivo compactado .ZIP.
            </p>
          </article>
        </div>
      </div>

      {/* SEÇÃO 3: DIFERENCIAIS TÉCNICOS */}
      <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-b from-slate-900/80 to-slate-950/80 border border-slate-800/80 space-y-6">
        <h2 className="text-xl sm:text-2xl font-bold text-white text-center">
          Por que o YtDown é a melhor ferramenta para baixar mídias?
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/60">
            <Zap className="w-6 h-6 text-rose-400 mx-auto mb-2" />
            <h4 className="text-sm font-semibold text-white">Servidor Dedicado</h4>
            <p className="text-[11px] text-slate-400 mt-1">
              Processamento em VPS própria com ffmpeg e yt-dlp atualizados diariamente.
            </p>
          </div>
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/60">
            <ShieldCheck className="w-6 h-6 text-emerald-400 mx-auto mb-2" />
            <h4 className="text-sm font-semibold text-white">Livre de Malwares</h4>
            <p className="text-[11px] text-slate-400 mt-1">
              Sem softwares instaláveis suspeitos, executáveis (.exe) ou pop-ups automáticos.
            </p>
          </div>
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/60">
            <Smartphone className="w-6 h-6 text-cyan-400 mx-auto mb-2" />
            <h4 className="text-sm font-semibold text-white">100% Responsivo</h4>
            <p className="text-[11px] text-slate-400 mt-1">
              Otimizado para iPhone, Android, tablets e desktops com navegação fluida.
            </p>
          </div>
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/60">
            <Music className="w-6 h-6 text-amber-400 mx-auto mb-2" />
            <h4 className="text-sm font-semibold text-white">MP3 320 kbps Real</h4>
            <p className="text-[11px] text-slate-400 mt-1">
              Taxa de bits genuína para amantes de boa música que exigem qualidade cristalina.
            </p>
          </div>
        </div>
      </div>

      {/* SEÇÃO 4: PERGUNTAS FREQUENTES (FAQ) ACCORDION */}
      <div className="space-y-6 pt-6 border-t border-slate-900" id="faq">
        <div className="text-center space-y-2">
          <span className="text-xs uppercase font-bold tracking-wider text-rose-400 bg-rose-500/10 px-3 py-1 rounded-full border border-rose-500/20">
            Tire Suas Dúvidas
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Perguntas Frequentes (FAQ)
          </h2>
          <p className="text-sm text-slate-400 max-w-xl mx-auto">
            Respostas para as dúvidas mais comuns sobre o conversor e baixador YtDown.
          </p>
        </div>

        <div className="space-y-3 pt-2">
          {faqs.map((faq, index) => (
            <details
              key={index}
              className="group p-5 rounded-2xl bg-slate-900/40 border border-slate-800/70 hover:border-slate-700 transition-all [&_summary::-webkit-details-marker]:hidden"
            >
              <summary className="flex items-center justify-between cursor-pointer text-sm sm:text-base font-semibold text-white list-none">
                <span className="flex items-center gap-3">
                  <HelpCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                  {faq.question}
                </span>
                <ChevronDown className="w-4 h-4 text-slate-400 transition-transform duration-200 group-open:rotate-180 flex-shrink-0 ml-2" />
              </summary>
              <p className="mt-3 text-xs sm:text-sm text-slate-400 leading-relaxed pl-7">
                {faq.answer}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
