import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'YtDown - Stream Ripper & Media Converter',
  description: 'Seu conversor pessoal e privado de vídeos e áudios do YouTube',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className="dark">
      <body className="bg-slate-950 text-slate-50 min-h-screen antialiased selection:bg-rose-500 selection:text-white">
        {children}
      </body>
    </html>
  );
}
