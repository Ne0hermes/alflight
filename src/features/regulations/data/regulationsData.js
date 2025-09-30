// Données réglementaires organisées par module d'application
export const regulationsData = {
  pilot: {
    title: 'Pilote',
    icon: 'User',
    description: 'Réglementations relatives aux licences, qualifications et certificats médicaux',
    sections: [
      {
        id: 'licenses',
        title: 'Licences',
        regulations: [
          {
            ref: 'FCL.025',
            title: 'Validité des licences',
            description: 'Les licences de pilote (PPL, CPL, ATPL) sont valides à vie, mais les privilèges ne peuvent être exercés que si :',
            requirements: [
              'Le certificat médical est valide',
              'Les qualifications requises sont valides',
              'Les exigences d\'expérience récente sont respectées'
            ]
          },
          {
            ref: 'FCL.015',
            title: 'Demande et délivrance de licences',
            description: 'Les conditions de délivrance des licences de pilote',
            requirements: [
              'Âge minimum : 17 ans pour PPL, 18 ans pour CPL',
              'Examen théorique valide',
              'Formation pratique complétée',
              'Test de compétences réussi',
              'Certificat médical approprié'
            ]
          }
        ]
      },
      {
        id: 'qualifications',
        title: 'Qualifications de classe et de type',
        regulations: [
          {
            ref: 'FCL.740.A',
            title: 'Prorogation des qualifications de classe et de type - avions',
            description: 'Pour proroger une qualification de classe ou de type, le pilote doit dans les 3 mois précédant l\'expiration :',
            requirements: [
              'Effectuer au moins 12 heures de vol dans la classe/type',
              'Dont 6 heures comme commandant de bord (PIC)',
              'Effectuer 12 décollages et 12 atterrissages',
              'Effectuer un vol d\'entraînement d\'au moins 1 heure avec un instructeur FI ou CRI'
            ]
          },
          {
            ref: 'FCL.740.A(b)(1)(ii)',
            title: 'Renouvellement des qualifications',
            description: 'Si la qualification est expirée, le pilote doit :',
            requirements: [
              'Réussir un contrôle de compétences avec un examinateur',
              'Effectuer une formation de remise à niveau si nécessaire',
              'Démontrer les connaissances théoriques requises'
            ]
          }
        ]
      },
      {
        id: 'recent-experience',
        title: 'Expérience récente',
        regulations: [
          {
            ref: 'FCL.060(b)(1)',
            title: 'Transport de passagers',
            description: 'Un pilote ne peut transporter des passagers que s\'il a effectué dans les 90 jours précédents :',
            requirements: [
              'Au moins 3 décollages et 3 atterrissages',
              'Sur un aéronef de même type ou classe',
              'Pour le transport de nuit : ces décollages et atterrissages doivent être effectués de nuit'
            ]
          }
        ]
      },
      {
        id: 'medical',
        title: 'Certificats médicaux',
        regulations: [
          {
            ref: 'MED.A.045',
            title: 'Validité des certificats médicaux',
            description: 'Durée de validité selon la classe et l\'âge du pilote',
            table: {
              headers: ['Classe', 'Âge', 'Durée de validité'],
              rows: [
                ['Classe 1', '< 40 ans', '12 mois'],
                ['Classe 1', '≥ 40 ans', '6 mois'],
                ['Classe 2', '< 40 ans', '60 mois'],
                ['Classe 2', '40-50 ans', '24 mois'],
                ['Classe 2', '> 50 ans', '12 mois'],
                ['LAPL', '< 40 ans', '60 mois'],
                ['LAPL', '≥ 40 ans', '24 mois']
              ]
            }
          },
          {
            ref: 'MED.A.050',
            title: 'Examens complémentaires',
            description: 'Examens médicaux supplémentaires requis',
            requirements: [
              'ECG : Requis selon l\'âge et la classe (généralement à partir de 40 ans)',
              'Audiométrie : À partir de 40 ans puis tous les 5 ans',
              'Ophtalmologie : Selon les recommandations du médecin examinateur',
              'Analyses sanguines : Selon l\'âge et les facteurs de risque'
            ]
          }
        ]
      }
    ]
  },
  navigation: {
    title: 'Navigation',
    icon: 'Navigation',
    description: 'Règles de navigation VFR, minima météo et espaces aériens',
    sections: [
      {
        id: 'vfr-minima',
        title: 'Minima VFR',
        regulations: [
          {
            ref: 'SERA.5001',
            title: 'Minima VMC de visibilité et de distance par rapport aux nuages',
            description: 'Conditions météorologiques minimales pour le vol VFR',
            table: {
              headers: ['Classe d\'espace', 'Altitude', 'Visibilité en vol', 'Distance des nuages'],
              rows: [
                ['A, B, C, D, E', '≥ FL100', '8 km', '1500m horizontal, 300m vertical'],
                ['F, G', '≥ FL100', '8 km', '1500m horizontal, 300m vertical'],
                ['C, D, E', '< FL100', '5 km', '1500m horizontal, 300m vertical'],
                ['F, G', '< FL100 (≥ 3000ft)', '5 km', '1500m horizontal, 300m vertical'],
                ['F, G', '< 3000ft', '5 km', 'Hors des nuages, vue du sol']
              ]
            }
          },
          {
            ref: 'SERA.5005(c)',
            title: 'Vol VFR de nuit',
            description: 'Conditions pour effectuer un vol VFR de nuit',
            requirements: [
              'Hauteur minimale : 500ft au-dessus de l\'obstacle le plus élevé dans un rayon de 8km',
              'Visibilité minimale : 5km (8km pour certains espaces)',
              'Hors des nuages et en vue du sol',
              'Plan de vol obligatoire pour les vols hors circuit d\'aérodrome'
            ]
          }
        ]
      },
      {
        id: 'airspace',
        title: 'Espaces aériens',
        regulations: [
          {
            ref: 'SERA.6001',
            title: 'Classification des espaces aériens',
            description: 'Classes d\'espaces aériens et services fournis',
            table: {
              headers: ['Classe', 'Type de vol', 'Séparation fournie', 'Service fourni', 'Clairance requise'],
              rows: [
                ['A', 'IFR seulement', 'Tous aéronefs', 'Contrôle', 'Oui'],
                ['B', 'IFR et VFR', 'Tous aéronefs', 'Contrôle', 'Oui'],
                ['C', 'IFR et VFR', 'IFR/IFR, IFR/VFR', 'Contrôle', 'Oui'],
                ['D', 'IFR et VFR', 'IFR/IFR', 'Contrôle (IFR), Info trafic (VFR)', 'Oui'],
                ['E', 'IFR et VFR', 'IFR/IFR', 'Contrôle (IFR), Info vol (VFR)', 'IFR: Oui, VFR: Non'],
                ['F', 'IFR et VFR', 'IFR/IFR si possible', 'Service consultatif', 'Non'],
                ['G', 'IFR et VFR', 'Aucune', 'Info vol', 'Non']
              ]
            }
          }
        ]
      },
      {
        id: 'altimetry',
        title: 'Règles d\'altimétrie',
        regulations: [
          {
            ref: 'SERA.5020',
            title: 'Altitude de transition et calages altimétriques',
            description: 'Règles de calage altimétrique selon les phases de vol',
            requirements: [
              'QNH : En dessous de l\'altitude de transition',
              'QNE (1013.25 hPa) : Au-dessus de l\'altitude de transition',
              'QFE : Peut être utilisé dans le circuit d\'aérodrome',
              'Altitude de transition : Variable selon les aérodromes (généralement 3000-6000ft)'
            ]
          },
          {
            ref: 'SERA.5025',
            title: 'Niveaux de croisière',
            description: 'Règles de la semi-circulaire pour les vols VFR',
            table: {
              headers: ['Route magnétique', 'Altitude/Niveau'],
              rows: [
                ['000° - 179°', 'FL35, FL55, FL75, FL95, FL115...'],
                ['180° - 359°', 'FL45, FL65, FL85, FL105, FL125...']
              ]
            }
          }
        ]
      }
    ]
  },
  weather: {
    title: 'Météo',
    icon: 'Cloud',
    description: 'Réglementations météorologiques et minima opérationnels',
    sections: [
      {
        id: 'weather-minima',
        title: 'Minima météorologiques',
        regulations: [
          {
            ref: 'NCO.OP.110',
            title: 'Minima opérationnels d\'aérodrome - avions',
            description: 'Minima pour les opérations VFR',
            requirements: [
              'Plafond minimum : 450m (1500ft) pour circuit normal',
              'Visibilité minimale : 5km (peut être réduite à 1500m avec autorisation)',
              'Les minima peuvent être augmentés selon les obstacles locaux',
              'Tenir compte des prévisions météo pour la destination et les alternats'
            ]
          }
        ]
      },
      {
        id: 'weather-planning',
        title: 'Planification météo',
        regulations: [
          {
            ref: 'NCO.OP.140',
            title: 'Informations météorologiques',
            description: 'Obligations de consultation météo avant vol',
            requirements: [
              'Consulter les informations météo disponibles avant tout vol',
              'Pour les vols locaux : au minimum les observations actuelles',
              'Pour les navigations : TAF, METAR, SIGMET, cartes de vents',
              'Tenir compte de l\'évolution prévue pendant toute la durée du vol'
            ]
          }
        ]
      }
    ]
  },
  fuel: {
    title: 'Carburant',
    icon: 'Fuel',
    description: 'Réglementations sur la gestion et les réserves de carburant',
    sections: [
      {
        id: 'fuel-planning',
        title: 'Planification carburant',
        regulations: [
          {
            ref: 'NCO.OP.125',
            title: 'Carburant et lubrifiant - avions',
            description: 'Quantité minimale de carburant requise pour VFR',
            requirements: [
              'Carburant pour atteindre la destination',
              'Réserve de route (généralement 5-10% selon les conditions)',
              'Carburant de dégagement vers l\'aérodrome de dégagement',
              'Réserve finale : 30 minutes en VFR de jour, 45 minutes de nuit',
              'Carburant supplémentaire si requis par les conditions'
            ]
          },
          {
            ref: 'NCO.OP.126',
            title: 'Gestion en vol du carburant',
            description: 'Surveillance et gestion du carburant pendant le vol',
            requirements: [
              'Vérifications régulières de la consommation',
              'Comparaison avec le carburant planifié',
              'Recalcul si nécessaire des réserves disponibles',
              'Décision de déroutement si les réserves minimales sont compromises'
            ]
          }
        ]
      }
    ]
  },
  weightBalance: {
    title: 'Masse et Centrage',
    icon: 'Scale',
    description: 'Limitations de masse et centrage',
    sections: [
      {
        id: 'mass-limits',
        title: 'Limitations de masse',
        regulations: [
          {
            ref: 'NCO.POL.100',
            title: 'Limitations de masse',
            description: 'Respect des limitations du manuel de vol',
            requirements: [
              'Ne pas dépasser la masse maximale au décollage (MTOM)',
              'Ne pas dépasser la masse maximale à l\'atterrissage (MLM)',
              'Ne pas dépasser la masse maximale sans carburant (MZFM)',
              'Vérifier les limitations de charge dans les soutes'
            ]
          },
          {
            ref: 'NCO.POL.105',
            title: 'Données et documents de masse et centrage',
            description: 'Documentation requise pour masse et centrage',
            requirements: [
              'Devis de masse et centrage actualisé',
              'Documentation des équipements installés',
              'Pesée périodique selon les exigences',
              'Enregistrement des modifications affectant la masse à vide'
            ]
          }
        ]
      },
      {
        id: 'cg-limits',
        title: 'Centrage',
        regulations: [
          {
            ref: 'CAT.POL.MAB.100',
            title: 'Limites de centrage',
            description: 'Maintien du centre de gravité dans les limites',
            requirements: [
              'Centre de gravité dans l\'enveloppe certifiée',
              'Prise en compte du déplacement du CG avec la consommation carburant',
              'Vérification pour toutes les phases de vol',
              'Considération des mouvements de passagers/charge en vol'
            ]
          }
        ]
      }
    ]
  },
  performance: {
    title: 'Performances',
    icon: 'TrendingUp',
    description: 'Calculs de performances et limitations opérationnelles',
    sections: [
      {
        id: 'takeoff-landing',
        title: 'Décollage et Atterrissage',
        regulations: [
          {
            ref: 'NCO.POL.110',
            title: 'Données de performances',
            description: 'Utilisation des données de performances du manuel de vol',
            requirements: [
              'Calcul des distances de décollage et d\'atterrissage',
              'Application des facteurs de correction (altitude, température, pente, vent)',
              'Marges de sécurité appropriées',
              'Considération de l\'état de la piste (sèche, mouillée, contaminée)'
            ]
          },
          {
            ref: 'NCO.IDE.A.120',
            title: 'Limitations de piste',
            description: 'Adéquation de la piste pour l\'opération prévue',
            requirements: [
              'Longueur de piste disponible supérieure à la distance requise',
              'Largeur de piste suffisante pour le type d\'aéronef',
              'Franchissement d\'obstacles en montée initiale',
              'Pente de la piste dans les limites'
            ]
          }
        ]
      },
      {
        id: 'climb-performance',
        title: 'Performances de montée',
        regulations: [
          {
            ref: 'CS-23',
            title: 'Performances minimales de montée',
            description: 'Taux de montée requis selon la configuration',
            requirements: [
              'Capacité de maintenir une pente de montée positive avec un moteur en panne (bimoteurs)',
              'Franchissement des obstacles avec marges réglementaires',
              'Performance dégradée avec givrage',
              'Effet de l\'altitude densité sur les performances'
            ]
          }
        ]
      }
    ]
  },
  operations: {
    title: 'Opérations',
    icon: 'Settings',
    description: 'Procédures opérationnelles et équipements requis',
    sections: [
      {
        id: 'equipment',
        title: 'Équipements requis',
        regulations: [
          {
            ref: 'NCO.IDE.A.105',
            title: 'Équipement minimal pour le vol',
            description: 'Instruments et équipements requis pour VFR',
            requirements: [
              'Anémomètre',
              'Altimètre',
              'Compas magnétique',
              'Chronomètre',
              'Indicateur de virage et dérapage',
              'Indicateur d\'assiette (vol de nuit ou IMC)',
              'Variomètre (pour planeurs)',
              'Équipement de radiocommunication approprié'
            ]
          },
          {
            ref: 'NCO.IDE.A.170',
            title: 'Équipements de secours',
            description: 'Équipements de survie et de secours',
            requirements: [
              'Gilets de sauvetage pour survol maritime',
              'ELT (Emergency Locator Transmitter)',
              'Trousse de premiers secours',
              'Extincteur si requis',
              'Équipement de survie selon la zone survolée'
            ]
          }
        ]
      },
      {
        id: 'procedures',
        title: 'Procédures opérationnelles',
        regulations: [
          {
            ref: 'NCO.OP.115',
            title: 'Préparation du vol',
            description: 'Éléments à vérifier avant vol',
            requirements: [
              'Documentation de l\'aéronef à jour',
              'Masse et centrage dans les limites',
              'Performances adéquates',
              'Plan de vol si requis',
              'NOTAM consultés',
              'Inspection prévol effectuée'
            ]
          }
        ]
      }
    ]
  },
  airworthiness: {
    title: 'Navigabilité',
    icon: 'Shield',
    description: 'Maintien de la navigabilité et documentation',
    sections: [
      {
        id: 'maintenance',
        title: 'Maintenance',
        regulations: [
          {
            ref: 'M.A.301',
            title: 'Tâches de maintien de la navigabilité',
            description: 'Responsabilités pour le maintien de la navigabilité',
            requirements: [
              'Exécution de la maintenance selon le programme approuvé',
              'Correction des défauts selon les données approuvées',
              'Respect des consignes de navigabilité (AD)',
              'Modifications et réparations selon données approuvées'
            ]
          },
          {
            ref: 'M.A.302',
            title: 'Programme de maintenance',
            description: 'Respect du programme de maintenance',
            requirements: [
              'Intervalles de maintenance respectés',
              'Potentiels calendaires et horaires surveillés',
              'Inspections spéciales si requises',
              'Tenue à jour des documents de maintenance'
            ]
          }
        ]
      },
      {
        id: 'documentation',
        title: 'Documentation',
        regulations: [
          {
            ref: 'M.A.305',
            title: 'Système d\'enregistrement du maintien de la navigabilité',
            description: 'Documents de navigabilité requis',
            requirements: [
              'Carnet de route à jour',
              'Certificat de navigabilité valide',
              'Certificat d\'immatriculation',
              'Licence de station d\'aéronef',
              'Certificat acoustique si applicable',
              'Assurance valide'
            ]
          }
        ]
      }
    ]
  }
};

// Fonction pour obtenir toutes les réglementations d'un module spécifique
export const getModuleRegulations = (moduleId) => {
  return regulationsData[moduleId] || null;
};

// Fonction pour rechercher une réglementation par référence
export const findRegulationByRef = (ref) => {
  for (const module of Object.values(regulationsData)) {
    for (const section of module.sections) {
      const regulation = section.regulations.find(reg => reg.ref === ref);
      if (regulation) {
        return {
          ...regulation,
          module: module.title,
          section: section.title
        };
      }
    }
  }
  return null;
};

// Fonction pour obtenir toutes les réglementations
export const getAllRegulations = () => {
  const allRegulations = [];
  for (const [moduleId, module] of Object.entries(regulationsData)) {
    for (const section of module.sections) {
      for (const regulation of section.regulations) {
        allRegulations.push({
          ...regulation,
          moduleId,
          module: module.title,
          sectionId: section.id,
          section: section.title
        });
      }
    }
  }
  return allRegulations;
};