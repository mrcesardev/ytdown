import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 60; // Suporta até 60 segundos de streaming em planos serverless
export const dynamic = 'force-dynamic';

const apiUrl =
  process.env.API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'http://localhost:8000';

const apiSecret =
  process.env.API_SECRET_KEY ||
  process.env.NEXT_PUBLIC_API_SECRET_KEY ||
  '';

export async function GET(
  req: NextRequest,
  { params }: { params: { filename: string[] } }
) {
  try {
    const rawSegments = params.filename || [];
    const filenamePath = Array.isArray(rawSegments)
      ? rawSegments.map((s) => decodeURIComponent(s)).join('/')
      : decodeURIComponent(rawSegments as string);

    if (!filenamePath) {
      return NextResponse.json(
        { detail: 'Nome do arquivo não informado.' },
        { status: 400 }
      );
    }

    // Monta a URL de download na VPS / backend FastAPI
    const backendUrl = `${apiUrl.replace(/\/$/, '')}/api/files/${encodeURIComponent(filenamePath)}`;

    // Repassa cabeçalhos do cliente (ex: Range para downloads parciais/resumo)
    const reqHeaders: Record<string, string> = {};
    const clientRange = req.headers.get('range');
    if (clientRange) {
      reqHeaders['Range'] = clientRange;
    }
    if (apiSecret) {
      reqHeaders['X-API-KEY'] = apiSecret;
    }

    const vpsRes = await fetch(backendUrl, {
      headers: reqHeaders,
      cache: 'no-store',
    });

    if (!vpsRes.ok) {
      const errorText = await vpsRes.text().catch(() => '');
      return new NextResponse(
        errorText || 'Arquivo não encontrado ou já expirado pelo sistema de limpeza.',
        {
          status: vpsRes.status,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        }
      );
    }

    // Configura os cabeçalhos de resposta HTTP para o navegador do usuário
    const resHeaders = new Headers();
    const contentType = vpsRes.headers.get('content-type') || 'application/octet-stream';
    const contentDisposition = vpsRes.headers.get('content-disposition');
    const contentLength = vpsRes.headers.get('content-length');
    const acceptRanges = vpsRes.headers.get('accept-ranges');
    const contentRange = vpsRes.headers.get('content-range');

    resHeaders.set('Content-Type', contentType);
    if (contentDisposition) {
      resHeaders.set('Content-Disposition', contentDisposition);
    } else {
      // Nome sem o UUID do início para exibição amigável
      const cleanName = filenamePath.replace(/^[a-f0-9\-]{36}_/, '') || filenamePath;
      resHeaders.set('Content-Disposition', `attachment; filename="${cleanName}"`);
    }

    if (contentLength) resHeaders.set('Content-Length', contentLength);
    if (acceptRanges) resHeaders.set('Accept-Ranges', acceptRanges);
    if (contentRange) resHeaders.set('Content-Range', contentRange);

    // Faz streaming direto dos bytes do arquivo sem carregar tudo na memória RAM da Vercel
    return new NextResponse(vpsRes.body, {
      status: vpsRes.status,
      headers: resHeaders,
    });
  } catch (error: any) {
    console.error('Erro ao repassar download de arquivo via proxy Next.js:', error);
    return NextResponse.json(
      { detail: `Falha na conexão com o servidor de arquivos: ${error.message || 'Erro desconhecido'}` },
      { status: 502 }
    );
  }
}
