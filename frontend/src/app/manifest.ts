import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'YtDown - Baixar Vídeos e Áudio do YouTube, TikTok, Instagram e X (Twitter)',
    short_name: 'YtDown',
    description:
      'Baixe vídeos e áudios do YouTube, TikTok sem marca d\'água, Instagram e X (Twitter) em MP4 e MP3 de alta fidelidade.',
    start_url: '/',
    display: 'standalone',
    background_color: '#020617',
    theme_color: '#e11d48',
    icons: [
      {
        src: '/favicon-32.png',
        sizes: '32x32',
        type: 'image/png',
      },
      {
        src: '/apple-touch-icon.png',
        sizes: '180x180',
        type: 'image/png',
      },
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  };
}
