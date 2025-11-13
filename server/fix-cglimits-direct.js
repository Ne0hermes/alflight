// server/fix-cglimits-direct.js
// Script backend pour corriger cgLimits F-HSTR (contourne CORS)

import fetch from 'node-fetch';

const SUPABASE_URL = 'https://yawivlfiebsemtsxgmqz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlhd2l2bGZpZWJzZW10c3hnbXF6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjgxNTE5NjcsImV4cCI6MjA0MzcyNzk2N30.QX5c9P7WUTQg5rHTTMp0D57HWmRxQXlNqHIGksMO-hY';

async function fixCgLimits() {
  console.log('\n🔧 Correction cgLimits F-HSTR via backend...\n');

  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/aircraft?registration=eq.F-HSTR`, {
      method: 'PATCH',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({
        cgLimits: {
          forward: 2.05,
          aft: 2.31
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Erreur HTTP:', response.status, errorText);
      return;
    }

    const data = await response.json();
    console.log('✅ Résultat:', data);
    console.log('\n✅ cgLimits ajoutés avec succès pour F-HSTR');
    console.log('\n⚠️  IMPORTANT: Videz IndexedDB dans la console navigateur:');
    console.log('   indexedDB.deleteDatabase("alflight-aircraft-db")');
    console.log('   Puis rechargez la page\n');

  } catch (error) {
    console.error('❌ Erreur:', error.message);
  }
}

fixCgLimits();
