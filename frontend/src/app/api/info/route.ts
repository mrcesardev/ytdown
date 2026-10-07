import { NextRequest, NextResponse } from 'next/server';
import { cleanMediaUrl, isSupportedMediaUrl } from '@/lib/youtube';

export const maxDuration = 45;

const apiUrl =
  process.env.API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  '';

const apiSecret =
  process.env.API_SECRET_KEY ||
  process.env.NEXT_PUBLIC_API_SECRET_KEY ||
  '';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rawUrl = body.url?.trim();

    if (!rawUrl) {
      return NextResponse.json({ detail: 'URL é obrigatória.' }, { status: 400 });
    }

    if (!apiUrl) {
      return NextResponse.json(
        { detail: 'A variável API_URL (endereço do backend) não está configurada no servidor.' },
        { status: 500 }
      );
    }

    if (!isSupportedMediaUrl(rawUrl)) {
      return NextResponse.json(
        { detail: 'URL inválida. Suportamos links do YouTube, TikTok, Instagram e X (Twitter).' },
        { status: 400 }
      );
    }

    const url = cleanMediaUrl(rawUrl);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 35000); // 35s timeout

    const vpsRes = await fetch(`${apiUrl.replace(/\/$/, '')}/api/info`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiSecret ? { 'X-API-KEY': apiSecret } : {}),
      },
      body: JSON.stringify({ url }),
      signal: controller.signal,
      cache: 'no-store',
    }).finally(() => clearTimeout(timeout));

    if (!vpsRes.ok) {
      const errData = await vpsRes.json().catch(() => ({}));
      return NextResponse.json(
        { detail: errData.detail || 'Não foi possível obter informações do vídeo ou playlist.' },
        { status: vpsRes.status }
      );
    }

    const data = await vpsRes.json();
    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    if (error.name === 'AbortError') {
      return NextResponse.json(
        { detail: 'Tempo limite excedido ao buscar informações da mídia na VPS.' },
        { status: 504 }
      );
    }
    console.error('Erro na rota /api/info:', error);
    return NextResponse.json(
      { detail: error.message || 'Erro ao conectar à VPS para buscar informações.' },
      { status: 500 }
    );
  }
}
