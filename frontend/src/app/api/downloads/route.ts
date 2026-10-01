import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Cliente Supabase no servidor utilizando as variáveis injetadas pela Vercel / Supabase integration
const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  '';

const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  '';

const supabaseServer = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const apiUrl = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || '';
    const apiSecret = process.env.API_SECRET_KEY || process.env.NEXT_PUBLIC_API_SECRET_KEY || '';

    if (!body.url) {
      return NextResponse.json({ detail: 'URL do YouTube é obrigatória.' }, { status: 400 });
    }

    // 1. Cria o registro na tabela media_downloads diretamente no servidor Supabase
    let record: any = null;
    if (supabaseServer) {
      const { data, error: dbError } = await supabaseServer
        .from('media_downloads')
        .insert({
          user_id: body.user_id || null,
          original_url: body.url.trim(),
          format: body.format || 'mp3',
          quality: body.quality || 'standard',
          is_playlist: Boolean(body.is_playlist),
          status: 'pending',
          progress: 0,
        })
        .select()
        .single();

      if (dbError) {
        console.error('Erro ao gravar no Supabase via serverless:', dbError);
        return NextResponse.json(
          { detail: `Falha ao gravar no banco de dados Supabase: ${dbError.message}` },
          { status: 500 }
        );
      }
      record = data;
    } else {
      console.warn('Variáveis do Supabase não encontradas no ambiente de execução.');
    }

    const downloadId = record?.id || body.id;

    // 2. Notifica a VPS para processar o download
    if (apiUrl) {
      try {
        const backendRes = await fetch(`${apiUrl.replace(/\/$/, '')}/api/downloads`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(apiSecret ? { 'X-API-KEY': apiSecret } : {}),
          },
          body: JSON.stringify({
            id: downloadId,
            url: body.url.trim(),
            format: body.format || 'mp3',
            quality: body.quality || 'standard',
            is_playlist: Boolean(body.is_playlist),
            user_id: body.user_id || null,
          }),
        });

        const backendData = await backendRes.json().catch(() => ({}));
        if (!backendRes.ok) {
          if (supabaseServer && downloadId) {
            await supabaseServer
              .from('media_downloads')
              .update({
                status: 'failed',
                error_message: backendData.detail || 'Falha de comunicação com a VPS.',
              })
              .eq('id', downloadId);
          }
          return NextResponse.json(
            { detail: backendData.detail || 'Falha ao comunicar com o servidor de conversão na VPS.' },
            { status: backendRes.status }
          );
        }
      } catch (err: any) {
        console.error('Erro ao conectar com a VPS:', err);
        if (supabaseServer && downloadId) {
          await supabaseServer
            .from('media_downloads')
            .update({
              status: 'failed',
              error_message: `VPS inacessível: ${err.message}`,
            })
            .eq('id', downloadId);
        }
        return NextResponse.json(
          { detail: `Não foi possível conectar à VPS: ${err.message}` },
          { status: 502 }
        );
      }
    } else {
      return NextResponse.json(
        { detail: 'A variável API_URL (endereço da VPS) não está configurada na Vercel.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      id: downloadId,
      status: 'pending',
      message: 'Download iniciado com sucesso.',
      record,
    });
  } catch (error: any) {
    console.error('Erro no proxy de download:', error);
    return NextResponse.json(
      { detail: error.message || 'Erro ao conectar com o servidor backend.' },
      { status: 500 }
    );
  }
}
