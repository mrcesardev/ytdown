import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const apiUrl = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    const apiSecret = process.env.API_SECRET_KEY || process.env.NEXT_PUBLIC_API_SECRET_KEY || '';

    const backendRes = await fetch(`${apiUrl.replace(/\/$/, '')}/api/downloads`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiSecret ? { 'X-API-KEY': apiSecret } : {}),
      },
      body: JSON.stringify(body),
    });

    const data = await backendRes.json().catch(() => ({}));
    if (!backendRes.ok) {
      return NextResponse.json(
        { detail: data.detail || 'Falha ao comunicar com o servidor de conversão na VPS.' },
        { status: backendRes.status }
      );
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Erro no proxy de download:', error);
    return NextResponse.json(
      { detail: error.message || 'Erro ao conectar com o servidor backend.' },
      { status: 500 }
    );
  }
}
