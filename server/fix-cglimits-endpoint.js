// Endpoint backend pour corriger cgLimits F-HSTR
import express from 'express';
import fetch from 'node-fetch';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

const SUPABASE_URL = 'https://yawivlfiebsemtsxgmqz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlhd2l2bGZpZWJzZW10c3hnbXF6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjgxNTE5NjcsImV4cCI6MjA0MzcyNzk2N30.QX5c9P7WUTQg5rHTTMp0D57HWmRxQXlNqHIGksMO-hY';

// Endpoint pour corriger cgLimits
app.post('/fix-cglimits', async (req, res) => {
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

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Erreur Supabase:', response.status, errorText);
      return res.status(response.status).json({ error: errorText });
    }

    const data = await response.json();
    console.log('✅ Supabase mis à jour:', data);

    res.json({
      success: true,
      message: 'cgLimits corrigés avec succès',
      data: data
    });

  } catch (error) {
    console.error('❌ Erreur:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Page HTML pour tester
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Fix cgLimits F-HSTR</title>
      <style>
        body { font-family: monospace; padding: 20px; background: #1e1e1e; color: #d4d4d4; }
        button { background: #0e639c; color: white; border: none; padding: 15px 30px; font-size: 18px; cursor: pointer; border-radius: 4px; margin: 20px 0; }
        button:hover { background: #1177bb; }
        pre { background: #252526; padding: 15px; border-radius: 4px; white-space: pre-wrap; }
        .warning { background: #433715; border-left: 4px solid #f59e0b; padding: 15px; margin: 15px 0; }
      </style>
    </head>
    <body>
      <h1>🔧 Correction cgLimits F-HSTR (Backend)</h1>

      <div class="warning">
        <strong>⚠️ VALEURS ACTUELLES FAUSSES:</strong><br>
        forward: 2.05 → devrait être 2.40 (35cm d'erreur!)<br>
        aft: 2.31 → devrait être 2.59 (28cm d'erreur!)
      </div>

      <button onclick="fix()">✅ CORRIGER VIA BACKEND</button>

      <pre id="log">Prêt à corriger...</pre>

      <script>
        async function fix() {
          const log = document.getElementById('log');
          log.textContent = '⏳ Envoi requête au backend...';

          try {
            const response = await fetch('http://localhost:3005/fix-cglimits', {
              method: 'POST'
            });

            const result = await response.json();

            if (result.success) {
              log.textContent = '✅ Supabase mis à jour!\\n\\n' + JSON.stringify(result.data, null, 2);
              alert('✅ SUCCÈS!\\n\\nLimites AVANT: 2.05 → 2.40 ✅\\nLimites ARRIÈRE: 2.31 → 2.59 ✅\\n\\nMaintenant:\\n1. Ouvrez votre app (localhost:4001)\\n2. Console (F12)\\n3. Tapez: indexedDB.deleteDatabase("alflight-aircraft-db")\\n4. Rechargez (Ctrl+R)');
            } else {
              log.textContent = '❌ Erreur: ' + JSON.stringify(result, null, 2);
            }

          } catch (error) {
            log.textContent = '❌ Erreur: ' + error.message;
          }
        }
      </script>
    </body>
    </html>
  `);
});

const PORT = 3005;
app.listen(PORT, () => {
  console.log(`\n✅ Serveur de correction cgLimits démarré sur http://localhost:${PORT}`);
  console.log(`📝 Ouvrez http://localhost:${PORT} dans votre navigateur\n`);
});
