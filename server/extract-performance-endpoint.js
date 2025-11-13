// Endpoint pour extraire les données de performance F-HSTR
import express from 'express';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3005;

const SUPABASE_URL = 'https://lzdnrhrrvacfpkcwhafg.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx6ZG5yaHJydmFjZnBrY3doYWZnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzU1NjM2MzUsImV4cCI6MjA1MTEzOTYzNX0.xA5LXVAe3Q1D3hk5xHbZxkgJmZ8F8IwMHnJ0YvdBNRE';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

app.get('/extract-performance', async (req, res) => {
  console.log('📥 Requête extraction données performance F-HSTR');

  try {
    const { data, error } = await supabase
      .from('aircraft_presets')
      .select('*')
      .eq('registration', 'F-HSTR')
      .single();

    if (error) throw error;

    const aircraft = data.aircraftData || data;
    const table = aircraft.advancedPerformance.tables.find(t =>
      t.table_name.includes('Landing Distance - Flaps LDG')
    );

    if (!table) {
      return res.status(404).send('Tableau Landing Distance - Flaps LDG non trouvé');
    }

    let output = '=== DONNÉES PERFORMANCE F-HSTR - LANDING FLAPS LDG ===\n\n';
    output += `Tableau: ${table.table_name}\n`;
    output += `Points de données: ${table.data.length}\n\n`;

    // Grouper par masse
    const byMass = {};
    table.data.forEach(point => {
      const m = point.Masse;
      if (!byMass[m]) byMass[m] = [];
      byMass[m].push(point);
    });

    const masses = Object.keys(byMass).map(Number).sort((a, b) => a - b);
    output += `Masses disponibles: ${masses.join(', ')} kg\n\n`;

    // Masse 1100 kg
    if (byMass[1100]) {
      output += '--- MASSE 1100 KG (pour calcul avec masse limite) ---\n';
      output += 'Alt(ft) | Temp(°C) | Roulage(m) | 15m(m)\n';
      output += '--------|----------|------------|---------\n';
      byMass[1100].sort((a,b) => a.Altitude - b.Altitude || a.Temperature - b.Temperature).forEach(p => {
        output += `${String(p.Altitude).padStart(7)} | ${String(p.Temperature).padStart(8)} | ${String(p.Distance_roulement).padStart(10)} | ${String(p.Distance_passage_15m).padStart(7)}\n`;
      });
      output += '\n';
    }

    // Masse 1200 kg
    if (byMass[1200]) {
      output += '--- MASSE 1200 KG (pour extrapolation linéaire) ---\n';
      output += 'Alt(ft) | Temp(°C) | Roulage(m) | 15m(m)\n';
      output += '--------|----------|------------|---------\n';
      byMass[1200].sort((a,b) => a.Altitude - b.Altitude || a.Temperature - b.Temperature).forEach(p => {
        output += `${String(p.Altitude).padStart(7)} | ${String(p.Temperature).padStart(8)} | ${String(p.Distance_roulement).padStart(10)} | ${String(p.Distance_passage_15m).padStart(7)}\n`;
      });
      output += '\n';
    }

    output += '\n=== CONDITIONS DE TEST ===\n';
    output += 'Masse: 960.1 kg (< 1100 kg minimum tableau)\n';
    output += 'Altitude: 505 ft\n';
    output += 'Température: 7°C\n\n';

    output += 'CALCUL:\n';
    output += '1. Interpolation 3D pour masse 1100 kg à (505 ft, 7°C)\n';
    output += '2. Interpolation 3D pour masse 1200 kg à (505 ft, 7°C)\n';
    output += '3. Extrapolation linéaire entre les 2 points pour 960.1 kg\n';

    // Sauvegarder aussi dans un fichier
    const outputPath = path.join(__dirname, '..', 'performance-data-fhstr.txt');
    fs.writeFileSync(outputPath, output, 'utf8');

    console.log('✅ Données extraites et sauvegardées dans:', outputPath);

    // Envoyer comme téléchargement
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="performance-data-fhstr.txt"');
    res.send(output);

  } catch (error) {
    console.error('❌ Erreur extraction:', error);
    res.status(500).send('Erreur: ' + error.message);
  }
});

app.listen(PORT, () => {
  console.log(`\n🚀 Serveur extraction performance démarré sur http://localhost:${PORT}`);
  console.log(`📥 Pour télécharger: http://localhost:${PORT}/extract-performance\n`);
});
