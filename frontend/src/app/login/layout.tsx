import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Entrar ou Criar Conta Gratuita',
  description:
    'Acesse sua conta no YtDown para baixar playlists inteiras do YouTube compactadas em .ZIP, extrair áudios em MP3 320 kbps e acompanhar seu histórico de downloads.',
  robots: {
    index: false,
    follow: true,
  },
};

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
