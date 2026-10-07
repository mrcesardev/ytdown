import type { Metadata, Viewport } from 'next';
import './globals.css';
import JsonLd from '@/components/JsonLd';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://ytdown.com.br';

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#020617' },
    { media: '(prefers-color-scheme: dark)', color: '#020617' },
  ],
  colorScheme: 'dark',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default:
      'YtDown - Baixar Vídeos do YouTube, TikTok, Instagram e X (Twitter) Grátis | MP3 320kbps & MP4',
    template: '%s | YtDown',
  },
  description:
    'Baixe vídeos e músicas do YouTube, TikTok sem marca d\'água, Instagram e X (Twitter) em MP4 e MP3 até 320 kbps. Rápido, direto, gratuito e sem anúncios invasivos. Suporte a download de playlists em .ZIP.',
  applicationName: 'YtDown',
  authors: [{ name: 'YtDown Team', url: SITE_URL }],
  generator: 'Next.js',
  keywords: [
    'baixar video youtube',
    'baixar musica youtube',
    'converter youtube em mp3',
    'youtube to mp3 320kbps',
    'baixar video tiktok sem marca d agua',
    'baixar reels instagram',
    'baixar video twitter',
    'baixar video x',
    'twitter video downloader',
    'x video download',
    'baixar playlist youtube zip',
    'conversor youtube mp4 1080p',
    'youtube downloader gratis',
    'tiktok downloader no watermark',
    'instagram video download',
    'stream ripper online',
    'ytdown',
    'baixar video do youtube no celular',
    'baixar audio do youtube alta qualidade',
  ],
  referrer: 'origin-when-cross-origin',
  creator: 'YtDown Team',
  publisher: 'YtDown',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  alternates: {
    canonical: '/',
    languages: {
      'pt-BR': '/',
      'en-US': '/?lang=en',
    },
  },
  icons: {
    icon: [
      { url: '/favicon.ico' },
      { url: '/favicon-32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
  openGraph: {
    title:
      'YtDown - Baixar Vídeos do YouTube, TikTok, Instagram e X (Twitter) | MP3 320kbps & MP4',
    description:
      'Baixe vídeos e músicas do YouTube, TikTok sem marca d\'água, Instagram e X (Twitter) em MP4 e MP3 até 320 kbps. Rápido, direto, gratuito e sem anúncios invasivos.',
    url: '/',
    siteName: 'YtDown',
    locale: 'pt_BR',
    type: 'website',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'YtDown - Baixar Vídeos e Músicas do YouTube, TikTok, Instagram e X (Twitter)',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'YtDown - Baixar Vídeos do YouTube, TikTok, Instagram e X (Twitter)',
    description:
      'Baixe vídeos em MP4 e áudios em MP3 320kbps do YouTube, TikTok sem marca d\'água, Instagram e X (Twitter). Grátis e sem anúncios invasivos.',
    creator: '@ytdown',
    images: ['/og-image.png'],
  },
  robots: {
    index: true,
    follow: true,
    nocache: false,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  manifest: '/manifest.webmanifest',
  category: 'technology',
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION,
    other: {
      'msvalidate.01': process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION || '',
    },
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className="dark scroll-smooth">
      <head>
        <JsonLd />
      </head>
      <body className="bg-slate-950 text-slate-50 min-h-screen antialiased selection:bg-rose-500 selection:text-white">
        {children}
      </body>
    </html>
  );
}
