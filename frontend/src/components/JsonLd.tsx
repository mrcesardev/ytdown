import React from 'react';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://ytdown.com.br';

export default function JsonLd() {
  const webAppSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    '@id': `${SITE_URL}/#webapp`,
    name: 'YtDown',
    url: SITE_URL,
    description:
      'Baixe vídeos e áudios do YouTube, TikTok, Instagram e X (Twitter) gratuitamente em alta velocidade. Suporte a MP4 1080p, MP3 320kbps, download de playlists em ZIP e vídeos sem marca d\'água.',
    applicationCategory: 'MultimediaApplication',
    operatingSystem: 'All',
    browserRequirements: 'Requires JavaScript. Requires HTML5.',
    offers: {
      '@type': 'Offer',
      price: '0.00',
      priceCurrency: 'BRL',
      availability: 'https://schema.org/InStock',
    },
    featureList: [
      'Download de vídeos do YouTube em MP4 (720p / 1080p)',
      'Conversão de áudio do YouTube para MP3 em 320 kbps e 128 kbps',
      'Download de vídeos do TikTok sem marca d\'água',
      'Download de Reels, vídeos e áudio do Instagram',
      'Download de vídeos e GIFs do X (Twitter) em MP4 e MP3',
      'Download de playlists completas do YouTube compactadas em .ZIP',
      'Conversão ultrarrápida na nuvem sem necessidade de instalar programas',
    ],
    softwareVersion: '1.0.0',
    creator: {
      '@type': 'Organization',
      name: 'YtDown',
      url: SITE_URL,
    },
  };

  const organizationSchema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${SITE_URL}/#organization`,
    name: 'YtDown',
    url: SITE_URL,
    logo: `${SITE_URL}/icon`,
    description: 'Serviço gratuito de download e conversão de mídias online.',
  };

  const howToSchema = {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: 'Como baixar vídeos e músicas do YouTube, TikTok, Instagram e X (Twitter) com o YtDown',
    description:
      'Guia passo a passo para baixar vídeos e converter áudio em MP3 320kbps ou MP4 sem complicações.',
    step: [
      {
        '@type': 'HowToStep',
        position: 1,
        name: 'Copie a URL do vídeo',
        text: 'Acesse o YouTube, TikTok, Instagram ou X (Twitter) e copie o link do vídeo, tweet, Reel ou playlist que deseja baixar.',
      },
      {
        '@type': 'HowToStep',
        position: 2,
        name: 'Cole o link no YtDown',
        text: 'Cole o link copiado na barra de busca do YtDown e aguarde a detecção automática do título e capa.',
      },
      {
        '@type': 'HowToStep',
        position: 3,
        name: 'Escolha o formato e a qualidade',
        text: 'Selecione se deseja baixar em Áudio MP3 (128k ou 320k) ou Vídeo MP4 (720p ou alta resolução).',
      },
      {
        '@type': 'HowToStep',
        position: 4,
        name: 'Clique em Baixar',
        text: 'O YtDown processará o arquivo em segundos na nuvem e liberará o download direto sem anúncios invasivos.',
      },
    ],
  };

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'O YtDown é gratuito?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Sim! O YtDown é 100% gratuito. Você pode baixar vídeos do YouTube, TikTok sem marca d\'água, Instagram e X (Twitter) imediatamente sem pagar nada e sem anúncios invasivos.',
        },
      },
      {
        '@type': 'Question',
        name: 'Como baixar vídeos do X (Twitter)?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Copie o link do tweet/post que contém o vídeo ou GIF no X (Twitter), cole na barra de busca do YtDown e escolha entre MP4 em alta resolução ou extração de áudio em MP3.',
        },
      },
      {
        '@type': 'Question',
        name: 'Como baixar vídeos do TikTok sem a marca d\'água?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Basta copiar o link do vídeo no aplicativo do TikTok (compartilhar > copiar link), colar na barra de pesquisa do YtDown e clicar em Baixar MP4. O vídeo será salvo limpo, sem o logotipo flutuante do TikTok.',
        },
      },
      {
        '@type': 'Question',
        name: 'Como converter vídeos do YouTube em MP3 de alta fidelidade (320 kbps)?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Selecione o formato de áudio MP3 no YtDown. Para acessar a taxa de bits máxima de 320 kbps e baixar com fidelidade sonora premium de estúdio, basta criar uma conta gratuita rápida.',
        },
      },
      {
        '@type': 'Question',
        name: 'É possível baixar uma playlist inteira do YouTube em arquivo .ZIP?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Sim! Ao colar a URL de uma playlist do YouTube, o YtDown reconhece todas as faixas e permite selecionar os vídeos para gerar um arquivo compactado .ZIP para você salvar tudo de uma vez.',
        },
      },
      {
        '@type': 'Question',
        name: 'Preciso instalar algum programa ou extensão no meu computador ou celular?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Não. Todo o processamento é feito 100% em nossos servidores em nuvem. Funciona diretamente no seu navegador, seja no celular (Android e iOS), tablet ou computador (Windows, Mac, Linux).',
        },
      },
      {
        '@type': 'Question',
        name: 'O YtDown tem anúncios abusivos ou pop-ups que abrem sozinhos?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Diferente da maioria dos sites de download que abrem pop-ups e vírus, o YtDown foi criado com foco na experiência limpa do usuário, sem redirecionamentos suspeitos ou anúncios abusivos.',
        },
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webAppSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(howToSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
    </>
  );
}
