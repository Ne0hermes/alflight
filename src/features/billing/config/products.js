// Product configuration for billing
export const PRODUCTS = {
  pro: {
    name: 'ALFlight PRO',
    description: 'Accès complet à toutes les fonctionnalités avancées',
    features: [
      'Interpolation IA avancée des performances',
      'Analyse OCR illimitée des manuels',
      'Cartes VAC haute résolution',
      'Export PDF professionnel',
      'Calculs de masse et centrage avancés',
      'Météo temps réel multi-sources',
      'Support prioritaire',
    ],
    plans: [
      {
        id: 'pro_monthly',
        priceId: import.meta.env.VITE_STRIPE_PRICE_ID_PRO_MONTHLY || 'price_monthly',
        name: 'Mensuel',
        price: 9.99,
        currency: 'EUR',
        interval: 'month',
        popular: false,
      },
      {
        id: 'pro_yearly',
        priceId: import.meta.env.VITE_STRIPE_PRICE_ID_PRO_YEARLY || 'price_yearly',
        name: 'Annuel',
        price: 99.99,
        currency: 'EUR',
        interval: 'year',
        popular: true,
        savings: '2 mois gratuits',
      },
    ],
  },
};

export const FEATURES_COMPARISON = {
  free: {
    name: 'Gratuit',
    features: {
      'Navigation de base': true,
      'Carte simple': true,
      'Météo METAR/TAF': true,
      'Calcul carburant': true,
      'Masse et centrage simple': true,
      'Export PDF': false,
      'Interpolation IA': false,
      'Analyse OCR': false,
      'Cartes VAC': false,
      'Support': 'Communauté',
    },
  },
  pro: {
    name: 'PRO',
    features: {
      'Navigation de base': true,
      'Carte simple': true,
      'Météo METAR/TAF': true,
      'Calcul carburant': true,
      'Masse et centrage simple': true,
      'Export PDF': true,
      'Interpolation IA': true,
      'Analyse OCR': true,
      'Cartes VAC': true,
      'Support': 'Prioritaire',
    },
  },
};