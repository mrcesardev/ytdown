/**
 * Configurações de Monetização e Doações para o YtDown (Fase 1)
 */

export const MONETIZATION_CONFIG = {
  // Chave PIX para apoio aos custos do servidor
  pix: {
    key: process.env.NEXT_PUBLIC_PIX_KEY || 'paulocesarferreiraleite@yahoo.com.br',
    receiverName: process.env.NEXT_PUBLIC_PIX_NAME || 'Paulo César',
    city: process.env.NEXT_PUBLIC_PIX_CITY || 'Brasil',
    description: 'Apoio aos custos de servidor do YtDown',
  },

  // Link internacional opcional (Buy Me a Coffee / Ko-fi / PayPal)
  donations: {
    buyMeACoffeeUrl: process.env.NEXT_PUBLIC_DONATION_URL || '',
  },

  // Configurações de Redes de Anúncios (Adsterra / Monetag / etc)
  ads: {
    // Altere para true quando cadastrar sua conta na Adsterra ou Monetag
    enabled: process.env.NEXT_PUBLIC_ADS_ENABLED === 'true',
    // Script ou Tag ID fornecido pela rede de anúncios
    adsterraBannerKey: process.env.NEXT_PUBLIC_ADSTERRA_BANNER_KEY || '',
    monetagTagId: process.env.NEXT_PUBLIC_MONETAG_TAG_ID || '',
  },

  // Download com Recompensa / Rewarded Ad para usuários não logados
  rewardedAds: {
    enabled: process.env.NEXT_PUBLIC_REWARDED_ADS_ENABLED !== 'false', // Ativo por padrão
    countdownSeconds: Number(process.env.NEXT_PUBLIC_REWARDED_COUNTDOWN) || 6,
    adScriptUrl: process.env.NEXT_PUBLIC_REWARDED_SCRIPT_URL || '',
  },
};
