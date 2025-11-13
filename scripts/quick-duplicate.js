// Script rapide pour dupliquer un avion
// Utilisation: Copier-coller dans la console du navigateur

/*
 * GUIDE RAPIDE:
 *
 * 1. Ouvrir la console du navigateur (F12)
 * 2. Copier-coller ce fichier
 * 3. Exécuter les commandes ci-dessous
 */

// ═══════════════════════════════════════════════════════════
// ÉTAPE 1: LISTER LES AVIONS DISPONIBLES
// ═══════════════════════════════════════════════════════════

async function listerAvions() {
  try {
    // Importer le module
    const { getAvailableAircraftForDuplication } = await import('/src/utils/duplicateAircraft.js');

    const aircrafts = await getAvailableAircraftForDuplication();

    console.log('\n╔════════════════════════════════════════════════════════╗');
    console.log('║           AVIONS DISPONIBLES POUR DUPLICATION          ║');
    console.log('╚════════════════════════════════════════════════════════╝\n');

    console.table(aircrafts.map((a, index) => ({
      'Index': index,
      'ID': a.id.substring(0, 8) + '...',
      'Immatriculation': a.registration,
      'Modèle': a.model,
      'Constructeur': a.manufacturer,
      'Catégorie': a.category,
      'MANEX': a.hasManex ? '✅' : '❌'
    })));

    console.log('\n💡 Pour dupliquer, utilisez: dupliquerAvion(index, nouvelleImmat, nouveauModele)\n');

    // Sauvegarder dans window pour réutilisation
    window.__aircrafts = aircrafts;

    return aircrafts;
  } catch (error) {
    console.error('❌ Erreur:', error);
  }
}

// ═══════════════════════════════════════════════════════════
// ÉTAPE 2: DUPLIQUER UN AVION
// ═══════════════════════════════════════════════════════════

async function dupliquerAvion(sourceIndex, newRegistration, newModel = null, newManufacturer = null) {
  try {
    // Importer le module
    const { duplicateAircraft } = await import('/src/utils/duplicateAircraft.js');

    // Récupérer la liste si elle n'existe pas
    if (!window.__aircrafts) {
      console.log('⏳ Chargement de la liste des avions...');
      await listerAvions();
    }

    const aircrafts = window.__aircrafts;

    if (!aircrafts || !aircrafts[sourceIndex]) {
      console.error('❌ Index invalide. Utilisez listerAvions() pour voir les index disponibles.');
      return;
    }

    const source = aircrafts[sourceIndex];

    console.log('\n╔════════════════════════════════════════════════════════╗');
    console.log('║              DUPLICATION EN COURS...                   ║');
    console.log('╚════════════════════════════════════════════════════════╝\n');

    console.log('📋 Avion source:', source.registration, '-', source.model);
    console.log('🆕 Nouvel avion:', newRegistration, '-', (newModel || source.model));
    console.log('');

    const newDetails = {
      registration: newRegistration,
      model: newModel || source.model,
      manufacturer: newManufacturer || source.manufacturer,
      category: source.category
    };

    const result = await duplicateAircraft(source.id, newDetails);

    console.log('\n✅ SUCCÈS! Avion dupliqué avec succès!\n');
    console.log('Nouvel avion créé:');
    console.table({
      'Immatriculation': result.registration || newRegistration,
      'Modèle': newDetails.model,
      'Constructeur': newDetails.manufacturer,
      'Catégorie': newDetails.category
    });

    console.log('\n💡 L\'avion est maintenant disponible dans votre liste d\'avions.');
    console.log('💡 Vous pouvez le modifier dans l\'éditeur d\'avion.\n');

    // Recharger la liste
    window.__aircrafts = null;

    return result;
  } catch (error) {
    console.error('\n❌ ERREUR lors de la duplication:', error.message);
    console.error('Détails:', error);
  }
}

// ═══════════════════════════════════════════════════════════
// FONCTION HELPER AVANCÉE
// ═══════════════════════════════════════════════════════════

async function dupliquerAvionAvance(sourceIndex, options = {}) {
  try {
    const { duplicateAircraft } = await import('/src/utils/duplicateAircraft.js');

    if (!window.__aircrafts) {
      await listerAvions();
    }

    const source = window.__aircrafts[sourceIndex];

    if (!source) {
      console.error('❌ Index invalide');
      return;
    }

    console.log('\n╔════════════════════════════════════════════════════════╗');
    console.log('║         DUPLICATION AVANCÉE EN COURS...                ║');
    console.log('╚════════════════════════════════════════════════════════╝\n');

    const result = await duplicateAircraft(source.id, options);

    console.log('✅ Duplication avancée terminée!\n');

    return result;
  } catch (error) {
    console.error('❌ Erreur:', error);
  }
}

// ═══════════════════════════════════════════════════════════
// AFFICHER L'AIDE
// ═══════════════════════════════════════════════════════════

function aide() {
  console.log(`
╔═════════════════════════════════════════════════════════════════╗
║           GUIDE DE DUPLICATION D'AVION - AIDE RAPIDE            ║
╚═════════════════════════════════════════════════════════════════╝

📋 COMMANDES DISPONIBLES:
─────────────────────────────────────────────────────────────────

1️⃣ listerAvions()
   → Liste tous les avions disponibles pour duplication

2️⃣ dupliquerAvion(index, newImmat, [newModel], [newManufacturer])
   → Duplique un avion

   Paramètres:
   - index: Index de l'avion source (voir listerAvions)
   - newImmat: Nouvelle immatriculation (ex: 'F-ABCD')
   - newModel: Nouveau modèle (optionnel)
   - newManufacturer: Nouveau constructeur (optionnel)

3️⃣ dupliquerAvionAvance(index, options)
   → Duplication avec options avancées

4️⃣ aide()
   → Affiche cette aide

─────────────────────────────────────────────────────────────────
📝 EXEMPLES:

// Exemple 1: Duplication simple (même modèle)
await listerAvions()
await dupliquerAvion(0, 'F-ABCD')

// Exemple 2: Duplication avec nouveau modèle
await dupliquerAvion(0, 'F-GEEK', 'DR400-180', 'Robin')

// Exemple 3: Duplication avancée
await dupliquerAvionAvance(0, {
  registration: 'F-TECH',
  model: 'PA-28-161',
  manufacturer: 'Piper',
  category: 'SEP',
  overrides: {
    weights: {
      emptyWeight: '650',
      maxWeight: '1157'
    }
  }
})

─────────────────────────────────────────────────────────────────
💡 ASTUCES:

• Les données (masse, centrage, performances) sont copiées
• Vous pouvez modifier l'avion après création dans l'éditeur
• L'immatriculation doit être unique
• La liste des avions est mise en cache (window.__aircrafts)

╚═════════════════════════════════════════════════════════════════╝
  `);
}

// ═══════════════════════════════════════════════════════════
// AUTO-DÉMARRAGE
// ═══════════════════════════════════════════════════════════

console.log('\n🚀 Script de duplication chargé!\n');
aide();

// Exporter les fonctions globalement
if (typeof window !== 'undefined') {
  window.listerAvions = listerAvions;
  window.dupliquerAvion = dupliquerAvion;
  window.dupliquerAvionAvance = dupliquerAvionAvance;
  window.aide = aide;
}
