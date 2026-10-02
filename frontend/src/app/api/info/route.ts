import { NextRequest, NextResponse } from 'next/server';

const apiUrl =
  process.env.API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'http://45.178.180.152:8000';

const apiSecret =
  process.env.API_SECRET_KEY ||
  process.env.NEXT_PUBLIC_API_SECRET_KEY ||
  'ytdown_sec_7d2a1b194b53cae48270df94b45a43d0f0583a8bd8226dfe';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const url = body.url?.trim();

    if (!url) {
      return NextResponse.json({ detail: 'URL é obrigatória.' }, { status: 400 });
    }

    if (!url.includes('youtube.com/') && !url.includes('youtu.be/')) {
      return NextResponse.json({ detail: 'URL inválida do YouTube.' }, { status: 400 });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000); // 20s timeout

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
