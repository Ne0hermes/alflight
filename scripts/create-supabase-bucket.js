// Script pour créer le bucket Supabase Storage pour les MANEX
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Charger les variables d'environnement
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Variables d\'environnement Supabase manquantes');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function createBucket() {
  try {
    console.log('🚀 Création du bucket Supabase Storage...');
    console.log('📍 URL:', SUPABASE_URL);

    // Vérifier si le bucket existe déjà
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();

    if (listError) {
      console.error('❌ Erreur lors de la liste des buckets:', listError);
      throw listError;
    }

    console.log('📦 Buckets existants:', buckets.map(b => b.name));

    const bucketExists = buckets.some(bucket => bucket.name === 'manex-files');

    if (bucketExists) {
      console.log('✅ Le bucket "manex-files" existe déjà!');
      return;
    }

    // Créer le bucket
    console.log('📤 Création du bucket "manex-files"...');

    const { data, error } = await supabase.storage.createBucket('manex-files', {
      public: true, // Fichiers publiquement accessibles
      fileSizeLimit: 52428800, // 50 MB max
      allowedMimeTypes: ['application/pdf'] // Seulement les PDFs
    });

    if (error) {
      console.error('❌ Erreur lors de la création du bucket:', error);
      throw error;
    }

    console.log('✅ Bucket "manex-files" créé avec succès!', data);
    console.log('📁 Configuration:');
    console.log('   - Public: true');
    console.log('   - Taille max: 50 MB');
    console.log('   - Types autorisés: application/pdf');
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

createBucket();
