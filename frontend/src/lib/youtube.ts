/**
 * Utilitários para normalização e detecção de URLs do YouTube, TikTok e Instagram.
 */

export function isYouTubeUrl(inputUrl: string): boolean {
  if (!inputUrl) return false;
  const trimmed = inputUrl.trim().toLowerCase();
  return trimmed.includes('youtube.com/') || trimmed.includes('youtu.be/');
}

export function isTikTokUrl(inputUrl: string): boolean {
  if (!inputUrl) return false;
  const trimmed = inputUrl.trim().toLowerCase();
  return (
    trimmed.includes('tiktok.com/') ||
    trimmed.includes('vm.tiktok.com/') ||
    trimmed.includes('vt.tiktok.com/') ||
    trimmed.includes('douyin.com/')
  );
}

export function isInstagramUrl(inputUrl: string): boolean {
  if (!inputUrl) return false;
  const trimmed = inputUrl.trim().toLowerCase();
  return (
    trimmed.includes('instagram.com/reel/') ||
    trimmed.includes('instagram.com/reels/') ||
    trimmed.includes('instagram.com/p/') ||
    trimmed.includes('instagram.com/tv/') ||
    trimmed.includes('instagr.am/p/') ||
    trimmed.includes('instagr.am/reel/')
  );
}

export function isTwitterUrl(inputUrl: string): boolean {
  if (!inputUrl) return false;
  const trimmed = inputUrl.trim().toLowerCase();
  return (
    trimmed.includes('twitter.com/') ||
    trimmed.includes('x.com/') ||
    trimmed.includes('t.co/')
  );
}

export function isSupportedMediaUrl(inputUrl: string): boolean {
  return (
    isYouTubeUrl(inputUrl) ||
    isTikTokUrl(inputUrl) ||
    isInstagramUrl(inputUrl) ||
    isTwitterUrl(inputUrl)
  );
}

export function getMediaPlatform(
  inputUrl: string
): 'youtube' | 'tiktok' | 'instagram' | 'twitter' | 'unknown' {
  if (isYouTubeUrl(inputUrl)) return 'youtube';
  if (isTikTokUrl(inputUrl)) return 'tiktok';
  if (isInstagramUrl(inputUrl)) return 'instagram';
  if (isTwitterUrl(inputUrl)) return 'twitter';
  return 'unknown';
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

export function cleanInstagramUrl(inputUrl: string): string {
  if (!inputUrl) return '';
  const trimmed = inputUrl.trim();
  try {
    const urlObj = new URL(trimmed);
    // Remove query params de tracking (?igsh=..., &utm_source=...) mantendo o caminho limpo
    return `${urlObj.origin}${urlObj.pathname}`;
  } catch {
    return trimmed.split('?')[0];
  }
}

export function cleanTwitterUrl(inputUrl: string): string {
  if (!inputUrl) return '';
  const trimmed = inputUrl.trim();
  try {
    const urlObj = new URL(trimmed);
    // Remove query params de tracking (?s=..., &t=...) mantendo o caminho limpo
    return `${urlObj.origin}${urlObj.pathname}`;
  } catch {
    return trimmed.split('?')[0];
  }
}

export function cleanMediaUrl(inputUrl: string): string {
  if (!inputUrl) return '';
  const trimmed = inputUrl.trim();
  if (isYouTubeUrl(trimmed)) {
    return cleanYouTubeUrl(trimmed);
  }
  if (isInstagramUrl(trimmed)) {
    return cleanInstagramUrl(trimmed);
  }
  if (isTwitterUrl(trimmed)) {
    return cleanTwitterUrl(trimmed);
  }
  return trimmed;
}
