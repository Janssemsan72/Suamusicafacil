// Hook simplificado para tradução
export const useTranslation = () => {
  return {
    t: (key: string) => {
      // Traduções hardcoded para evitar problemas
      const translations: { [key: string]: string } = {
        'hero.platform': 'A plataforma #1 de músicas personalizadas',
        'hero.title': 'Músicas Que Tocam o Coração',
        'hero.subtitle': 'Crie a música perfeita para seus momentos especiais. Propostas, casamentos, tributos — cada nota criada com amor e entregue em 48h.',
        'hero.cta': 'Criar Sua Música',
        'hero.deliveredWithLove': 'Entregue com amor',
        'hero.over500Songs': 'Mais de 1000 músicas criadas',
        'features.title': 'Como Funciona',
        'features.subtitle': 'Criar sua música personalizada é simples e mágico. Em apenas 3 passos, você terá uma obra-prima única.',
        'features.step1.title': 'Conte Sua História',
        'features.step1.description': 'Responda algumas perguntas sobre seu momento especial, a pessoa e as emoções que deseja transmitir.',
        'features.step2.title': 'Nossa Equipe Cria Sua Música',
        'features.step2.description': 'Entregamos uma música única, criada com dedicação para transformar sua história em melodia e palavras.',
        'features.step3.title': 'Receba Sua Obra-Prima',
        'features.step3.description': 'Receba sua música personalizada em alta qualidade, pronta para compartilhar com o mundo.',
        'pricing.title': 'Investimento Transparente',
        'pricing.subtitle': 'Sem taxas escondidas. Sem surpresas. Apenas música de qualidade profissional.',
        'pricing.mostPopular': 'Mais Popular',
        'pricing.deliveryIn': 'Entrega em',
        'pricing.createMyMusic': 'Criar Minha Música',
        'pricing.features.highQualityMP3': 'MP3 alta qualidade',
        'pricing.features.customCover': 'Capa personalizada',
        'pricing.features.fullLyrics': 'Letra completa',
        'pricing.features.unlimitedDownload': 'Download ilimitado',
        'pricing.features.delivery24h': 'Entrega em 48h',
        'testimonials.title': 'O Que Nossos Clientes Dizem',
        'testimonials.subtitle': 'Histórias reais de pessoas reais que criaram momentos mágicos.',
        'vinyl.title': 'Ouça um Exemplo',
        'vinyl.subtitle': 'Cada faixa é produzida com instrumentos reais e vocais profissionais',
        'vinylPlayer.changingMusic': 'Mudando música...',
        'common.loading': 'Carregando...'
      };
      
      return translations[key] || key;
    },
    currentLanguage: 'pt'
  };
};
