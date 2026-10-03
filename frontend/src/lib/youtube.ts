/**
 * Utilitários para normalização e detecção de URLs do YouTube.
 */

export function isYouTubeUrl(inputUrl: string): boolean {
  if (!inputUrl) return false;
  const trimmed = inputUrl.trim();
  return trimmed.includes('youtube.com/') || trimmed.includes('youtu.be/');
}

/**
 * Identifica se a URL é de uma Playlist real de usuário (ex: list=PL... ou /playlist?list=).
 * Mixes automáticos do YouTube (RD..., UL...) NÃO são playlists reais para download.
 */
export function isYouTubePlaylist(inputUrl: string): boolean {
  if (!inputUrl) return false;
  try {
    const parsed = new URL(inputUrl.trim());
    const listId = parsed.searchParams.get('list');
    if (!listId) return false;

    // RD... é Mix/Rádio do YouTube; UL... é Mix de uploads do canal
    if (listId.startsWith('RD') || listId.startsWith('UL')) {
      return false;
    }

    return true;
  } catch {
    if (inputUrl.includes('list=RD') || inputUrl.includes('list=UL')) {
      return false;
    }
    return inputUrl.includes('list=');
  }
}

/**
 * Limpa parâmetros desnecessários ou que causam timeouts:
 * - Converte links de vídeos tocando em Mixes (ex: watch?v=XYZ&list=RDXYZ) para watch?v=XYZ
 * - Remove tags de tracking e posição mantendo o vídeo limpo
 */
export function cleanYouTubeUrl(inputUrl: string): string {
  if (!inputUrl) return '';
  const trimmed = inputUrl.trim();

  try {
    const urlObj = new URL(trimmed);
    const videoId = urlObj.searchParams.get('v');
    const listId = urlObj.searchParams.get('list');

    // 1. Caso vídeo tocando dentro de um Mix/Rádio do YouTube (RD... ou UL...)
    if (videoId && listId && (listId.startsWith('RD') || listId.startsWith('UL'))) {
      return `https://www.youtube.com/watch?v=${videoId}`;
    }

    // 2. Caso youtu.be/ID com Mix
    if (urlObj.hostname.includes('youtu.be') && listId && (listId.startsWith('RD') || listId.startsWith('UL'))) {
      const pathId = urlObj.pathname.replace(/^\//, '');
      if (pathId) {
        return `https://www.youtube.com/watch?v=${pathId}`;
      }
    }

    // 3. Caso vídeo normal com tracking (?si=..., &feature=..., etc.) e sem playlist real
    if (videoId && (!listId || listId.startsWith('RD') || listId.startsWith('UL'))) {
      return `https://www.youtube.com/watch?v=${videoId}`;
    }

    return trimmed;
  } catch {
    return trimmed;
  }
}
