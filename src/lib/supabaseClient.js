// src/lib/supabaseClient.js
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Variables d\'environnement Supabase manquantes!');
  console.error('VITE_SUPABASE_URL:', supabaseUrl ? '✓' : '✗');
  console.error('VITE_SUPABASE_ANON_KEY:', supabaseAnonKey ? '✓' : '✗');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false // Pas de session auth pour l'instant (public)
  },
  db: {
    schema: 'public'
  },
  global: {
    headers: {
      'X-Client-Info': 'alflight-vac-module'
    }
  }
});

// Fonction helper pour vérifier la connexion
export async function checkSupabaseConnection() {
  try {
    const { data, error } = await supabase
      .from('vac_charts')
      .select('count')
      .limit(1);

    if (error) {
      console.error('❌ Erreur connexion Supabase:', error.message);
      return false;
    }

    console.log('✅ Connexion Supabase OK');
    return true;
  } catch (error) {
    console.error('❌ Erreur test connexion Supabase:', error);
    return false;
  }
}

export default supabase;
