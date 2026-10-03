import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// 1. Resolução de credenciais do Supabase
const supabaseUrl =
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  '';

const supabaseKey =
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  '';

// 2. Resolução de endereço da VPS Backend
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

    if (!body.url) {
      return NextResponse.json({ detail: 'URL do YouTube é obrigatória.' }, { status: 400 });
    }

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        { detail: 'Configuração do banco de dados (Supabase) ausente no servidor. Verifique as variáveis de ambiente.' },
        { status: 500 }
      );
    }

    const supabaseServer = createClient(supabaseUrl, supabaseKey);

    // 1. Cria o registro na tabela media_downloads diretamente no servidor Supabase
    let record: any = null;
    if (supabaseServer) {
      const { data, error: dbError } = await supabaseServer
        .from('media_downloads')
        .insert({
          user_id: body.user_id || null,
          title: body.playlist_title || body.title || null,
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
            selected_urls: body.selected_urls || null,
            playlist_title: body.playlist_title || null,
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

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const idsParam = searchParams.get('ids') || searchParams.get('id');
    const userId = searchParams.get('user_id');

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        { detail: 'Configuração do banco de dados (Supabase) ausente no servidor. Verifique as variáveis de ambiente.' },
        { status: 500 }
      );
    }

    const supabaseServer = createClient(supabaseUrl, supabaseKey);

    let query = supabaseServer.from('media_downloads').select('*');

    if (idsParam) {
      const ids = idsParam.split(',').map((s) => s.trim()).filter(Boolean);
      if (ids.length === 0) {
        return NextResponse.json({ downloads: [] });
      }
      query = query.in('id', ids);
    } else if (userId) {
      query = query.eq('user_id', userId).order('created_at', { ascending: false }).limit(30);
    } else {
      return NextResponse.json({ downloads: [] });
    }

    const { data: rows, error: dbError } = await query;
    if (dbError) {
      console.error('Erro ao buscar downloads no Supabase:', dbError);
      return NextResponse.json({ detail: dbError.message }, { status: 500 });
    }

    const list = rows || [];

    // Para cada item ainda pendente ou em processamento, consulta a VPS para sincronizar se já concluiu
    const updatedList = await Promise.all(
      list.map(async (item: any) => {
        if (item.status === 'pending' || item.status === 'processing') {
          try {
            const vpsRes = await fetch(`${apiUrl.replace(/\/$/, '')}/api/downloads/${item.id}`, {
              cache: 'no-store',
              headers: apiSecret ? { 'X-API-KEY': apiSecret } : {},
            });
            if (vpsRes.ok) {
              const vpsData = await vpsRes.json();
              if (vpsData && vpsData.status && (vpsData.status !== item.status || (vpsData.progress && vpsData.progress > (item.progress || 0)))) {
                const updates: any = {
                  status: vpsData.status,
                  progress: vpsData.progress ?? item.progress,
                  title: vpsData.title || item.title,
                  thumbnail: vpsData.thumbnail || item.thumbnail,
                  download_url: vpsData.download_url || item.download_url,
                  filename: vpsData.filename || item.filename,
                  file_size: vpsData.file_size || item.file_size,
                  error_message: vpsData.error_message || item.error_message,
                  updated_at: new Date().toISOString(),
                };
                if (vpsData.status === 'completed') {
                  updates.completed_at = new Date().toISOString();
                }

                await supabaseServer.from('media_downloads').update(updates).eq('id', item.id);
                return { ...item, ...updates };
              }
            }
          } catch (e) {
            // Ignora falha transitória de consulta na VPS
          }
        }
        return item;
      })
    );

    return NextResponse.json({ downloads: updatedList });
  } catch (error: any) {
    console.error('Erro na rota GET /api/downloads:', error);
    return NextResponse.json({ detail: error.message }, { status: 500 });
  }
}
