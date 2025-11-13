// Script pour corriger cgLimits et cgEnvelope de F-HSTR avec les VRAIES valeurs
import fetch from 'node-fetch';

const SUPABASE_URL = 'https://yawivlfiebsemtsxgmqz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlhd2l2bGZpZWJzZW10c3hnbXF6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjgxNTE5NjcsImV4cCI6MjA0MzcyNzk2N30.QX5c9P7WUTQg5rHTTMp0D57HWmRxQXlNqHIGksMO-hY';

async function fixFHSTRCgLimits() {
  console.log('\n🔧 Correction cgLimits F-HSTR avec VRAIES valeurs...\n');

  const correctData = {
    cgEnvelope: {
      forwardPoints: [
        { mass: 780, cg: 2.40 },   // 780-980kg: CG avant = 2.40
        { mass: 980, cg: 2.40 },   // Point intermédiaire
        { mass: 1150, cg: 2.46 }   // 980-1150kg: CG avant = 2.46
      ],
      aftCG: 2.59                  // Limite arrière FIXE = 2.59
    },
    cgLimits: {
      forward: 2.40,               // Limite avant la plus restrictive
      aft: 2.59                    // Limite arrière
    }
  };

  console.log('📊 Données correctes pour F-HSTR:');
  console.log(JSON.stringify(correctData, null, 2));

  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/aircraft?registration=eq.F-HSTR`, {
      method: 'PATCH',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(correctData)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Erreur HTTP:', response.status, errorText);
      return;
    }

    const data = await response.json();
    console.log('\n✅ Résultat mise à jour:', data);
    console.log('\n✅ cgEnvelope et cgLimits corrigés avec succès!');
    console.log('\n⚠️  IMPORTANT: Videz IndexedDB dans la console navigateur:');
    console.log('   indexedDB.deleteDatabase("alflight-aircraft-db")');
    console.log('   Puis rechargez la page\n');

  } catch (error) {
    console.error('❌ Erreur:', error.message);
    console.log('\n💡 Si erreur réseau, utilisez le script console ci-dessous:\n');
    console.log('--- SCRIPT CONSOLE (à copier dans F12) ---');
    console.log(`
(async function() {
  const url = '${SUPABASE_URL}';
  const key = '${SUPABASE_ANON_KEY}';

  const response = await fetch(url + '/rest/v1/aircraft?registration=eq.F-HSTR', {
    method: 'PATCH',
    headers: {
      'apikey': key,
      'Authorization': 'Bearer ' + key,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify({
      cgEnvelope: {
        forwardPoints: [
          { mass: 780, cg: 2.40 },
          { mass: 980, cg: 2.40 },
          { mass: 1150, cg: 2.46 }
        ],
        aftCG: 2.59
      },
      cgLimits: {
        forward: 2.40,
        aft: 2.59
      }
    })
  });

  const data = await response.json();
  console.log('✅ Résultat:', data);

  indexedDB.deleteDatabase('alflight-aircraft-db').onsuccess = () => {
    console.log('✅ IndexedDB vidée');
    alert('✅ cgLimits F-HSTR corrigés! Rechargez (Ctrl+R)');
  };
})();
    `);
  }
}

fixFHSTRCgLimits();
