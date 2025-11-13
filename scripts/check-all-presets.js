/**
 * Script de vérification de tous les presets (tous statuts)
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://bgmscwckawgybymbimga.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJnbXNjd2NrYXdneWJ5bWJpbWdhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk3NTk0MDAsImV4cCI6MjA3NTMzNTQwMH0.2J6nlClW_4GCdKaHrtjbf4AgdbDMpd_6auSzcMQnCMc';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkAllPresets() {
  try {
    // Récupérer TOUS les presets (sans filtre status)
    const { data: allPresets, error } = await supabase
      .from('community_presets')
      .select('id, registration, status, created_at')
      .order('created_at', { ascending: false });

    if (error) throw error;

    console.log(`📊 Total presets (tous statuts): ${allPresets.length}\n`);

    // Grouper par statut
    const byStatus = {};
    allPresets.forEach(preset => {
      const status = preset.status || 'null';
      if (!byStatus[status]) byStatus[status] = [];
      byStatus[status].push(preset);
    });

    console.log('📋 Répartition par statut:\n');
    Object.entries(byStatus).forEach(([status, presets]) => {
      console.log(`   ${status}: ${presets.length} presets`);
      if (presets.length <= 5) {
        presets.forEach(p => {
          console.log(`      - ${p.registration} (${new Date(p.created_at).toLocaleString()})`);
        });
      }
    });

    // Grouper par registration
    const byReg = {};
    allPresets.forEach(preset => {
      if (!byReg[preset.registration]) byReg[preset.registration] = [];
      byReg[preset.registration].push(preset);
    });

    console.log('\n📋 Répartition par registration:\n');
    Object.entries(byReg).forEach(([reg, presets]) => {
      console.log(`   ${reg}: ${presets.length} versions`);
      if (presets.length > 1) {
        presets.forEach((p, i) => {
          console.log(`      ${i + 1}. [${p.status}] ${new Date(p.created_at).toLocaleString()}`);
        });
      }
    });

  } catch (error) {
    console.error('❌ Erreur:', error);
  }
}

checkAllPresets();
