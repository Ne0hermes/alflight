/**
 * Script de test pour vérifier l'intégration Google Sheets
 * Test de mise à jour automatique
 */

import fetch from 'node-fetch';

const SERVER_URL = 'http://localhost:3001';

// Fonction pour envoyer un log de test
async function sendTestLog(action, summary, details) {
  try {
    const response = await fetch(`${SERVER_URL}/api/log`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        action: action,
        component: 'Test Script',
        summary: summary,
        details: typeof details === 'object' ? JSON.stringify(details) : details,
        files: 'testGoogleSheets.js',
        status: 'test'
      })
    });

    if (response.ok) {
      const result = await response.json();
      console.log(`✅ Log envoyé avec succès: ${action}`);
      return result;
    } else {
      console.error(`❌ Erreur lors de l'envoi: ${response.statusText}`);
      return null;
    }
  } catch (error) {
    console.error('❌ Erreur de connexion:', error.message);
    return null;
  }
}

// Fonction principale de test
async function runTests() {
  console.log('\n🚀 Démarrage des tests Google Sheets\n');
  console.log('=' .repeat(50));

  // Test 1: Vérifier la santé du serveur
  console.log('\n📋 Test 1: Vérification du serveur');
  try {
    const healthResponse = await fetch(`${SERVER_URL}/health`);
    const health = await healthResponse.json();
    console.log('✅ Serveur actif:', health);
  } catch (error) {
    console.error('❌ Serveur non accessible:', error.message);
    process.exit(1);
  }

  // Test 2: Envoyer un log simple
  console.log('\n📋 Test 2: Envoi d\'un log simple');
  await sendTestLog(
    'Test Simple',
    'Ceci est un test de base',
    'Test effectué le ' + new Date().toLocaleString('fr-FR')
  );

  // Test 3: Envoyer un log avec des caractères spéciaux
  console.log('\n📋 Test 3: Test avec caractères spéciaux');
  await sendTestLog(
    'Test Spéciaux',
    'Test avec émojis 🚀 et accents éàèùâêîôû',
    {
      emoji: '✨🎉🔥',
      accents: 'àéèùâêîôûç',
      special: '«»€@#&'
    }
  );

  // Test 4: Envoyer plusieurs logs rapidement
  console.log('\n📋 Test 4: Envoi de plusieurs logs');
  for (let i = 1; i <= 3; i++) {
    await sendTestLog(
      `Test Multiple ${i}`,
      `Log numéro ${i} sur 3`,
      { iteration: i, timestamp: Date.now() }
    );
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // Test 5: Log avec beaucoup de données
  console.log('\n📋 Test 5: Log avec données complexes');
  await sendTestLog(
    'Test Complexe',
    'Test avec objet complexe',
    {
      user: {
        name: 'Test User',
        id: 12345,
        email: 'test@example.com'
      },
      aircraft: {
        registration: 'F-TEST',
        type: 'Cessna 172',
        hours: 1234.5
      },
      flight: {
        departure: 'LFPG',
        arrival: 'LFBO',
        duration: '1:30',
        date: new Date().toISOString()
      }
    }
  );

  // Test 6: Test de lecture
  console.log('\n📋 Test 6: Lecture des données');
  try {
    const testResponse = await fetch(`${SERVER_URL}/api/test`);
    const testResult = await testResponse.json();
    console.log('✅ Données lues:', testResult);
  } catch (error) {
    console.error('❌ Erreur de lecture:', error.message);
  }

  console.log('\n' + '=' .repeat(50));
  console.log('✅ Tests terminés avec succès!');
  console.log('📊 Vérifiez votre Google Sheet:');
  console.log('   https://docs.google.com/spreadsheets/d/1Y26_Zf7-jHPgpjWasubXpzQE-k0eMl0pHIMpg8OHw_k');
  console.log('=' .repeat(50) + '\n');
}

// Exécuter les tests
runTests().catch(error => {
  console.error('❌ Erreur fatale:', error);
  process.exit(1);
});