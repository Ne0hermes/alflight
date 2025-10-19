/**
 * Test manuel d'envoi d'un log vers Google Sheets
 */

async function testLog() {
  console.log('🧪 Test d\'envoi de log vers Google Sheets...\n');

  const logEntry = {
    action: 'TEST_MANUAL',
    component: '/test',
    summary: 'Test manuel depuis script',
    details: JSON.stringify({ test: 'valeur', timestamp: new Date().toISOString() }),
    files: 'test-google-sheets-log.js',
    status: 'completed',
    timestamp: new Date().toISOString()
  };

  try {
    const response = await fetch('http://localhost:3001/api/log', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(logEntry)
    });

    if (response.ok) {
      const result = await response.json();
      console.log('✅ Log envoyé avec succès!');
      console.log('📊 Résultat:', result);
      console.log('\n🔗 Vérifiez dans Google Sheets:');
      console.log('   https://docs.google.com/spreadsheets/d/1Y26_Zf7-jHPgpjWasubXpzQE-k0eMl0pHIMpg8OHw_k');
    } else {
      console.error('❌ Erreur:', response.status, response.statusText);
      const text = await response.text();
      console.error('   Détails:', text);
    }
  } catch (error) {
    console.error('❌ Erreur de connexion:', error.message);
    console.log('💡 Vérifiez que le serveur tourne sur http://localhost:3001');
  }
}

testLog();
