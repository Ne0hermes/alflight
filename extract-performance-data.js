// Script Node.js pour extraire les données de performance depuis Supabase
// Usage: node extract-performance-data.js

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const SUPABASE_URL = 'https://lzdnrhrrvacfpkcwhafg.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx6ZG5yaHJydmFjZnBrY3doYWZnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzU1NjM2MzUsImV4cCI6MjA1MTEzOTYzNX0.xA5LXVAe3Q1D3hk5xHbZxkgJmZ8F8IwMHnJ0YvdBNRE';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function extractData() {
  console.log('🔍 Chargement des données F-HSTR depuis Supabase...');

  try {
    const { data, error } = await supabase
      .from('aircraft_presets')
      .select('*')
      .eq('registration', 'F-HSTR')
      .single();

    if (error) throw error;

    const aircraft = data.aircraftData || data;
    const tables = aircraft.advancedPerformance?.tables || [];

    console.log(`✅ Trouvé ${tables.length} tableaux de performance`);

    // Filtrer les tableaux Landing Flaps LDG
    const landingTables = tables.filter(t =>
      t.table_type === 'landing' && t.table_name.includes('Flaps LDG')
    );

    console.log(`✅ Trouvé ${landingTables.length} tableaux Landing Flaps LDG`);

    let output = '=== TABLEAUX DE PERFORMANCE F-HSTR - LANDING FLAPS LDG ===\n\n';

    landingTables.forEach((table, idx) => {
      output += `\n=== TABLEAU ${idx + 1}: ${table.table_name} ===\n`;
      output += `Type: ${table.table_type}\n`;
      output += `Points de données: ${table.data?.length || 0}\n\n`;

      if (table.data && table.data.length > 0) {
        // Grouper par masse
        const byMass = {};
        table.data.forEach(point => {
          const m = point.Masse;
          if (!byMass[m]) byMass[m] = [];
          byMass[m].push(point);
        });

        const masses = Object.keys(byMass).map(Number).sort((a, b) => a - b);
        output += `Masses disponibles: ${masses.join(', ')} kg\n\n`;

        // Afficher les points pour masse 1100 kg (pour interpolation à 960.1 kg)
        const mass1100 = byMass[1100];
        if (mass1100) {
          output += '--- POINTS POUR MASSE 1100 KG ---\n';
          output += 'Alt(ft) | Temp(°C) | Roulage(m) | Passage 15m(m)\n';
          output += '--------|----------|------------|--------------\n';

          mass1100
            .sort((a, b) => {
              if (a.Altitude !== b.Altitude) return a.Altitude - b.Altitude;
              return a.Temperature - b.Temperature;
            })
            .forEach(p => {
              output += `${String(p.Altitude).padStart(7)} | ${String(p.Temperature).padStart(8)} | ${String(p.Distance_roulement).padStart(10)} | ${String(p.Distance_passage_15m).padStart(12)}\n`;
            });
          output += '\n';
        }

        // Afficher les points pour masse 1200 kg (pour extrapolation)
        const mass1200 = byMass[1200];
        if (mass1200) {
          output += '--- POINTS POUR MASSE 1200 KG ---\n';
          output += 'Alt(ft) | Temp(°C) | Roulage(m) | Passage 15m(m)\n';
          output += '--------|----------|------------|--------------\n';

          mass1200
            .sort((a, b) => {
              if (a.Altitude !== b.Altitude) return a.Altitude - b.Altitude;
              return a.Temperature - b.Temperature;
            })
            .forEach(p => {
              output += `${String(p.Altitude).padStart(7)} | ${String(p.Temperature).padStart(8)} | ${String(p.Distance_roulement).padStart(10)} | ${String(p.Distance_passage_15m).padStart(12)}\n`;
            });
          output += '\n';
        }
      }
    });

    // Sauvegarder dans un fichier
    const filename = 'performance-data-fhstr.txt';
    fs.writeFileSync(filename, output, 'utf8');

    console.log(`\n✅ Données sauvegardées dans: ${filename}`);
    console.log('📄 Ouvre ce fichier avec Notepad pour voir les données');

    // Aussi sauvegarder le JSON complet
    const jsonFilename = 'performance-data-fhstr.json';
    fs.writeFileSync(jsonFilename, JSON.stringify(landingTables[0].data, null, 2), 'utf8');
    console.log(`✅ JSON complet sauvegardé dans: ${jsonFilename}`);

  } catch (error) {
    console.error('❌ Erreur:', error.message);
    process.exit(1);
  }
}

extractData();
